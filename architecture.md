# Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    BLOCKCHAIN P2P FILE TRANSFER                 │
│                                                                 │
├──────────────────────────┬──────────────────────────────────────┤
│                          │                                      │
│      SENDER CLIENT       │       RECEIVER CLIENT                │
│   (React + Vite)         │      (React + Vite)                  │
│                          │                                      │
│  ┌────────────────────┐  │  ┌────────────────────┐              │
│  │ MetaMask Wallet    │  │  │ MetaMask Wallet    │              │
│  │ Authentication     │  │  │ Authentication     │              │
│  └────────────────────┘  │  └────────────────────┘              │
│           ▼              │           ▼                          │
│  ┌────────────────────┐  │  ┌────────────────────┐              │
│  │ Crypto Service     │  │  │ Crypto Service     │              │
│  │ (AES-256-GCM)      │  │  │ (AES-256-GCM)      │              │
│  └────────────────────┘  │  └────────────────────┘              │
│           │              │           │                         │
│           ▼              │           ▼                         │
│  ┌──────────────────────────────────────────┐                  │
│  │   WebRTC Data Channel (Encrypted Data)   │◄─────────────┐   │
│  └──────────────────────────────────────────┘              │   │
│           │              │           │                    │    │
└───────────┼──────────────┼───────────┼────────────────────┼────┘
            │              │           │                    │
            │         ┌────┴───────────┴────┐               │
            │         │                     │               │
            │         ▼                     ▼               │
            │    ┌──────────────────────────────┐           │
            │    │   WebSocket Signaling Server │           │
            │    │   (Peer Discovery & SDP)     │           │
            │    └──────────────────────────────┘           │
            │         │                     ▲               │
            │         │ Offer/Answer/ICE    │               │
            │         │ (SDP Only)          │               │
            └─────────┼─────────────────────┘               │
                      │                                     │
                      ▼                                     │
            ┌──────────────────────┐                        │
            │  Polygon Mumbai      │                        │
            │  Smart Contract      │                        │
            │  (FileRegistry)      │                        │
            │                      │                        │
            │ ┌────────────────┐   │                        │
            │ │ File Hash      │   │                        │
            │ │ (SHA-256)      │   │                        │
            │ │                │   │                        │
            │ │ Sender Address │   │                        │
            │ │ Timestamp      │   │                        │
            │ └────────────────┘   │                        │
            │                      │                        │
            └──────────────────────┘                        │
                      ▲                                     │
                      │ Verify Hash                         │
                      │ (Read-only)                         │
                      └─────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend (React + Vite)

#### Application State Management

```
┌─────────────────┐
│ WalletContext   │ <- MetaMask account, signer, network
└────────┬────────┘
         │
    ┌────┴──────────────────────┐
    │                           │
┌───▼──────────┐      ┌────────▼────┐
│ useBlockchain│      │  useSocket  │
│              │      │             │
│ - Register   │      │ - Connect   │
│ - Verify     │      │ - Send SDP  │
│ - Gas Est.   │      │ - Route ICE │
└──────────────┘      └─────────────┘
                            │
                      ┌─────▼──────┐
                      │  useWebRTC  │
                      │             │
                      │ - Offer     │
                      │ - Answer    │
                      │ - ICE Cand. │
                      │ - Send Data │
                      └─────────────┘
```

#### Component Hierarchy

```
App.jsx
├── WalletConnect
│   └── MetaMask Integration
├── FileUploader (Sender Mode)
│   └── File Selection & Drag-Drop
├── TransferReceiver (Receiver Mode)
│   └── Peer Selection
├── ProgressBar
│   └── Transfer Progress
└── StatusDisplay
    ├── Connection Status
    └── Error Messages
```

### 2. Backend Services

#### Crypto Service
```javascript
generateEncryptionKey()      // Generate AES-256 key
generateIV()                // Generate 12-byte IV
encrypt(data, key, iv)      // AES-256-GCM encryption
decrypt(encryptedData, key) // AES-256-GCM decryption
exportKey(key)              // Export key for transmission
importKey(keyData)          // Import received key
```

#### Blockchain Service
```javascript
registerFile(fileHash)      // Store hash on blockchain
verifyFile(fileHash)        // Check if hash exists
fileExists(fileHash)        // Boolean check
getFileRecord(fileHash)     // Get sender + timestamp
getNetwork()                // Get current network info
estimateGas(fileHash)       // Estimate registration cost
```

#### Socket Service
```javascript
connect(walletAddress, peerId)     // Connect to signaling server
disconnect()                      // Disconnect
sendOffer(to, offer)             // Send WebRTC offer
sendAnswer(to, answer)           // Send WebRTC answer
sendIceCandidate(to, candidate)  // Send ICE candidate
on(type, callback)               // Listen for messages
getConnectedPeers()              // Get available peers
```

### 3. Smart Contract

#### FileRegistry.sol State

```solidity
mapping(bytes32 => FileRecord) public files
mapping(address => bytes32[]) public userFiles

struct FileRecord {
    address sender;
    uint256 timestamp;
    bool exists;
}
```

#### Key Functions

```solidity
function registerFile(bytes32 fileHash)
  - Prevents duplicate registration
  - Emits FileRegistered event
  - Stores sender address and timestamp

function verifyFile(bytes32 fileHash) returns (bool, address, uint256)
  - Returns existence status
  - Returns original sender
  - Returns registration timestamp
  - Emits FileVerified event

function fileExists(bytes32 fileHash) returns (bool)
  - Quick existence check

function getUserFiles(address user)
  - Get all files registered by user

function getUserFileCount(address user)
  - Get count of files by user
```

### 4. Signaling Server

#### Message Flow

```
Client A          Signaling Server      Client B
  │                    │                  │
  │─── JOIN ──────────►│                  │
  │                    │                  │
  │                    │◄─── JOIN ────────│
  │                    │                  │
  │ (Generates Offer)  │                  │
  │                    │                  │
  │─── OFFER ─────────►│─── OFFER ───────►│
  │                    │                  │
  │                    │         (Generates Answer)
  │                    │                  │
  │◄─── ANSWER ────────│◄─── ANSWER ──────│
  │                    │                  │
  │ (ICE Candidates)   │                  │
  │                    │                  │
  │─── ICE_CANDIDATE ─►│─ ICE_CANDIDATE ─►│
  │                    │                  │
  │◄─ ICE_CANDIDATE ───│◄─ ICE_CANDIDATE ─│
  │                    │                  │
  │                    │  WebRTC Data Channel Established
  │                    │                  │
  │◄════════════════════════════════════════════► (Direct P2P)
  │       Encrypted File Transfer (No ServerInvolvement)
  │
```

## Data Flow

### File Transfer (Sender → Receiver)

1. **Preparation**
   - Read file from disk
   - Generate random 256-bit AES key
   - Generate 12-byte IV
   - Encrypt entire file with AES-256-GCM

2. **Blockchain Registration**
   - Calculate SHA-256 of encrypted file
   - Call `FileRegistry.registerFile(hash)`
   - Wait for transaction confirmation

3. **P2P Connection**
   - Create WebRTC peer connection
   - Generate SDP offer
   - Send offer through signaling server
   - Receive answer from peer
   - Exchange ICE candidates
   - Establish data channel

4. **File Transfer**
   - Split encrypted file into 64KB chunks
   - Send each chunk through data channel
   - Send metadata with:
     - File name
     - Original file size
     - Encrypted file hash
     - Decryption key (encrypted if needed)
     - IV for decryption

### File Verification (Receiver → Blockchain)

1. **Chunk Reception**
   - Receive encrypted chunks from peer
   - Reassemble into complete encrypted file

2. **Hash Calculation**
   - Calculate SHA-256 of complete encrypted file
   - Compare with hash from blockchain

3. **Verification**
   - If hash matches: decryption can proceed
   - If hash mismatches: reject file, alert sender

4. **Decryption**
   - Use received key and IV
   - Decrypt file with AES-256-GCM
   - Save to local disk

## Security Model

### End-to-End Encryption

```
File → AES-256-GCM → Encrypted File → Transfer → Encrypted File → AES-256-GCM → File
(Plain) (key, IV)   (chunks)         (P2P)      (reassembled)  (Received key) (Plain)
```

### Hash Chain

```
Original File
     ▼
Encrypt (AES-256)
     ▼
Encrypted File
     ▼
SHA-256 Hash
     ▼
Register on Blockchain
     ▼
Receiver receives file
     ▼
Recalculate SHA-256
     ▼
Compare with blockchain hash
     ▼
If match: Decrypt | If mismatch: Reject
```

### Session Key Exchange

Current implementation uses direct key transmission. For production:

```
Sender                          Receiver
  │
  ├─ Generate ECDH key pair
  │
  ├─ Send Public Key via Socket ──► │
  │                                  ├─ Generate ECDH key pair
  │                                  │
  │◄─ Receive Public Key ────────────┤
  │
  ├─ Calculate Shared Secret (ECDH)
  │                                  ├─ Calculate Shared Secret (ECDH)
  │
  └─ Both derive same session key
```

## Network Flow

### Addresses and Connections

```
Sender (192.168.1.100)
  └─ WebSocket ──────► Signaling Server (52.1.2.3:8080)
                        ▲
                        │ WebSocket
                        │
Receiver (192.168.1.101)

After Signaling:

Sender (192.168.1.100)
  ├─ WebRTC Data Channel ──────► Receiver (192.168.1.101)
  │  (via NAT/Firewall)
  │
  └─ Encrypted File Chunks (P2P)
```

### Firewall/NAT Traversal

- **STUN Servers**: Discover public IP:port
- **ICE Candidates**: Support multiple connection paths
- **Fallback**: If P2P fails, could implement relay (not in this version)

## Deployment Architecture

### Local Development

```
Developer Machine
├── Frontend Dev Server (5173)
├── Signaling Server (8080)
├── Hardhat Local Node (8545)
└── MetaMask (Localhost Network)
```

### Production

```
Internet
├── Frontend (Static hosting / CDN)
├── Signaling Server (VPS)
└── Smart Contract (Polygon Mainnet)

No file server needed!
```

## Performance Considerations

### Chunk Size Strategy

- **64 KB chunks**: Balance between memory and speed
- **Too large**: Memory issues, error recovery difficult
- **Too small**: More overhead, slower transfer

### Memory Usage

```
File Size    Chunks    Memory (Peak)
1 MB         16        ~128 KB (1 chunk + reassembly buffer)
100 MB       1600      ~128 KB (same, streaming)
1 GB         16384     ~128 KB (same, streaming)
```

### Network Optimization

- **Compression**: File compression before encryption (future)
- **Chunking**: Allows pause/resume (future)
- **Parallel**: Multiple files in sequence (future)

## Error Handling

### Levels

1. **Wallet Errors**: Connection, switching networks
2. **Crypto Errors**: Encryption/decryption failures
3. **Blockchain Errors**: Transaction failures, gas limits
4. **Network Errors**: Socket disconnection, P2P failure
5. **Transfer Errors**: Chunk loss, timeout, hash mismatch

### Recovery Strategies

```
Error Type          Recovery
─────────────────────────────────────────
Network Error   → Reconnect to signaling
Connection Drop → Reinitialize WebRTC
Hash Mismatch   → Resend chunks
Chunk Timeout   → Retransmit chunk
Wallet Changed  → Refresh connection
```

## Scalability Limits

Current design supports:

- **Concurrent Users**: Limited by signaling server (could handle 10k+)
- **Max File Size**: 1 GB (adjustable)
- **Simultaneous Transfers**: 1 per user (modifiable)
- **Peers Discovery**: O(n) broadcast to all peers

Future improvements:

- [ ] Chunk caching for P2P network
- [ ] File directory service
- [ ] Reputation system
- [ ] Bandwidth prioritization
- [ ] Distributed indexing

---

**For questions or improvements, open an issue on GitHub.**

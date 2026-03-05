# 🔧 Developer Quick Reference

## Project Commands

### Installation
```bash
# All at once
npm install

# Or individually
cd frontend && npm install
cd ../smart-contract && npm install
cd ../signaling-server && npm install
```

### Frontend Development
```bash
cd frontend

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Smart Contract
```bash
cd smart-contract

# Compile contracts
npm run compile

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Deploy to different networks
npm run deploy:localhost      # Local Hardhat
npm run deploy:mumbai         # Polygon Mumbai
npm run deploy:polygon        # Polygon Mainnet

# Start local node
npm run node
```

### Signaling Server
```bash
cd signaling-server

# Production start
npm start

# Development with auto-reload
npm run dev

# Check health
curl http://localhost:8080/health

# Get connected peers
curl http://localhost:8080/peers
```

---

## Directory Guide

### Frontend Files
```
frontend/src/
├── App.jsx                 # Main app component
├── main.jsx               # Entry point
├── index.css              # Global styles
│
├── components/            # UI Components
│   ├── WalletConnect.jsx
│   ├── FileUploader.jsx
│   ├── TransferReceiver.jsx
│   ├── ProgressBar.jsx
│   └── StatusDisplay.jsx
│
├── hooks/                 # Custom React Hooks
│   ├── useWebRTC.js      # WebRTC connection
│   ├── useEncryption.js  # Crypto operations
│   ├── useBlockchain.js  # Smart contract
│   └── useSocket.js      # WebSocket comms
│
├── services/              # Business Logic
│   ├── cryptoService.js  # AES-256-GCM
│   ├── blockchainService.js  # Contract calls
│   └── socketService.js  # WebSocket client
│
├── utils/                 # Helper Functions
│   ├── constants.js      # App constants
│   ├── hashFile.js       # SHA-256 hashing
│   └── chunkFile.js      # File chunking
│
└── context/
    └── WalletContext.jsx # Wallet state
```

### Smart Contract Files
```
smart-contract/
├── contracts/
│   └── FileRegistry.sol  # Main contract
├── scripts/
│   └── deploy.js         # Deployment
├── test/
│   └── FileRegistry.test.js  # Tests
├── hardhat.config.js     # Configuration
└── artifacts/            # Compiled ABIs (generated)
```

### Signaling Server
```
signaling-server/
├── server.js             # Main server
└── package.json
```

---

## Configuration Files

### Frontend .env
```env
# Copy frontend/.env.example → frontend/.env
VITE_SIGNALING_SERVER_URL=ws://localhost:8080
VITE_FILE_REGISTRY_ADDRESS=0x...
VITE_NETWORK_ID=80001
VITE_POLYGON_RPC=https://rpc-mumbai.maticvigil.com
```

### Smart Contract .env
```env
# Copy smart-contract/.env.example → smart-contract/.env
PRIVATE_KEY=your_private_key_here
POLYGONSCAN_API_KEY=your_api_key
```

### Signaling Server .env
```env
# Copy signaling-server/.env.example → signaling-server/.env
PORT=8080
NODE_ENV=development
```

---

## Architecture Quick Reference

### Key Components

**Encryption: AES-256-GCM**
- 256-bit key
- 12-byte IV
- 16-byte authentication tag

```javascript
const key = await generateEncryptionKey()
const iv = generateIV()
const encrypted = await encrypt(fileData, key, iv)
const decrypted = await decrypt(encrypted, key)
```

**Hashing: SHA-256**
```javascript
const hash = await hashFile(fileData)  // 64-char hex string
```

**Blockchain: FileRegistry.sol**
```solidity
registerFile(bytes32 hash)   // Store hash
verifyFile(bytes32 hash)     // Check existence
fileExists(bytes32 hash)     // Boolean check
```

**P2P: WebRTC**
```javascript
const pc = new RTCPeerConnection()
const offer = await pc.createOffer()
const answer = await pc.createAnswer()
const channel = pc.createDataChannel('file-transfer')
```

---

## API Reference

### Crypto Service
```javascript
import { 
  generateEncryptionKey,
  generateIV,
  encrypt,
  decrypt,
  exportKey,
  importKey,
  hashFile
} from './services/cryptoService'

// Generate key
const key = await generateEncryptionKey()

// Encrypt
const iv = generateIV()
const encrypted = await encrypt(data, key, iv)

// Decrypt
const decrypted = await decrypt(encrypted, key)

// Export/Import for transmission
const keyData = await exportKey(key)
const importedKey = await importKey(keyData)
```

### Blockchain Service
```javascript
import { BlockchainService } from './services/blockchainService'

const blockchain = new BlockchainService(contractAddress, signer, chainId)

// Register file
await blockchain.registerFile(fileHash)

// Verify file
const result = await blockchain.verifyFile(fileHash)
// Returns: { exists, sender, timestamp }

// Check existence
const exists = await blockchain.fileExists(fileHash)

// Get network info
const network = await blockchain.getNetwork()

// Get gas estimate
const gas = await blockchain.estimateGas(fileHash)
```

### Socket Service
```javascript
import { SocketService } from './services/socketService'

const socket = new SocketService(signalingServerUrl)

// Connect
await socket.connect(walletAddress, peerId)

// Send messages
socket.sendOffer(to, offer)
socket.sendAnswer(to, answer)
socket.sendIceCandidate(to, candidate)

// Listen for messages
socket.on('OFFER', (data) => {})
socket.on('ANSWER', (data) => {})
socket.on('ICE_CANDIDATE', (data) => {})

// Get status
socket.isConnectedToServer()
const peers = await socket.getConnectedPeers()
```

---

## React Hooks

### useEncryption
```javascript
const {
  encryptionKey,
  isLoading,
  error,
  generateKey,
  encryptFile,
  decryptFile,
  exportKeyForTransfer,
  importKeyFromTransfer,
  clearKey
} = useEncryption()
```

### useBlockchain
```javascript
const {
  blockchain,
  isVerified,
  isRegistering,
  error,
  txHash,
  initialize,
  registerFileHash,
  verifyFileHash,
  checkFileExists,
  getNetwork,
  getSignerAddress,
  getContractAddress,
  estimateGasCost
} = useBlockchain()
```

### useWebRTC
```javascript
const {
  status,
  isConnected,
  error,
  progress,
  initializePeerConnection,
  createOffer,
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  sendData,
  onDataReceived,
  closeConnection,
  updateProgress,
  peerConnection,
  dataChannel
} = useWebRTC(socketService)
```

### useSocket
```javascript
const {
  socket,
  isConnected,
  peers,
  error,
  connect,
  disconnect,
  sendOffer,
  sendAnswer,
  sendIceCandidate,
  on,
  off,
  refreshPeers,
  checkHealth
} = useSocket(signalingServerUrl)
```

---

## Common Tasks

### Add a New Component
```bash
cd frontend/src/components
# Copy existing component, modify as needed
# Import in App.jsx
```

### Deploy Smart Contract to New Network
```bash
# 1. Add network to hardhat.config.js
# 2. Create .env with PRIVATE_KEY
# 3. Run deployment
npm run deploy:your_network
```

### Debug WebRTC Connection
```javascript
// In console
const pc = window.peerConnection
pc.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'inbound-rtp') {
      console.log('Received:', report.bytesReceived)
    }
  })
})
```

### Test Signaling Server
```bash
# Check health
curl http://localhost:8080/health

# Get connected peers
curl http://localhost:8080/peers

# Monitor logs
# Check terminal where npm start was run
```

### Verify Smart Contract on PolygonScan
```bash
# After deployment
cd smart-contract

# Verify automatically
npx hardhat verify --network polygon_mumbai \
  0x<CONTRACT_ADDRESS> \
  --api-key <POLYGONSCAN_API_KEY>
```

---

## Environment Variables

### Frontend
```
VITE_SIGNALING_SERVER_URL     # WebSocket server URL
VITE_FILE_REGISTRY_ADDRESS    # Deployed contract address
VITE_NETWORK_ID               # Chain ID (80001 for Mumbai)
VITE_POLYGON_RPC              # RPC endpoint
```

### Smart Contract
```
PRIVATE_KEY                   # Deployment account private key
POLYGONSCAN_API_KEY          # For contract verification
```

### Signaling Server
```
PORT                          # Port to run on (default 8080)
NODE_ENV                      # Environment (development/production)
```

---

## Network Details

### Polygon Mumbai (Test)
```
Network: Polygon Mumbai Testnet
Chain ID: 80001
RPC: https://rpc-mumbai.maticvigil.com
Explorer: https://mumbai.polygonscan.com
Faucet: https://faucet.polygon.technology/
```

### Polygon Mainnet
```
Network: Polygon Mainnet
Chain ID: 137
RPC: https://polygon-rpc.com
Explorer: https://polygonscan.com
```

---

## Testing

### Run All Tests
```bash
cd smart-contract
npm test
```

### Run Specific Test
```bash
npm test -- --grep "should register file"
```

### Coverage Report
```bash
npm run test:coverage
```

### Test File Location
```
smart-contract/test/FileRegistry.test.js
```

---

## Debugging

### Enable Logs
```javascript
// Already enabled in components
// Check browser console (F12) for logs

// Format: emoji + action + details
// ✅ Component initialized
// ❌ Error occurred
// 📊 Data updated
// 🔗 Connection established
```

### Debug Smart Contract
```bash
# Add console.log statements
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

console.log("Debug info:", value);
```

### Debug Frontend
```javascript
// Use browser DevTools
// F12 to open
// Console tab for logs
// Network tab for API calls
// Application tab for storage
```

---

## Performance Optimization

### File Transfer Speed
```javascript
// Current: 1 file per peer connection
// Chunk size: 64 KB
// Theoretical max: 10 MB/s on good connection
```

### Memory Usage
```javascript
// Streaming approach
// Peak memory: ~128 KB per file
// No buffering entire file
```

### Blockchain Gas
```javascript
// registerFile: ~50,000 gas
// verifyFile: ~5,000 gas (view, free)
// On Polygon: ~0.01 MATIC per file
```

---

## Security Checklist

Before deploying:
- [ ] Private key never committed
- [ ] .env files in .gitignore
- [ ] No hardcoded secrets
- [ ] Error messages don't leak info
- [ ] Logs don't contain keys
- [ ] HTTPS/WSS in production
- [ ] Rate limiting enabled
- [ ] Input validation done

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| `Cannot find module` | Run `npm install` |
| `MetaMask not found` | Install extension |
| `Wrong network` | Switch to Polygon Mumbai |
| `No MATIC` | Use faucet |
| `Contract not found` | Deploy contract first |
| `Server not running` | Check signaling-server terminal |
| `WebRTC fails` | Check firewall settings |
| `File corrupted` | Hash mismatch - network issue |

---

## File Structure Command

Regenerate file tree:
```bash
# Linux/Mac
tree -L 3 -I 'node_modules|dist|artifacts'

# Windows (PowerShell)
Get-ChildItem -Recurse -Depth 3 | Where-Object { $_.Name -notmatch 'node_modules|dist|artifacts' }
```

---

## Git Workflow

```bash
# Clone
git clone <repo>

# Create feature branch
git checkout -b feature/your-feature

# Make changes
git add .
git commit -m "feat: description"

# Push
git push origin feature/your-feature

# Create Pull Request
```

---

## IDE Setup

### VS Code Recommended Extensions
- ES7+ React/Redux/React-Native snippets
- Solidity (0.0.123)
- Hardhat Solidity Compiler
- REST Client
- Thunder Client (API testing)

### VS Code Settings
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[solidity]": {
    "editor.defaultFormatter": "NomicFoundation.hardhat-solidity"
  }
}
```

---

This guide covers ~80% of common operations. For deeper questions, see the full documentation files.

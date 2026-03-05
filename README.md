# ⛓️ Blockchain-Verified Secure P2P File Transfer

A lightweight, secure peer-to-peer file transfer platform that uses blockchain verification, WebRTC for direct transfer, and AES-256-GCM encryption. No file persistence, only blockchain-stored hashes for integrity verification.

## 🌟 Features

✅ **MetaMask Wallet Authentication** - No email/password required  
✅ **End-to-End Encryption** - AES-256-GCM local encryption  
✅ **Blockchain Verification** - SHA-256 hash stored on Polygon  
✅ **Direct P2P Transfer** - WebRTC Data Channels (no server)  
✅ **Chunked Transfer** - Support for large files  
✅ **Zero File Persistence** - Files never stored anywhere  
✅ **Integrity Guarantee** - Blockchain-backed verification  

## 🏗️ Project Structure

```
blockchain-p2p-file-transfer/
├── frontend/              # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Utilities
│   │   └── App.jsx        # Main app
│   └── vite.config.js
│
├── smart-contract/        # Solidity contracts
│   ├── contracts/
│   │   └── FileRegistry.sol
│   ├── scripts/deploy.js
│   ├── test/
│   └── hardhat.config.js
│
├── signaling-server/      # WebSocket signaling
│   ├── server.js
│   └── package.json
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 14+
- **MetaMask** wallet browser extension
- **Polygon Mumbai Testnet** accounts with test MATIC

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# Or install each workspace
npm install --workspace=frontend
npm install --workspace=smart-contract
npm install --workspace=signaling-server
```

### 2. Deploy Smart Contract

```bash
cd smart-contract

# Copy and configure environment
cp .env.example .env

# Add your private key to .env
# PRIVATE_KEY=your_private_key_here

# Deploy to Polygon Mumbai
npm run deploy:mumbai
```

**Important**: Copy the deployed contract address and add it to `frontend/.env`:

```env
VITE_FILE_REGISTRY_ADDRESS=0x...
```

### 3. Start Signaling Server

```bash
cd signaling-server

# Copy environment
cp .env.example .env

# Start server
npm start
```

Server runs on `ws://localhost:8080`

### 4. Start Frontend

```bash
cd frontend

# Copy environment
cp .env.example .env

# Update VITE_SIGNALING_SERVER_URL if running on different host
# VITE_SIGNALING_SERVER_URL=ws://localhost:8080

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173`

## 🔄 File Transfer Flow

### Sender Process

1. **Connect Wallet** - MetaMask wallet authentication
2. **Select File** - Choose file to send
3. **Generate Encryption Key** - AES-256 session key
4. **Encrypt Locally** - File encrypted with key
5. **Calculate Hash** - SHA-256 of encrypted file
6. **Register on Blockchain** - Store hash on Polygon
7. **Establish P2P Connection** - WebRTC peer connection
8. **Send Encrypted Chunks** - File transferred via data channel
9. **Share Session Key** - Securely transmit decryption key

### Receiver Process

1. **Connect Wallet** - MetaMask wallet authentication
2. **See Available Peers** - List of online senders
3. **Request File** - Connect to sender peer
4. **Accept Connection** - WebRTC peer connection established
5. **Receive Chunks** - Download encrypted file
6. **Verify Hash** - Recalculate and compare from blockchain
7. **Decrypt File** - If hash valid, decrypt with received key
8. **Download** - Save decrypted file locally

## 🔐 Security Architecture

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Generation**: Cryptographic random 256-bit key
- **IV**: 12-byte random initialization vector
- **Authentication Tag**: 16 bytes GCM tag for integrity

### Blockchain Verification

- **Hash Algorithm**: SHA-256
- **Storage**: Polygon Mumbai smart contract
- **Data Stored**: Hash + sender address + timestamp
- **Duplicate Prevention**: One hash per registration

### Network Security

- **WebRTC**: Direct peer-to-peer (no relay through servers)
- **Signaling**: WebSocket with peer routing
- **No Files on Server**: Only metadata exchange

## 📁 File Components

### Smart Contract

[FileRegistry.sol](smart-contract/contracts/FileRegistry.sol)
- Stores encrypted file hashes
- Prevents duplicate registration
- Provides hash verification
- Maps files to sender addresses

### Frontend

**Components**:
- `WalletConnect` - MetaMask integration
- `FileUploader` - File selection interface
- `StatusDisplay` - Connection status
- `TransferReceiver` - Peer list and request interface
- `ProgressBar` - Transfer progress visualization

**Hooks**:
- `useEncryption` - Crypto operations
- `useBlockchain` - Smart contract interaction
- `useWebRTC` - P2P connection management
- `useSocket` - Signaling server communication

**Services**:
- `cryptoService` - AES-256-GCM encryption/decryption
- `blockchainService` - Smart contract interface
- `socketService` - WebSocket client
- `chunkFile` - File chunking utilities
- `hashFile` - SHA-256 hashing

### Signaling Server

[server.js](signaling-server/server.js)
- WebSocket server for peer discovery
- Relays WebRTC offers/answers
- Forwards ICE candidates
- Maintains peer registry (no file storage)

## ⚙️ Configuration

### Frontend (.env)

```env
VITE_SIGNALING_SERVER_URL=ws://localhost:8080
VITE_FILE_REGISTRY_ADDRESS=0x...
VITE_NETWORK_ID=80001
VITE_POLYGON_RPC=https://rpc-mumbai.maticvigil.com
```

### Smart Contract (.env)

```env
PRIVATE_KEY=your_private_key
POLYGONSCAN_API_KEY=your_api_key
```

### Signaling Server (.env)

```env
PORT=8080
NODE_ENV=development
```

## 🧪 Testing

### Smart Contract Tests

```bash
cd smart-contract

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

Test file: [smart-contract/test/FileRegistry.test.js](smart-contract/test/FileRegistry.test.js)

## 📊 Tech Stack

### Frontend
- **React** 18.2
- **Vite** 4.3
- **Tailwind CSS** 3.3
- **Ethers.js** 5.7
- **Web Crypto API** (built-in)

### Blockchain
- **Solidity** 0.8.19
- **Hardhat** 2.14
- **OpenZeppelin** Contracts
- **Polygon Mumbai** Testnet

### Backend (Signaling Only)
- **Node.js** + **Express**
- **WebSocket** (ws)
- **CORS** enabled

## 🔗 Network Details

### Polygon Mumbai Testnet

- **Chain ID**: 80001
- **RPC**: `https://rpc-mumbai.maticvigil.com`
- **Explorer**: `https://mumbai.polygonscan.com`
- **Faucet**: [Polygon Faucet](https://faucet.polygon.technology/)

## 📝 Smart Contract Functions

### `registerFile(bytes32 fileHash)`
Register encrypted file hash to prevent duplicates.

### `verifyFile(bytes32 fileHash)`
Verify if hash exists and get sender details.

### `fileExists(bytes32 fileHash)`
Check if a specific hash is registered.

### `getFileRecord(bytes32 fileHash)`
Get detailed record of a registered file.

### `getUserFiles(address user)`
Get all files registered by a user.

## ⚡ Performance

- **File Chunk Size**: 64 KB
- **Connection Timeout**: 30 seconds
- **Chunk Timeout**: 5 seconds
- **Max File Size**: 1 GB
- **Supported**: Multi-file sequential transfers

## 🔍 Debugging

### Enable Logs

Frontend components and services include debug logs. Open browser console (F12) to see:
- Connection events
- Encryption/Decryption operations
- WebRTC state changes
- Hash verification results

### Check Server Health

```bash
curl http://localhost:8080/health
```

### Monitor Peers

```bash
curl http://localhost:8080/peers
```

## 🐛 Troubleshooting

### MetaMask Connection Failed
- Ensure MetaMask is installed
- Check if extension is enabled
- Try disconnecting and reconnecting

### Contract Deployment Failed
- Verify private key is correct
- Ensure account has test MATIC
- Check gas price settings

### Peer Connection Issues
- Ensure signaling server is running
- Check NAT/firewall settings
- Verify WebSocket connection: `ws://localhost:8080`

### File Transfer Stalled
- Check peer connection status
- Verify both peers are on same network
- Increase timeout values if needed

## 📜 License

MIT License - See LICENSE file

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## ⚠️ Security Notes

**This is a demonstration project. Before production use:**

- Conduct security audit
- Use ECDH for proper key exchange
- Implement rate limiting on signaling server
- Add authentication to signaling server
- Use proper TLS/SSL for WebSocket
- Implement key management system
- Add input validation everywhere
- Test with larger files
- Stress test P2P connections

## 📚 Additional Resources

- [Ethers.js Documentation](https://docs.ethers.io/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Hardhat Documentation](https://hardhat.org/)
- [Solidity Documentation](https://docs.soliditylang.org/)

## 💡 Future Enhancements

- [ ] File compression before transfer
- [ ] Resume interrupted transfers
- [ ] Multi-part file transfer
- [ ] Batch file transfers
- [ ] File access control list
- [ ] Transfer history and statistics
- [ ] Payment integration for transfers
- [ ] Mobile app version
- [ ] IPFS integration option
- [ ] Multi-chain deployment

---

**Built with ❤️ for secure P2P file transfer**

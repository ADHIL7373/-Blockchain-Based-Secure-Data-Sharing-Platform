# ⚡ Quick Setup Guide

Get the Blockchain P2P File Transfer running in 15 minutes!

## Prerequisites

**You need:**
- ✅ Node.js 14+ (Download from [nodejs.org](https://nodejs.org))
- ✅ MetaMask browser extension ([Install](https://metamask.io))
- ✅ Test MATIC tokens for Mumbai testnet ([Faucet](https://faucet.polygon.technology/))

**Check installation:**
```bash
node --version  # Should be v14+
npm --version   # Should be v6+
```

## Step 1: Clone and Install (5 min)

```bash
# Navigate to project directory
cd "d:\Sharing Application"

# Install all dependencies
npm install

# If that doesn't work, install manually:
cd frontend && npm install && cd ..
cd smart-contract && npm install && cd ..
cd signaling-server && npm install && cd ..
```

## Step 2: Deploy Smart Contract (5 min)

```bash
cd smart-contract

# Create environment file
cp .env.example .env

# Edit .env and add your private key:
# PRIVATE_KEY=your_private_key_without_0x_prefix
```

**Don't have a private key?**

1. Open MetaMask
2. Click account icon → Settings → Security & Privacy
3. Click "Reveal Secret Recovery Phrase"
4. Use an online tool to derive private key (careful with safety!)
5. Or create a dedicated test account just for deployment

**Deploy:**
```bash
npm run deploy:mumbai
```

**Success output:**
```
✅ FileRegistry deployed successfully!
📍 Contract Address: 0x...
🌐 Network: goerli (ChainID: 80001)
```

**Copy the contract address!** You'll need it next.

## Step 3: Configure Frontend (2 min)

```bash
cd ../frontend

# Create environment file
cp .env.example .env

# Edit .env with your values:
# VITE_FILE_REGISTRY_ADDRESS=0x... (from previous step)
# VITE_SIGNALING_SERVER_URL=ws://localhost:8080
```

Example `.env`:
```env
VITE_SIGNALING_SERVER_URL=ws://localhost:8080
VITE_FILE_REGISTRY_ADDRESS=0x1a2b3c4d5e...
VITE_NETWORK_ID=80001
VITE_POLYGON_RPC=https://rpc-mumbai.maticvigil.com
```

## Step 4: Start Signaling Server (2 min)

**In a new terminal:**

```bash
cd signaling-server

# Optional: Create .env (usually defaults work)
cp .env.example .env

# Start the server
npm start
```

**Success output:**
```
🚀 Signaling server running on port 8080
🔗 WebSocket: ws://localhost:8080
📊 Health check: http://localhost:8080/health
```

**Keep this terminal open!**

## Step 5: Start Frontend (1 min)

**In another new terminal:**

```bash
cd frontend

# Start development server
npm run dev
```

**Success output:**
```
  VITE v4.3.9  dev server running at:

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## Step 6: Test the Application

1. **Open browser**: http://localhost:5173
2. **Connect wallet**: Click "🔗 Connect MetaMask Wallet"
3. **Check network**: Switch to "Polygon Mumbai" if needed
4. **Try sending**:
   - Mode: 📤 Send File
   - Select a file
   - See file hash register on blockchain
5. **Try receiving** (with two browser windows):
   - Window 1: Send mode
   - Window 2: Receive mode
   - Window 2 should see Window 1 address as available peer

## Troubleshooting

### "MetaMask not found"
- ✅ Install MetaMask extension from [metamask.io](https://metamask.io)
- ✅ Refresh the page
- ✅ Try a different browser

### "Wrong Network"
- ✅ Click "📡 Switch to Polygon Mumbai"
- ✅ Or manually add Mumbai to MetaMask:
  - Network: Polygon Mumbai Testnet
  - RPC URL: `https://rpc-mumbai.maticvigil.com`
  - Chain ID: `80001`
  - Currency: MATIC

### "No MATIC tokens"
- ✅ Go to [Polygon Faucet](https://faucet.polygon.technology/)
- ✅ Paste your address
- ✅ Get 0.5 MATIC
- ✅ Wait 1-2 minutes

### "Contract Address is 0x000..."
- ✅ This means you haven't deployed yet
- ✅ Go back to Step 2 and deploy first
- ✅ Then add the correct address to `.env`

### "Can't connect to signaling server"
- ✅ Make sure signaling server is running (Step 4)
- ✅ Check terminal shows: "🚀 Signaling server running"
- ✅ If using remote server, update URL in `.env`

### "Files stuck on 'Connecting'"
- ✅ Both peers need to be connected first
- ✅ Check Status shows both peers connected
- ✅ Try refreshing browser

## Commands Reference

### Frontend
```bash
cd frontend

# Development
npm run dev              # Start dev server (http://localhost:5173)

# Production
npm run build           # Build for production
npm run preview         # Preview production build
```

### Smart Contract
```bash
cd smart-contract

# Testing
npm test                # Run all tests
npm run test:coverage   # Coverage report

# Deployment
npm run deploy:localhost    # Deploy to local Hardhat
npm run deploy:mumbai       # Deploy to Mumbai testnet
npm run deploy:polygon      # Deploy to Polygon mainnet

# Utilities
npm run compile         # Compile contracts
npm run node           # Start local Hardhat node
```

### Signaling Server
```bash
cd signaling-server

# Development
npm start               # Start server
npm run dev            # Start with nodemon (auto-reload)

# Health check
curl http://localhost:8080/health

# Get connected peers
curl http://localhost:8080/peers
```

## File Structure After Setup

```
d:\Sharing Application
├── frontend/
│   ├── src/
│   ├── dist/            # Generated after build
│   ├── .env             # Your configuration ✅
│   ├── package.json
│   └── vite.config.js
├── smart-contract/
│   ├── contracts/
│   ├── artifacts/       # Generated after compile
│   ├── .env             # Your private key ✅
│   ├── package.json
│   └── hardhat.config.js
├── signaling-server/
│   ├── server.js
│   ├── .env             # Your config ✅
│   └── package.json
├── README.md
├── SECURITY.md
└── architecture.md
```

## Production Deployment

### Frontend (Vercel / Netlify)

```bash
# Build
npm run build

# Deploy dist/ folder to:
# - Vercel (automatic from GitHub)
# - Netlify (automatic from GitHub)
# - Any static host (AWS S3, Cloudflare, etc.)
```

### Signaling Server (VPS)

```bash
# On VPS
git clone <repo>
cd signaling-server
npm install

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name "p2p-signaling"
pm2 save

# Or use systemd service
```

### Smart Contract (Already on Polygon)

- No additional setup needed!
- Contract already on blockchain
- Just update frontend address if deploying new version

## Security Checklist

Before sharing with others:

- [ ] `.env` files are in `.gitignore`
- [ ] Private key never committed to Git
- [ ] HTTPS/WSS enabled in production
- [ ] Signaling server behind firewall
- [ ] Rate limiting enabled
- [ ] Logs don't contain sensitive data
- [ ] MetaMask warning screenshots removed
- [ ] Audit completed

## Next Steps

1. **Test thoroughly**: Try different file sizes
2. **Read architecture**: Check [architecture.md](architecture.md)
3. **Review security**: Check [SECURITY.md](SECURITY.md)
4. **Deploy**: Follow production checklist
5. **Monitor**: Set up error tracking and analytics

## Getting Help

### Common Questions

**Q: Can I transfer files without blockchain?**
A: Yes! Hardware WebRTC works. Blockchain is just for verification.

**Q: What if power cuts during transfer?**
A: File is re-downloaded. Everything is streamed, no resume yet.

**Q: Who can see my file?**
A: Only the peer you're connected to. File is end-to-end encrypted.

**Q: Can you (the developer) see my files?**
A: No! No server storage. I can't access anything.

### Resources

- 📚 [Complete README](README.md)
- 🏗️ [Architecture Guide](architecture.md)
- 🔒 [Security Details](SECURITY.md)
- 📖 [Ethers.js Docs](https://docs.ethers.io)
- 🔗 [WebRTC MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- ⛓️ [Solidity Docs](https://docs.soliditylang.org)

## Getting Support

Issues or questions?

1. Check troubleshooting above
2. Review GitHub Issues (if available)
3. Ask on blockchain communities (Discord, Reddit)
4. Report bugs on GitHub

---

**🎉 You're ready to go! Happy file transferring!**

Start with the frontend at http://localhost:5173

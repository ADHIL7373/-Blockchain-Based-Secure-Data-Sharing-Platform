# Project Logical Error Analysis

**Date**: February 23, 2026  
**Status**: Critical Issues Found - Needs Fixes

---

## 🔴 CRITICAL ERRORS (Will Break Functionality)

### 1. **WalletContext.jsx - Missing React Import**

**Location**: `frontend/src/context/WalletContext.jsx` Line 44

**Issue**:
```javascript
export function useWallet() {
  const context = React.useContext(WalletContext);  // ❌ React not imported
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

**Problem**: `React` is referenced but not imported at the top of the file.

**Fix**:
```javascript
import { createContext, useState, useCallback, useContext } from 'react';

// Then later:
export function useWallet() {
  const context = useContext(WalletContext);  // ✅ Use imported useContext
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

---

### 2. **blockchainService.js - Incorrect ABI stateMutability for verifyFile**

**Location**: `frontend/src/services/blockchainService.js` Lines 15-21

**Issue**:
```javascript
{
  name: 'verifyFile',
  type: 'function',
  inputs: [{ name: 'fileHash', type: 'bytes32' }],
  outputs: [...],
  stateMutability: 'nonpayable',  // ❌ WRONG - should be 'view' or 'pure'
},
```

**Problem**: 
- `verifyFile` in the Solidity contract is marked as `external` but doesn't modify state
- It only reads data and emits events
- Should be `'view'` since it's a read-only function
- Using `'nonpayable'` tells ethers.js this is a state-modifying transaction

**Impact**: This will cause the function to be called as a write transaction instead of a read-only call, wasting gas and potentially failing.

**Fix**:
```javascript
{
  name: 'verifyFile',
  type: 'function',
  inputs: [{ name: 'fileHash', type: 'bytes32' }],
  outputs: [...],
  stateMutability: 'view',  // ✅ CORRECT - read-only function
},
```

---

### 3. **App.jsx - Incorrect chunkFile Usage**

**Location**: `frontend/src/App.jsx` Line 181

**Issue**:
```javascript
const chunks = await chunkFile({ arrayBuffer: () => Promise.resolve(encryptedData.buffer) });
```

**Problem**: 
- `chunkFile()` function expects a `File` object with an `arrayBuffer()` method
- `encryptedData` is already a `Uint8Array` (from the `encrypt` function)
- Constructing a mock object with `{ arrayBuffer: ... }` doesn't match the function signature
- The function calls `file.arrayBuffer()` which would work, but it's semantically wrong

**Better Fix**: Create a helper function or modify the chunking logic:

**Option 1** - Create a Uint8Array chunking helper:
```javascript
// In chunkFile.js
export function chunkUint8Array(data, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// Then in App.jsx:
const chunks = chunkUint8Array(encryptedData);
```

**Option 2** - Pass the Uint8Array directly:
```javascript
// Modify chunkFile to accept Uint8Array or File:
export async function chunkFile(fileOrData, chunkSize = CHUNK_SIZE) {
  let fileBytes;
  
  if (fileOrData instanceof Uint8Array) {
    fileBytes = fileOrData;
  } else {
    const fileBuffer = await fileOrData.arrayBuffer();
    fileBytes = new Uint8Array(fileBuffer);
  }

  const chunks = [];
  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    chunks.push(fileBytes.slice(i, i + chunkSize));
  }
  return chunks;
}
```

---

### 4. **App.jsx - Socket listener cleanup doesn't work**

**Location**: `frontend/src/App.jsx` Lines 103-107

**Issue**:
```javascript
return () => {
  socket.off(MESSAGE_TYPES.OFFER, null);      // ❌ Passing null
  socket.off(MESSAGE_TYPES.ANSWER, null);
  socket.off(MESSAGE_TYPES.ICE_CANDIDATE, null);
};
```

**Problem**:
- The `off()` method expects the actual callback function to remove
- Passing `null` won't find any matching callback to remove (callbacks are never null)
- Listeners won't be properly unsubscribed, causing memory leaks
- Multiple listeners could stack up on re-renders

**How `off()` Works** (from socketService.js):
```javascript
off(type, callback) {
  if (!this.listeners.has(type)) return;
  const callbacks = this.listeners.get(type);
  const index = callbacks.indexOf(callback);  // ❌ null will never be found
  if (index > -1) {
    callbacks.splice(index, 1);
  }
}
```

**Fix**: Store callback references and remove them:
```javascript
const [offerCallback, setOfferCallback] = useState(null);
const [answerCallback, setAnswerCallback] = useState(null);
const [iceCallback, setIceCallback] = useState(null);

useEffect(() => {
  if (!socket.socket) return;

  const handleOffer = async (data) => {
    // ... existing code
  };
  
  const handleAnswer = async (data) => {
    // ... existing code
  };
  
  const handleIce = async (data) => {
    // ... existing code
  };

  socket.on(MESSAGE_TYPES.OFFER, handleOffer);
  socket.on(MESSAGE_TYPES.ANSWER, handleAnswer);
  socket.on(MESSAGE_TYPES.ICE_CANDIDATE, handleIce);

  return () => {
    socket.off(MESSAGE_TYPES.OFFER, handleOffer);      // ✅ Pass actual callback
    socket.off(MESSAGE_TYPES.ANSWER, handleAnswer);
    socket.off(MESSAGE_TYPES.ICE_CANDIDATE, handleIce);
  };
}, [socket.socket, webrtc]);
```

---

### 5. **WalletContext.jsx - Confusing Parameter Names**

**Location**: `frontend/src/context/WalletContext.jsx` Line 15

**Issue**:
```javascript
const updateWallet = useCallback((addr, sig, net, sig2) => {
    setAccount(addr);
    setSigner(sig);        // ❌ Parameter named 'sig' but contains signer
    setNetwork(net);
    setSignature(sig2);    // ❌ Parameter named 'sig2', confusing
}, []);
```

**Problem**:
- Parameter `sig` is ambiguous - is it a signature or signer?
- Parameter `sig2` is even more confusing
- Looking at the call site (App.jsx line 119): `setWallet({ account: address, signer, network, signature })`
- The names don't match the usage

**Fix**:
```javascript
const updateWallet = useCallback((address, signer, network, signature) => {
    setAccount(address);
    setSigner(signer);
    setNetwork(network);
    setSignature(signature);
}, []);
```

---

## 🟡 MEDIUM ISSUES (May Cause Problems)

### 6. **Smart Contract - verifyFile Is State-Modifying**

**Location**: `smart-contract/contracts/FileRegistry.sol` Lines 59-66

**Issue**:
```solidity
function verifyFile(bytes32 fileHash)
    external
    returns (bool exists, address sender, uint256 timestamp)
{
    FileRecord memory record = files[fileHash];
    emit FileVerified(fileHash, msg.sender, record.exists);  // ❌ Emits event
    return (record.exists, record.sender, record.timestamp);
}
```

**Problem**:
- Function emits an event, which is a state-modifying operation
- Can't be marked as `view` because it emits
- But users expect it to be read-only and free to call
- This will cost gas when called from verified transaction

**Better Design**:
```solidity
// Create two functions: one view, one state-modifying
function verifyFile(bytes32 fileHash)
    external
    view
    returns (bool exists, address sender, uint256 timestamp)
{
    FileRecord memory record = files[fileHash];
    return (record.exists, record.sender, record.timestamp);
}

// Separate function for verification with logging
function logFileVerification(bytes32 fileHash)
    external
{
    FileRecord memory record = files[fileHash];
    emit FileVerified(fileHash, msg.sender, record.exists);
}
```

---

### 7. **App.jsx - Race Condition in startTransfer**

**Location**: `frontend/src/App.jsx` Lines 140-180

**Issue**:
```javascript
const startTransfer = async () => {
  // ... validation ...
  
  setTransferStatus(TRANSFER_STATUS.SENDING);
  
  // Generate key, encrypt...
  
  // Register on blockchain
  if (blockchain.blockchain) {
    try {
      setTransferStatus(TRANSFER_STATUS.VERIFYING);  // Change status
      const result = await blockchain.registerFileHash(fileHash);
      // Takes time...
    } catch (err) {
      console.warn('Blockchain registration failed:', err.message);
    }
  }

  // Connect to peer immediately (shouldn't wait for blockchain)
  setTransferStatus(TRANSFER_STATUS.CONNECTING);  // ❌ Changes status while blockchain is still registering
  webrtc.initializePeerConnection(true);
  
  const targetPeer = socket.peers[0];
  const offer = await webrtc.createOffer(targetPeer);
```

**Problem**:
- Sets status to `VERIFYING` but doesn't await
- Immediately changes it to `CONNECTING`
- User sees wrong status
- If blockchain registration fails, status was never reset

**Fix**:
```javascript
const startTransfer = async () => {
  if (!selectedFile || !wallet || !socket.isConnected || socket.peers.length === 0) {
    setError('Please select a file and ensure a peer is connected');
    return;
  }

  try {
    setTransferStatus(TRANSFER_STATUS.SENDING);
    setError(null);

    // Generate encryption key
    const key = await encryption.generateKey();

    // Encrypt file
    const fileData = await fileToBytes(selectedFile);
    const { encryptedData, iv } = await encryption.encryptFile(fileData, key);

    // Calculate hash
    const fileHash = await hashFile(encryptedData);
    setSuccessMessage(`📊 File hash: ${fileHash.slice(0, 16)}...`);

    // Register on blockchain
    if (blockchain.blockchain) {
      try {
        setTransferStatus(TRANSFER_STATUS.VERIFYING);
        const result = await blockchain.registerFileHash(fileHash);
        setSuccessMessage(`✅ File registered: ${result.txHash.slice(0, 16)}...`);
        // ✅ Only change status after blockchain completes
      } catch (err) {
        console.warn('Blockchain registration failed:', err.message);
        setError('Blockchain registration failed, but continuing with transfer');
      }
    }

    // NOW connect to peer (blockchain is done or failed)
    setTransferStatus(TRANSFER_STATUS.CONNECTING);
    // ... rest of code
  } catch (err) {
    setError(`Transfer failed: ${err.message}`);
    setTransferStatus(TRANSFER_STATUS.ERROR);
  }
};
```

---

### 8. **useSocket - Listener Not Properly Tracked**

**Location**: `frontend/src/hooks/useSocket.js` Lines 21-24

**Issue**:
```javascript
const connect = useCallback(
  async (walletAddress, peerId) => {
    // ...
    
    // Listen for successful join
    socketService.on(MESSAGE_TYPES.JOIN + '_SUCCESS', (data) => {
          setPeers(data.peers.filter((p) => p !== walletAddress));
    });

    // These listeners are added but never cleaned up!
    // Listen for new peers joining
    socketService.on(MESSAGE_TYPES.PEER_JOINED, (data) => {
      // ...
    });

    setSocket(socketService);
    setIsConnected(true);

    return socketService;
  },
  [signalingServerUrl]
);
```

**Problem**:
- Listeners are added every time `connect()` is called
- No cleanup for these listeners
- If `connect()` is called multiple times, multiple listeners stack up
- Each emit triggers all accumulated listeners

**Fix**: Store the callback references:
```javascript
const [listenerCleanup, setListenerCleanup] = useState(null);

const connect = useCallback(
  async (walletAddress, peerId) => {
    // Clean up previous listeners if they exist
    if (listenerCleanup) {
      listenerCleanup();
    }

    setError(null);
    try {
      const socketService = initializeSocket(signalingServerUrl);
      
      await socketService.connect(walletAddress, peerId);
      
      // Define callbacks
      const handleJoinSuccess = (data) => {
        setPeers(data.peers.filter((p) => p !== walletAddress));
      };
      
      const handlePeerJoined = (data) => {
        setPeers((prev) => {
          if (!prev.includes(data.walletAddress)) {
            return [...prev, data.walletAddress];
          }
          return prev;
        });
      };
      
      const handlePeerLeft = (data) => {
        setPeers((prev) => prev.filter((p) => p !== data.walletAddress));
      };
      
      // Add listeners
      socketService.on(MESSAGE_TYPES.JOIN + '_SUCCESS', handleJoinSuccess);
      socketService.on(MESSAGE_TYPES.PEER_JOINED, handlePeerJoined);
      socketService.on(MESSAGE_TYPES.PEER_LEFT, handlePeerLeft);
      
      // Store cleanup function
      setListenerCleanup(() => () => {
        socketService.off(MESSAGE_TYPES.JOIN + '_SUCCESS', handleJoinSuccess);
        socketService.off(MESSAGE_TYPES.PEER_JOINED, handlePeerJoined);
        socketService.off(MESSAGE_TYPES.PEER_LEFT, handlePeerLeft);
      });

      setSocket(socketService);
      setIsConnected(true);

      return socketService;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  },
  [signalingServerUrl]
);
```

---

## 🟠 MINOR ISSUES (Best Practices)

### 9. **Constants - MESSAGE_TYPES.JOIN_SUCCESS Not Defined**

**Location**: `frontend/src/utils/constants.js`

**Issue**:
```javascript
export const MESSAGE_TYPES = {
  JOIN: 'JOIN',
  OFFER: 'OFFER',
  // ...
};

// But code uses: MESSAGE_TYPES.JOIN + '_SUCCESS'
// This works but is not ideal
```

**Better Practice**:
```javascript
export const MESSAGE_TYPES = {
  JOIN: 'JOIN',
  JOIN_SUCCESS: 'JOIN_SUCCESS',  // ✅ Explicit
  OFFER: 'OFFER',
  ANSWER: 'ANSWER',
  ICE_CANDIDATE: 'ICE_CANDIDATE',
  PEER_JOINED: 'PEER_JOINED',
  PEER_LEFT: 'PEER_LEFT',
  // ...
};
```

---

### 10. **Signaling Server - No Error Handling for Message Parsing**

**Location**: `signaling-server/server.js` Lines 40-80

**Issue**: While there's try-catch, the functions like `handleJoin`, `handleOffer` don't have complete error handling. If they throw, client gets disconnected.

**Improvement**: Add error boundaries

---

### 11. **fileToBytes - Unnecessary Wrapping**

**Location**: `frontend/src/utils/chunkFile.js` Lines 24-28

**Issue**:
```javascript
export async function fileToBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}
```

**Usage in App.jsx**:
```javascript
const fileData = await fileToBytes(selectedFile);
const { encryptedData, iv } = await encryption.encryptFile(fileData, key);
```

**Problem**: `fileData` is already the Uint8Array returned by fileToBytes. Then it's passed to encryptFile which expects Uint8Array. This is fine, but the naming could be clearer.

---

## 📊 Summary

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 5 | Errors that will break code |
| 🟡 Medium | 3 | Logic errors that cause problems |
| 🟠 Minor | 3 | Best practice improvements |
| **Total** | **11** | **Comprehensive analysis** |

---

## ✅ Recommended Fix Priority

**Must Fix First** (Breaks Execution):
1. ✅ WalletContext - Missing React import (#1)
2. ✅ App.jsx - chunkFile usage (#3)
3. ✅ blockchainService - ABI stateMutability (#2)

**Must Fix Second** (Memory leaks/Logic errors):
4. ✅ App.jsx - Socket listener cleanup (#4)
5. ✅ App.jsx - Race condition (#7)
6. ✅ useSocket - Listener stacking (#8)

**Should Fix** (Quality/Clarity):
7. ✅ WalletContext - Parameter names (#5)
8. ✅ Smart Contract - verifyFile design (#6)
9. ✅ Constants - MESSAGE_TYPES completeness (#9)

---

**Analysis Complete** - All issues identified and solutions provided.

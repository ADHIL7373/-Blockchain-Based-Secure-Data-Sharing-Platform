# Quick Implementation Guide

## Files Changed/Created

### ✅ MODIFIED FILES

1. **frontend/src/services/socketService.js** (COMPLETE REWRITE)
   - Singleton pattern implementation
   - State machine (DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING → FAILED)
   - Exponential backoff with jitter
   - Heartbeat/ping mechanism
   - Proper error handling and cleanup
   - Production metrics collection

2. **signaling-server/server.js** (COMPLETE REWRITE)
   - Rate limiting per IP (max 5 connections)
   - Per-peer message rate limiting (100 msg/min)
   - Server-side heartbeat (PING/PONG every 30s)
   - Automatic cleanup of stale connections
   - Connection timeout (60s initial, 120s idle)
   - Comprehensive metrics endpoints
   - Graceful error handling

3. **signaling-server/.env** (UPDATED)
   - PORT=8081 (changed from 8080 to avoid Apache conflict)

4. **frontend/.env** (UPDATED)
   - VITE_SIGNALING_SERVER_URL=ws://localhost:8081 (updated port)

### ✨ NEW FILES

1. **frontend/src/hooks/useSocketService.js**
   - React hook for proper component lifecycle management
   - Auto-cleanup on unmount
   - Connection state tracking
   - Error handling
   - Listener registration/deregistration

2. **frontend/src/utils/diagnostics.js**
   - Comprehensive diagnostics utility
   - Browser socket limit detection
   - Server health checking
   - Formatted console output
   - JSON export for bug reports

3. **WEBSOCKET_FIX_GUIDE.md** (This directory)
   - Complete technical analysis
   - Root cause explanation
   - Architecture comparison
   - System-level diagnostics
   - Integration guide
   - Troubleshooting guide

## Step-by-Step Integration

### Step 1: Use New Socket Service (Backend agnostic)
```javascript
// In any component or service
import { SocketService } from '../services/socketService.js';

// Get singleton instance
const socket = SocketService.getInstance('ws://localhost:8081');

// Connect
await socket.connect(walletAddress, peerId);

// Listen for events (returns unsubscribe function)
const unsubscribe = socket.on('OFFER', (data) => {
  console.log('Received offer:', data);
});

// Cleanup (in useEffect return)
unsubscribe();

// Disconnect
socket.disconnect();
```

### Step 2: Use React Hook (RECOMMENDED for React)
```javascript
// In React component
import useSocketService from '../hooks/useSocketService.js';

function FileTransferComponent() {
  const socket = useSocketService('ws://localhost:8081');
  
  // Auto-cleanup on unmount
  useEffect(() => {
    (async () => {
      try {
        await socket?.connect(walletAddress, peerId);
        console.log('Connected!');
      } catch (err) {
        console.error('Connection failed:', err);
      }
    })();
  }, [socket, walletAddress, peerId]);

  // Register listeners (auto-cleanup on unmount)
  useEffect(() => {
    const unsubscribe = socket?.on('OFFER', handleOffer);
    return () => unsubscribe?.();
  }, [socket]);

  // Disconnect on unmount
  useEffect(() => {
    return () => socket?.disconnect();
  }, [socket]);

  return (
    <div>
      {socket?.isConnected ? (
        <span>✅ Connected ({socket.connectionState})</span>
      ) : (
        <span>❌ Disconnected</span>
      )}
      {socket?.error && <div style={{ color: 'red' }}>Error: {socket.error}</div>}
    </div>
  );
}
```

### Step 3: Verify Setup
```bash
# Start signaling server on new port
cd signaling-server
npm start
# Should see:
# ✅ Signaling server running on port 8081
# 🔗 WebSocket: ws://localhost:8081

# In another terminal, start frontend
cd frontend
npm run dev
# Should see Vite running on 5173
```

### Step 4: Test Connection
Open browser console and run:
```javascript
// Get socket service instance
const socket = window.socketService; 

// Or create new one
const { SocketService } = await import('./services/socketService.js');
const socket = SocketService.getInstance('ws://localhost:8081');

// Connect
await socket.connect('0xYourWalletAddress', 'peer-id-123');

// Check status
console.log(socket.isConnected()); // should be true
console.log(socket.getMetrics()); // should show successful connection
```

### Step 5: Enable Diagnostics (Development)
```javascript
// In any component or console
import { logComprehensiveDiagnostics } from '../utils/diagnostics.js';

await logComprehensiveDiagnostics(socket, 'ws://localhost:8081');

// Or manually check
socket.getMetrics();
socket.getState();
```

## Key Features Explained

### 1. Singleton Pattern
```javascript
// Only ONE WebSocket per app lifetime
const socket1 = SocketService.getInstance(url);
const socket2 = SocketService.getInstance(url);
console.log(socket1 === socket2); // true - same instance
```

### 2. State Machine
```javascript
socket.getState(); // Returns one of:
// - DISCONNECTED: Initial state
// - CONNECTING: Attempting to connect
// - CONNECTED: Successfully connected
// - RECONNECTING: Attempting to reconnect after error
// - FAILED: Max retries exceeded
```

### 3. Exponential Backoff with Jitter
```javascript
// Retries with increasing delays:
// Attempt 1: immediate
// Attempt 2: 1000-1500ms (1s + jitter)
// Attempt 3: 2000-3000ms (2s + jitter)
// Attempt 4: 4000-6000ms (4s + jitter)
// Attempt 5: 8000-12000ms (8s + jitter)
// Attempt 6: 16000-24000ms (16s + jitter, capped at 30s max)
```

### 4. Heartbeat Mechanism
```
Every 30 seconds:
Server → Client: { type: 'PING' }
Client → Server: { type: 'PONG' }

If no PONG within heartbeat interval:
→ Connection considered dead
→ Automatically reconnect
```

### 5. Auto-Cleanup on Disconnect
```javascript
socket.disconnect();
// Clears:
// ✅ WebSocket connection
// ✅ All timers (retry, heartbeat, connection timeout)
// ✅ Event listeners
// ✅ References
// Memory properly freed
```

## Testing Specific Scenarios

### Test 1: Network Interruption
```javascript
// 1. Connect successfully
await socket.connect(addr, id);

// 2. Simulate network failure
// Windows: netsh interface set interface Ethernet disabled
// Mac: ifconfig en0 down
// Browser: DevTools → Network → Offline

// 3. Observe:
// - Socket detects disconnect within heartbeat interval (30s)
// - Automatically attempts reconnect
// - Shows appropriate state/error

// 4. Restore network
// - Socket auto-reconnects
// - No "Insufficient resources" errors
```

### Test 2: Server Restart
```javascript
// 1. With socket connected
await socket.connect(addr, id);

// 2. Kill signaling server
// Get-Process node | Stop-Process

// 3. Observe:
// - Socket detects disconnect (PING timeout)
// - Enters RECONNECTING state
// - Repeatedly tries to connect

// 4. Restart server
cd signaling-server && npm start

// 5. Socket auto-reconnects without user action
```

### Test 3: Rapid Reconnect (Previously Crashed)
```javascript
// This would cause "Insufficient resources" before fix
for (let i = 0; i < 10; i++) {
  socket.disconnect();
  await socket.connect(addr, id);
  console.log(`Attempt ${i + 1}: ${socket.isConnected() ? '✅' : '❌'}`);
}
// Now: All succeed without errors ✅
```

## Browser DevTools Integration

### Monitor WebSocket Traffic
```javascript
// Chrome DevTools → Network tab → WS (WebSocket)
// You'll see:
// - ws://localhost:8081 connection
// - All frames (PING, PONG, JOIN, OFFER, ANSWER, ICE_CANDIDATE)
// - Frame size and timing
// - Automatic reconnects appear as new WS connection
```

### Check Socket Pool Status
```javascript
// Chrome DevTools → chrome://net-internals/ → Sockets
// Shows:
// - All active WebSocket connections
// - Connection states
// - TIME_WAIT sockets
// - Button to flush pools if needed
```

## Production Deployment

### Before Going Live
1. ✅ Test all three scenarios above
2. ✅ Run diagnostics: `logComprehensiveDiagnostics()`
3. ✅ Check metrics endpoint: http://localhost:8081/metrics
4. ✅ Load test with multiple peers connecting
5. ✅ Monitor memory and CPU usage
6. ✅ Check server logs for errors

### Configuration for Production
```javascript
// signaling-server/server.js - Adjust if needed
const CONFIG = {
  MAX_CONNECTIONS_PER_IP: 10, // Increase for larger networks
  MAX_PEERS: 10000, // Increase if needed
  CONNECTION_TIMEOUT: 60000, // Adjust based on network latency
  HEARTBEAT_INTERVAL: 30000, // Balance between detection time and bandwidth
  MESSAGE_RATE_LIMIT: 1000, // Increase if high message volume needed
};
```

## Monitoring & Alerting

### Health Check Endpoint
```bash
# Production monitoring can check:
curl http://signaling-server:8081/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-27T...",
  "activePeers": 42,
  "config": { ... }
}
```

### Metrics Endpoint
```bash
# Track over time:
curl http://signaling-server:8081/metrics

# Key metrics to track:
{
  "totalConnections": 1000,
  "activeConnections": 42,
  "messagesProcessed": 50000,
  "uptime": "3600s"
}
```

## Troubleshooting

### Issue: "Cannot read property 'getInstance' of undefined"
**Fix**: Make sure import is correct
```javascript
// ✅ CORRECT
import { SocketService } from '../services/socketService.js';
const socket = SocketService.getInstance(url);

// ❌ WRONG
import SocketService from '../services/socketService.js'; // Missing braces
```

### Issue: Multiple listeners firing
**Fix**: Ensure cleanup in useEffect
```javascript
// ✅ CORRECT
useEffect(() => {
  const unsubscribe = socket.on('OFFER', handler);
  return () => unsubscribe(); // Important!
}, [socket]);

// ❌ WRONG
useEffect(() => {
  socket.on('OFFER', handler); // No cleanup
}, [socket]);
```

### Issue: Memory leak warnings in console
**Fix**: Call disconnect() on unmount
```javascript
// ✅ CORRECT
useEffect(() => {
  return () => socket.disconnect();
}, [socket]);

// ❌ WRONG
// Never calling disconnect()
```

## Next Steps

1. ✅ Replace your socketService.js with new version
2. ✅ Replace your server.js with new version
3. ✅ Update .env files (ports)
4. ✅ Test thoroughly
5. ✅ Use React hook in components
6. ✅ Enable diagnostics in development
7. ✅ Monitor metrics in production
8. ✅ Enjoy reliable WebSocket connections 🎉

---

**Need Help?**
- Check browser console for error messages
- Run: `await logComprehensiveDiagnostics(socket, 'ws://localhost:8081')`
- Check server logs: Look for `[Server]` prefixed messages
- Review WEBSOCKET_FIX_GUIDE.md for detailed troubleshooting

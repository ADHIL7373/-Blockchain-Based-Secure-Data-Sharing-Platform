const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

/**
 * ============================================================================
 * PRODUCTION-GRADE WEBSOCKET SIGNALING SERVER
 * ============================================================================
 * 
 * This server implements:
 * - Connection rate limiting per IP
 * - Per-peer message rate limiting
 * - Connection timeout handling
 * - Server-side heartbeat/ping-pong
 * - Automatic stale connection cleanup
 * - Resource constraints enforcement
 * - Graceful degradation
 * - Comprehensive metrics and monitoring
 */

// Configuration
const CONFIG = {
  MAX_CONNECTIONS_PER_IP: 5,
  MAX_PEERS: 1000,
  CONNECTION_TIMEOUT: 60000, // 60 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  MESSAGE_RATE_LIMIT: 100, // messages per 60 seconds per peer
  MESSAGE_RATE_WINDOW: 60000, // 1 minute
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1 MB
};

// Store active peer connections
const peers = new Map(); // walletAddress -> { ws, peerId, ip, createdAt, lastActivity, messageCount, messageWindow, heartbeatTimeout }

// Track connections per IP
const connectionsPerIp = new Map(); // ip -> [walletAddress, ...]

// Server metrics
const metrics = {
  totalConnections: 0,
  activeConnections: 0,
  messagesProcessed: 0,
  offersForwarded: 0,
  answersForwarded: 0,
  iceCandidatesForwarded: 0,
  errorsEncountered: 0,
  startTime: Date.now(),
};

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activePeers: peers.size,
    totalConnections: metrics.totalConnections,
    messagesProcessed: metrics.messagesProcessed,
    uptime: `${uptime}s`,
    config: {
      maxPeers: CONFIG.MAX_PEERS,
      heartbeatInterval: CONFIG.HEARTBEAT_INTERVAL,
      connectionTimeout: CONFIG.CONNECTION_TIMEOUT,
    },
  });
});

/**
 * Metrics endpoint
 */
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  res.json({
    ...metrics,
    activePeers: peers.size,
    uptime: `${uptime}s`,
    avgMessagesPerConnection: Math.floor(metrics.messagesProcessed / (metrics.totalConnections || 1)),
  });
});

/**
 * Get connected peers (excludes self)
 */
app.get('/peers', (req, res) => {
  const peerList = Array.from(peers.keys()).map((addr) => ({
    address: addr.slice(0, 6) + '...',
    fullAddress: addr,
  }));
  res.json({
    peers: peerList,
    count: peerList.length,
  });
});

/**
 * WebSocket connection handler
 */
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  console.log(`[Server] 🔗 New WebSocket connection from ${ip}`);

  let currentPeer = null;
  let peerData = null;

  // Rate limiting: Check connections per IP
  if (!connectionsPerIp.has(ip)) {
    connectionsPerIp.set(ip, []);
  }

  const ipConnections = connectionsPerIp.get(ip);
  if (ipConnections.length >= CONFIG.MAX_CONNECTIONS_PER_IP) {
    console.warn(`[Server] ⚠️  Rate limit exceeded for IP: ${ip}`);
    ws.close(1008, 'Too many connections from this IP');
    return;
  }

  // Check max peers
  if (peers.size >= CONFIG.MAX_PEERS) {
    console.warn(`[Server] ⚠️  Server at max capacity (${CONFIG.MAX_PEERS} peers)`);
    ws.close(1008, 'Server at capacity');
    return;
  }

  metrics.totalConnections++;
  metrics.activeConnections++;

  // Connection timeout
  let connectionTimeoutId = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.warn(`[Server] ⚠️  Connection timeout for ${currentPeer || ip}`);
      ws.close(1000, 'Connection timeout');
    }
  }, CONFIG.CONNECTION_TIMEOUT);

  ws.on('message', (message) => {
    try {
      if (!message || message.length === 0) {
        console.warn('[Server] ⚠️  Received empty message');
        return;
      }

      // Check message size
      if (message.length > CONFIG.MAX_MESSAGE_SIZE) {
        console.warn('[Server] ⚠️  Message exceeds max size');
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Message too large' }));
        return;
      }

      const data = JSON.parse(message);
      console.log(`[Server] 📨 Message type: ${data.type}`);

      // Rate limiting: Per-peer message rate
      if (currentPeer && peerData) {
        const now = Date.now();
        if (now - peerData.messageWindow > CONFIG.MESSAGE_RATE_WINDOW) {
          peerData.messageCount = 0;
          peerData.messageWindow = now;
        }

        peerData.messageCount++;
        if (peerData.messageCount > CONFIG.MESSAGE_RATE_LIMIT) {
          console.warn(
            `[Server] ⚠️  Rate limit exceeded for peer: ${currentPeer.slice(0, 6)}...`
          );
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              message: 'Message rate limit exceeded',
            })
          );
          return;
        }
      }

      peerData.lastActivity = Date.now();
      metrics.messagesProcessed++;

      switch (data.type) {
        case 'JOIN':
          handleJoin(ws, data, ip, connectionTimeoutId);
          currentPeer = data.walletAddress;
          break;

        case 'OFFER':
          handleOffer(ws, data);
          metrics.offersForwarded++;
          break;

        case 'ANSWER':
          handleAnswer(ws, data);
          metrics.answersForwarded++;
          break;

        case 'ICE_CANDIDATE':
          handleIceCandidate(ws, data);
          metrics.iceCandidatesForwarded++;
          break;

        case 'LEAVE':
          handleLeave(currentPeer, ip);
          currentPeer = null;
          break;

        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;

        case 'PONG':
          // Client acknowledges heartbeat
          break;

        default:
          console.warn(`[Server] ⚠️  Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('[Server] ❌ Message parsing error:', error.message);
      metrics.errorsEncountered++;
      try {
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Invalid message format',
          })
        );
      } catch (sendErr) {
        console.error('[Server] ❌ Failed to send error:', sendErr.message);
      }
    }
  });

  ws.on('close', () => {
    console.log(`[Server] 👋 WebSocket closed for ${currentPeer || ip}`);
    
    clearTimeout(connectionTimeoutId);
    if (currentPeer) {
      handleLeave(currentPeer, ip);
    }

    metrics.activeConnections--;
  });

  ws.on('error', (error) => {
    console.error('[Server] ❌ WebSocket error:', error.message);
    metrics.errorsEncountered++;
    
    clearTimeout(connectionTimeoutId);
    if (currentPeer) {
      handleLeave(currentPeer, ip);
    }
  });

  // Track for rate limiting
  ws._peerId = null;
});

/**
 * Handle peer joining the network
 */
function handleJoin(ws, data, ip, connectionTimeoutId) {
  const { walletAddress, peerId } = data;

  if (!walletAddress || !peerId) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Missing walletAddress or peerId',
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  // Clear connection timeout on successful JOIN
  clearTimeout(connectionTimeoutId);

  // Check if peer already exists
  if (peers.has(walletAddress)) {
    console.warn(
      `[Server] ⚠️  Peer ${walletAddress.slice(0, 6)}... already connected, replacing...`
    );
    const oldPeer = peers.get(walletAddress);
    if (oldPeer?.ws && oldPeer.ws.readyState === WebSocket.OPEN) {
      try {
        oldPeer.ws.close(1000, 'Duplicate connection');
      } catch (err) {
        console.warn('[Server] ⚠️  Failed to close old connection:', err.message);
      }
    }

    // Remove from IP tracking
    const oldIp = oldPeer.ip;
    if (connectionsPerIp.has(oldIp)) {
      const ipConns = connectionsPerIp.get(oldIp);
      const idx = ipConns.indexOf(walletAddress);
      if (idx > -1) {
        ipConns.splice(idx, 1);
      }
    }
  }

  // Store peer connection
  const peerData = {
    ws,
    peerId,
    ip,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    messageWindow: Date.now(),
    heartbeatTimeout: null,
  };

  peers.set(walletAddress, peerData);
  connectionsPerIp.get(ip).push(walletAddress);

  console.log(`[Server] ✅ Peer joined: ${walletAddress.slice(0, 6)}...`);

  // Send list of connected peers to the new peer
  const connectedPeers = Array.from(peers.keys()).filter(
    (addr) => addr !== walletAddress
  );

  try {
    ws.send(
      JSON.stringify({
        type: 'JOIN_SUCCESS',
        message: 'Successfully joined the network',
        peers: connectedPeers,
        yourAddress: walletAddress,
      })
    );
  } catch (err) {
    console.error('[Server] ❌ Failed to send JOIN_SUCCESS:', err.message);
    metrics.errorsEncountered++;
  }

  // Start heartbeat for this peer
  startHeartbeat(walletAddress, peerData);

  // Notify all other peers about the new peer
  broadcastToOthers(walletAddress, {
    type: 'PEER_JOINED',
    walletAddress,
    peerId,
  });
}

/**
 * Start heartbeat mechanism for a peer
 */
function startHeartbeat(walletAddress, peerData) {
  const sendPing = () => {
    if (peerData.ws && peerData.ws.readyState === WebSocket.OPEN) {
      try {
        peerData.ws.send(JSON.stringify({ type: 'PING' }));
      } catch (err) {
        console.error(
          `[Server] ❌ Failed to send PING to ${walletAddress.slice(0, 6)}...`,
          err.message
        );
      }
    }

    peerData.heartbeatTimeout = setTimeout(sendPing, CONFIG.HEARTBEAT_INTERVAL);
  };

  peerData.heartbeatTimeout = setTimeout(sendPing, CONFIG.HEARTBEAT_INTERVAL);
}

/**
 * Handle WebRTC offer
 */
function handleOffer(ws, data) {
  const { from, to, offer } = data;

  if (!from || !to || !offer) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Invalid offer format',
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  const targetPeer = peers.get(to);
  if (!targetPeer) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: `Peer ${to} is not connected`,
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  // Send offer to target peer
  try {
    targetPeer.ws.send(
      JSON.stringify({
        type: 'OFFER',
        from,
        offer,
      })
    );
  } catch (err) {
    console.error('[Server] ❌ Failed to send offer:', err.message);
    metrics.errorsEncountered++;
  }

  console.log(
    `[Server] 📤 Offer sent from ${from.slice(0, 6)}... to ${to.slice(0, 6)}...`
  );
}

/**
 * Handle WebRTC answer
 */
function handleAnswer(ws, data) {
  const { from, to, answer } = data;

  if (!from || !to || !answer) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Invalid answer format',
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  const targetPeer = peers.get(to);
  if (!targetPeer) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: `Peer ${to} is not connected`,
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  // Send answer to target peer
  try {
    targetPeer.ws.send(
      JSON.stringify({
        type: 'ANSWER',
        from,
        answer,
      })
    );
  } catch (err) {
    console.error('[Server] ❌ Failed to send answer:', err.message);
    metrics.errorsEncountered++;
  }

  console.log(
    `[Server] 📤 Answer sent from ${from.slice(0, 6)}... to ${to.slice(0, 6)}...`
  );
}

/**
 * Handle ICE candidates
 */
function handleIceCandidate(ws, data) {
  const { from, to, candidate } = data;

  if (!from || !to || !candidate) {
    try {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Invalid ICE candidate format',
        })
      );
    } catch (err) {
      console.error('[Server] ❌ Failed to send error:', err.message);
    }
    return;
  }

  const targetPeer = peers.get(to);
  if (!targetPeer) {
    console.warn(
      `[Server] ⚠️  Target peer ${to} not found for ICE candidate`
    );
    return;
  }

  // Send ICE candidate to target peer
  try {
    targetPeer.ws.send(
      JSON.stringify({
        type: 'ICE_CANDIDATE',
        from,
        candidate,
      })
    );
  } catch (err) {
    console.error('[Server] ❌ Failed to send ICE candidate:', err.message);
    metrics.errorsEncountered++;
  }
}

/**
 * Handle peer leaving
 */
function handleLeave(walletAddress, ip) {
  if (!walletAddress) return;

  const peerData = peers.get(walletAddress);
  if (peerData) {
    // Clear heartbeat
    if (peerData.heartbeatTimeout) {
      clearTimeout(peerData.heartbeatTimeout);
    }

    // Remove from peers
    peers.delete(walletAddress);

    // Remove from IP tracking
    if (connectionsPerIp.has(ip)) {
      const ipConns = connectionsPerIp.get(ip);
      const idx = ipConns.indexOf(walletAddress);
      if (idx > -1) {
        ipConns.splice(idx, 1);
      }
    }
  }

  // Notify all other peers
  broadcastToAll({
    type: 'PEER_LEFT',
    walletAddress,
  });

  console.log(`[Server] ❌ Peer left: ${walletAddress.slice(0, 6)}...`);
}

/**
 * Broadcast message to all peers
 */
function broadcastToAll(message) {
  const payload = JSON.stringify(message);
  peers.forEach((peer, address) => {
    if (peer.ws && peer.ws.readyState === WebSocket.OPEN) {
      try {
        peer.ws.send(payload);
      } catch (err) {
        console.error(`[Server] ❌ Broadcast error to ${address.slice(0, 6)}...`, err.message);
      }
    }
  });
}

/**
 * Broadcast message to all peers except sender
 */
function broadcastToOthers(excludeAddress, message) {
  const payload = JSON.stringify(message);
  peers.forEach((peer, address) => {
    if (
      address !== excludeAddress &&
      peer.ws &&
      peer.ws.readyState === WebSocket.OPEN
    ) {
      try {
        peer.ws.send(payload);
      } catch (err) {
        console.error(`[Server] ❌ Broadcast error to ${address.slice(0, 6)}...`, err.message);
      }
    }
  });
}

/**
 * Periodic cleanup of stale connections
 */
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [walletAddress, peerData] of peers.entries()) {
    const idleTime = now - peerData.lastActivity;

    // Close connections idle for too long
    if (idleTime > CONFIG.CONNECTION_TIMEOUT * 2) {
      console.warn(
        `[Server] ⚠️  Closing stale connection for ${walletAddress.slice(0, 6)}...`
      );
      try {
        peerData.ws.close(1000, 'Idle timeout');
      } catch (err) {
        console.warn('[Server] ⚠️  Failed to close stale connection:', err.message);
      }
      handleLeave(walletAddress, peerData.ip);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `[Server] 🧹 Cleaned up ${cleanedCount} stale connections`
    );
  }
}, 60000); // Run every minute

/**
 * Start server
 */
const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Production Signaling Server Started`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`👥 Peers list: http://localhost:${PORT}/peers`);
  console.log(`⚙️  Config:`);
  console.log(`   - Max peers: ${CONFIG.MAX_PEERS}`);
  console.log(`   - Max connections per IP: ${CONFIG.MAX_CONNECTIONS_PER_IP}`);
  console.log(`   - Message rate limit: ${CONFIG.MESSAGE_RATE_LIMIT} msg/min per peer`);
  console.log(`   - Heartbeat interval: ${CONFIG.HEARTBEAT_INTERVAL}ms`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');

  // Notify all peers
  const closeMessage = JSON.stringify({
    type: 'SERVER_SHUTDOWN',
    message: 'Server is shutting down',
  });

  peers.forEach((peerData) => {
    try {
      if (peerData.ws && peerData.ws.readyState === WebSocket.OPEN) {
        peerData.ws.send(closeMessage);
        peerData.ws.close(1001, 'Server shutdown');
      }
      if (peerData.heartbeatTimeout) {
        clearTimeout(peerData.heartbeatTimeout);
      }
    } catch (err) {
      console.warn('⚠️  Error closing peer connection:', err.message);
    }
  });

  server.close(() => {
    console.log('✅ Server closed');
    console.log(`📊 Final metrics: ${metrics.totalConnections} total connections, ${metrics.messagesProcessed} messages processed`);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received');
  process.emit('SIGTERM');
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  metrics.errorsEncountered++;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  metrics.errorsEncountered++;
});


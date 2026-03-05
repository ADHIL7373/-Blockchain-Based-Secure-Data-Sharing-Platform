import { MESSAGE_TYPES } from '../utils/constants.js';

/**
 * ============================================================================
 * PRODUCTION-GRADE WEBSOCKET SOCKET SERVICE
 * ============================================================================
 * 
 * This service implements:
 * - Singleton pattern (only ONE WebSocket instance)
 * - Proper state machine (DISCONNECTED -> CONNECTING -> CONNECTED -> RECONNECTING)
 * - Exponential backoff with jitter
 * - Heartbeat/ping mechanism
 * - Proper resource cleanup (no memory leaks)
 * - Connection timeout handling
 * - Graceful degradation
 * - Comprehensive error handling
 * - Production-grade logging
 */

// Connection states
const STATES = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  FAILED: 'FAILED',
};

// Singleton instance
let socketServiceInstance = null;

export class SocketService {
  constructor(signalingServerUrl) {
    // Prevent multiple instances
    if (socketServiceInstance) {
      throw new Error(
        '❌ SocketService is a singleton. Use SocketService.getInstance() instead.'
      );
    }

    // Configuration
    this.signalingServerUrl = signalingServerUrl;
    this.maxRetries = 5;
    this.baseRetryDelay = 1000; // 1 second
    this.maxRetryDelay = 30000; // 30 seconds
    this.heartbeatInterval = 30000; // 30 seconds
    this.connectionTimeout = 10000; // 10 seconds

    // State management
    this.state = STATES.DISCONNECTED;
    this.ws = null;
    this.walletAddress = null;
    this.peerId = null;
    this.retryCount = 0;
    this.retryTimeoutId = null;
    this.heartbeatTimeoutId = null;
    this.connectionTimeoutId = null;

    // Event listeners (with cleanup tracking)
    this.listeners = new Map();
    this.internalListeners = new Map();

    // Metrics
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
    };

    console.log('[SocketService] Initialized with URL:', signalingServerUrl);
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(signalingServerUrl) {
    if (!socketServiceInstance) {
      socketServiceInstance = new SocketService(signalingServerUrl);
    }
    return socketServiceInstance;
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return (
      this.state === STATES.CONNECTED &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    );
  }

  /**
   * Connect to signaling server with proper error handling
   * @param {string} walletAddress - User's wallet address
   * @param {string} peerId - Unique peer ID
   * @returns {Promise<void>}
   */
  async connect(walletAddress, peerId) {
    // Validation
    if (!walletAddress || !peerId) {
      throw new Error('❌ walletAddress and peerId are required');
    }

    // Already connected
    if (this.isConnected()) {
      console.log(
        '[SocketService] Already connected, skipping connection attempt'
      );
      return;
    }

    // Already connecting
    if (this.state === STATES.CONNECTING) {
      console.log('[SocketService] Connection attempt already in progress');
      return;
    }

    this.walletAddress = walletAddress;
    this.peerId = peerId;

    return this._attemptConnect();
  }

  /**
   * Internal connection attempt with retry logic
   * @private
   */
  _attemptConnect() {
    return new Promise((resolve, reject) => {
      // Prevent parallel connection attempts
      if (this.state === STATES.CONNECTING) {
        reject(new Error('Connection attempt already in progress'));
        return;
      }

      this.state = STATES.CONNECTING;
      this.metrics.connectionAttempts++;

      // Clean up old connection
      this._cleanupWebSocket();

      console.log(
        `[SocketService] Attempting connection (attempt ${this.retryCount + 1}/${this.maxRetries + 1})`
      );

      let connectionResolved = false;

      try {
        // Create new WebSocket with options
        this.ws = new WebSocket(this.signalingServerUrl, {
          // Custom headers if needed for authentication
        });

        // Prevent binary data
        this.ws.binaryType = 'arraybuffer';

        // Connection established
        this.ws.onopen = () => {
          if (connectionResolved) return;
          connectionResolved = true;

          console.log('[SocketService] WebSocket connected');
          this.state = STATES.CONNECTED;
          this.retryCount = 0;
          this.metrics.successfulConnections++;

          // Emit connection event
          this._emit('connected', { state: this.state });

          // Send JOIN message
          this._sendJoinMessage()
            .then(() => {
              console.log('[SocketService] JOIN message sent, connection ready');
              this._startHeartbeat();
              resolve();
            })
            .catch((error) => {
              console.error('[SocketService] Failed to send JOIN:', error);
              this.state = STATES.FAILED;
              this._cleanupWebSocket();
              reject(error);
            });
        };

        // Message received
        this.ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };

        // Connection error
        this.ws.onerror = (event) => {
          console.error('[SocketService] WebSocket error:', event);
          this._handleConnectionError(connectionResolved, resolve, reject);
          connectionResolved = true;
        };

        // Connection closed
        this.ws.onclose = (event) => {
          console.log(
            '[SocketService] WebSocket closed. Code:',
            event.code,
            'Reason:',
            event.reason
          );
          this._handleConnectionClosed();
        };

        // Connection timeout
        this.connectionTimeoutId = setTimeout(() => {
          if (!connectionResolved) {
            connectionResolved = true;
            console.error('[SocketService] Connection timeout');
            this._handleConnectionError(true, resolve, reject);
          }
        }, this.connectionTimeout);
      } catch (error) {
        connectionResolved = true;
        console.error('[SocketService] Failed to create WebSocket:', error);
        this.state = STATES.FAILED;
        this._handleConnectionError(true, resolve, reject);
      }
    });
  }

  /**
   * Send JOIN message
   * @private
   */
  _sendJoinMessage() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not ready'));
          return;
        }

        const message = JSON.stringify({
          type: MESSAGE_TYPES.JOIN,
          walletAddress: this.walletAddress,
          peerId: this.peerId,
        });

        this.ws.send(message);
        this.metrics.messagesSent++;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   * @private
   */
  _handleMessage(data) {
    try {
      if (!data || data.length === 0) {
        return;
      }

      const message = JSON.parse(data);
      this.metrics.messagesReceived++;

      // Handle ping/pong
      if (message.type === 'PING') {
        this._handlePing();
        return;
      }

      if (message.type === 'PONG') {
        this._handlePong();
        return;
      }

      // Emit to listeners
      this._emit(message.type, message);
    } catch (error) {
      console.error('[SocketService] Failed to parse message:', error);
    }
  }

  /**
   * Handle ping from server
   * @private
   */
  _handlePing() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (error) {
      console.error('[SocketService] Failed to send PONG:', error);
    }
  }

  /**
   * Handle pong from server
   * @private
   */
  _handlePong() {
    // Reset heartbeat timer
    this._resetHeartbeatTimer();
  }

  /**
   * Start heartbeat mechanism
   * @private
   */
  _startHeartbeat() {
    this._resetHeartbeatTimer();
  }

  /**
   * Reset heartbeat timer
   * @private
   */
  _resetHeartbeatTimer() {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    this.heartbeatTimeoutId = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        } catch (error) {
          console.error('[SocketService] Failed to send PING:', error);
          this._handleConnectionError(true, null, null);
        }
      }
    }, this.heartbeatInterval);
  }

  /**
   * Handle connection error
   * @private
   */
  _handleConnectionError(connectionResolved, resolve, reject) {
    this._cleanupWebSocket();
    this._stopHeartbeat();

    if (this.retryCount < this.maxRetries) {
      this.state = STATES.RECONNECTING;
      this._scheduleReconnect();

      if (resolve) {
        resolve(); // Allow app to continue, will reconnect in background
      }
    } else {
      this.state = STATES.FAILED;
      this.metrics.failedConnections++;

      const error = new Error(
        `Failed to connect after ${this.maxRetries + 1} attempts`
      );

      if (reject) {
        reject(error);
      }

      this._emit('CONNECTION_FAILED', error);
    }
  }

  /**
   * Handle connection closed
   * @private
   */
  _handleConnectionClosed() {
    this._stopHeartbeat();

    if (this.state === STATES.CONNECTED) {
      // Unexpected close, attempt reconnect
      if (this.retryCount < this.maxRetries) {
        this.state = STATES.RECONNECTING;
        this._scheduleReconnect();
      } else {
        this.state = STATES.FAILED;
      }
    } else {
      this.state = STATES.DISCONNECTED;
    }

    this._emit('DISCONNECTED', {});
  }

  /**
   * Schedule reconnect attempt with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Calculate delay with exponential backoff and jitter
    const exponentialDelay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.retryCount),
      this.maxRetryDelay
    );

    // Add jitter (±50% of the delay)
    const jitter = exponentialDelay * (0.5 + Math.random());
    const delay = Math.min(jitter, this.maxRetryDelay);

    this.retryCount++;

    console.log(
      `[SocketService] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.retryCount}/${this.maxRetries + 1})`
    );

    this.retryTimeoutId = setTimeout(() => {
      if (
        this.state === STATES.RECONNECTING ||
        this.state === STATES.FAILED
      ) {
        this._attemptConnect()
          .then(() => {
            console.log('[SocketService] Reconnected successfully');
            this._emit('RECONNECTED', {});
          })
          .catch((error) => {
            console.error('[SocketService] Reconnection failed:', error);
          });
      }
    }, delay);
  }

  /**
   * Clean up WebSocket
   * @private
   */
  _cleanupWebSocket() {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Cleanup');
        }
      } catch (error) {
        console.warn('[SocketService] Error closing WebSocket:', error);
      }

      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws = null;
    }
  }

  /**
   * Stop heartbeat
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  /**
   * Disconnect gracefully
   */
  disconnect() {
    console.log('[SocketService] Disconnecting');

    // Cancel pending reconnects
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    // Send LEAVE message
    if (this.isConnected()) {
      try {
        this.ws.send(
          JSON.stringify({
            type: MESSAGE_TYPES.LEAVE,
            walletAddress: this.walletAddress,
          })
        );
      } catch (error) {
        console.warn('[SocketService] Failed to send LEAVE:', error);
      }
    }

    // Clean up
    this._cleanupWebSocket();
    this._stopHeartbeat();

    this.state = STATES.DISCONNECTED;
    this.retryCount = 0;
    this.walletAddress = null;
    this.peerId = null;

    this._emit('DISCONNECTED', {});
  }

  /**
   * Send message
   */
  send(message) {
    if (!this.isConnected()) {
      throw new Error(
        `Cannot send message. Connection state: ${this.state}`
      );
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.metrics.messagesSent++;
    } catch (error) {
      console.error('[SocketService] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(to, offer) {
    this.send({
      type: MESSAGE_TYPES.OFFER,
      from: this.walletAddress,
      to,
      offer: offer.sdp,
    });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(to, answer) {
    this.send({
      type: MESSAGE_TYPES.ANSWER,
      from: this.walletAddress,
      to,
      answer: answer.sdp,
    });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(to, candidate) {
    this.send({
      type: MESSAGE_TYPES.ICE_CANDIDATE,
      from: this.walletAddress,
      to,
      candidate: candidate.candidate,
    });
  }

  /**
   * Listen for events
   */
  on(type, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(callback);

    // Return unsubscribe function
    return () => this.off(type, callback);
  }

  /**
   * Remove listener
   */
  off(type, callback) {
    if (!this.listeners.has(type)) return;

    const callbacks = this.listeners.get(type);
    const index = callbacks.indexOf(callback);

    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event
   * @private
   */
  _emit(type, data) {
    if (this.listeners.has(type)) {
      const callbacks = [...this.listeners.get(type)];

      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `[SocketService] Error in listener for ${type}:`,
            error
          );
        }
      });
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      isConnected: this.isConnected(),
      retryCount: this.retryCount,
      walletAddress: this.walletAddress ? this.walletAddress.slice(0, 6) + '...' : null,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
    };
  }

  /**
   * Check if connected (backward compatible alias)
   */
  isConnectedToServer() {
    return this.isConnected();
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    this.disconnect();
    this.listeners.clear();
    this.internalListeners.clear();
    socketServiceInstance = null;
  }
}

/**
 * Initialize socket service (singleton)
 */
export function initializeSocket(signalingServerUrl) {
  return SocketService.getInstance(signalingServerUrl);
}

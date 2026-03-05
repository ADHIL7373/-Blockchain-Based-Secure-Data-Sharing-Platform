import { useEffect, useRef, useState, useCallback } from 'react';
import { SocketService } from '../services/socketService.js';

/**
 * ============================================================================
 * REACT HOOK: useSocketService
 * ============================================================================
 * 
 * Properly manages WebSocket lifecycle in React components
 * 
 * Features:
 * - Automatic cleanup on component unmount
 * - Listener registration/deregistration
 * - Connection state tracking
 * - Error handling
 * - Metrics collection
 * 
 * Usage:
 * const socketService = useSocketService(signalingServerUrl);
 * 
 * useEffect(() => {
 *   socketService?.connect(walletAddress, peerId)
 *     .then(() => console.log('Connected'))
 *     .catch(err => console.error('Connection failed:', err));
 * }, [socketService]);
 * 
 * useEffect(() => {
 *   const unsubscribe = socketService?.on('OFFER', handleOffer);
 *   return () => unsubscribe?.();
 * }, [socketService]);
 */

export function useSocketService(signalingServerUrl) {
  const socketRef = useRef(null);
  const listenersRef = useRef([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [error, setError] = useState(null);

  // Initialize socket service (singleton)
  useEffect(() => {
    try {
      socketRef.current = SocketService.getInstance(signalingServerUrl);
      setConnectionState(socketRef.current.getState());
    } catch (err) {
      console.error('[useSocketService] Failed to initialize:', err);
      setError(err.message);
    }

    return () => {
      // Cleanup listeners on unmount
      listenersRef.current.forEach((listener) => {
        listener.unsubscribe();
      });
      listenersRef.current = [];
    };
  }, [signalingServerUrl]);

  // Track connection state
  useEffect(() => {
    if (!socketRef.current) return;

    const handleConnectionChange = () => {
      setConnectionState(socketRef.current.getState());
      setIsConnected(socketRef.current.isConnected());
    };

    const handleError = (error) => {
      setError(error.message || 'Connection error occurred');
      console.error('[useSocketService] Error:', error);
    };

    const handleDisconnected = () => {
      handleConnectionChange();
    };

    const handleReconnected = () => {
      handleConnectionChange();
      setError(null);
    };

    // Register internal listeners
    socketRef.current.on('CONNECTION_FAILED', handleError);
    socketRef.current.on('DISCONNECTED', handleDisconnected);
    socketRef.current.on('RECONNECTED', handleReconnected);

    // Check initial state
    handleConnectionChange();

    return () => {
      if (socketRef.current) {
        socketRef.current.off('CONNECTION_FAILED', handleError);
        socketRef.current.off('DISCONNECTED', handleDisconnected);
        socketRef.current.off('RECONNECTED', handleReconnected);
      }
    };
  }, []);

  /**
   * Connect to signaling server
   */
  const connect = useCallback(
    async (walletAddress, peerId) => {
      try {
        if (!socketRef.current) {
          throw new Error('Socket service not initialized');
        }

        setError(null);
        await socketRef.current.connect(walletAddress, peerId);
        setConnectionState(socketRef.current.getState());
        setIsConnected(socketRef.current.isConnected());
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  /**
   * Disconnect from signaling server
   */
  const disconnect = useCallback(() => {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        setConnectionState(socketRef.current.getState());
        setIsConnected(false);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  /**
   * Send message
   */
  const send = useCallback((message) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket service not initialized');
      }
      socketRef.current.send(message);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Send offer
   */
  const sendOffer = useCallback((to, offer) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket service not initialized');
      }
      socketRef.current.sendOffer(to, offer);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Send answer
   */
  const sendAnswer = useCallback((to, answer) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket service not initialized');
      }
      socketRef.current.sendAnswer(to, answer);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Send ICE candidate
   */
  const sendIceCandidate = useCallback((to, candidate) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket service not initialized');
      }
      socketRef.current.sendIceCandidate(to, candidate);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Listen for events
   * Returns unsubscribe function
   */
  const on = useCallback((type, callback) => {
    try {
      if (!socketRef.current) {
        throw new Error('Socket service not initialized');
      }

      const unsubscribe = socketRef.current.on(type, callback);
      listenersRef.current.push({ type, callback, unsubscribe });

      return () => {
        unsubscribe();
        listenersRef.current = listenersRef.current.filter(
          (l) => !(l.type === type && l.callback === callback)
        );
      };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Get metrics
   */
  const getMetrics = useCallback(() => {
    return socketRef.current?.getMetrics() || null;
  }, []);

  /**
   * Get current state
   */
  const getState = useCallback(() => {
    return socketRef.current?.getState() || 'DISCONNECTED';
  }, []);

  return {
    // Methods
    connect,
    disconnect,
    send,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    on,
    getMetrics,
    getState,

    // State
    isConnected,
    connectionState,
    error,

    // Reference
    service: socketRef.current,
  };
}

export default useSocketService;

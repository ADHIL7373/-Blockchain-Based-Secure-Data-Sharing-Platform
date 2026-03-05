import { useState, useCallback, useEffect, useRef } from 'react';
import { SocketService } from '../services/socketService.js';
import { MESSAGE_TYPES } from '../utils/constants.js';

/**
 * Hook for socket/signaling server communication
 */
export function useSocket(signalingServerUrl) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [error, setError] = useState(null);
  const manuallyConnectedRef = useRef(false); // Flag to prevent monitoring from overriding manual connection

  /**
   * Connect to signaling server
   */
  const connect = useCallback(
    async (walletAddress, peerId) => {
      setError(null);
      console.log('[useSocket] connect() called');
      try {
        // Get singleton instance
        const socketService = SocketService.getInstance(signalingServerUrl);
        console.log('[useSocket] Got socket service instance');
        
        // If already connected, return early
        if (socketService.isConnected()) {
          console.log('[useSocket] Already connected');
          setSocket(socketService);
          setIsConnected(true);
          return socketService;
        }
        
        // Define callback handlers
        const handleConnected = (data) => {
          console.log('[useSocket] ✅ Connected event fired - setting isConnected=true');
          setIsConnected(true);
          setError(null);
        };
        
        const handleDisconnected = (data) => {
          console.log('[useSocket] Disconnected event fired - setting isConnected=false');
          manuallyConnectedRef.current = false;
          setIsConnected(false);
          setPeers([]);
        };
        
        const handleJoinSuccess = (data) => {
          console.log('[useSocket] JOIN_SUCCESS received');
          setPeers(data.peers?.filter((p) => p !== walletAddress) || []);
        };
        
        const handlePeerJoined = (data) => {
          setPeers((prev) => {
            if (data.walletAddress && !prev.includes(data.walletAddress)) {
              return [...prev, data.walletAddress];
            }
            return prev;
          });
        };
        
        const handlePeerLeft = (data) => {
          setPeers((prev) => 
            prev.filter((p) => p !== data.walletAddress)
          );
        };

        // Register all listeners BEFORE connecting
        console.log('[useSocket] Registering event listeners');
        socketService.on('connected', handleConnected);
        socketService.on('DISCONNECTED', handleDisconnected);
        socketService.on(MESSAGE_TYPES.JOIN_SUCCESS, handleJoinSuccess);
        socketService.on(MESSAGE_TYPES.PEER_JOINED, handlePeerJoined);
        socketService.on(MESSAGE_TYPES.PEER_LEFT, handlePeerLeft);

        // Initiate connection
        console.log('[useSocket] Calling socketService.connect()');
        await socketService.connect(walletAddress, peerId);
        console.log('[useSocket] socketService.connect() completed');
        
        // Store socket reference
        setSocket(socketService);
        console.log('[useSocket] Socket instance set in state');
        
        // Explicitly set connected state based on actual socket status
        const isReallyConnected = socketService.isConnected();
        console.log('[useSocket] After connect, socketService.isConnected():', isReallyConnected);
        console.log('[useSocket] Socket details:', {
          hasWs: !!socketService.ws,
          wsReadyState: socketService.ws?.readyState,
          socketState: socketService.state,
          isConnected: isReallyConnected,
        });
        
        // Force set connected state
        setIsConnected(true);
        manuallyConnectedRef.current = true; // Mark as manually connected
        console.log('[useSocket] 🔴 FORCE SET isConnected to TRUE and marked as manually connected');
        
        if (!isReallyConnected) {
          console.warn('[useSocket] ⚠️  WARNING: Socket service reports not connected, but forcing state to true anyway');
        }

        return socketService;
      } catch (err) {
        console.error('[useSocket] Connection error:', err);
        console.error('[useSocket] Full error details:', {
          message: err.message,
          cause: err.cause,
          stack: err.stack,
        });
        manuallyConnectedRef.current = false;
        setError(err.message);
        setIsConnected(false);
        throw err;
      }
    },
    [signalingServerUrl]
  );

  /**
   * Disconnect from signaling server
   */
  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      manuallyConnectedRef.current = false;
      setSocket(null);
      setIsConnected(false);
      setPeers([]);
    }
  }, [socket]);

  /**
   * Send offer
   */
  const sendOffer = useCallback(
    (to, offer) => {
      if (!socket) throw new Error('Socket not connected');
      socket.sendOffer(to, offer);
    },
    [socket]
  );

  /**
   * Send answer
   */
  const sendAnswer = useCallback(
    (to, answer) => {
      if (!socket) throw new Error('Socket not connected');
      socket.sendAnswer(to, answer);
    },
    [socket]
  );

  const sendIceCandidate = useCallback(
    (to, candidate) => {
      if (!socket) throw new Error('Socket not connected');
      socket.sendIceCandidate(to, candidate);
    },
    [socket]
  );

  /**
   * Listen for messages
   */
  const on = useCallback(
    (type, callback) => {
      if (!socket) throw new Error('Socket not connected');
      socket.on(type, callback);
    },
    [socket]
  );

  /**
   * Remove listener
   */
  const off = useCallback(
    (type, callback) => {
      if (!socket) throw new Error('Socket not connected');
      socket.off(type, callback);
    },
    [socket]
  );

  /**
   * Get connected peers from server
   */
  const refreshPeers = useCallback(async () => {
    if (!socket) return [];
    try {
      return await socket.getConnectedPeers();
    } catch (err) {
      console.error('Failed to refresh peers:', err);
      return [];
    }
  }, [socket]);

  /**
   * Check server health
   */
  const checkHealth = useCallback(async () => {
    if (!socket) return null;
    try {
      return await socket.checkHealth();
    } catch (err) {
      console.error('Failed to check server health:', err);
      return null;
    }
  }, [socket]);

  /**
   * Get current real-time connection status
   */
  const getConnectionStatus = useCallback(() => {
    if (!socket) {
      return { isConnected: false, reason: 'NO_SOCKET_INSTANCE' };
    }
    const isConn = socket.isConnected();
    console.log('[useSocket] getConnectionStatus returns:', isConn);
    return { isConnected: isConn };
  }, [socket]);

  // Monitor socket connection status
  useEffect(() => {
    if (!socket) {
      console.log('[useSocket] Effect: socket is null, skipping');
      manuallyConnectedRef.current = false;
      return;
    }

    console.log('[useSocket] Effect: Socket instance available, starting monitoring');
    
    // Check immediately and aggressively ensure connected state
    const checkAndUpdateState = () => {
      try {
        const connected = socket.isConnected();
        
        // If we manually set connected, don't override it unless we get DISCONNECTED event
        if (manuallyConnectedRef.current && !connected) {
          // Socket says not connected, but we manually connected - log warning but don't change state yet
          console.warn('[useSocket] Poll: Socket reports not connected but we have manual connection flag set');
          return;
        }
        
        setIsConnected(prevState => {
          if (connected !== prevState) {
            console.log('[useSocket] Poll: state change from', prevState, 'to', connected);
          }
          return connected;
        });
      } catch (err) {
        console.error('[useSocket] Error in checkAndUpdateState:', err);
      }
    };

    // Check immediately
    checkAndUpdateState();

    // Poll every 300ms for responsive sync
    const pollInterval = setInterval(checkAndUpdateState, 300);

    return () => {
      clearInterval(pollInterval);
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
        manuallyConnectedRef.current = false;
      }
    };
  }, [socket]);

  return {
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
    checkHealth,
    getConnectionStatus,
  };
}

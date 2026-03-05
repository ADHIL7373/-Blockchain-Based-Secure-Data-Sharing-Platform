import { useState, useCallback, useRef, useEffect } from 'react';
import { TRANSFER_STATUS } from '../utils/constants.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

/**
 * Hook for WebRTC data channel communication
 */
export function useWebRTC(socketService) {
  const [status, setStatus] = useState(TRANSFER_STATUS.IDLE);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteAddressRef = useRef(null);
  const isSenderRef = useRef(false);

  /**
   * Initialize peer connection
   */
  const initializePeerConnection = useCallback((isSender = false) => {
    setError(null);
    setStatus(TRANSFER_STATUS.CONNECTING);

    try {
      const peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS.iceServers,
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteAddressRef.current) {
          socketService.sendIceCandidate(remoteAddressRef.current, event.candidate);
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔗 Connection state: ${state}`);

        if (state === 'connected' || state === 'completed') {
          setIsConnected(true);
          setStatus(TRANSFER_STATUS.CONNECTED);
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setIsConnected(false);
          setStatus(TRANSFER_STATUS.ERROR);
          setError(`Connection ${state}`);
        }
      };

      // If sender, create data channel
      if (isSender) {
        const dataChannel = peerConnection.createDataChannel('file-transfer', {
          ordered: true,
          maxPacketLifeTime: 5000,
        });
        _setupDataChannel(dataChannel);
      } else {
        // If receiver, wait for data channel
        peerConnection.ondatachannel = (event) => {
          _setupDataChannel(event.channel);
        };
      }

      peerConnectionRef.current = peerConnection;
      isSenderRef.current = isSender;

      return peerConnection;
    } catch (err) {
      setError(err.message);
      setStatus(TRANSFER_STATUS.ERROR);
      throw err;
    }
  }, [socketService]);

  /**
   * Setup data channel
   */
  const _setupDataChannel = (dataChannel) => {
    dataChannelRef.current = dataChannel;

    dataChannel.onopen = () => {
      console.log('📤 Data channel opened');
      setIsConnected(true);
      setStatus(TRANSFER_STATUS.CONNECTED);
    };

    dataChannel.onclose = () => {
      console.log('📭 Data channel closed');
      setIsConnected(false);
    };

    dataChannel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
      setError(error.message);
    };
  };

  /**
   * Create and send offer
   */
  const createOffer = useCallback(
    async (remotePeerAddress) => {
      if (!peerConnectionRef.current) {
        throw new Error('Peer connection not initialized');
      }

      setError(null);
      try {
        remoteAddressRef.current = remotePeerAddress;

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        socketService.sendOffer(remotePeerAddress, offer);
        return offer;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [socketService]
  );

  /**
   * Handle incoming offer
   */
  const handleOffer = useCallback(
    async (offerData) => {
      if (!peerConnectionRef.current) {
        throw new Error('Peer connection not initialized');
      }

      setError(null);
      try {
        remoteAddressRef.current = offerData.from;

        const offer = new RTCSessionDescription({
          type: 'offer',
          sdp: offerData.offer,
        });

        await peerConnectionRef.current.setRemoteDescription(offer);

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socketService.sendAnswer(offerData.from, answer);
        return answer;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [socketService]
  );

  /**
   * Handle incoming answer
   */
  const handleAnswer = useCallback(async (answerData) => {
    if (!peerConnectionRef.current) {
      throw new Error('Peer connection not initialized');
    }

    setError(null);
    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.answer,
      });

      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Handle ICE candidate
   */
  const handleIceCandidate = useCallback(async (candidateData) => {
    if (!peerConnectionRef.current) {
      return;
    }

    try {
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
      });

      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (err) {
      console.error('Failed to add ICE candidate:', err);
    }
  }, []);

  /**
   * Send data through data channel with backpressure handling
   */
  const sendData = useCallback((data) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    try {
      // Check buffered amount to prevent overflow
      const bufferedAmount = dataChannelRef.current.bufferedAmount;
      if (bufferedAmount > 16 * 1024 * 1024) { // 16MB buffer limit
        console.warn(`⚠️  Data channel buffer high: ${(bufferedAmount / 1024 / 1024).toFixed(2)}MB`);
        throw new Error('Data channel buffer overflow - receiver too slow');
      }

      dataChannelRef.current.send(data);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);;

  /**
   * Listen for data (supports multiple listeners)
   */
  const dataListenersRef = useRef([]);
  
  const onDataReceived = useCallback(
    (callback) => {
      if (!dataChannelRef.current) {
        throw new Error('Data channel not initialized');
      }

      // Store callback reference
      dataListenersRef.current.push(callback);

      // Setup unified message handler
      dataChannelRef.current.onmessage = (event) => {
        dataListenersRef.current.forEach((listener) => {
          try {
            listener(event.data);
          } catch (err) {
            console.error('Error in data listener:', err);
          }
        });
      };
    },
    []
  );;

  /**
   * Close connection
   */
  const closeConnection = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIsConnected(false);
    setStatus(TRANSFER_STATUS.IDLE);
    setProgress(0);
  }, []);

  /**
   * Update progress
   */
  const updateProgress = useCallback((percentage) => {
    setProgress(Math.min(percentage, 100));
  }, []);

  return {
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
    peerConnection: peerConnectionRef.current,
    dataChannel: dataChannelRef.current,
  };
}

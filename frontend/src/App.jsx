import { useState, useEffect, useCallback, useRef } from 'react';
import { WalletConnect } from './components/WalletConnect';
import { FileUploader } from './components/FileUploader';
import { TransferReceiver } from './components/TransferReceiver';
import { ProgressBar } from './components/ProgressBar';
import { StatusDisplay } from './components/StatusDisplay';
import { useBlockchain } from './hooks/useBlockchain';
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useEncryption } from './hooks/useEncryption';
import { hashFile } from './utils/hashFile';
import { chunkFile, fileToBytes, formatFileSize } from './utils/chunkFile';
import { TRANSFER_STATUS, MESSAGE_TYPES } from './utils/constants';

const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'ws://localhost:8080';
const FILE_REGISTRY_ADDRESS = import.meta.env.VITE_FILE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000';

export function App() {
  const [mode, setMode] = useState('sender'); // sender or receiver
  const [wallet, setWallet] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [transferStatus, setTransferStatus] = useState(TRANSFER_STATUS.IDLE);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const isConnectingRef = useRef(false);

  const blockchain = useBlockchain();
  const socket = useSocket(SIGNALING_SERVER_URL);
  const encryption = useEncryption();
  const webrtc = useWebRTC(socket.socket);

  /**
   * Validate critical dependencies
   */
  useEffect(() => {
    if (!encryption) {
      setError('Encryption service failed to initialize');
    }
  }, []);

  /**
   * Initialize blockchain when wallet connects
   */
  useEffect(() => {
    if (wallet?.signer && FILE_REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      blockchain.initialize(FILE_REGISTRY_ADDRESS, wallet.signer);
    }
  }, [wallet]);

  /**
   * Initialize socket connection when wallet is connected
   */
  useEffect(() => {
    if (!wallet?.account || socket.isConnected || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    const connectSocket = async () => {
      try {
        console.log('🔗 Attempting to connect to signaling server...', wallet.account);
        const peerId = `${wallet.account}-${Date.now()}`;
        await socket.connect(wallet.account, peerId);
        console.log('✅ Successfully connected to signaling server');
        setSuccessMessage('✅ Connected to signaling server');
        setTimeout(() => setSuccessMessage(null), 4000);
        setError(null);
      } catch (err) {
        console.error('❌ Socket connection failed:', err);
        setError(`Signaling Server: ${err.message}`);
        // Don't crash the app - user can retry
        setTimeout(() => {
          setError(null);
        }, 5000);
      } finally {
        isConnectingRef.current = false;
      }
    };

    connectSocket();

    return () => {
      if (socket.isConnected) {
        console.log('👋 Disconnecting from signaling server');
        try {
          socket.disconnect();
        } catch (err) {
          console.warn('Error during disconnect:', err);
        }
      }
    };
  }, [wallet?.account, socket.connect, socket.isConnected, socket.disconnect]);

  /**
   * Setup WebRTC listeners
   */
  useEffect(() => {
    if (!socket.socket) return;

    // Define callback handlers
    const handleOffer = async (data) => {
      try {
        setTransferStatus(TRANSFER_STATUS.CONNECTING);
        webrtc.initializePeerConnection(false);
        await webrtc.handleOffer(data);
        setSuccessMessage('📨 File transfer offer received');
      } catch (err) {
        setError(`Failed to handle offer: ${err.message}`);
        setTransferStatus(TRANSFER_STATUS.ERROR);
      }
    };

    const handleAnswer = async (data) => {
      try {
        await webrtc.handleAnswer(data);
      } catch (err) {
        setError(`Failed to handle answer: ${err.message}`);
      }
    };

    const handleIceCandidate = async (data) => {
      try {
        await webrtc.handleIceCandidate(data);
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    };

    // Register listeners
    socket.on(MESSAGE_TYPES.OFFER, handleOffer);
    socket.on(MESSAGE_TYPES.ANSWER, handleAnswer);
    socket.on(MESSAGE_TYPES.ICE_CANDIDATE, handleIceCandidate);

    // Cleanup listeners on unmount
    return () => {
      socket.off(MESSAGE_TYPES.OFFER, handleOffer);
      socket.off(MESSAGE_TYPES.ANSWER, handleAnswer);
      socket.off(MESSAGE_TYPES.ICE_CANDIDATE, handleIceCandidate);
    };
  }, [socket.socket, webrtc]);

  /**
   * Handle wallet connection
   */
  const handleWalletConnect = (address, signer, network, signature) => {
    setWallet({ account: address, signer, network, signature });
    setError(null);
    setSuccessMessage('✅ Wallet connected successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  /**
   * Start file transfer (sender)
   */
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
          
          if (!result || !result.txHash) {
            throw new Error('Invalid blockchain registration response');
          }
          
          setSuccessMessage(`✅ File registered on blockchain: ${result.txHash.slice(0, 16)}...`);
        } catch (err) {
          console.warn('Blockchain registration failed:', err.message);
          setError('Blockchain registration failed, but continuing with transfer');
        }
      } else {
        console.warn('⚠️  Blockchain not initialized, skipping registration');
      }

      // Connect to peer and send file (after blockchain completes)
      setTransferStatus(TRANSFER_STATUS.CONNECTING);
      webrtc.initializePeerConnection(true);

      // Send offer to first available peer
      const targetPeer = socket.peers[0];
      const offer = await webrtc.createOffer(targetPeer);
      updateProgress(20);

      // Send chunks when connected
      webrtc.onDataReceived((data) => {
        try {
          if (data === 'READY') {
            sendFileChunks(encryptedData, key, iv, fileHash);
          }
        } catch (err) {
          setError(`Error handling receiver ready: ${err.message}`);
        }
      });

      setSuccessMessage('📤 Waiting for peer connection...');
    } catch (err) {
      setError(`Transfer failed: ${err.message}`);
      setTransferStatus(TRANSFER_STATUS.ERROR);
    }
  };

  /**
   * Send file chunks
   */
  const sendFileChunks = async (encryptedData, key, iv, fileHash) => {
    try {
      if (!encryptedData || encryptedData.length === 0) {
        throw new Error('No data to send');
      }

      const chunks = await chunkFile(encryptedData);
      const totalChunks = chunks.length;
      
      if (totalChunks === 0) {
        throw new Error('File resulted in zero chunks');
      }

      for (let i = 0; i < totalChunks; i++) {
        webrtc.sendData(chunks[i]);
        const progress = ((i + 1) / totalChunks) * 100;
        webrtc.updateProgress(progress);
        setSuccessMessage(`📤 Sending chunk ${i + 1}/${totalChunks}`);
      }

      // Send metadata
      webrtc.sendData(JSON.stringify({
        type: 'FILE_COMPLETE',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileHash,
        iv: Array.from(iv),
        encryptedKey: await encryption.exportKeyForTransfer(key),
      }));

      setTransferStatus(TRANSFER_STATUS.COMPLETED);
      setSuccessMessage('✅ File transfer completed!');
      setTimeout(() => {
        setTransferStatus(TRANSFER_STATUS.IDLE);
        setSelectedFile(null);
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError(`Chunk transfer failed: ${err.message}`);
      setTransferStatus(TRANSFER_STATUS.ERROR);
    }
  };

  /**
   * Update progress
   */
  const updateProgress = (percentage) => {
    webrtc.updateProgress(percentage);
  };

  /**
   * Handle mode switch
   */
  const switchMode = (newMode) => {
    setMode(newMode);
    setSelectedFile(null);
    setTransferStatus(TRANSFER_STATUS.IDLE);
    setError(null);
    setSuccessMessage(null);
  };

  const isReady = wallet && socket.isConnected;
  const canSelectFile = true; // Allow file selection always

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-12 text-center slide-up">
          <div className="mb-4">
            <span className="text-6xl drop-shadow-lg">⛓️</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3">Blockchain P2P File Transfer</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Secure, encrypted, peer-to-peer file sharing powered by blockchain technology
          </p>
        </div>

        {/* Mode Selector */}
        <div className="mb-8 flex justify-center gap-4 slide-up">
          <button
            onClick={() => switchMode('sender')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all transform ${
              mode === 'sender'
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            📤 Send File
          </button>
          <button
            onClick={() => switchMode('receiver')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all transform ${
              mode === 'receiver'
                ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg'
                : 'btn-secondary'
            }`}
          >
            📥 Receive File
          </button>
        </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Status & Wallet */}
          <div className="lg:col-span-1 space-y-6 slide-in">
            <WalletConnect onWalletConnected={handleWalletConnect} />
            <StatusDisplay
              isSocketConnected={socket.isConnected}
              isPeerConnected={webrtc.isConnected}
              isWalletConnected={!!wallet}
              peers={socket.peers}
              error={error}
              txHash={blockchain.txHash}
              message={successMessage}
            />
          </div>

          {/* Right Content - File Transfer */}
          <div className="lg:col-span-3 space-y-6 slide-in" style={{ animationDelay: '0.1s' }}>
            {/* Alerts */}
            {error && (
              <div className="card p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">Error</p>
                    <p className="text-sm text-red-800 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="card p-4 bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 fade-in">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">Success</p>
                    <p className="text-sm text-green-800 mt-1">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Based on Mode */}
            {mode === 'sender' ? (
              <>
                <FileUploader
                  onFileSelected={setSelectedFile}
                  disabled={!canSelectFile}
                />

                {selectedFile && (
                  <>
                    <button
                      onClick={startTransfer}
                      disabled={!isReady || webrtc.status !== TRANSFER_STATUS.IDLE}
                      className="w-full btn-primary py-4 text-lg rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {webrtc.status === TRANSFER_STATUS.IDLE ? '🚀 Start Transfer' : 'Transferring...'}
                    </button>

                    {transferStatus !== TRANSFER_STATUS.IDLE && (
                      <ProgressBar progress={webrtc.progress} status={transferStatus} />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <TransferReceiver
                  peers={socket.peers}
                  isLoading={webrtc.status === TRANSFER_STATUS.CONNECTING}
                  disabled={!isReady}
                />

                {webrtc.isConnected && (
                  <ProgressBar progress={webrtc.progress} status={transferStatus} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>🔒 Your files are encrypted end-to-end and never stored on servers</p>
        </div>
      </div>
    </div>
  );
}

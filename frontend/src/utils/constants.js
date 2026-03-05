// Application constants

export const CHUNK_SIZE = 64 * 1024; // 64KB chunks

export const ENCRYPTION_ALGORITHM = 'AES-GCM';
export const KEY_SIZE = 256; // bits
export const IV_SIZE = 12; // bytes (96 bits for GCM)
export const TAG_SIZE = 16; // bytes (128 bits)

export const MESSAGE_TYPES = {
  JOIN: 'JOIN',
  JOIN_SUCCESS: 'JOIN_SUCCESS',
  OFFER: 'OFFER',
  ANSWER: 'ANSWER',
  ICE_CANDIDATE: 'ICE_CANDIDATE',
  LEAVE: 'LEAVE',
  PEER_JOINED: 'PEER_JOINED',
  PEER_LEFT: 'PEER_LEFT',
  FILE_OFFER: 'FILE_OFFER',
  FILE_READY: 'FILE_READY',
  FILE_START: 'FILE_START',
  FILE_CHUNK: 'FILE_CHUNK',
  FILE_END: 'FILE_END',
  FILE_VERIFIED: 'FILE_VERIFIED',
  FILE_ERROR: 'FILE_ERROR',
};

export const TRANSFER_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SENDING: 'sending',
  RECEIVING: 'receiving',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  ERROR: 'error',
};

export const ERROR_CODES = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INVALID_FILE: 'INVALID_FILE',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  PEER_NOT_FOUND: 'PEER_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  HASH_MISMATCH: 'HASH_MISMATCH',
};

export const POLYGON_NETWORKS = {
  MUMBAI_TESTNET: {
    id: 80001,
    name: 'Polygon Mumbai Testnet',
    rpc: 'https://rpc-mumbai.maticvigil.com',
    explorer: 'https://mumbai.polygonscan.com',
  },
  MAINNET: {
    id: 137,
    name: 'Polygon Mainnet',
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
  },
};

export const DEFAULT_NETWORK = POLYGON_NETWORKS.MUMBAI_TESTNET;

export const TRANSACTION_TIMEOUT = 60000; // 60 seconds
export const WEBRTC_TIMEOUT = 30000; // 30 seconds
export const CHUNK_TIMEOUT = 5000; // 5 seconds per chunk

import { useState, useCallback, useEffect } from 'react';
import { BlockchainService } from '../services/blockchainService.js';

/**
 * Hook for blockchain interactions
 */
export function useBlockchain() {
  const [blockchain, setBlockchain] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  /**
   * Initialize blockchain service
   */
  const initialize = useCallback(async (contractAddress, signer) => {
    setError(null);
    try {
      const blockchainService = new BlockchainService(
        contractAddress,
        signer,
        null
      );
      setBlockchain(blockchainService);
      return blockchainService;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  /**
   * Register file hash on blockchain
   */
  const registerFileHash = useCallback(
    async (fileHash) => {
      if (!blockchain) {
        setError('Blockchain service not initialized');
        throw new Error('Blockchain service not initialized');
      }

      setIsRegistering(true);
      setError(null);
      try {
        const result = await blockchain.registerFile(fileHash);
        setTxHash(result.txHash);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsRegistering(false);
      }
    },
    [blockchain]
  );

  /**
   * Verify file hash on blockchain
   */
  const verifyFileHash = useCallback(
    async (fileHash) => {
      if (!blockchain) {
        setError('Blockchain service not initialized');
        throw new Error('Blockchain service not initialized');
      }

      setError(null);
      try {
        const result = await blockchain.verifyFile(fileHash);
        setIsVerified(result.exists);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [blockchain]
  );

  /**
   * Check if file exists
   */
  const checkFileExists = useCallback(
    async (fileHash) => {
      if (!blockchain) {
        return false;
      }

      try {
        return await blockchain.fileExists(fileHash);
      } catch (err) {
        console.error('File existence check failed:', err);
        return false;
      }
    },
    [blockchain]
  );

  /**
   * Get network info
   */
  const getNetwork = useCallback(async () => {
    if (!blockchain) {
      setError('Blockchain service not initialized');
      return null;
    }

    try {
      return await blockchain.getNetwork();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [blockchain]);

  /**
   * Get signer address
   */
  const getSignerAddress = useCallback(async () => {
    if (!blockchain) {
      return null;
    }

    try {
      return await blockchain.getSignerAddress();
    } catch (err) {
      console.error('Failed to get signer address:', err);
      return null;
    }
  }, [blockchain]);

  /**
   * Get contract address
   */
  const getContractAddress = useCallback(() => {
    if (!blockchain) {
      return null;
    }

    return blockchain.getContractAddress();
  }, [blockchain]);

  /**
   * Estimate gas
   */
  const estimateGasCost = useCallback(
    async (fileHash) => {
      if (!blockchain) {
        return null;
      }

      try {
        return await blockchain.estimateGas(fileHash);
      } catch (err) {
        console.error('Gas estimation failed:', err);
        return null;
      }
    },
    [blockchain]
  );

  return {
    blockchain,
    isVerified,
    isRegistering,
    error,
    txHash,
    initialize,
    registerFileHash,
    verifyFileHash,
    checkFileExists,
    getNetwork,
    getSignerAddress,
    getContractAddress,
    estimateGasCost,
  };
}

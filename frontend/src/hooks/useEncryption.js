import { useState, useCallback } from 'react';
import {
  generateEncryptionKey,
  generateIV,
  encrypt,
  decrypt,
  exportKey,
  importKey,
} from '../services/cryptoService.js';

/**
 * Hook for file encryption and decryption
 */
export function useEncryption() {
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate and store encryption key
   */
  const generateKey = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const key = await generateEncryptionKey();
      setEncryptionKey(key);
      return key;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Encrypt file data
   */
  const encryptFile = useCallback(
    async (fileData, key) => {
      setIsLoading(true);
      setError(null);
      try {
        if (!fileData || fileData.length === 0) {
          throw new Error('No file data provided');
        }

        const keyToUse = key || encryptionKey;
        if (!keyToUse) {
          throw new Error('No encryption key available');
        }

        const iv = generateIV();
        const encryptedData = await encrypt(fileData, keyToUse, iv);

        return {
          encryptedData,
          iv,
          key: keyToUse,
        };
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [encryptionKey]
  );

  /**
   * Decrypt file data
   */
  const decryptFile = useCallback(
    async (encryptedData, key) => {
      setIsLoading(true);
      setError(null);
      try {
        if (!encryptedData || encryptedData.length === 0) {
          throw new Error('No encrypted data provided');
        }

        const keyToUse = key || encryptionKey;
        if (!keyToUse) {
          throw new Error('No encryption key available');
        }

        const decryptedData = await decrypt(encryptedData, keyToUse);
        return decryptedData;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [encryptionKey]
  );

  /**
   * Export key for sharing
   */
  const exportKeyForTransfer = useCallback(async (key) => {
    try {
      const keyData = await exportKey(key || encryptionKey);
      return keyData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [encryptionKey]);

  /**
   * Import key from transfer
   */
  const importKeyFromTransfer = useCallback(async (keyData) => {
    setIsLoading(true);
    setError(null);
    try {
      const importedKey = await importKey(keyData);
      setEncryptionKey(importedKey);
      return importedKey;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear key
   */
  const clearKey = useCallback(() => {
    setEncryptionKey(null);
    setError(null);
  }, []);

  return {
    encryptionKey,
    isLoading,
    error,
    generateKey,
    encryptFile,
    decryptFile,
    exportKeyForTransfer,
    importKeyFromTransfer,
    clearKey,
  };
}

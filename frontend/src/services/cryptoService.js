import { KEY_SIZE, IV_SIZE, ENCRYPTION_ALGORITHM } from '../utils/constants.js';
import { arrayBufferToHex, hexToArrayBuffer } from '../utils/hashFile.js';

/**
 * Generate a random cryptographic key
 * @returns {Promise<CryptoKey>} AES-256 key
 */
export async function generateEncryptionKey() {
  try {
    return await crypto.subtle.generateKey(
      {
        name: ENCRYPTION_ALGORITHM,
        length: KEY_SIZE,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    throw new Error(`Failed to generate encryption key: ${error.message}`);
  }
}

/**
 * Export key to raw bytes for transmission
 * @param {CryptoKey} key - Key to export
 * @returns {Promise<Uint8Array>} Raw key bytes
 */
export async function exportKey(key) {
  try {
    const exported = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(exported);
  } catch (error) {
    throw new Error(`Failed to export key: ${error.message}`);
  }
}

/**
 * Import raw key bytes
 * @param {Uint8Array} keyData - Raw key bytes
 * @returns {Promise<CryptoKey>} Imported key
 */
export async function importKey(keyData) {
  try {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      ENCRYPTION_ALGORITHM,
      true,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    throw new Error(`Failed to import key: ${error.message}`);
  }
}

/**
 * Generate random IV (Initialization Vector)
 * @returns {Uint8Array} Random IV
 */
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_SIZE));
}

/**
 * Encrypt data with AES-256-GCM
 * @param {Uint8Array} data - Data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<Uint8Array>} Encrypted data (iv + ciphertext + tag)
 */
export async function encrypt(data, key, iv) {
  try {
    if (!data || data.length === 0) {
      throw new Error('Cannot encrypt empty data');
    }

    if (!key) {
      throw new Error('No encryption key provided');
    }

    if (!iv || iv.length !== 12) {
      throw new Error('Invalid IV: must be 12 bytes');
    }

    const algorithm = {
      name: ENCRYPTION_ALGORITHM,
      iv: iv,
    };

    const encrypted = await crypto.subtle.encrypt(algorithm, key, data);
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data with AES-256-GCM
 * @param {Uint8Array} encryptedData - Encrypted data (iv + ciphertext + tag)
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Uint8Array>} Decrypted data
 */
export async function decrypt(encryptedData, key) {
  try {
    // Extract IV and ciphertext
    const iv = encryptedData.slice(0, IV_SIZE);
    const ciphertext = encryptedData.slice(IV_SIZE);

    const algorithm = {
      name: ENCRYPTION_ALGORITHM,
      iv: iv,
    };

    const decrypted = await crypto.subtle.decrypt(algorithm, key, ciphertext);
    return new Uint8Array(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt data and encode as hex
 * Convenient for storage or transmission
 * @param {Uint8Array} data - Data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<string>} Hex-encoded encrypted data
 */
export async function encryptToHex(data, key, iv) {
  const encrypted = await encrypt(data, key, iv);
  return arrayBufferToHex(encrypted);
}

/**
 * Decrypt hex-encoded data
 * @param {string} hexData - Hex-encoded encrypted data
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Uint8Array>} Decrypted data
 */
export async function decryptFromHex(hexData, key) {
  const encryptedData = new Uint8Array(hexToArrayBuffer(hexData));
  return decrypt(encryptedData, key);
}

/**
 * KeyExchange object for session key negotiation
 * (In production, use ECDH for proper key exchange)
 */
export class KeyExchange {
  constructor() {
    this.publicKey = null;
    this.privateKey = null;
  }

  /**
   * Generate key pair (simple - in production use ECDH)
   */
  async generateKeyPair() {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );

      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
      return keyPair;
    } catch (error) {
      throw new Error(`Key pair generation failed: ${error.message}`);
    }
  }

  /**
   * Export public key
   */
  async exportPublicKey() {
    try {
      const exported = await crypto.subtle.exportKey('spki', this.publicKey);
      return arrayBufferToHex(exported);
    } catch (error) {
      throw new Error(`Public key export failed: ${error.message}`);
    }
  }

  /**
   * Import peer's public key
   */
  async importPeerPublicKey(hexKey) {
    try {
      const keyBuffer = hexToArrayBuffer(hexKey);
      this.peerPublicKey = await crypto.subtle.importKey(
        'spki',
        keyBuffer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        true,
        ['verify']
      );
      return this.peerPublicKey;
    } catch (error) {
      throw new Error(`Public key import failed: ${error.message}`);
    }
  }
}

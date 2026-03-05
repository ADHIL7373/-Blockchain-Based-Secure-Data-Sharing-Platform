/**
 * Generate SHA-256 hash of file content
 * @param {Uint8Array} data - File data as bytes
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function hashFile(data) {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return arrayBufferToHex(hashBuffer);
  } catch (error) {
    throw new Error(`Failed to hash file: ${error.message}`);
  }
}

/**
 * Generate SHA-256 hash from ArrayBuffer
 * @param {ArrayBuffer} buffer - Data buffer
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashBuffer(buffer) {
  return hashFile(new Uint8Array(buffer));
}

/**
 * Convert ArrayBuffer to hex string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Hex string
 */
export function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to ArrayBuffer
 * @param {string} hex - Hex string
 * @returns {ArrayBuffer} Buffer
 */
export function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

/**
 * Verify hash by comparing two hex hashes
 * @param {string} hash1 - First hash (hex)
 * @param {string} hash2 - Second hash (hex)
 * @returns {boolean} True if hashes match
 */
export function verifyHash(hash1, hash2) {
  return hash1.toLowerCase() === hash2.toLowerCase();
}

/**
 * Stream hash calculation for large files
 * Useful for calculating hash while receiving chunks
 */
export class StreamHasher {
  constructor() {
    this.chunks = [];
  }

  addChunk(chunk) {
    this.chunks.push(new Uint8Array(chunk));
  }

  async getHash() {
    const totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return hashFile(combined);
  }

  reset() {
    this.chunks = [];
  }
}

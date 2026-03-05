import { CHUNK_SIZE } from './constants.js';

/**
 * Split file or data into chunks
 * @param {File|Uint8Array|ArrayBuffer} fileOrData - File or data to split
 * @param {number} chunkSize - Size of each chunk in bytes (default: 64KB)
 * @returns {Promise<Uint8Array[]>} Array of chunks
 */
export async function chunkFile(fileOrData, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  let fileBytes;

  // Handle multiple input types
  if (fileOrData instanceof Uint8Array) {
    fileBytes = fileOrData;
  } else if (fileOrData instanceof ArrayBuffer) {
    fileBytes = new Uint8Array(fileOrData);
  } else if (fileOrData instanceof File || (fileOrData && typeof fileOrData.arrayBuffer === 'function')) {
    const fileBuffer = await fileOrData.arrayBuffer();
    fileBytes = new Uint8Array(fileBuffer);
  } else {
    throw new Error('Invalid input: expected File, Uint8Array, or ArrayBuffer');
  }

  if (fileBytes.length === 0) {
    throw new Error('Cannot chunk empty data');
  }

  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    const chunk = fileBytes.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  return chunks;
}

/**
 * Get file as Uint8Array
 * @param {File} file - File object
 * @returns {Promise<Uint8Array>} File data as bytes
 */
export async function fileToBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Create file from chunks
 * @param {Uint8Array[]} chunks - Array of chunks
 * @param {string} fileName - Name for the file
 * @param {string} mimeType - MIME type
 * @returns {File} Reconstructed file
 */
export function chunksToFile(chunks, fileName, mimeType = 'application/octet-stream') {
  const blob = new Blob(chunks, { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}

/**
 * Create ArrayBuffer from chunks
 * @param {Uint8Array[]} chunks - Array of chunks
 * @returns {ArrayBuffer} Combined buffer
 */
export function chunksToBuffer(chunks) {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined.buffer;
}

/**
 * Get file metadata
 * @param {File} file - File object
 * @returns {Object} File metadata
 */
export function getFileMetadata(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    chunks: Math.ceil(file.size / CHUNK_SIZE),
  };
}

/**
 * Estimate file transfer time
 * @param {number} fileSize - Size of file in bytes
 * @param {number} bandwidth - Bandwidth in bytes per second (default 1MB/s)
 * @returns {number} Estimated time in seconds
 */
export function estimateTransferTime(fileSize, bandwidth = 1024 * 1024) {
  return Math.ceil(fileSize / bandwidth);
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

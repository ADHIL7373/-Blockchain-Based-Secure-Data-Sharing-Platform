import { ethers } from 'ethers';

// Simple ABI for FileRegistry (essential methods only)
const FILE_REGISTRY_ABI = [
  {
    name: 'registerFile',
    type: 'function',
    inputs: [{ name: 'fileHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'verifyFile',
    type: 'function',
    inputs: [{ name: 'fileHash', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'sender', type: 'address' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'fileExists',
    type: 'function',
    inputs: [{ name: 'fileHash', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getFileRecord',
    type: 'function',
    inputs: [{ name: 'fileHash', type: 'bytes32' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
  },
];

/**
 * Blockchain service for file registration and verification
 */
export class BlockchainService {
  constructor(contractAddress, signer, chainId) {
    this.contractAddress = contractAddress;
    this.signer = signer;
    this.chainId = chainId;
    this.contract = new ethers.Contract(
      contractAddress,
      FILE_REGISTRY_ABI,
      signer
    );
  }

  /**
   * Register file hash on blockchain
   * @param {string} fileHash - SHA-256 hash (hex string)
   * @returns {Promise<Object>} Transaction receipt
   */
  async registerFile(fileHash) {
    try {
      // Convert hex hash to bytes32
      const bytes32Hash = this._hashToBytes32(fileHash);

      // Check if already registered
      const exists = await this.contract.fileExists(bytes32Hash);
      if (exists) {
        throw new Error('File already registered on blockchain');
      }

      // Register the file
      const tx = await this.contract.registerFile(bytes32Hash);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      throw new Error(`File registration failed: ${error.message}`);
    }
  }

  /**
   * Verify file on blockchain
   * @param {string} fileHash - SHA-256 hash (hex string)
   * @returns {Promise<Object>} Verification result
   */
  async verifyFile(fileHash) {
    try {
      const bytes32Hash = this._hashToBytes32(fileHash);
      const result = await this.contract.verifyFile(bytes32Hash);

      return {
        exists: result.exists,
        sender: result.sender,
        timestamp: result.timestamp.toNumber(),
      };
    } catch (error) {
      throw new Error(`File verification failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} fileHash - SHA-256 hash (hex string)
   * @returns {Promise<boolean>} True if file is registered
   */
  async fileExists(fileHash) {
    try {
      const bytes32Hash = this._hashToBytes32(fileHash);
      return await this.contract.fileExists(bytes32Hash);
    } catch (error) {
      throw new Error(`File existence check failed: ${error.message}`);
    }
  }

  /**
   * Get contract address
   */
  getContractAddress() {
    return this.contractAddress;
  }

  /**
   * Get current network
   */
  async getNetwork() {
    const network = await this.signer.provider.getNetwork();
    return {
      name: network.name,
      chainId: network.chainId,
    };
  }

  /**
   * Get signer address
   */
  async getSignerAddress() {
    return await this.signer.getAddress();
  }

  /**
   * Estimate gas for registration
   */
  async estimateGas(fileHash) {
    try {
      const bytes32Hash = this._hashToBytes32(fileHash);
      const gasEstimate = await this.contract.estimateGas.registerFile(
        bytes32Hash
      );
      return gasEstimate.toString();
    } catch (error) {
      // If file already exists, use a default estimate
      return '50000';
    }
  }

  /**
   * Convert hex hash to bytes32 format
   * @private
   * @param {string} hash - Hex hash (with or without 0x prefix)
   * @returns {string} bytes32 hash
   */
  _hashToBytes32(hash) {
    let h = hash;
    if (!h.startsWith('0x')) {
      h = '0x' + h;
    }

    // Pad to 32 bytes if necessary
    return ethers.utils.zeroPad(h, 32);
  }
}

/**
 * Initialize blockchain service
 * @param {string} contractAddress - FileRegistry contract address
 * @param {ethers.Signer} signer - Ethers signer (from MetaMask)
 * @returns {Promise<BlockchainService>} Initialized service
 */
export async function initializeBlockchain(contractAddress, signer) {
  try {
    const network = await signer.provider.getNetwork();
    return new BlockchainService(contractAddress, signer, network.chainId);
  } catch (error) {
    throw new Error(`Blockchain initialization failed: ${error.message}`);
  }
}

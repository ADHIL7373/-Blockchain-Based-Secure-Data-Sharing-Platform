// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FileRegistry
 * @notice Stores SHA-256 hashes of encrypted files for integrity verification
 * @dev Prevents duplicate registrations and maintains file ownership
 */
contract FileRegistry {
    // File structure: hash -> registration details
    struct FileRecord {
        address sender;
        uint256 timestamp;
        bool exists;
    }

    // Mapping: encrypted file hash -> FileRecord
    mapping(bytes32 => FileRecord) public files;

    // Mapping: sender -> array of file hashes (for tracking)
    mapping(address => bytes32[]) public userFiles;

    // Events
    event FileRegistered(
        bytes32 indexed fileHash,
        address indexed sender,
        uint256 timestamp
    );

    event FileVerified(
        bytes32 indexed fileHash,
        address indexed verifier,
        bool isValid
    );

    /**
     * @notice Register a file hash on blockchain
     * @param fileHash SHA-256 hash of encrypted file
     * @dev Prevents duplicate hash registration
     */
    function registerFile(bytes32 fileHash) external {
        require(fileHash != bytes32(0), "Invalid file hash");
        require(!files[fileHash].exists, "File already registered");

        files[fileHash] = FileRecord({
            sender: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        userFiles[msg.sender].push(fileHash);

        emit FileRegistered(fileHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Verify file integrity by checking if hash exists
     * @param fileHash SHA-256 hash to verify
     * @return exists True if file is registered
     * @return sender Address of original sender
     * @return timestamp Registration timestamp
     */
    function verifyFile(bytes32 fileHash)
        external
        view
        returns (bool exists, address sender, uint256 timestamp)
    {
        FileRecord memory record = files[fileHash];
        return (record.exists, record.sender, record.timestamp);
    }

    /**
     * @notice Log file verification event (state-modifying)
     * @param fileHash SHA-256 hash to verify
     */
    function logFileVerification(bytes32 fileHash)
        external
    {
        FileRecord memory record = files[fileHash];
        emit FileVerified(fileHash, msg.sender, record.exists);
    }

    /**
     * @notice Get all files registered by a user
     * @param user Address to query
     * @return Array of file hashes
     */
    function getUserFiles(address user)
        external
        view
        returns (bytes32[] memory)
    {
        return userFiles[user];
    }

    /**
     * @notice Get total files registered by user
     * @param user Address to query
     * @return Count of files
     */
    function getUserFileCount(address user)
        external
        view
        returns (uint256)
    {
        return userFiles[user].length;
    }

    /**
     * @notice Check if a specific hash exists
     * @param fileHash Hash to check
     * @return True if hash is registered
     */
    function fileExists(bytes32 fileHash) external view returns (bool) {
        return files[fileHash].exists;
    }

    /**
     * @notice Get file record details
     * @param fileHash Hash to query
     * @return FileRecord struct with details
     */
    function getFileRecord(bytes32 fileHash)
        external
        view
        returns (FileRecord memory)
    {
        require(files[fileHash].exists, "File not found");
        return files[fileHash];
    }
}

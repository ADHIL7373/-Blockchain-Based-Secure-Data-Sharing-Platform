const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FileRegistry Contract', function () {
  let fileRegistry;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const FileRegistry = await ethers.getContractFactory('FileRegistry');
    fileRegistry = await FileRegistry.deploy();
    await fileRegistry.deployed();
  });

  describe('Deployment', function () {
    it('Should deploy successfully', async function () {
      expect(fileRegistry.address).to.be.properAddress;
    });
  });

  describe('File Registration', function () {
    it('Should register a file hash', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-file'));

      await expect(fileRegistry.registerFile(fileHash))
        .to.emit(fileRegistry, 'FileRegistered')
        .withArgs(fileHash, owner.address, expect.any(ethers.BigNumber));

      const record = await fileRegistry.getFileRecord(fileHash);
      expect(record.sender).to.equal(owner.address);
      expect(record.exists).to.equal(true);
    });

    it('Should reject duplicate hash registration', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-file'));

      await fileRegistry.registerFile(fileHash);

      await expect(fileRegistry.registerFile(fileHash)).to.be.revertedWith(
        'File already registered'
      );
    });

    it('Should reject zero hash', async function () {
      const zeroHash = ethers.constants.HashZero;

      await expect(fileRegistry.registerFile(zeroHash)).to.be.revertedWith(
        'Invalid file hash'
      );
    });
  });

  describe('File Verification', function () {
    it('Should verify existing file', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-file'));
      await fileRegistry.registerFile(fileHash);

      const result = await fileRegistry.verifyFile(fileHash);
      expect(result.exists).to.equal(true);
      expect(result.sender).to.equal(owner.address);
    });

    it('Should return false for non-existing file', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('non-existing'));

      const result = await fileRegistry.verifyFile(fileHash);
      expect(result.exists).to.equal(false);
      expect(result.sender).to.equal(ethers.constants.AddressZero);
    });
  });

  describe('User File Tracking', function () {
    it('Should track user files', async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file1'));
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file2'));

      await fileRegistry.registerFile(hash1);
      await fileRegistry.registerFile(hash2);

      const userFiles = await fileRegistry.getUserFiles(owner.address);
      expect(userFiles.length).to.equal(2);
      expect(userFiles[0]).to.equal(hash1);
      expect(userFiles[1]).to.equal(hash2);
    });

    it('Should return correct user file count', async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file1'));
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file2'));

      await fileRegistry.registerFile(hash1);
      await fileRegistry.registerFile(hash2);

      const count = await fileRegistry.getUserFileCount(owner.address);
      expect(count).to.equal(2);
    });
  });

  describe('File Existence Check', function () {
    it('Should check if file exists', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-file'));

      let exists = await fileRegistry.fileExists(fileHash);
      expect(exists).to.equal(false);

      await fileRegistry.registerFile(fileHash);

      exists = await fileRegistry.fileExists(fileHash);
      expect(exists).to.equal(true);
    });
  });

  describe('Multi-user Registration', function () {
    it('Should allow different users to register same file hash', async function () {
      const fileHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-file'));

      await fileRegistry.registerFile(fileHash);

      const record1 = await fileRegistry.getFileRecord(fileHash);
      expect(record1.sender).to.equal(owner.address);

      // Same hash cannot be registered again
      await expect(
        fileRegistry.connect(addr1).registerFile(fileHash)
      ).to.be.revertedWith('File already registered');
    });

    it('Should allow different users to register different files', async function () {
      const hash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file1'));
      const hash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('file2'));

      await fileRegistry.connect(addr1).registerFile(hash1);
      await fileRegistry.connect(addr2).registerFile(hash2);

      const record1 = await fileRegistry.getFileRecord(hash1);
      const record2 = await fileRegistry.getFileRecord(hash2);

      expect(record1.sender).to.equal(addr1.address);
      expect(record2.sender).to.equal(addr2.address);
    });
  });
});

const hre = require('hardhat');

async function main() {
  console.log('Deploying FileRegistry contract...');

  // Get the contract factory
  const FileRegistry = await hre.ethers.getContractFactory('FileRegistry');

  // Deploy
  const fileRegistry = await FileRegistry.deploy();
  await fileRegistry.deployed();

  const network = await hre.ethers.provider.getNetwork();

  console.log('\n✅ FileRegistry deployed successfully!');
  console.log(`📍 Contract Address: ${fileRegistry.address}`);
  console.log(`🌐 Network: ${network.name} (ChainID: ${network.chainId})`);
  console.log(`⏰ Block: ${await hre.ethers.provider.getBlockNumber()}`);

  // Display setup instructions
  console.log('\n📋 Next steps:');
  console.log('1. Copy the contract address above');
  console.log('2. Add to frontend/.env: VITE_FILE_REGISTRY_ADDRESS=' + fileRegistry.address);
  console.log('3. Add network ID: VITE_NETWORK_ID=' + network.chainId);

  return fileRegistry.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

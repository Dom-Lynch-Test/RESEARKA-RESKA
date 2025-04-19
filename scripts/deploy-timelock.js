// Deploy the Timelock Controller for RESKA governance
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA TIMELOCK CONTROLLER ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Deploying to network: ${hre.network.name}`);
  
  const minDelay = process.env.TIMELOCK_DELAY || 86400; // Default to 1 day (in seconds)
  
  // Parse proposers and executors from environment variables
  // Format in .env should be comma-separated addresses: 0x123,0x456
  let proposers = [];
  let executors = [];
  
  if (process.env.TIMELOCK_PROPOSERS) {
    proposers = process.env.TIMELOCK_PROPOSERS.split(',');
  } else {
    // Default to deployer if not specified
    proposers = [wallet.address];
  }
  
  if (process.env.TIMELOCK_EXECUTORS) {
    executors = process.env.TIMELOCK_EXECUTORS.split(',');
  } else {
    // Default to deployer if not specified
    executors = [wallet.address];
  }
  
  // Admin address - typically set to zero address to renounce admin role
  // This means only the timelock itself can manage its own settings
  const admin = "0x0000000000000000000000000000000000000000";
  
  // Validate parameters
  console.log(`Timelock Parameters:`);
  console.log(`- Minimum Delay: ${minDelay} seconds (${minDelay / 86400} days)`);
  console.log(`- Proposers: ${proposers.join(', ')}`);
  console.log(`- Executors: ${executors.join(', ')}`);
  console.log(`- Admin: ${admin} (zero address = renounced admin role)`);
  
  // Get the artifact for the ReskaTimelock contract
  const artifact = await hre.artifacts.readArtifact("ReskaTimelock");
  
  // Create deployer
  const deployer = new hre.zkSync.Deployer(hre, wallet);
  
  // Deploy timelock with constructor arguments
  console.log(`\nDeploying Timelock Controller...`);
  const timelock = await deployer.deploy(artifact, [
    minDelay,
    proposers,
    executors,
    admin
  ]);
  
  const timelockAddress = await timelock.getAddress();
  console.log(`Timelock deployed to: ${timelockAddress}`);
  
  // Save deployment info
  let deployments = {};
  
  try {
    deployments = require('../deployments.json');
  } catch (error) {
    deployments = { 
      testnet: {},
      mainnet: {}
    };
  }
  
  // Update deployments with timelock address
  if (hre.network.name.includes('Mainnet') || hre.network.name.includes('mainnet')) {
    deployments.mainnet.timelock = timelockAddress;
  } else {
    // Assume testnet otherwise
    deployments.testnet.timelock = timelockAddress;
  }
  
  const fs = require('fs');
  fs.writeFileSync(
    './deployments.json',
    JSON.stringify(deployments, null, 2)
  );
  
  console.log(`\nDeployment info saved to deployments.json`);
  console.log(`\n=== NEXT STEPS ===`);
  console.log(`1. Transfer admin roles from owner to Timelock controller: ${timelockAddress}`);
  console.log(`2. Verify timelock contract on Explorer`);
  console.log(`3. Test scheduling and executing administrative actions through timelock`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

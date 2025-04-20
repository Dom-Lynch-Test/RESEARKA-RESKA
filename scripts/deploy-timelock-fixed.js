// Deploy the Timelock Controller for RESKA governance
// Fixed for zkSync Era deployment
const { Wallet, Provider, utils } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
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
  
  // Create deployer object - use the proper zkSync Era deployer
  const deployer = new Deployer(hre, wallet);
  
  // Load the ReskaTimelock artifact
  const artifact = await deployer.loadArtifact("ReskaTimelock");
  
  // Check wallet balance
  const balanceInWei = await provider.getBalance(wallet.address);
  const balance = Number(utils.formatEther(balanceInWei.toString()));
  console.log(`Wallet ETH Balance: ${balance} ETH`);
  
  if (balance < 0.001) {
    console.error("Warning: Low ETH balance. You may not have enough funds to deploy the contract.");
  }
  
  // Deploy the Timelock contract
  console.log(`\nDeploying Timelock Controller...`);
  
  try {
    const timelock = await deployer.deploy(artifact, [
      minDelay,
      proposers,
      executors,
      admin
    ]);
    
    const timelockAddress = await timelock.getAddress();
    console.log(`✅ Timelock deployed to: ${timelockAddress}`);
    
    // Save deployment info
    let deployments = {};
    
    try {
      const fs = require('fs');
      try {
        const deploymentFile = fs.readFileSync('./deployments.json', 'utf8');
        deployments = JSON.parse(deploymentFile);
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
      
      fs.writeFileSync(
        './deployments.json',
        JSON.stringify(deployments, null, 2)
      );
      
      console.log(`Deployment info saved to deployments.json`);
    } catch (ioError) {
      console.error(`Note: Could not save deployment info: ${ioError.message}`);
    }
    
    console.log(`\n=== NEXT STEPS ===`);
    console.log(`1. Transfer admin roles from owner to Timelock controller: ${timelockAddress}`);
    console.log(`2. Verify timelock contract on Explorer`);
    console.log(`3. Test scheduling and executing administrative actions through timelock`);
  } catch (deployError) {
    console.error(`❌ Deployment failed: ${deployError.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

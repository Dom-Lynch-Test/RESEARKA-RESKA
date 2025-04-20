// Simple Timelock deployment script compatible with zkSync Era Sepolia
const { Wallet, Provider } = require("zksync-ethers");
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
  
  // Timelock parameters
  const minDelay = process.env.TIMELOCK_DELAY || "300"; // Default to 5 minutes for testing
  const proposers = [wallet.address]; // Use deployer as proposer for simplicity
  const executors = [wallet.address]; // Use deployer as executor for simplicity
  const admin = "0x0000000000000000000000000000000000000000"; // Renounce admin role
  
  // Log parameters
  console.log(`Timelock Parameters:`);
  console.log(`- Minimum Delay: ${minDelay} seconds`);
  console.log(`- Proposers: ${proposers.join(', ')}`);
  console.log(`- Executors: ${executors.join(', ')}`);
  console.log(`- Admin: ${admin}`);
  
  // Check wallet balance
  const balanceInWei = await provider.getBalance(wallet.address);
  console.log(`Wallet Balance: ${balanceInWei.toString()} wei`);
  
  // Create deployer
  const deployer = new Deployer(hre, wallet);
  
  // Load artifact
  const artifact = await deployer.loadArtifact("ReskaTimelock");
  
  // Deploy the contract
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
    
    // Store address for future reference
    console.log(`\nIMPORTANT: Save this address for your token governance:`);
    console.log(`TIMELOCK_ADDRESS=${timelockAddress}`);
    
    console.log(`\n=== NEXT STEPS ===`);
    console.log(`1. Transfer RESKA token admin roles to Timelock: ${timelockAddress}`);
    console.log(`2. Test creating a governance proposal through Timelock`);
  } catch (error) {
    console.error(`Error during deployment: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

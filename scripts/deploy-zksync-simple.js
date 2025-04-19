// Simplified zkSync Era deployment script - for cleaner deployment without verification overhead
const { Wallet, Provider, utils } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== SIMPLIFIED RESKA TOKEN DEPLOYMENT TO ZKSYNC ERA (SEPOLIA) ===");
  
  // Initialize zkSync provider
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  console.log(`Connected to zkSync Era Sepolia`);
  
  // Initialize wallet
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deploying from address: ${wallet.address}`);
  
  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  // Format balance using native BigInt handling
  console.log(`Wallet balance: ${Number(balance) / 1e18} ETH`);
  
  // All allocations will go to the deployer address for testing purposes
  // In a production environment, these would be different addresses
  const deployerAddress = wallet.address;
  console.log(`Using ${deployerAddress} for all allocation addresses (for testing)`);
  
  // Initialize the deployer
  const deployer = new Deployer(hre, wallet);
  
  // Load contract artifact
  console.log("Loading RESKA Token artifact...");
  const artifact = await deployer.loadArtifact("ReskaToken");
  
  // Deploy RESKA token with constructor arguments for allocations
  console.log("Deploying RESKA Token contract...");
  const token = await deployer.deploy(artifact, [
    deployerAddress, // Founder - 10%
    deployerAddress, // Advisors - 5%
    deployerAddress, // Investors - 5%
    deployerAddress, // Airdrops - 40%
    deployerAddress, // Ecosystem - 10%
    deployerAddress, // Treasury - 10%
    deployerAddress, // Public Sale - 10%
    deployerAddress  // Escrow - 10%
  ]);
  const tokenAddress = await token.getAddress();
  
  console.log(`\n✅ RESKA Token deployed successfully to ${tokenAddress}`);
  
  // Save the address to a file
  const fs = require('fs');
  const deploymentData = {
    "ReskaToken": tokenAddress,
    "network": "zkSyncTestnet",
    "timestamp": new Date().toISOString(),
    "deployer": deployerAddress
  };
  
  fs.writeFileSync(
    './deployments/zksync-sepolia.json',
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment address saved to deployments/zksync-sepolia.json");
  
  // Now let's try to read some basic info
  try {
    console.log("\nVerifying contract functionality:");
    
    try {
      const name = await token.name();
      console.log(`- Token name: ${name}`);
    } catch (error) {
      console.log(`- Could not get name: ${error.message}`);
    }
    
    try {
      const symbol = await token.symbol();
      console.log(`- Token symbol: ${symbol}`);
    } catch (error) {
      console.log(`- Could not get symbol: ${error.message}`);
    }
    
    try {
      const decimals = await token.decimals();
      console.log(`- Decimals: ${decimals}`);
    } catch (error) {
      console.log(`- Could not get decimals: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`Error verifying token: ${error.message}`);
  }
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Your token is now deployed on zkSync Era Sepolia!");
  console.log(`Add it to MetaMask with address: ${tokenAddress} and 6 decimals`);
  console.log("Token details:");
  console.log("- Name: RESEARKA");
  console.log("- Symbol: RESKA");
  console.log("- Decimals: 6");
  console.log("- Total Supply: 1,000,000,000 RESKA");
  console.log("\nToken allocations (all to your wallet for testing):");
  console.log("- Founder: 10% (100,000,000 RESKA)");
  console.log("- Advisors: 5% (50,000,000 RESKA)");
  console.log("- Investors: 5% (50,000,000 RESKA)");
  console.log("- Airdrops/Rewards: 40% (400,000,000 RESKA)");
  console.log("- Ecosystem Development: 10% (100,000,000 RESKA)");
  console.log("- Treasury Reserve: 10% (100,000,000 RESKA)");
  console.log("- Public Sale/DEX Liquidity: 10% (100,000,000 RESKA)");
  console.log("- Long-Term Escrow: 10% (100,000,000 RESKA)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Mainnet verification script for RESKA token ecosystem
// Use after successful deployment to zkSync Era Mainnet
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== RESKA TOKEN MAINNET VERIFICATION ===");
  
  if (hre.network.name !== 'zkSyncMainnet') {
    console.error("This script should only be run on zkSync Era Mainnet!");
    console.error(`Current network: ${hre.network.name}`);
    console.error("Use: npx hardhat run scripts/verify-mainnet.js --network zkSyncMainnet");
    process.exit(1);
  }
  
  // Read deployed contract addresses from the deployments.json file or set manually
  let tokenAddress, vestingAddress, timelockAddress;
  
  try {
    const deployments = require('../deployments.json');
    tokenAddress = deployments.mainnet.token;
    vestingAddress = deployments.mainnet.vesting;
    timelockAddress = deployments.mainnet.timelock;
    
    console.log(`Using deployed addresses from deployments.json:`);
  } catch (error) {
    // If no deployments.json exists, you'll need to manually set the addresses
    console.log("No deployments.json found or error reading file.");
    console.log("Please set the contract addresses manually in the script.");
    
    // Set your actual deployed contract addresses here
    tokenAddress = "0x..."; // RESKA token address on mainnet
    vestingAddress = "0x..."; // Vesting contract address on mainnet
    timelockAddress = "0x..."; // Timelock address on mainnet
  }
  
  console.log(`Token Address: ${tokenAddress}`);
  console.log(`Vesting Address: ${vestingAddress}`);
  console.log(`Timelock Address: ${timelockAddress}`);
  
  // Verify RESKA Token
  try {
    console.log("\nVerifying RESKA Token...");
    
    // Get constructor arguments for the token (required for verification)
    // These should match the exact values used during deployment
    const constructorArgs = [
      "0x...", // Founder address
      "0x...", // Advisors address
      "0x...", // Investors address
      "0x...", // Airdrops address
      "0x...", // Ecosystem address
      "0x...", // Treasury address
      "0x...", // Public Sale address
      "0x..."  // Escrow address
    ];
    
    await hre.run("verify:verify", {
      address: tokenAddress,
      constructorArguments: constructorArgs,
      contract: "contracts/ReskaToken.sol:ReskaToken"
    });
    
    console.log("✅ Token verification submitted successfully");
  } catch (error) {
    console.error(`Error verifying token: ${error.message}`);
  }
  
  // Verify Vesting Contract
  try {
    console.log("\nVerifying Vesting Contract...");
    
    // The vesting contract constructor takes just the token address
    const vestingArgs = [tokenAddress];
    
    await hre.run("verify:verify", {
      address: vestingAddress,
      constructorArguments: vestingArgs,
      contract: "contracts/ReskaTokenVesting.sol:ReskaTokenVesting"
    });
    
    console.log("✅ Vesting contract verification submitted successfully");
  } catch (error) {
    console.error(`Error verifying vesting contract: ${error.message}`);
  }
  
  // Verify Timelock Contract
  try {
    console.log("\nVerifying Timelock Contract...");
    
    // Timelock constructor takes minDelay, proposers, executors, admin
    const timelockArgs = [
      86400, // 1 day in seconds
      ["0x...", "0x..."], // Proposer addresses
      ["0x...", "0x..."], // Executor addresses
      "0x0000000000000000000000000000000000000000" // Zero address for admin (renounced)
    ];
    
    await hre.run("verify:verify", {
      address: timelockAddress,
      constructorArguments: timelockArgs,
      contract: "contracts/ReskaTimelock.sol:ReskaTimelock"
    });
    
    console.log("✅ Timelock contract verification submitted successfully");
  } catch (error) {
    console.error(`Error verifying timelock: ${error.message}`);
  }
  
  console.log("\n=== VERIFICATION PROCESS COMPLETE ===");
  console.log("Visit https://explorer.era.zksync.io to check verification status");
  console.log("Note: Verification can take several minutes to complete");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

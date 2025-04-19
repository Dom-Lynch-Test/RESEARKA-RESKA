// Verification script for zkSync testnet
const hre = require("hardhat");
const { getContractAddress } = require("./deployment-addresses");

async function main() {
  console.log("Starting verification of RESKA tokens on zkSync testnet...");
  
  try {
    // Read deployment addresses from the generated file
    // You can manually set these if the deployment-addresses.js file doesn't exist
    let tokenAddress, vestingAddress;
    try {
      const addresses = getContractAddress("zkSyncTestnet");
      tokenAddress = addresses.token;
      vestingAddress = addresses.vesting;
    } catch (error) {
      console.log("Could not load addresses from file, please enter them manually below:");
      // For manual verification, enter the addresses here
      tokenAddress = process.env.RESKA_TOKEN_ADDRESS || "";
      vestingAddress = process.env.RESKA_VESTING_ADDRESS || "";
      
      if (!tokenAddress || !vestingAddress) {
        console.error("❌ Token or vesting contract addresses not found. Please provide them in .env or as arguments.");
        process.exit(1);
      }
    }
    
    console.log(`Verifying RESKA token at address: ${tokenAddress}`);
    console.log(`Verifying vesting contract at address: ${vestingAddress}`);
    
    // Get deployer address
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Using deployer address: ${deployer.address}`);
    
    // These should match the constructor arguments used during deployment
    const tokenArgs = [
      deployer.address, // founder
      deployer.address, // advisors
      deployer.address, // investors
      deployer.address, // airdrops
      deployer.address, // ecosystem
      deployer.address, // treasury
      deployer.address, // public sale
      deployer.address  // escrow
    ];
    
    // Verify token contract
    console.log("Verifying RESKA token contract...");
    try {
      await hre.run("verify:verify", {
        address: tokenAddress,
        constructorArguments: tokenArgs,
        contract: "contracts/ReskaToken.sol:ReskaToken"
      });
      console.log("✅ RESKA token verified successfully!");
    } catch (error) {
      console.log("Error verifying token:", error.message);
      if (error.message.includes("already verified")) {
        console.log("✅ Contract is already verified!");
      }
    }
    
    // Verify vesting contract
    console.log("Verifying vesting contract...");
    try {
      await hre.run("verify:verify", {
        address: vestingAddress,
        constructorArguments: [tokenAddress],
        contract: "contracts/ReskaTokenVesting.sol:ReskaTokenVesting"
      });
      console.log("✅ Vesting contract verified successfully!");
    } catch (error) {
      console.log("Error verifying vesting contract:", error.message);
      if (error.message.includes("already verified")) {
        console.log("✅ Contract is already verified!");
      }
    }
    
    console.log("\n=== VERIFICATION SUMMARY ===");
    console.log(`Network: ${hre.network.name}`);
    console.log(`RESKA Token: ${tokenAddress}`);
    console.log(`Vesting Contract: ${vestingAddress}`);
    console.log("=============================\n");
    
    console.log("The contracts are now verified and can be viewed on the zkSync explorer:");
    console.log(`Token: https://explorer.zksync.io/address/${tokenAddress}`);
    console.log(`Vesting: https://explorer.zksync.io/address/${vestingAddress}`);
  } catch (error) {
    console.error("Error during verification:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

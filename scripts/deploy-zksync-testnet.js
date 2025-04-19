// Deploy script for zkSync testnet using the recommended pattern
const { Wallet } = require("zksync-web3");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { saveContractAddress } = require("./deployment-addresses");

// Main deployment function
async function main() {
  console.log("Starting RESKA token zkSync testnet deployment...");
  console.log("Using network:", hre.network.name);

  try {
    // Initialize the wallet and deployer
    const wallet = new Wallet(process.env.PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);
    
    console.log("Deployer address:", wallet.address);
    
    // Create provider using the hre
    const provider = hre.ethers.provider;
    
    // Check wallet balance
    const ethBalance = await provider.getBalance(wallet.address);
    console.log(`Deployer ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
    
    if (ethBalance.eq(0)) {
      console.error("❌ Deployer wallet has no ETH. Please fund it with testnet ETH first.");
      console.log(`\nTo get zkSync Testnet ETH, follow these steps:`);
      console.log(`1. Get Goerli ETH from a faucet like https://goerlifaucet.com/`);
      console.log(`2. Bridge Goerli ETH to zkSync using the official bridge: https://portal.zksync.io/bridge`);
      process.exit(1);
    }
    
    // Verify that we're connected to zkSync Era testnet
    const chainId = await provider.getChainId();
    console.log(`Connected to chain ID: ${chainId}`);
    if (chainId === 280) {
      console.log("✅ Connected to zkSync Era Testnet");
    } else {
      console.log(`⚠️ Connected to chain ID ${chainId}, which is not zkSync Era Testnet (280)`);
    }

    console.log("Loading contract artifacts...");
    
    // Load contract artifacts
    const reskaArtifact = await deployer.loadArtifact("ReskaToken");
    
    // Decimal values - 6 decimals for RESKA token
    const decimals = 6;
    
    // Prepare constructor arguments - addresses for token allocation
    // For testing, we'll use the deployer wallet for all allocations
    const founderAddress = wallet.address;    // 10%
    const advisorsAddress = wallet.address;   // 5%
    const investorsAddress = wallet.address;  // 5%
    const airdropsAddress = wallet.address;   // 40%
    const ecosystemAddress = wallet.address;  // 10%
    const treasuryAddress = wallet.address;   // 10%
    const publicSaleAddress = wallet.address; // 10%
    const escrowAddress = wallet.address;     // 10%

    // Deploy the token with the allocation addresses
    console.log("Deploying ReskaToken with 6 decimals...");
    const reskaToken = await deployer.deploy(reskaArtifact, [
      founderAddress,
      advisorsAddress,
      investorsAddress,
      airdropsAddress,
      ecosystemAddress,
      treasuryAddress,
      publicSaleAddress,
      escrowAddress
    ]);
    
    // Get the deployed contract address
    const tokenAddress = await reskaToken.getAddress();
    console.log(`✅ RESKA token deployed at: ${tokenAddress}`);

    // Deploy vesting contract
    console.log("Deploying vesting contract...");
    const vestingArtifact = await deployer.loadArtifact("ReskaTokenVesting");
    const vestingContract = await deployer.deploy(vestingArtifact, [tokenAddress]);
    const vestingAddress = await vestingContract.getAddress();
    
    console.log(`✅ Vesting contract deployed at: ${vestingAddress}`);
    
    // Fund the vesting contract with some tokens for testing
    console.log("Funding vesting contract with test tokens...");
    const vestingAmount = ethers.parseUnits("100000", decimals); // 100,000 RESKA tokens
    
    // Use the deployed contract to transfer tokens
    const tx = await reskaToken.transfer(vestingAddress, vestingAmount);
    await tx.wait();
    
    console.log(`✅ Transferred ${ethers.formatUnits(vestingAmount, decimals)} RESKA tokens to vesting contract`);
    
    // Create a test vesting schedule for demonstration
    console.log("Creating a test vesting schedule...");
    const beneficiary = wallet.address;
    const amount = ethers.parseUnits("10000", decimals); // 10,000 RESKA tokens
    const cliffDuration = 60; // 1 minute cliff for testing
    const duration = 300; // 5 minutes total duration for testing
    
    // Get current timestamp for the vesting schedule
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const currentTimestamp = block.timestamp;
    const start = currentTimestamp;
    
    // Create vesting schedule
    const createTx = await vestingContract.createVestingSchedule(
      beneficiary,
      start,
      cliffDuration,
      duration,
      1, // time step interval (seconds)
      true, // is revocable
      amount
    );
    await createTx.wait();
    
    console.log(`✅ Created vesting schedule for ${ethers.formatUnits(amount, decimals)} RESKA tokens`);
    console.log(`   Beneficiary: ${beneficiary}`);
    console.log(`   Start time: ${new Date(start * 1000).toLocaleString()}`);
    console.log(`   Cliff duration: ${cliffDuration} seconds`);
    console.log(`   Total duration: ${duration} seconds`);
    
    // Display summary
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log(`Network: ${hre.network.name} (Chain ID: ${chainId})`);
    console.log(`RESKA Token: ${tokenAddress}`);
    console.log(`Vesting Contract: ${vestingAddress}`);
    console.log(`Deployer address: ${wallet.address}`);
    console.log("=========================\n");
    
    // Save deployed addresses
    saveContractAddress(hre.network.name, {
      token: tokenAddress,
      vesting: vestingAddress,
      deployer: wallet.address,
      chainId: chainId
    });
    
    return {
      tokenAddress,
      vestingAddress,
      deployer: wallet.address
    };
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

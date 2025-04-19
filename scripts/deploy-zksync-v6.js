// Modern zkSync deployment script using zksync-ethers with full Ethers v6 compatibility
const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync/src/deployer");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { saveContractAddress } = require("./deployment-addresses");

async function main() {
  console.log("Starting RESKA token deployment to zkSync testnet with Ethers v6...");
  console.log(`Network: ${hre.network.name}`);
  
  try {
    // Get private key from env
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Missing PRIVATE_KEY in .env file");
    }
    
    // Initialize the wallet and provider
    const provider = new Provider(hre.network.config.url);
    const wallet = new Wallet(privateKey, provider);
    console.log(`Deploying from address: ${wallet.address}`);
    
    // Create a deployer object
    const deployer = new Deployer(hre, wallet);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.log("\n⚠️ Wallet has no ETH on zkSync testnet");
      console.log("Please follow these steps to get zkSync testnet ETH:");
      console.log("1. Get Goerli ETH from a faucet like https://goerlifaucet.com");
      console.log("2. Bridge Goerli ETH to zkSync using https://portal.zksync.io/bridge");
      process.exit(1);
    }
    
    // Check chain ID to verify we're on zkSync testnet
    const chainId = await provider.getChainId();
    console.log(`Connected to chain ID: ${chainId}`);
    
    // Deploy the token
    console.log("\nDeploying RESKA token...");
    const tokenArtifact = await deployer.loadArtifact("ReskaToken");
    
    // Decimal values - 6 decimals for RESKA token
    const decimals = 6;
    
    // For testnet, we'll use the deployer wallet for all allocations
    const addresses = {
      founder: wallet.address,    // 10%
      advisors: wallet.address,   // 5%
      investors: wallet.address,  // 5%
      airdrops: wallet.address,   // 40%
      ecosystem: wallet.address,  // 10%
      treasury: wallet.address,   // 10%
      publicSale: wallet.address, // 10%
      escrow: wallet.address      // 10%
    };
    
    // Deploy token
    const token = await deployer.deploy(tokenArtifact, [
      addresses.founder,
      addresses.advisors,
      addresses.investors,
      addresses.airdrops,
      addresses.ecosystem,
      addresses.treasury,
      addresses.publicSale,
      addresses.escrow
    ]);
    
    // Get token address
    const tokenAddress = await token.getAddress();
    console.log(`✅ RESKA token deployed to: ${tokenAddress}`);
    
    // Deploy vesting contract
    console.log("\nDeploying vesting contract...");
    const vestingArtifact = await deployer.loadArtifact("ReskaTokenVesting");
    
    // Deploy vesting with token address
    const vesting = await deployer.deploy(vestingArtifact, [tokenAddress]);
    const vestingAddress = await vesting.getAddress();
    console.log(`✅ Vesting contract deployed to: ${vestingAddress}`);
    
    // Fund vesting contract with some tokens
    console.log("\nFunding vesting contract with tokens...");
    const vestingAmount = ethers.parseUnits("100000", decimals); // 100,000 tokens
    
    // Transfer tokens to vesting contract
    const tx = await token.transfer(vestingAddress, vestingAmount);
    const receipt = await tx.wait();
    
    console.log(`✅ Transferred ${ethers.formatUnits(vestingAmount, decimals)} RESKA tokens to vesting contract`);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Create a test vesting schedule
    console.log("\nCreating test vesting schedule...");
    const beneficiary = wallet.address;
    const amount = ethers.parseUnits("10000", decimals); // 10,000 tokens
    const cliffDuration = 60; // 1 minute cliff for testing
    const duration = 300; // 5 minutes duration for testing
    
    // Get current timestamp
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const start = block.timestamp;
    
    // Create vesting schedule
    const createTx = await vesting.createVestingSchedule(
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
    
    // Save deployed addresses
    saveContractAddress(hre.network.name, {
      token: tokenAddress,
      vesting: vestingAddress,
      deployer: wallet.address,
      chainId: chainId,
      timestamp: new Date().toISOString()
    });
    
    // Print deployment summary
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log(`Network: ${hre.network.name} (Chain ID: ${chainId})`);
    console.log(`RESKA Token: ${tokenAddress}`);
    console.log(`Vesting Contract: ${vestingAddress}`);
    console.log(`Deployer: ${wallet.address}`);
    console.log("=========================\n");
    
    // Verification instructions
    console.log("To verify contracts on zkSync Explorer:");
    console.log(`1. Go to https://explorer.zksync.io/address/${tokenAddress}`);
    console.log(`2. Go to https://explorer.zksync.io/address/${vestingAddress}`);
    
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

// Run the deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

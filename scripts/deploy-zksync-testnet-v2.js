// RESKA Token zkSync Testnet Deployment Script
// Compatible with the latest zkSync tools and Ethers v6
const { Wallet, Provider } = require("zksync-ethers");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("\n=== RESKA TOKEN DEPLOYMENT TO ZKSYNC ERA TESTNET ===");

  try {
    // Initialize provider with fallback mechanism
    const url = process.env.ZKSYNC_TESTNET_URL || "https://zksync-era-testnet.blockpi.network/v1/rpc/public";
    console.log(`Using zkSync RPC: ${url}`);
    
    // Check if we're on the zkSync network
    if (hre.network.name !== "zkSyncTestnet") {
      throw new Error(`You need to use the zkSyncTestnet network. Current network: ${hre.network.name}`);
    }

    // Initialize the wallet - using the same wallet from your server (as per your memory)
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Missing PRIVATE_KEY environment variable");
    }
    
    // Initialize provider using hardhat's ethers
    const provider = ethers.provider;
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`Deployer address: ${wallet.address}`);
    
    // Get wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.log("\n⚠️ WARNING: Your wallet has zero balance on zkSync Testnet");
      console.log("Before deployment, you'll need to:");
      console.log("1. Get Goerli ETH from a faucet");
      console.log("2. Bridge your ETH to zkSync Era Testnet via https://portal.zksync.io/bridge");
      console.log("\nDeployment will continue but will likely fail...");
    }

    // Token allocation addresses based on your memory requirements
    console.log("\nPreparing token allocations according to specified distribution...");
    
    // For testing purposes, we'll use the same wallet for all roles
    // In production, these would be different addresses
    const founderAddress = wallet.address;    // 10%
    const advisorsAddress = wallet.address;   // 5%
    const investorsAddress = wallet.address;  // 5%
    const airdropsAddress = wallet.address;   // 40%
    const ecosystemAddress = wallet.address;  // 10%
    const treasuryAddress = wallet.address;   // 10%
    const publicSaleAddress = wallet.address; // 10%
    const escrowAddress = wallet.address;     // 10%
    
    // Deploy the RESKA token contract
    console.log("\n=== DEPLOYING RESKA TOKEN CONTRACT ===");
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    const reskaToken = await ReskaToken.connect(wallet).deploy(
      founderAddress,      // 10%
      advisorsAddress,     // 5%
      investorsAddress,    // 5%
      airdropsAddress,     // 40%
      ecosystemAddress,    // 10%
      treasuryAddress,     // 10%
      publicSaleAddress,   // 10%
      escrowAddress        // 10%
    );
    
    // Wait for the transaction to be confirmed
    await reskaToken.waitForDeployment();
    const tokenAddress = await reskaToken.getAddress();
    console.log(`✅ RESKA Token deployed at: ${tokenAddress}`);
    
    // Get token details
    const tokenName = await reskaToken.name();
    const tokenSymbol = await reskaToken.symbol();
    const tokenDecimals = await reskaToken.decimals();
    const totalSupply = await reskaToken.totalSupply();
    
    console.log(`\nToken Details:`);
    console.log(`- Name: ${tokenName}`);
    console.log(`- Symbol: ${tokenSymbol}`);
    console.log(`- Decimals: ${tokenDecimals}`);
    console.log(`- Total Supply: ${ethers.formatUnits(totalSupply, tokenDecimals)} ${tokenSymbol}`);
    
    // Deploy the vesting contract
    console.log("\n=== DEPLOYING RESKA TOKEN VESTING CONTRACT ===");
    const ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
    const vestingContract = await ReskaTokenVesting.connect(wallet).deploy(tokenAddress);
    
    // Wait for the transaction to be confirmed
    await vestingContract.waitForDeployment();
    const vestingAddress = await vestingContract.getAddress();
    console.log(`✅ RESKA Token Vesting deployed at: ${vestingAddress}`);
    
    // Save deployment information
    const deploymentInfo = {
      network: "zkSyncTestnet",
      tokenContract: tokenAddress,
      vestingContract: vestingAddress,
      deployer: wallet.address,
      tokenDetails: {
        name: tokenName,
        symbol: tokenSymbol,
        decimals: tokenDecimals.toString(),
        totalSupply: ethers.formatUnits(totalSupply, tokenDecimals)
      },
      distributionAddresses: {
        founder: founderAddress,
        advisors: advisorsAddress,
        investors: investorsAddress,
        airdrops: airdropsAddress,
        ecosystem: ecosystemAddress,
        treasury: treasuryAddress,
        publicSale: publicSaleAddress,
        escrow: escrowAddress
      },
      timestamp: new Date().toISOString()
    };
    
    // Ensure deployments directory exists
    const deploymentDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const deploymentPath = path.join(deploymentDir, "zksync-testnet.json");
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log(`\n✅ Deployment information saved to: ${deploymentPath}`);
    
    // Verification instructions
    console.log("\n=== NEXT STEPS ===");
    console.log("1. Verify the contract on zkSync Explorer:");
    console.log(`   npx hardhat verify --network zkSyncTestnet ${tokenAddress} "${founderAddress}" "${advisorsAddress}" "${investorsAddress}" "${airdropsAddress}" "${ecosystemAddress}" "${treasuryAddress}" "${publicSaleAddress}" "${escrowAddress}"`);
    
    console.log("\n2. After verification, transfer the deployment files to your server:");
    console.log(`   rsync -avz --exclude 'node_modules' --exclude '.git' ./ reska@5.161.55.81:/home/reska/reska-token/`);
    
    console.log("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===");
    return { success: true, tokenAddress, vestingAddress };
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED");
    console.error(`Error: ${error.message}`);
    
    // Provide helpful troubleshooting guidance
    console.log("\n=== TROUBLESHOOTING ===");
    console.log("1. Check zkSync Era Testnet status: https://status.zksync.io/");
    console.log("2. Ensure your wallet has enough ETH on zkSync Era Testnet");
    console.log("3. Try with a different RPC endpoint in your .env file");
    console.log("4. If network issues persist, follow your staged approach:");
    console.log("   - Continue developing and testing locally");
    console.log("   - Try deployment again when network conditions improve");
    
    return { success: false, error: error.message };
  }
}

// Execute the deployment
if (require.main === module) {
  main()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

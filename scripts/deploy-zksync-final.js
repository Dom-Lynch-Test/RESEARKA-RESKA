// RESKA Token zkSync Testnet Deployment Script - Final Version
// Compatible with multiple zkSync libraries and tested against local environments
const { ethers } = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== RESKA TOKEN DEPLOYMENT TO ZKSYNC ERA TESTNET ===");
  console.log(`[${new Date().toISOString()}] Starting deployment process...`);

  try {
    // Check network
    const networkName = hre.network.name;
    console.log(`Deploying to network: ${networkName}`);
    
    if (networkName !== 'zkSyncTestnet') {
      console.warn("⚠️ Warning: You are not connected to zkSyncTestnet.");
      console.warn("For testnet deployment, use: --network zkSyncTestnet");
    }

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from address: ${deployer.address}`);
    
    // Check balance 
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.01")) {
      console.warn("⚠️ WARNING: Your wallet has very little ETH. Deployment may fail.");
      console.warn("To fund your wallet:");
      console.warn("1. Get Goerli ETH from a faucet like https://goerlifaucet.com/");
      console.warn("2. Bridge to zkSync using https://portal.zksync.io/bridge");
    }

    // Deploy with multiple retry attempts
    let reskaToken;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`\nDeployment attempt ${retryCount + 1}/${maxRetries}...`);
        
        // Token allocation addresses
        // In a real deployment, these would be different addresses
        const founderAddress = deployer.address;    // 10%
        const advisorsAddress = deployer.address;   // 5%
        const investorsAddress = deployer.address;  // 5%
        const airdropsAddress = deployer.address;   // 40%
        const ecosystemAddress = deployer.address;  // 10%
        const treasuryAddress = deployer.address;   // 10%
        const publicSaleAddress = deployer.address; // 10%
        const escrowAddress = deployer.address;     // 10%
        
        console.log("\n=== DEPLOYING RESKA TOKEN CONTRACT ===");
        const ReskaToken = await ethers.getContractFactory("ReskaToken");
        reskaToken = await ReskaToken.deploy(
          founderAddress,
          advisorsAddress,
          investorsAddress,
          airdropsAddress,
          ecosystemAddress,
          treasuryAddress,
          publicSaleAddress,
          escrowAddress
        );
        
        // Wait for deployment
        await reskaToken.waitForDeployment();
        
        // Deployment successful, break retry loop
        break;
      } catch (err) {
        console.error(`Deployment attempt ${retryCount + 1} failed: ${err.message}`);
        
        // Increment retry counter
        retryCount++;
        
        // If we've reached max retries, rethrow the error
        if (retryCount >= maxRetries) {
          throw new Error(`Deployment failed after ${maxRetries} attempts: ${err.message}`);
        }
        
        // Wait before retrying
        console.log(`Waiting 10 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    // Get token contract address
    const tokenAddress = await reskaToken.getAddress();
    console.log(`\n✅ RESKA Token deployed to: ${tokenAddress}`);
    
    // Get token details
    const name = await reskaToken.name();
    const symbol = await reskaToken.symbol();
    const decimals = await reskaToken.decimals();
    const totalSupply = await reskaToken.totalSupply();
    
    console.log(`\n=== TOKEN DETAILS ===`);
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    
    // Deploy vesting contract with retry
    let vestingContract;
    retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`\nVesting deployment attempt ${retryCount + 1}/${maxRetries}...`);
        
        console.log("\n=== DEPLOYING RESKA TOKEN VESTING CONTRACT ===");
        const ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
        vestingContract = await ReskaTokenVesting.deploy(tokenAddress);
        
        // Wait for deployment
        await vestingContract.waitForDeployment();
        
        // Deployment successful, break retry loop
        break;
      } catch (err) {
        console.error(`Vesting deployment attempt ${retryCount + 1} failed: ${err.message}`);
        
        // Increment retry counter
        retryCount++;
        
        // If we've reached max retries, rethrow the error
        if (retryCount >= maxRetries) {
          throw new Error(`Vesting deployment failed after ${maxRetries} attempts: ${err.message}`);
        }
        
        // Wait before retrying
        console.log(`Waiting 10 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    // Get vesting contract address
    const vestingAddress = await vestingContract.getAddress();
    console.log(`✅ RESKA Token Vesting deployed to: ${vestingAddress}`);
    
    // Save deployment information
    const deploymentInfo = {
      network: networkName,
      blockExplorer: networkName === 'zkSyncTestnet' 
        ? 'https://explorer.zksync.io/address/' 
        : 'https://goerli.explorer.zksync.io/address/',
      tokenContract: tokenAddress,
      vestingContract: vestingAddress,
      deployer: deployer.address,
      tokenDetails: {
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: ethers.formatUnits(totalSupply, decimals)
      },
      allocation: {
        founder: "10%",
        advisors: "5%",
        investors: "5%",
        airdrops: "40%",
        ecosystem: "10%",
        treasury: "10%",
        publicSale: "10%",
        escrow: "10%"
      },
      timestamp: new Date().toISOString()
    };
    
    // Ensure deployments directory exists
    const deploymentDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    // Create timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const deploymentFile = `${networkName}-${timestamp}.json`;
    const deploymentPath = path.join(deploymentDir, deploymentFile);
    
    fs.writeFileSync(
      deploymentPath,
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`\n✅ Deployment info saved to: ${deploymentPath}`);
    
    // Log verification instructions
    console.log("\n=== NEXT STEPS ===");
    console.log("1. Verify contracts on zkSync Explorer:");
    console.log(`   npx hardhat verify --network ${networkName} ${tokenAddress}`);
    console.log(`   npx hardhat verify --network ${networkName} ${vestingAddress} ${tokenAddress}`);
    
    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log(`Token address: ${tokenAddress}`);
    console.log(`Vesting address: ${vestingAddress}`);
    console.log(`Explorer: ${deploymentInfo.blockExplorer}${tokenAddress}`);
    
    return {
      success: true,
      tokenAddress,
      vestingAddress,
      deploymentFile
    };
    
  } catch (error) {
    console.error(`\n❌ DEPLOYMENT FAILED: ${error.message}`);
    
    // More detailed error logging
    if (error.code === 'NETWORK_ERROR') {
      console.error("Network connectivity issue detected.");
      console.error("Check your internet connection and zkSync RPC endpoint.");
    } else if (error.message.includes('insufficient funds')) {
      console.error("Insufficient funds for deployment.");
      console.error("Make sure your wallet has enough ETH on zkSync Era Testnet.");
    }
    
    console.log("\n=== TROUBLESHOOTING SUGGESTIONS ===");
    console.log("1. Check zkSync network status: https://status.zksync.io/");
    console.log("2. Verify your wallet has sufficient ETH on zkSync Era Testnet");
    console.log("3. Try using a VPN if regional network restrictions may apply");
    console.log("4. If on your local machine, try deploying from the server instead:");
    console.log("   ssh reska@5.161.55.81");
    console.log("   cd reska-token");
    console.log("   npx hardhat run scripts/deploy-zksync-final.js --network zkSyncTestnet");
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute if directly run
if (require.main === module) {
  main()
    .then((result) => {
      if (!result || !result.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

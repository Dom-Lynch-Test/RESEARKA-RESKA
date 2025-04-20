/**
 * RESKA Token - Fund Vesting Contract Script
 * This script funds the vesting contract with RESKA tokens from the deployer wallet
 * 
 * @author RESKA Team
 * @version 1.0.0
 * Node.js v18+ required
 */

const { Wallet, Provider, utils } = require("zksync-ethers");
const hre = require("hardhat");
const { validateEnvironment, validateAddresses } = require("./helpers/vestingDeployer");
require("dotenv").config();

// Parse command line arguments
const args = process.argv.slice(2);
const networkArg = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 
                   args[args.indexOf('--network') + 1];

// Token funding amount (can be overridden via environment variable)
const FUNDING_AMOUNT = process.env.VESTING_FUNDING_AMOUNT 
  ? BigInt(process.env.VESTING_FUNDING_AMOUNT) 
  : BigInt(1_000_000 * 10**6); // Default: 1M RESKA with 6 decimals

async function main() {
  console.log("=== FUNDING VESTING CONTRACT WITH RESKA TOKENS ===");
  
  try {
    // Validate environment variables
    validateEnvironment(['PRIVATE_KEY']);
    
    // Get network configuration
    const network = networkArg || 'zkSyncTestnet';
    const validNetworks = ['zkSyncTestnet', 'zkSyncMainnet', 'hardhat'];
    
    if (!validNetworks.includes(network)) {
      throw new Error(`Invalid network: ${network}. Must be one of: ${validNetworks.join(', ')}`);
    }
    
    // Get network configuration from hardhat config
    const networkConfig = hre.config.networks[network];
    if (!networkConfig) {
      throw new Error(`Network configuration not found for: ${network}`);
    }
    
    // Initialize provider and wallet
    const providerUrl = network === 'zkSyncMainnet' 
      ? (process.env.ZKSYNC_MAINNET_URL || 'https://mainnet.era.zksync.io')
      : (process.env.ZKSYNC_TESTNET_URL || 'https://sepolia.era.zksync.dev');
      
    const provider = new Provider(providerUrl);
    const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Using wallet: ${wallet.address}`);
    
    // Contract addresses - try to get from env, fall back to deployments.json
    let TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
    let VESTING_ADDRESS = process.env.VESTING_ADDRESS;
    
    // If not in env, try to load from deployments.json
    if (!TOKEN_ADDRESS || !VESTING_ADDRESS) {
      try {
        const fs = require('fs');
        const path = require('path');
        const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
        
        if (fs.existsSync(deploymentsPath)) {
          const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
          const networkKey = network === 'zkSyncMainnet' ? 'mainnet' : 'testnet';
          
          TOKEN_ADDRESS = TOKEN_ADDRESS || deployments[networkKey]?.token;
          VESTING_ADDRESS = VESTING_ADDRESS || deployments[networkKey]?.vesting?.address;
        }
      } catch (error) {
        console.warn('Could not load addresses from deployments.json:', error.message);
      }
    }
    
    // Validate contract addresses
    validateAddresses({
      'TOKEN_ADDRESS': TOKEN_ADDRESS,
      'VESTING_ADDRESS': VESTING_ADDRESS
    });
    
    console.log(`Token contract: ${TOKEN_ADDRESS}`);
    console.log(`Vesting contract: ${VESTING_ADDRESS}`);
    
    // Load token contract dynamically
    console.log("Loading contracts...");
    const tokenAbi = await hre.artifacts.readArtifact('ReskaToken').then(artifact => artifact.abi);
    const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
    
    // Check balances before transfer
    const walletBalance = await token.balanceOf(wallet.address);
    const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
    
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    console.log(`Vesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Funding amount: ${Number(FUNDING_AMOUNT) / 10**6} RESKA`);
    
    if (walletBalance < FUNDING_AMOUNT) {
      throw new Error(`Wallet doesn't have enough tokens to fund vesting (${Number(FUNDING_AMOUNT) / 10**6} RESKA needed, ${Number(walletBalance) / 10**6} available)`);
    }
    
    // Transfer tokens to vesting contract if needed
    if (vestingBalance >= FUNDING_AMOUNT) {
      console.log(`Vesting contract already has sufficient funding (${Number(vestingBalance) / 10**6} RESKA)`);
      console.log("=== VESTING CONTRACT IS ALREADY FUNDED ===");
      return;
    }
    
    // Transfer tokens to vesting contract
    console.log(`Transferring ${Number(FUNDING_AMOUNT - vestingBalance) / 10**6} RESKA to the vesting contract...`);
    
    // Estimate gas for the transaction
    const gasEstimate = await token.estimateGas.transfer(VESTING_ADDRESS, FUNDING_AMOUNT - vestingBalance);
    // Add 20% buffer to gas estimate
    const gasLimit = Math.floor(gasEstimate.toNumber() * 1.2);
    
    const tx = await token.transfer(VESTING_ADDRESS, FUNDING_AMOUNT - vestingBalance, { gasLimit });
    console.log(`Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the new balance
    const newVestingBalance = await token.balanceOf(VESTING_ADDRESS);
    console.log(`New vesting contract balance: ${Number(newVestingBalance) / 10**6} RESKA`);
    
    console.log("=== VESTING CONTRACT SUCCESSFULLY FUNDED ===");
    console.log("You can now create vesting schedules without the InsufficientContractBalance error");
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Execute script
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`Unhandled error:`, error);
    process.exit(1);
  });

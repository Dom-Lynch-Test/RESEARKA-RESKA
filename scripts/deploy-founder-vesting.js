/**
 * RESKA Token - Founder Vesting Schedule Deployment Script
 * Implements a balanced 50/50 split: 50% immediate and 50% after 1-year cliff
 * 
 * @author RESKA Team
 * @version 1.0.0
 * Node.js v18+ required
 */

const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
const path = require('path');
const vestingHelper = require('./helpers/vestingDeployer');
require("dotenv").config();

// Parse command line arguments
const args = process.argv.slice(2);
const networkArg = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 
                   args[args.indexOf('--network') + 1];

async function main() {
  console.log("=== DEPLOYING RESKA FOUNDER VESTING SCHEDULE ===");
  
  try {
    // Validate environment variables
    vestingHelper.validateEnvironment(['PRIVATE_KEY']);
    
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
    const { provider, wallet } = await vestingHelper.initializeConnection(networkConfig);
    console.log(`Using wallet: ${wallet.address}`);
    console.log(`Network: ${network}`);
    
    // Contract addresses - try to get from env, fall back to deployments.json
    let TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
    let VESTING_ADDRESS = process.env.VESTING_ADDRESS;
    
    // If not in env, try to load from deployments.json
    if (!TOKEN_ADDRESS || !VESTING_ADDRESS) {
      try {
        const fs = require('fs');
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
    vestingHelper.validateAddresses({
      'TOKEN_ADDRESS': TOKEN_ADDRESS,
      'VESTING_ADDRESS': VESTING_ADDRESS
    });
    
    console.log(`\nConnecting to contracts:`);
    console.log(`- Token: ${TOKEN_ADDRESS}`);
    console.log(`- Vesting: ${VESTING_ADDRESS}`);
    
    // Load contract instances
    const { token, vesting } = await vestingHelper.loadContracts(wallet, {
      tokenAddress: TOKEN_ADDRESS,
      vestingAddress: VESTING_ADDRESS
    });
    
    // Founder allocation parameters
    // Total supply: 1,000,000,000 RESKA
    // Founder allocation: 10% = 100,000,000 RESKA
    const TOTAL_FOUNDER_AMOUNT = BigInt(100_000_000 * 10**6); // 100M RESKA with 6 decimals
    
    // 50/50 split for founder allocation
    const IMMEDIATE_AMOUNT = TOTAL_FOUNDER_AMOUNT / BigInt(2); // 50% immediately available
    const VESTED_AMOUNT = TOTAL_FOUNDER_AMOUNT - IMMEDIATE_AMOUNT; // 50% vested with cliff
    
    // Vesting schedule parameters for the vested portion
    const now = Math.floor(Date.now() / 1000);
    const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 31,536,000 seconds
    
    const START_TIME = now; // Start now
    const CLIFF_PERIOD = ONE_YEAR_IN_SECONDS; // 1 year cliff
    const VESTING_DURATION = ONE_YEAR_IN_SECONDS; // 1 year vesting after cliff (total 2 years)
    const SLICE_PERIOD = 30 * 24 * 60 * 60; // 30 days between releases after cliff
    const REVOCABLE = false; // Non-revocable for founder allocation (commitment to project)
    
    // Founder address - update with the actual founder address
    const FOUNDER_ADDRESS = process.env.FOUNDER_ADDRESS || wallet.address;
    
    // Validate founder address
    vestingHelper.validateAddresses({
      'FOUNDER_ADDRESS': FOUNDER_ADDRESS
    });
    
    console.log(`\nFounder allocation details:`);
    console.log(`- Founder address: ${FOUNDER_ADDRESS}`);
    console.log(`- Total allocation: ${Number(TOTAL_FOUNDER_AMOUNT) / 10**6} RESKA (10% of supply)`);
    console.log(`- Immediate amount: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA (50%)`);
    console.log(`- Vested amount: ${Number(VESTED_AMOUNT) / 10**6} RESKA (50%)`);
    
    // STEP 1: Check token balances and fund vesting contract if needed
    // ===============================================================
    await vestingHelper.fundVestingContractIfNeeded(token, wallet, VESTING_ADDRESS, VESTED_AMOUNT);
    
    // STEP 2: Transfer immediate founder allocation
    // ============================================
    
    // Check wallet balance for immediate transfer
    const walletBalance = await token.balanceOf(wallet.address);
    
    if (walletBalance < IMMEDIATE_AMOUNT) {
      throw new Error(`Insufficient tokens in wallet for immediate founder allocation. Required: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA, Available: ${Number(walletBalance) / 10**6} RESKA`);
    }
    
    // If founder address is different from deployer, transfer the immediate portion
    if (FOUNDER_ADDRESS.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log(`\nTransferring immediate founder allocation (50%)...`);
      
      // Estimate gas for the transfer
      const gasEstimate = await token.estimateGas.transfer(FOUNDER_ADDRESS, IMMEDIATE_AMOUNT);
      const gasLimit = Math.floor(gasEstimate.toNumber() * 1.2); // Add 20% buffer
      
      const transferTx = await token.transfer(FOUNDER_ADDRESS, IMMEDIATE_AMOUNT, { gasLimit });
      const receipt = await transferTx.wait();
      console.log(`✅ Transferred ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA to founder immediately`);
      console.log(`Transaction hash: ${receipt.hash}`);
    } else {
      console.log(`\nFounder and deployer are the same address, no immediate transfer needed.`);
      console.log(`✅ ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA available immediately to founder`);
    }
    
    // STEP 3: Create vesting schedule for remaining 50%
    // ===============================================
    
    console.log(`\nCreating vesting schedule for remaining 50% of founder allocation:`);
    console.log(`- Cliff: ${CLIFF_PERIOD} seconds (1 year)`);
    console.log(`- Release period: ${VESTING_DURATION} seconds (1 year after cliff)`);
    console.log(`- Release frequency: ${SLICE_PERIOD} seconds (monthly after cliff)`);
    
    // Create vesting schedule using the helper
    const vestingParams = {
      beneficiary: FOUNDER_ADDRESS,
      startTime: START_TIME,
      cliffPeriod: CLIFF_PERIOD,
      duration: VESTING_DURATION,
      slicePeriod: SLICE_PERIOD,
      revocable: REVOCABLE,
      amount: VESTED_AMOUNT
    };
    
    const receipt = await vestingHelper.createVestingSchedule(vesting, vestingParams);
    console.log(`Transaction hash: ${receipt.hash}`);
    
    // Get the vesting schedule ID for future reference
    const scheduleId = await vestingHelper.getVestingScheduleId(vesting, FOUNDER_ADDRESS);
    console.log(`Vesting schedule ID: ${scheduleId}`);
    
    // Summary
    console.log(`\n=== FOUNDER ALLOCATION COMPLETE ===`);
    console.log(`- Immediate allocation: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA (available now)`);
    console.log(`- Vested allocation: ${Number(VESTED_AMOUNT) / 10**6} RESKA`);
    console.log(`- Cliff end date: ${new Date((START_TIME + CLIFF_PERIOD) * 1000).toISOString()}`);
    console.log(`- Full vesting date: ${new Date((START_TIME + CLIFF_PERIOD + VESTING_DURATION) * 1000).toISOString()}`);
    
    // Update deployments.json with vesting details
    const networkType = network === 'zkSyncMainnet' ? 'mainnet' : 'testnet';
    
    const vestingData = {
      address: FOUNDER_ADDRESS,
      immediateAmount: IMMEDIATE_AMOUNT.toString(),
      vestedAmount: VESTED_AMOUNT.toString(),
      cliffEnd: new Date((START_TIME + CLIFF_PERIOD) * 1000).toISOString(),
      fullVestingDate: new Date((START_TIME + CLIFF_PERIOD + VESTING_DURATION) * 1000).toISOString(),
      scheduleId: scheduleId
    };
    
    vestingHelper.updateDeploymentsJson(networkType, 'founder', vestingData);
    
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
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

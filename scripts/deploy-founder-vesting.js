// Founder vesting schedule deployment script for RESKA token
// Implements a balanced 50/50 split: 50% immediate and 50% after 1-year cliff
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA FOUNDER VESTING SCHEDULE ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
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
  
  // Connect to contracts
  console.log(`\nConnecting to contracts:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- Vesting: ${VESTING_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Founder address - update with the actual founder address
  const FOUNDER_ADDRESS = process.env.FOUNDER_ADDRESS || wallet.address;
  
  console.log(`\nFounder allocation details:`);
  console.log(`- Founder address: ${FOUNDER_ADDRESS}`);
  console.log(`- Total allocation: ${Number(TOTAL_FOUNDER_AMOUNT) / 10**6} RESKA (10% of supply)`);
  console.log(`- Immediate amount: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA (50%)`);
  console.log(`- Vested amount: ${Number(VESTED_AMOUNT) / 10**6} RESKA (50%)`);
  
  // STEP 1: Check token balances
  // ===========================
  
  // Check vesting contract balance
  const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
  console.log(`\nVesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  
  // Ensure vesting contract has sufficient tokens for the vested portion
  if (vestingBalance < VESTED_AMOUNT) {
    console.log(`\nVesting contract needs more tokens for the founder allocation.`);
    console.log(`Required: ${Number(VESTED_AMOUNT) / 10**6} RESKA`);
    console.log(`Available: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Deficit: ${Number(VESTED_AMOUNT - vestingBalance) / 10**6} RESKA`);
    
    // Check if wallet has enough tokens to cover the deficit
    const walletBalance = await token.balanceOf(wallet.address);
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    
    if (walletBalance >= (VESTED_AMOUNT - vestingBalance)) {
      console.log(`\nTransferring additional tokens to vesting contract...`);
      const transferAmount = VESTED_AMOUNT - vestingBalance;
      
      try {
        const transferTx = await token.transfer(VESTING_ADDRESS, transferAmount);
        await transferTx.wait();
        console.log(`✅ Transferred ${Number(transferAmount) / 10**6} RESKA to vesting contract`);
        
        // Verify new balance
        const newVestingBalance = await token.balanceOf(VESTING_ADDRESS);
        console.log(`New vesting contract balance: ${Number(newVestingBalance) / 10**6} RESKA`);
      } catch (error) {
        console.error(`Error transferring tokens: ${error.message}`);
        return;
      }
    } else {
      console.error(`❌ Error: Insufficient tokens in wallet to fund vesting contract.`);
      console.error(`Please fund your wallet with more RESKA tokens or adjust the allocation amount.`);
      return;
    }
  }
  
  // STEP 2: Transfer immediate founder allocation
  // ============================================
  
  // Check wallet balance for immediate transfer
  const walletBalance = await token.balanceOf(wallet.address);
  
  if (walletBalance < IMMEDIATE_AMOUNT) {
    console.error(`❌ Error: Insufficient tokens in wallet for immediate founder allocation.`);
    console.error(`Required: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA`);
    console.error(`Available: ${Number(walletBalance) / 10**6} RESKA`);
    return;
  }
  
  // If founder address is different from deployer, transfer the immediate portion
  if (FOUNDER_ADDRESS.toLowerCase() !== wallet.address.toLowerCase()) {
    console.log(`\nTransferring immediate founder allocation (50%)...`);
    
    try {
      const transferTx = await token.transfer(FOUNDER_ADDRESS, IMMEDIATE_AMOUNT);
      await transferTx.wait();
      console.log(`✅ Transferred ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA to founder immediately`);
    } catch (error) {
      console.error(`Error transferring immediate allocation: ${error.message}`);
      return;
    }
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
  
  try {
    const tx = await vesting.createVestingSchedule(
      FOUNDER_ADDRESS,
      START_TIME,
      CLIFF_PERIOD,
      VESTING_DURATION,
      SLICE_PERIOD,
      REVOCABLE,
      VESTED_AMOUNT,
      { gasLimit: 5000000 }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Founder vesting schedule created successfully`);
    
    // Get the vesting schedule ID for future reference
    const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(FOUNDER_ADDRESS, 0);
    console.log(`Vesting schedule ID: ${scheduleId}`);
    
    // Summary
    console.log(`\n=== FOUNDER ALLOCATION COMPLETE ===`);
    console.log(`- Immediate allocation: ${Number(IMMEDIATE_AMOUNT) / 10**6} RESKA (available now)`);
    console.log(`- Vested allocation: ${Number(VESTED_AMOUNT) / 10**6} RESKA`);
    console.log(`- Cliff end date: ${new Date((START_TIME + CLIFF_PERIOD) * 1000).toISOString()}`);
    console.log(`- Full vesting date: ${new Date((START_TIME + CLIFF_PERIOD + VESTING_DURATION) * 1000).toISOString()}`);
    
    // Add to deployments.json
    try {
      const fs = require('fs');
      let deployments = {};
      
      try {
        const data = fs.readFileSync('./deployments.json', 'utf8');
        deployments = JSON.parse(data);
      } catch (error) {
        deployments = { 
          testnet: { vesting: {} },
          mainnet: { vesting: {} }
        };
      }
      
      // Update with founder vesting details
      const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
      
      if (!deployments[networkType].vesting) {
        deployments[networkType].vesting = {};
      }
      
      deployments[networkType].vesting.founder = {
        address: FOUNDER_ADDRESS,
        immediateAmount: IMMEDIATE_AMOUNT.toString(),
        vestedAmount: VESTED_AMOUNT.toString(),
        cliffEnd: new Date((START_TIME + CLIFF_PERIOD) * 1000).toISOString(),
        fullVestingDate: new Date((START_TIME + CLIFF_PERIOD + VESTING_DURATION) * 1000).toISOString(),
        scheduleId: scheduleId
      };
      
      fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
      console.log(`Founder vesting details saved to deployments.json`);
    } catch (error) {
      console.log(`Note: Could not save to deployments.json: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating founder vesting schedule: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

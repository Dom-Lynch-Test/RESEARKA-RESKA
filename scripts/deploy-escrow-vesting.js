// Long-Term Escrow vesting schedule deployment script for RESKA token
// Implements a 3-year cliff (all tokens released after 3 years)
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA LONG-TERM ESCROW VESTING SCHEDULE ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Long-Term Escrow allocation parameters
  // Total supply: 1,000,000,000 RESKA
  // Long-Term Escrow allocation: 10% = 100,000,000 RESKA
  const TOTAL_ESCROW_AMOUNT = BigInt(100_000_000 * 10**6); // 100M RESKA with 6 decimals
  
  // Vesting schedule parameters - 3-year cliff for maximum long-term stability
  const now = Math.floor(Date.now() / 1000);
  const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 31,536,000 seconds
  const THREE_YEARS_IN_SECONDS = 3 * ONE_YEAR_IN_SECONDS;
  
  const START_TIME = now; // Start now
  const CLIFF_PERIOD = THREE_YEARS_IN_SECONDS; // 3-year cliff
  const VESTING_DURATION = 1; // Minimal duration - immediately available after cliff
  const SLICE_PERIOD = 1; // Minimal slice - all tokens released at once after cliff
  const REVOCABLE = false; // Non-revocable for stability and security
  
  // Connect to contracts
  console.log(`\nConnecting to contracts:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- Vesting: ${VESTING_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Escrow address - in production, this should be a secure multi-sig wallet
  // For testing, we'll use our own wallet address
  const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || wallet.address;
  
  console.log(`\nLong-Term Escrow allocation details:`);
  console.log(`- Escrow address: ${ESCROW_ADDRESS}`);
  console.log(`- Total allocation: ${Number(TOTAL_ESCROW_AMOUNT) / 10**6} RESKA (10% of supply)`);
  console.log(`- Vesting type: 3-year cliff (all tokens at once after 3 years)`);
  
  // Check vesting contract balance
  const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
  console.log(`\nVesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  
  // Ensure vesting contract has sufficient tokens
  if (vestingBalance < TOTAL_ESCROW_AMOUNT) {
    console.log(`\nVesting contract needs more tokens for the escrow allocation.`);
    console.log(`Required: ${Number(TOTAL_ESCROW_AMOUNT) / 10**6} RESKA`);
    console.log(`Available: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Deficit: ${Number(TOTAL_ESCROW_AMOUNT - vestingBalance) / 10**6} RESKA`);
    
    // Check if wallet has enough tokens to cover the deficit
    const walletBalance = await token.balanceOf(wallet.address);
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    
    if (walletBalance >= (TOTAL_ESCROW_AMOUNT - vestingBalance)) {
      console.log(`\nTransferring additional tokens to vesting contract...`);
      const transferAmount = TOTAL_ESCROW_AMOUNT - vestingBalance;
      
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
      console.error(`Please fund your wallet with more RESKA tokens or adjust the escrow amount.`);
      return;
    }
  }
  
  // Create escrow vesting schedule
  console.log(`\nCreating 3-year cliff vesting schedule for Long-Term Escrow...`);
  
  try {
    const tx = await vesting.createVestingSchedule(
      ESCROW_ADDRESS,
      START_TIME,
      CLIFF_PERIOD,
      VESTING_DURATION,
      SLICE_PERIOD,
      REVOCABLE,
      TOTAL_ESCROW_AMOUNT,
      { gasLimit: 5000000 }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Long-Term Escrow vesting schedule created successfully`);
    
    // Get the vesting schedule ID for future reference
    const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(ESCROW_ADDRESS, 0);
    console.log(`Vesting schedule ID: ${scheduleId}`);
    
    // Calculate release date
    const releaseDate = new Date((START_TIME + CLIFF_PERIOD) * 1000);
    
    // Summary
    console.log(`\n=== LONG-TERM ESCROW ALLOCATION COMPLETE ===`);
    console.log(`- Total amount: ${Number(TOTAL_ESCROW_AMOUNT) / 10**6} RESKA`);
    console.log(`- 3-year cliff, all tokens available after: ${releaseDate.toISOString()}`);
    
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
      
      // Update with escrow vesting details
      const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
      
      if (!deployments[networkType].vesting) {
        deployments[networkType].vesting = {};
      }
      
      deployments[networkType].vesting.escrow = {
        address: ESCROW_ADDRESS,
        amount: TOTAL_ESCROW_AMOUNT.toString(),
        cliffDate: releaseDate.toISOString(),
        scheduleId: scheduleId
      };
      
      fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
      console.log(`Escrow vesting details saved to deployments.json`);
    } catch (error) {
      console.log(`Note: Could not save to deployments.json: ${error.message}`);
    }
    
    console.log(`\nNOTE: In production, the escrow address should be a secure multi-sig wallet`);
    console.log(`controlled by trusted project guardians for maximum security.`);
    
  } catch (error) {
    console.error(`❌ Error creating escrow vesting schedule: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

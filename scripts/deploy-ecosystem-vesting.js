// Ecosystem Development vesting schedule deployment script for RESKA token
// Implements a linear release over 2 years (no cliff)
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA ECOSYSTEM DEVELOPMENT VESTING SCHEDULE ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Ecosystem allocation parameters
  // Total supply: 1,000,000,000 RESKA
  // Ecosystem allocation: 10% = 100,000,000 RESKA
  const TOTAL_ECOSYSTEM_AMOUNT = BigInt(100_000_000 * 10**6); // 100M RESKA with 6 decimals
  
  // Vesting schedule parameters
  const now = Math.floor(Date.now() / 1000);
  const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 31,536,000 seconds
  const TWO_YEARS_IN_SECONDS = 2 * ONE_YEAR_IN_SECONDS;
  const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days
  
  const START_TIME = now; // Start now
  const CLIFF_PERIOD = 0; // No cliff - linear vesting from day one
  const VESTING_DURATION = TWO_YEARS_IN_SECONDS; // 2 year total linear vesting
  const SLICE_PERIOD = ONE_MONTH_IN_SECONDS; // Monthly releases
  const REVOCABLE = false; // Non-revocable for stability
  
  // Connect to contracts
  console.log(`\nConnecting to contracts:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- Vesting: ${VESTING_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Ecosystem wallet - in production, this should be a secure multi-sig wallet
  const ECOSYSTEM_ADDRESS = process.env.ECOSYSTEM_ADDRESS || wallet.address;
  
  console.log(`\nEcosystem Development allocation details:`);
  console.log(`- Ecosystem address: ${ECOSYSTEM_ADDRESS}`);
  console.log(`- Total allocation: ${Number(TOTAL_ECOSYSTEM_AMOUNT) / 10**6} RESKA (10% of supply)`);
  console.log(`- Vesting type: Linear over 2 years (no cliff), monthly releases`);
  
  // Check vesting contract balance
  const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
  console.log(`\nVesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  
  // Ensure vesting contract has sufficient tokens
  if (vestingBalance < TOTAL_ECOSYSTEM_AMOUNT) {
    console.log(`\nVesting contract needs more tokens for the ecosystem allocation.`);
    console.log(`Required: ${Number(TOTAL_ECOSYSTEM_AMOUNT) / 10**6} RESKA`);
    console.log(`Available: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Deficit: ${Number(TOTAL_ECOSYSTEM_AMOUNT - vestingBalance) / 10**6} RESKA`);
    
    // Check if wallet has enough tokens to cover the deficit
    const walletBalance = await token.balanceOf(wallet.address);
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    
    if (walletBalance >= (TOTAL_ECOSYSTEM_AMOUNT - vestingBalance)) {
      console.log(`\nTransferring additional tokens to vesting contract...`);
      const transferAmount = TOTAL_ECOSYSTEM_AMOUNT - vestingBalance;
      
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
  
  // Create ecosystem vesting schedule
  console.log(`\nCreating 2-year linear vesting schedule for Ecosystem Development...`);
  
  try {
    const tx = await vesting.createVestingSchedule(
      ECOSYSTEM_ADDRESS,
      START_TIME,
      CLIFF_PERIOD,
      VESTING_DURATION,
      SLICE_PERIOD,
      REVOCABLE,
      TOTAL_ECOSYSTEM_AMOUNT,
      { gasLimit: 5000000 }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Ecosystem vesting schedule created successfully`);
    
    // Get the vesting schedule ID for future reference
    const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(ECOSYSTEM_ADDRESS, 0);
    console.log(`Vesting schedule ID: ${scheduleId}`);
    
    // Calculate release dates
    const oneYear = new Date((START_TIME + ONE_YEAR_IN_SECONDS) * 1000);
    const twoYears = new Date((START_TIME + TWO_YEARS_IN_SECONDS) * 1000);
    const monthlyRelease = TOTAL_ECOSYSTEM_AMOUNT / BigInt(24); // 24 months
    
    // Summary
    console.log(`\n=== ECOSYSTEM DEVELOPMENT ALLOCATION COMPLETE ===`);
    console.log(`- Total amount: ${Number(TOTAL_ECOSYSTEM_AMOUNT) / 10**6} RESKA`);
    console.log(`- Linear monthly releases: ~${Number(monthlyRelease) / 10**6} RESKA per month`);
    console.log(`- After 1 year (${oneYear.toISOString()}): 50% released (${Number(TOTAL_ECOSYSTEM_AMOUNT / BigInt(2)) / 10**6} RESKA)`);
    console.log(`- Full vesting date (${twoYears.toISOString()}): 100% released`);
    
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
      
      // Update with ecosystem vesting details
      const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
      
      if (!deployments[networkType].vesting) {
        deployments[networkType].vesting = {};
      }
      
      deployments[networkType].vesting.ecosystem = {
        address: ECOSYSTEM_ADDRESS,
        amount: TOTAL_ECOSYSTEM_AMOUNT.toString(),
        startDate: new Date(START_TIME * 1000).toISOString(),
        halfwayDate: oneYear.toISOString(),
        endDate: twoYears.toISOString(),
        monthlyRelease: monthlyRelease.toString(),
        scheduleId: scheduleId
      };
      
      fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
      console.log(`Ecosystem vesting details saved to deployments.json`);
    } catch (error) {
      console.log(`Note: Could not save to deployments.json: ${error.message}`);
    }
    
    console.log(`\nNOTE: In production, the ecosystem address should be a secure multi-sig wallet`);
    console.log(`controlled by the development team for ecosystem growth initiatives.`);
    
  } catch (error) {
    console.error(`❌ Error creating ecosystem vesting schedule: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

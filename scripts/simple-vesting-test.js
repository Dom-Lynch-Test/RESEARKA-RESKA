// Simplified vesting test for zkSync Era Sepolia - avoiding ethers utility functions
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== SIMPLE RESKA VESTING TEST (SEPOLIA) ===");
  
  // Initialize provider and wallet
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Contract addresses
  const TOKEN_ADDRESS = "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Get contract factories
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  // Connect to contracts
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Basic checks
  try {
    console.log("Checking token details...");
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    console.log(`Token: ${name} (${symbol}), Decimals: ${decimals}`);
    
    // No formatUnits, just manual calculation
    const balance = await token.balanceOf(wallet.address);
    console.log(`Our Balance: ${Number(balance) / 10**6} ${symbol}`);
    
    // Check vesting contract
    console.log("\nChecking vesting contract integration...");
    const vestingToken = await vesting.getToken();
    console.log(`Vesting contract token: ${vestingToken}`);
    
    // Check allowance
    const allowance = await token.allowance(wallet.address, VESTING_ADDRESS);
    console.log(`Current allowance: ${Number(allowance) / 10**6} RESKA`);
    
    // Increase allowance if needed
    if (Number(allowance) < 100 * 10**6) { // Less than 100 RESKA
      console.log("Setting allowance to 100 RESKA...");
      // 100 tokens with 6 decimals = 100000000
      const approveTx = await token.approve(VESTING_ADDRESS, BigInt(100 * 10**6));
      await approveTx.wait();
      console.log("Allowance set");
      
      // Verify new allowance
      const newAllowance = await token.allowance(wallet.address, VESTING_ADDRESS);
      console.log(`New allowance: ${Number(newAllowance) / 10**6} RESKA`);
    }
    
    // Try creating a vesting schedule
    console.log("\nCreating a test vesting schedule...");
    const now = Math.floor(Date.now() / 1000);
    
    // Create minimal schedule with tiny values
    const beneficiary = wallet.address;
    const startTime = now;
    const cliff = 60; // 1 minute cliff
    const duration = 300; // 5 minute duration
    const slicePeriodSeconds = 60; // 1 minute slice period
    const revocable = true;
    const amount = BigInt(10 * 10**6); // 10 RESKA tokens
    
    console.log("Parameters:");
    console.log(`- Beneficiary: ${beneficiary}`);
    console.log(`- Start Time: ${startTime} (${new Date(startTime * 1000).toISOString()})`);
    console.log(`- Amount: 10 RESKA`);
    
    // Specific gas parameters for zkSync
    const createTx = await vesting.createVestingSchedule(
      beneficiary,
      startTime,
      cliff,
      duration,
      slicePeriodSeconds,
      revocable,
      amount,
      { gasLimit: 10000000 } // Set a high gas limit
    );
    
    console.log(`Transaction submitted: ${createTx.hash}`);
    await createTx.wait();
    console.log("✅ Vesting schedule created successfully!");
    
    // Verify it was created
    const scheduleCount = await vesting.getVestingSchedulesCount();
    console.log(`Total vesting schedules: ${scheduleCount}`);
    
    if (scheduleCount > 0) {
      console.log(`\nRetrieving vesting schedule info...`);
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary, 0);
      console.log(`Schedule ID: ${scheduleId}`);
      
      try {
        const schedule = await vesting.getVestingSchedule(scheduleId);
        console.log("Schedule details:");
        console.log(`- Beneficiary: ${schedule.beneficiary}`);
        console.log(`- Cliff: ${schedule.cliff} seconds`);
        console.log(`- Duration: ${schedule.duration} seconds`);
        console.log(`- Amount: ${Number(schedule.amountTotal) / 10**6} RESKA`);
        
        // Check releasable amount
        const releasable = await vesting.computeReleasableAmount(scheduleId);
        console.log(`- Currently releasable: ${Number(releasable) / 10**6} RESKA`);
        
        console.log("\n✅ Test Successful! Continue with your comprehensive test plan");
        console.log("Next steps:");
        console.log("1. Wait ~1 minute for cliff to pass");
        console.log("2. Check releasable amount again");
        console.log("3. Release tokens to validate vesting mechanics");
      } catch (error) {
        console.log(`Error retrieving schedule: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    
    // Try to provide more context
    if (error.message.includes("revert")) {
      console.log("\nTransaction reverted. Possible reasons:");
      console.log("1. Insufficient funds or token allowance");
      console.log("2. Invalid parameters (e.g., duration < cliff)");
      console.log("3. Contract restrictions (e.g., paused, only owner)");
      console.log("4. zkSync-specific gas or execution limitations");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

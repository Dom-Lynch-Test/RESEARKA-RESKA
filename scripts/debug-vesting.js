// Simplified script to debug vesting contract on zkSync Era Sepolia
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEBUGGING RESKA VESTING CONTRACT ===");
  
  // Initialize provider and wallet
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Vesting contract address from previous deployment
  const VESTING_ADDRESS = "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  // Token address
  const TOKEN_ADDRESS = "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  
  // Load contract ABIs
  const tokenABI = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json").abi;
  const vestingABI = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json").abi;
  
  // Connect to contracts
  const token = new ethers.Contract(TOKEN_ADDRESS, tokenABI, wallet);
  const vesting = new ethers.Contract(VESTING_ADDRESS, vestingABI, wallet);
  
  console.log("Checking token details...");
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    const balance = await token.balanceOf(wallet.address);
    
    console.log(`Token: ${name} (${symbol})`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.utils.formatUnits(totalSupply, decimals)} ${symbol}`);
    console.log(`Our Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
  } catch (error) {
    console.error(`Error checking token: ${error.message}`);
  }
  
  console.log("\nChecking vesting contract...");
  try {
    // Get token address from vesting contract
    const tokenAddress = await vesting.getToken();
    console.log(`Vesting contract token: ${tokenAddress}`);
    
    // Check if it matches our token
    if (tokenAddress.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
      console.log("✅ Vesting contract is correctly linked to our RESKA token");
    } else {
      console.log("❌ Vesting contract points to different token!");
    }
    
    // Check vesting schedules count
    try {
      const vestingSchedulesCount = await vesting.getVestingSchedulesCount();
      console.log(`Total vesting schedules: ${vestingSchedulesCount}`);
    } catch (error) {
      console.log(`Error getting schedules count: ${error.message}`);
    }
    
    // Check if our wallet is the owner
    try {
      const owner = await vesting.owner();
      console.log(`Vesting contract owner: ${owner}`);
      if (owner.toLowerCase() === wallet.address.toLowerCase()) {
        console.log("✅ We are the owner of the vesting contract");
      } else {
        console.log("❌ We are NOT the owner of the vesting contract!");
      }
    } catch (error) {
      console.log(`Error checking owner: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error checking vesting contract: ${error.message}`);
  }
  
  console.log("\nChecking token allowance...");
  try {
    const allowance = await token.allowance(wallet.address, VESTING_ADDRESS);
    console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, 6)} RESKA`);
    
    if (allowance.toString() === "0") {
      console.log("No allowance set - approving 1000 RESKA to vesting contract...");
      const amount = ethers.utils.parseUnits("1000", 6);
      const tx = await token.approve(VESTING_ADDRESS, amount);
      await tx.wait();
      console.log(`✅ Approved ${amount / 10**6} RESKA to vesting contract`);
      
      // Verify the new allowance
      const newAllowance = await token.allowance(wallet.address, VESTING_ADDRESS);
      console.log(`New allowance: ${ethers.utils.formatUnits(newAllowance, 6)} RESKA`);
    }
  } catch (error) {
    console.error(`Error checking/setting allowance: ${error.message}`);
  }
  
  console.log("\nAttempting to create minimal vesting schedule...");
  try {
    // Get current time
    const now = Math.floor(Date.now() / 1000);
    
    // Create minimal vesting schedule with very small amount
    const beneficiary = wallet.address;
    const startTime = now;
    const cliff = 60; // 1 minute
    const duration = 300; // 5 minutes
    const slicePeriodSeconds = 60; // 1 minute
    const revocable = true;
    const amount = ethers.utils.parseUnits("10", 6); // Just 10 tokens
    
    console.log("Creating minimal vesting schedule with these parameters:");
    console.log(`- Beneficiary: ${beneficiary}`);
    console.log(`- Start Time: ${new Date(startTime * 1000).toISOString()}`);
    console.log(`- Cliff: ${cliff} seconds`);
    console.log(`- Duration: ${duration} seconds`);
    console.log(`- Slice Period: ${slicePeriodSeconds} seconds`);
    console.log(`- Revocable: ${revocable}`);
    console.log(`- Amount: ${ethers.utils.formatUnits(amount, 6)} RESKA`);
    
    // Estimate gas for the transaction to see if it would revert
    try {
      const estimatedGas = await vesting.estimateGas.createVestingSchedule(
        beneficiary,
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revocable,
        amount
      );
      console.log(`Estimated gas: ${estimatedGas.toString()}`);
      console.log("✅ Gas estimation succeeded - transaction should work");
    } catch (error) {
      console.log(`❌ Gas estimation failed: ${error.message}`);
      console.log("Attempting to debug why the transaction would fail...");
      
      // Try to debug by calling the contract's view functions
      try {
        // Check if we're already a beneficiary
        const scheduleIds = await vesting.getVestingSchedulesCountByBeneficiary(beneficiary);
        console.log(`This beneficiary already has ${scheduleIds} schedules`);
      } catch (error) {
        console.log(`Error checking beneficiary schedules: ${error.message}`);
      }
    }
    
    // Try to execute the transaction even if gas estimation failed
    console.log("\nAttempting to create vesting schedule anyway...");
    const tx = await vesting.createVestingSchedule(
      beneficiary,
      startTime,
      cliff,
      duration,
      slicePeriodSeconds,
      revocable,
      amount,
      { gasLimit: 5000000 } // Explicitly set high gas limit
    );
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Vesting schedule created successfully!");
    
    // Verify the schedule was created
    const scheduleIds = await vesting.getVestingSchedulesCountByBeneficiary(beneficiary);
    console.log(`This beneficiary now has ${scheduleIds} schedules`);
    
  } catch (error) {
    console.error(`❌ Error creating vesting schedule: ${error.message}`);
    
    // Try to parse the error to understand what's happening
    if (error.message.includes("reverted")) {
      console.log("\nPossible reasons for revert:");
      console.log("1. Insufficient token balance or allowance");
      console.log("2. Invalid parameters (e.g., duration < cliff)");
      console.log("3. Contract state prevents creation (e.g., paused)");
      console.log("4. Caller lacks permission to create schedules");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

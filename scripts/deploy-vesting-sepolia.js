// Deploy & test vesting contract on zkSync Era Sepolia
const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { ethers } = require("hardhat");
require("dotenv").config();

// Helper to convert to token units (6 decimals)
function toTokenUnits(amount) {
  return BigInt(amount) * BigInt(10**6);
}

async function main() {
  console.log("=== RESKA VESTING DEPLOYMENT & TESTING (SEPOLIA) ===");
  
  // Initialize zkSync provider
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  
  // Initialize wallet
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deploying from address: ${wallet.address}`);
  
  // Balance check
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet balance: ${Number(balance) / 1e18} ETH`);
  
  // Read the token address
  const RESKA_TOKEN_ADDRESS = "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  console.log(`Using RESKA token at: ${RESKA_TOKEN_ADDRESS}`);
  
  // Initialize the deployer
  const deployer = new Deployer(hre, wallet);
  
  // Load contract artifacts
  console.log("Loading contract artifacts...");
  const vestingArtifact = await deployer.loadArtifact("ReskaTokenVesting");
  const tokenArtifact = await deployer.loadArtifact("ReskaToken");
  
  // Access token contract
  const token = new ethers.Contract(
    RESKA_TOKEN_ADDRESS,
    tokenArtifact.abi,
    wallet
  );
  
  // Check token details
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    
    console.log(`\nToken details:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Decimals: ${decimals}`);
    console.log(`- Total Supply: ${Number(totalSupply) / 10**6} ${symbol}`);
    
    // Check our balance
    const balance = await token.balanceOf(wallet.address);
    console.log(`- Our balance: ${Number(balance) / 10**6} ${symbol}`);
    
  } catch (error) {
    console.log(`❌ Error getting token details: ${error.message}`);
    return;
  }
  
  // Deploy vesting contract
  console.log("\nDeploying Vesting Contract...");
  const vesting = await deployer.deploy(vestingArtifact, [RESKA_TOKEN_ADDRESS]);
  const vestingAddress = await vesting.getAddress();
  
  console.log(`✅ Vesting Contract deployed to: ${vestingAddress}`);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentData = {
    "ReskaToken": RESKA_TOKEN_ADDRESS,
    "ReskaVesting": vestingAddress,
    "network": "zkSyncTestnet",
    "timestamp": new Date().toISOString()
  };
  
  fs.writeFileSync(
    './deployments/zksync-vesting-sepolia.json',
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment saved to deployments/zksync-vesting-sepolia.json");
  
  // Create an accelerated vesting schedule for testing
  console.log("\n=== CREATING TEST VESTING SCHEDULE ===");
  try {
    // Get current time
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Create a vesting schedule that starts now and vests over 5 minutes
    const startTime = currentTime;
    const cliff = 60; // 1 minute cliff
    const duration = 300; // 5 minute total vesting duration
    const slicePeriodSeconds = 60; // Release tokens every minute
    const revocable = true;
    const amount = toTokenUnits(1000000); // 1 million tokens (with 6 decimals)
    
    // Create a beneficiary address (for testing, we'll use our own)
    const beneficiary = wallet.address;
    
    // Approve vesting contract to transfer tokens
    console.log("Approving tokens for vesting contract...");
    const approveTx = await token.approve(vestingAddress, amount);
    await approveTx.wait();
    console.log("✅ Approval successful");
    
    // Create vesting schedule
    console.log("Creating vesting schedule...");
    const createTx = await vesting.createVestingSchedule(
      beneficiary,
      startTime,
      cliff,
      duration,
      slicePeriodSeconds,
      revocable,
      amount
    );
    await createTx.wait();
    
    console.log("✅ Vesting schedule created successfully!");
    console.log(`Schedule details:`);
    console.log(`- Beneficiary: ${beneficiary}`);
    console.log(`- Start time: ${new Date(startTime * 1000).toISOString()}`);
    console.log(`- Cliff: ${cliff} seconds (${cliff/60} minutes)`);
    console.log(`- Duration: ${duration} seconds (${duration/60} minutes)`);
    console.log(`- Amount: ${Number(amount) / 10**6} RESKA`);
    
    // Get the vesting schedule ID
    const vestingScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
      beneficiary,
      0
    );
    console.log(`- Vesting Schedule ID: ${vestingScheduleId}`);
    
    // Check how much is vested initially (should be 0)
    const vestedAmount = await vesting.computeReleasableAmount(vestingScheduleId);
    console.log(`- Initially vested amount: ${Number(vestedAmount) / 10**6} RESKA`);
    
    console.log("\n=== VESTING TESTING INSTRUCTIONS ===");
    console.log("1. Wait for the cliff period (1 minute)");
    console.log("2. Call the following to release tokens after cliff:");
    console.log(`   npx hardhat run scripts/release-vested-tokens.js --network zkSyncTestnet`);
    console.log("3. For full vesting test, wait 5 minutes from deployment");
    
    // Create a helper script to release tokens
    const releaseScript = `// Helper script to release vested tokens
const { Wallet, Provider } = require("zksync-ethers");
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== RELEASING VESTED RESKA TOKENS ===");
  
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  const VESTING_ADDRESS = "${vestingAddress}";
  const VESTING_SCHEDULE_ID = "${vestingScheduleId}";
  
  // Load contract artifacts
  const vestingAbi = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json").abi;
  const tokenAbi = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json").abi;
  
  // Connect to contracts
  const vesting = new ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  const token = new ethers.Contract("${RESKA_TOKEN_ADDRESS}", tokenAbi, wallet);
  
  // Check vesting status
  try {
    // Get vesting schedule
    const schedule = await vesting.getVestingSchedule(VESTING_SCHEDULE_ID);
    
    // Current time
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = Number(schedule.start);
    const elapsedTime = currentTime - startTime;
    
    console.log(\`Schedule start time: \${new Date(startTime * 1000).toISOString()}\`);
    console.log(\`Current time: \${new Date(currentTime * 1000).toISOString()}\`);
    console.log(\`Elapsed time: \${elapsedTime} seconds (\${elapsedTime/60} minutes)\`);
    
    // Check releasable amount
    const releasableAmount = await vesting.computeReleasableAmount(VESTING_SCHEDULE_ID);
    console.log(\`Releasable amount: \${Number(releasableAmount) / 10**6} RESKA\`);
    
    if (releasableAmount > 0) {
      console.log("Releasing vested tokens...");
      const releaseTx = await vesting.release(VESTING_SCHEDULE_ID, releasableAmount);
      await releaseTx.wait();
      
      // Check new balance
      const balance = await token.balanceOf(wallet.address);
      console.log(\`✅ Release successful! New balance: \${Number(balance) / 10**6} RESKA\`);
    } else {
      console.log("No tokens are available for release yet.");
      console.log(\`Cliff period: \${schedule.cliff} seconds\`);
      const timeUntilCliff = (startTime + Number(schedule.cliff)) - currentTime;
      if (timeUntilCliff > 0) {
        console.log(\`Time until cliff: \${timeUntilCliff} seconds (\${timeUntilCliff/60} minutes)\`);
      }
    }
  } catch (error) {
    console.error(\`Error releasing tokens: \${error.message}\`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });`;
    
    fs.writeFileSync(
      './scripts/release-vested-tokens.js',
      releaseScript
    );
    console.log("✅ Created release-vested-tokens.js helper script");
    
  } catch (error) {
    console.error(`❌ Error creating vesting schedule: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

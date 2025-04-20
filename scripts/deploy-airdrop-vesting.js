// Airdrop vesting schedule deployment script for RESKA token
// Implements a 1-year cliff (all tokens released after 1 year)
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA AIRDROP VESTING SCHEDULE ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Airdrop allocation parameters
  // Total supply: 1,000,000,000 RESKA
  // Airdrop allocation: 40% = 400,000,000 RESKA
  const TOTAL_AIRDROP_AMOUNT = BigInt(400_000_000 * 10**6); // 400M RESKA with 6 decimals
  
  // Vesting schedule parameters
  const now = Math.floor(Date.now() / 1000);
  const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 31,536,000 seconds
  
  const START_TIME = now; // Start now
  const CLIFF_PERIOD = ONE_YEAR_IN_SECONDS; // 1 year cliff
  const VESTING_DURATION = 1; // Minimal duration - immediately available after cliff
  const SLICE_PERIOD = 1; // Minimal slice - all tokens released at once after cliff
  const REVOCABLE = false; // Non-revocable for airdrop recipients
  
  // Connect to contracts
  console.log(`\nConnecting to contracts:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- Vesting: ${VESTING_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Example airdrop recipients - replace with your actual list
  const recipients = [
    { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", amount: BigInt(1000 * 10**6) }, // 1000 RESKA
    { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", amount: BigInt(2000 * 10**6) }, // 2000 RESKA
    { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", amount: BigInt(3000 * 10**6) }  // 3000 RESKA
    // Add more recipients as needed
  ];
  
  const totalForExamples = recipients.reduce((acc, recipient) => acc + recipient.amount, BigInt(0));
  
  console.log(`\nAirdrop allocation details:`);
  console.log(`- Total allocation: ${Number(TOTAL_AIRDROP_AMOUNT) / 10**6} RESKA (40% of supply)`);
  console.log(`- Vesting type: 1-year cliff (all tokens at once after 1 year)`);
  console.log(`- Example recipients: ${recipients.length} addresses (total ${Number(totalForExamples) / 10**6} RESKA)`);
  
  // Check vesting contract balance
  const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
  console.log(`\nVesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  
  // Ensure vesting contract has sufficient tokens
  if (vestingBalance < totalForExamples) {
    console.log(`\nVesting contract needs more tokens for these airdrop allocations.`);
    console.log(`Required: ${Number(totalForExamples) / 10**6} RESKA`);
    console.log(`Available: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Deficit: ${Number(totalForExamples - vestingBalance) / 10**6} RESKA`);
    
    // Check if wallet has enough tokens to cover the deficit
    const walletBalance = await token.balanceOf(wallet.address);
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    
    if (walletBalance >= (totalForExamples - vestingBalance)) {
      console.log(`\nTransferring additional tokens to vesting contract...`);
      const transferAmount = totalForExamples - vestingBalance;
      
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
      console.error(`Please fund your wallet with more RESKA tokens or adjust the airdrop amounts.`);
      return;
    }
  }
  
  // Create vesting schedules for each recipient
  console.log(`\nCreating 1-year cliff vesting schedules for airdrop recipients...`);
  
  // Calculate release date for display
  const releaseDate = new Date((START_TIME + CLIFF_PERIOD) * 1000);
  console.log(`Release date: ${releaseDate.toISOString()}`);
  
  // Store successful vesting schedules
  const successfulVestings = [];
  
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    
    try {
      console.log(`\nCreating vesting schedule for ${recipient.address}:`);
      console.log(`- Amount: ${Number(recipient.amount) / 10**6} RESKA`);
      
      const tx = await vesting.createVestingSchedule(
        recipient.address,
        START_TIME,
        CLIFF_PERIOD,
        VESTING_DURATION,
        SLICE_PERIOD,
        REVOCABLE,
        recipient.amount,
        { gasLimit: 5000000 }
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Vesting schedule created successfully`);
      
      // Get the vesting schedule ID for future reference
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(recipient.address, 0);
      console.log(`Vesting schedule ID: ${scheduleId}`);
      
      successfulVestings.push({
        address: recipient.address,
        amount: recipient.amount.toString(),
        scheduleId: scheduleId
      });
      
    } catch (error) {
      console.error(`❌ Error creating vesting schedule for ${recipient.address}: ${error.message}`);
    }
  }
  
  // Summary
  console.log(`\n=== AIRDROP ALLOCATION SUMMARY ===`);
  console.log(`- Total recipients processed: ${successfulVestings.length} / ${recipients.length}`);
  console.log(`- Release date: ${releaseDate.toISOString()}`);
  console.log(`- Total amount allocated: ${Number(totalForExamples) / 10**6} RESKA`);
  
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
    
    // Update with airdrop vesting details
    const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
    
    if (!deployments[networkType].vesting) {
      deployments[networkType].vesting = {};
    }
    
    deployments[networkType].vesting.airdrop = {
      releaseDate: releaseDate.toISOString(),
      recipients: successfulVestings
    };
    
    fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
    console.log(`Airdrop vesting details saved to deployments.json`);
  } catch (error) {
    console.log(`Note: Could not save to deployments.json: ${error.message}`);
  }
  
  console.log(`\nNOTE: This script contains example recipients for demonstration.`);
  console.log(`For actual airdrop deployment, replace the recipients array with your full list.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

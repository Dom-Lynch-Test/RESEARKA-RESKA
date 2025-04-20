// Advisor vesting schedule deployment script for RESKA token
// Implements a 1-year cliff, then quarterly releases over 1 year
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA ADVISOR VESTING SCHEDULE ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = process.env.VESTING_ADDRESS || "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Advisor allocation parameters
  // Total supply: 1,000,000,000 RESKA
  // Advisor allocation: 5% = 50,000,000 RESKA
  const TOTAL_ADVISOR_AMOUNT = BigInt(50_000_000 * 10**6); // 50M RESKA with 6 decimals
  
  // Vesting schedule parameters
  const now = Math.floor(Date.now() / 1000);
  const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60; // 31,536,000 seconds
  const THREE_MONTHS_IN_SECONDS = ONE_YEAR_IN_SECONDS / 4; // Quarter of a year
  
  const START_TIME = now; // Start now
  const CLIFF_PERIOD = ONE_YEAR_IN_SECONDS; // 1 year cliff
  const VESTING_DURATION = ONE_YEAR_IN_SECONDS; // 1 year release period after cliff
  const SLICE_PERIOD = THREE_MONTHS_IN_SECONDS; // Quarterly releases after cliff
  const REVOCABLE = false; // Non-revocable for advisor allocations
  
  // Connect to contracts
  console.log(`\nConnecting to contracts:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  console.log(`- Vesting: ${VESTING_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const { abi: vestingAbi } = require("../artifacts-zk/contracts/ReskaTokenVesting.sol/ReskaTokenVesting.json");
  
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(VESTING_ADDRESS, vestingAbi, wallet);
  
  // Example advisor recipients
  const advisors = [
    { 
      address: process.env.ADVISOR1_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
      amount: BigInt(10_000_000 * 10**6) // 10M RESKA
    },
    { 
      address: process.env.ADVISOR2_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", 
      amount: BigInt(10_000_000 * 10**6) // 10M RESKA
    }
    // Add more advisors as needed
  ];
  
  const totalForAdvisors = advisors.reduce((acc, advisor) => acc + advisor.amount, BigInt(0));
  
  console.log(`\nAdvisor allocation details:`);
  console.log(`- Total allocation: ${Number(TOTAL_ADVISOR_AMOUNT) / 10**6} RESKA (5% of supply)`);
  console.log(`- Vesting type: 1-year cliff, then quarterly releases over 1 year`);
  console.log(`- Example advisors: ${advisors.length} addresses (total ${Number(totalForAdvisors) / 10**6} RESKA)`);
  
  // Check vesting contract balance
  const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
  console.log(`\nVesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  
  // Ensure vesting contract has sufficient tokens
  if (vestingBalance < totalForAdvisors) {
    console.log(`\nVesting contract needs more tokens for advisor allocations.`);
    console.log(`Required: ${Number(totalForAdvisors) / 10**6} RESKA`);
    console.log(`Available: ${Number(vestingBalance) / 10**6} RESKA`);
    console.log(`Deficit: ${Number(totalForAdvisors - vestingBalance) / 10**6} RESKA`);
    
    // Check if wallet has enough tokens to cover the deficit
    const walletBalance = await token.balanceOf(wallet.address);
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    
    if (walletBalance >= (totalForAdvisors - vestingBalance)) {
      console.log(`\nTransferring additional tokens to vesting contract...`);
      const transferAmount = totalForAdvisors - vestingBalance;
      
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
      console.error(`Please fund your wallet with more RESKA tokens or adjust the advisor amounts.`);
      return;
    }
  }
  
  // Create vesting schedules for each advisor
  console.log(`\nCreating vesting schedules for advisors...`);
  
  // Calculate release dates for display
  const cliffDate = new Date((START_TIME + CLIFF_PERIOD) * 1000);
  const firstRelease = new Date((START_TIME + CLIFF_PERIOD) * 1000);
  const secondRelease = new Date((START_TIME + CLIFF_PERIOD + THREE_MONTHS_IN_SECONDS) * 1000);
  const thirdRelease = new Date((START_TIME + CLIFF_PERIOD + 2 * THREE_MONTHS_IN_SECONDS) * 1000);
  const fourthRelease = new Date((START_TIME + CLIFF_PERIOD + 3 * THREE_MONTHS_IN_SECONDS) * 1000);
  
  console.log(`\nQuarterly release schedule after 1-year cliff:`);
  console.log(`- Cliff ends: ${cliffDate.toISOString()} (25% released)`);
  console.log(`- Second release: ${secondRelease.toISOString()} (50% total)`);
  console.log(`- Third release: ${thirdRelease.toISOString()} (75% total)`);
  console.log(`- Final release: ${fourthRelease.toISOString()} (100% total)`);
  
  // Store successful vesting schedules
  const successfulVestings = [];
  
  for (let i = 0; i < advisors.length; i++) {
    const advisor = advisors[i];
    
    try {
      console.log(`\nCreating vesting schedule for advisor ${advisor.address}:`);
      console.log(`- Amount: ${Number(advisor.amount) / 10**6} RESKA`);
      
      const tx = await vesting.createVestingSchedule(
        advisor.address,
        START_TIME,
        CLIFF_PERIOD,
        VESTING_DURATION,
        SLICE_PERIOD,
        REVOCABLE,
        advisor.amount,
        { gasLimit: 5000000 }
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Advisor vesting schedule created successfully`);
      
      // Get the vesting schedule ID for future reference
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(advisor.address, 0);
      console.log(`Vesting schedule ID: ${scheduleId}`);
      
      successfulVestings.push({
        address: advisor.address,
        amount: advisor.amount.toString(),
        scheduleId: scheduleId
      });
      
    } catch (error) {
      console.error(`❌ Error creating vesting schedule for advisor ${advisor.address}: ${error.message}`);
    }
  }
  
  // Summary
  console.log(`\n=== ADVISOR ALLOCATION SUMMARY ===`);
  console.log(`- Total advisors processed: ${successfulVestings.length} / ${advisors.length}`);
  console.log(`- Total amount allocated: ${Number(totalForAdvisors) / 10**6} RESKA`);
  
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
    
    // Update with advisor vesting details
    const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
    
    if (!deployments[networkType].vesting) {
      deployments[networkType].vesting = {};
    }
    
    deployments[networkType].vesting.advisor = {
      cliffDate: cliffDate.toISOString(),
      quarterlyReleases: [
        firstRelease.toISOString(),
        secondRelease.toISOString(),
        thirdRelease.toISOString(),
        fourthRelease.toISOString()
      ],
      advisors: successfulVestings
    };
    
    fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
    console.log(`Advisor vesting details saved to deployments.json`);
  } catch (error) {
    console.log(`Note: Could not save to deployments.json: ${error.message}`);
  }
  
  console.log(`\nNOTE: This script contains example advisors for demonstration.`);
  console.log(`For actual advisor deployment, update the advisors array with your real advisor addresses.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// Investor allocation deployment script for RESKA token
// Implements immediate allocation (no vesting) for investors
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DEPLOYING RESKA INVESTOR ALLOCATIONS ===");
  
  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  console.log(`Network: ${hre.network.name}`);
  
  // Contract addresses - update these with your actual deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  
  // Investor allocation parameters
  // Total supply: 1,000,000,000 RESKA
  // Investor allocation: 5% = 50,000,000 RESKA
  const TOTAL_INVESTOR_AMOUNT = BigInt(50_000_000 * 10**6); // 50M RESKA with 6 decimals
  
  // Connect to contracts
  console.log(`\nConnecting to token contract:`);
  console.log(`- Token: ${TOKEN_ADDRESS}`);
  
  const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
  const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
  
  // Example investor allocations - replace with your actual investor list
  const investors = [
    { 
      address: process.env.INVESTOR1_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
      amount: BigInt(10_000_000 * 10**6) // 10M RESKA
    },
    { 
      address: process.env.INVESTOR2_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", 
      amount: BigInt(10_000_000 * 10**6) // 10M RESKA
    }
    // Add more investors as needed
  ];
  
  const totalForInvestors = investors.reduce((acc, investor) => acc + investor.amount, BigInt(0));
  
  console.log(`\nInvestor allocation details:`);
  console.log(`- Total allocation: ${Number(TOTAL_INVESTOR_AMOUNT) / 10**6} RESKA (5% of supply)`);
  console.log(`- Distribution type: Immediate allocation (no vesting)`);
  console.log(`- Example investors: ${investors.length} addresses (total ${Number(totalForInvestors) / 10**6} RESKA)`);
  
  // Check wallet balance
  const walletBalance = await token.balanceOf(wallet.address);
  console.log(`\nWallet balance: ${Number(walletBalance) / 10**6} RESKA`);
  
  // Ensure wallet has sufficient tokens
  if (walletBalance < totalForInvestors) {
    console.error(`❌ Error: Insufficient tokens in wallet for investor allocations.`);
    console.error(`Required: ${Number(totalForInvestors) / 10**6} RESKA`);
    console.error(`Available: ${Number(walletBalance) / 10**6} RESKA`);
    console.error(`Please mint more tokens to your wallet or adjust the allocation amounts.`);
    return;
  }
  
  // Transfer tokens to each investor
  console.log(`\nTransferring tokens to investors...`);
  
  // Store successful transfers
  const successfulTransfers = [];
  
  for (let i = 0; i < investors.length; i++) {
    const investor = investors[i];
    
    try {
      console.log(`\nTransferring tokens to investor ${investor.address}:`);
      console.log(`- Amount: ${Number(investor.amount) / 10**6} RESKA`);
      
      const tx = await token.transfer(
        investor.address,
        investor.amount,
        { gasLimit: 5000000 }
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Transfer successful`);
      
      successfulTransfers.push({
        address: investor.address,
        amount: investor.amount.toString()
      });
      
    } catch (error) {
      console.error(`❌ Error transferring tokens to investor ${investor.address}: ${error.message}`);
    }
  }
  
  // Summary
  console.log(`\n=== INVESTOR ALLOCATION SUMMARY ===`);
  console.log(`- Total investors processed: ${successfulTransfers.length} / ${investors.length}`);
  console.log(`- Total amount allocated: ${Number(totalForInvestors) / 10**6} RESKA`);
  
  // Add to deployments.json
  try {
    const fs = require('fs');
    let deployments = {};
    
    try {
      const data = fs.readFileSync('./deployments.json', 'utf8');
      deployments = JSON.parse(data);
    } catch (error) {
      deployments = { 
        testnet: { allocations: {} },
        mainnet: { allocations: {} }
      };
    }
    
    // Update with investor allocation details
    const networkType = hre.network.name.includes('ainnet') ? 'mainnet' : 'testnet';
    
    if (!deployments[networkType].allocations) {
      deployments[networkType].allocations = {};
    }
    
    deployments[networkType].allocations.investor = {
      total: TOTAL_INVESTOR_AMOUNT.toString(),
      date: new Date().toISOString(),
      investors: successfulTransfers
    };
    
    fs.writeFileSync('./deployments.json', JSON.stringify(deployments, null, 2));
    console.log(`Investor allocation details saved to deployments.json`);
  } catch (error) {
    console.log(`Note: Could not save to deployments.json: ${error.message}`);
  }
  
  console.log(`\nNOTE: This script contains example investors for demonstration.`);
  console.log(`For actual investor allocation deployment, update the investors array with real investor addresses.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

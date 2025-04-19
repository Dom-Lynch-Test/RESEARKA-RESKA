// Script to fund the vesting contract with RESKA tokens
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== FUNDING VESTING CONTRACT WITH RESKA TOKENS ===");
  
  // Initialize provider and wallet
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Contract addresses
  const TOKEN_ADDRESS = "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  // Amount to fund (calculate based on your vesting needs - starting with 1M tokens)
  const FUNDING_AMOUNT = BigInt(1_000_000 * 10**6); // 1M RESKA with 6 decimals
  
  try {
    console.log("Loading contracts...");
    const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
    const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
    
    // Check balances before transfer
    const walletBalance = await token.balanceOf(wallet.address);
    const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
    
    console.log(`Wallet balance: ${Number(walletBalance) / 10**6} RESKA`);
    console.log(`Vesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
    
    if (walletBalance < FUNDING_AMOUNT) {
      console.error(`Error: Wallet doesn't have enough tokens to fund vesting (${Number(FUNDING_AMOUNT) / 10**6} RESKA needed)`);
      process.exit(1);
    }
    
    // Transfer tokens to vesting contract
    console.log(`Transferring ${Number(FUNDING_AMOUNT) / 10**6} RESKA to the vesting contract...`);
    const tx = await token.transfer(VESTING_ADDRESS, FUNDING_AMOUNT);
    console.log(`Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the new balance
    const newVestingBalance = await token.balanceOf(VESTING_ADDRESS);
    console.log(`New vesting contract balance: ${Number(newVestingBalance) / 10**6} RESKA`);
    
    console.log("=== VESTING CONTRACT SUCCESSFULLY FUNDED ===");
    console.log("You can now create vesting schedules without the InsufficientContractBalance error");
    console.log("Next steps: Run the simple-vesting-test.js script to create a test vesting schedule");
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

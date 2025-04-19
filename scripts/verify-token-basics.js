// Basic verification script for RESKA token on zkSync Era Sepolia
// Compatible with all Node.js versions
const { Wallet, Provider } = require("zksync-ethers");
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== RESKA TOKEN BASIC VERIFICATION ===");
  
  // Initialize provider and wallet
  const provider = new Provider(process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev");
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Contract addresses
  const TOKEN_ADDRESS = "0xcc503D0778f18fa52dBA1d7D268C012C862BCCA2";
  const VESTING_ADDRESS = "0xc78D8FA758d2c1827A1A17e4Fb02a22d7bA406fc";
  
  try {
    console.log("\n1. LOADING TOKEN CONTRACT");
    const { abi: tokenAbi } = require("../artifacts-zk/contracts/ReskaToken.sol/ReskaToken.json");
    const token = new hre.ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);
    
    // Basic token information
    console.log("\n2. TOKEN DETAILS");
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    
    // Supply information
    const totalSupply = await token.totalSupply();
    const balance = await token.balanceOf(wallet.address);
    console.log(`Total Supply: ${totalSupply.toString()}`);
    console.log(`Wallet Balance: ${balance.toString()}`);
    
    // Check roles
    console.log("\n3. ROLE VERIFICATION");
    const MINTER_ROLE = await token.MINTER_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    
    const hasMinterRole = await token.hasRole(MINTER_ROLE, wallet.address);
    const hasPauserRole = await token.hasRole(PAUSER_ROLE, wallet.address);
    const hasAdminRole = await token.hasRole(DEFAULT_ADMIN_ROLE, wallet.address);
    
    console.log(`Has MINTER_ROLE: ${hasMinterRole}`);
    console.log(`Has PAUSER_ROLE: ${hasPauserRole}`);
    console.log(`Has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
    
    // Check vesting contract
    console.log("\n4. VESTING CONTRACT STATUS");
    const vestingBalance = await token.balanceOf(VESTING_ADDRESS);
    console.log(`Vesting Contract Balance: ${vestingBalance.toString()}`);
    
    // Check token transferability 
    console.log("\n5. TOKEN TRANSFERABILITY");
    const isPaused = await token.paused();
    console.log(`Token is paused: ${isPaused}`);
    
    // Summary
    console.log("\n=== RESKA TOKEN VERIFICATION SUMMARY ===");
    console.log(`Token Name: ${name} (${symbol})`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${totalSupply.toString()}`);
    console.log(`Admin Controls: ${hasAdminRole ? "✅" : "❌"}`);
    console.log(`Transferable: ${!isPaused ? "✅" : "❌"}`);
    console.log(`Vesting Contract Funded: ${vestingBalance.toString() !== "0" ? "✅" : "❌"}`);
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// Script to verify RESKA token on zkSync Era Sepolia
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== RESKA TOKEN VERIFICATION ON ZKSYNC ERA SEPOLIA ===");
  
  // Contract addresses from deployment
  const tokenAddresses = [
    "0xa87C19183570ac477ee04c899D7b2f6147F567EF",
    "0x7592d245b0fB5d3F60451397E87a808eA5CE671e"
  ];
  
  // Get wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  console.log(`Connected to wallet: ${wallet.address}`);
  
  // Load the token ABI - simplified ABI for basic ERC20 functions
  const tokenABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ];
  
  // Check both token addresses
  for (const address of tokenAddresses) {
    console.log(`\nChecking RESKA token at address: ${address}`);
    try {
      const token = new ethers.Contract(address, tokenABI, wallet);
      
      // Try to get token info
      try {
        const name = await token.name();
        console.log(`✅ Token name: ${name}`);
      } catch (error) {
        console.log(`❌ Could not retrieve token name: ${error.message}`);
      }
      
      try {
        const symbol = await token.symbol();
        console.log(`✅ Token symbol: ${symbol}`);
      } catch (error) {
        console.log(`❌ Could not retrieve token symbol: ${error.message}`);
      }
      
      try {
        const decimals = await token.decimals();
        console.log(`✅ Token decimals: ${decimals}`);
      } catch (error) {
        console.log(`❌ Could not retrieve token decimals: ${error.message}`);
      }
      
      try {
        const totalSupply = await token.totalSupply();
        console.log(`✅ Total supply: ${ethers.utils.formatUnits(totalSupply, 6)} RESKA`);
      } catch (error) {
        console.log(`❌ Could not retrieve total supply: ${error.message}`);
      }
      
      try {
        const balance = await token.balanceOf(wallet.address);
        console.log(`✅ Your balance: ${ethers.utils.formatUnits(balance, 6)} RESKA`);
      } catch (error) {
        console.log(`❌ Could not retrieve wallet balance: ${error.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Error checking token at ${address}: ${error.message}`);
    }
  }
  
  console.log("\n=== VERIFICATION COMPLETE ===");
  console.log("To add your token to MetaMask:");
  console.log("1. Open MetaMask on zkSync Era Sepolia network");
  console.log("2. Click 'Import token'");
  console.log("3. Enter the contract address (use the working one from above)");
  console.log("4. MetaMask should auto-detect the token details");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

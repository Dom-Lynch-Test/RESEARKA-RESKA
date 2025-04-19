// Script to check wallet balance on zkSync
const { Wallet, Provider } = require("zksync-web3");
const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  // Initialize provider based on the network
  const provider = new Provider(hre.network.config.url);
  
  // Get wallet from private key in .env
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(`\n=== WALLET BALANCE CHECK ===`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Wallet address: ${wallet.address}`);
  
  // Check ETH balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`ETH balance: ${ethers.formatEther(ethBalance)} ETH`);
  
  // If zero balance, provide instructions for getting testnet ETH
  if (ethBalance.eq(0)) {
    console.log(`\n❌ Your wallet has no ETH on ${hre.network.name}.`);
    
    if (hre.network.name.includes("zkSync")) {
      console.log(`\nTo get zkSync Testnet ETH:`);
      console.log(`1. Use the official zkSync Testnet faucet: https://portal.zksync.io/faucet`);
      console.log(`2. First bridge some Goerli ETH to zkSync using the zkSync bridge: https://portal.zksync.io/bridge`);
      console.log(`3. Or ask for testnet ETH in the zkSync Discord: https://discord.gg/zksync\n`);
    } else if (hre.network.name.includes("goerli")) {
      console.log(`\nTo get Goerli ETH:`);
      console.log(`1. Use a Goerli faucet like: https://goerlifaucet.com/`);
      console.log(`2. Or ask for testnet ETH in Goerli Discord servers\n`);
    }
    
    console.log(`Once you have ETH, run this command again to verify your balance.`);
  } else {
    console.log(`\n✅ Your wallet has sufficient ETH to deploy contracts.`);
    
    if (ethBalance.lt(ethers.parseEther("0.05"))) {
      console.log(`⚠️ However, your balance is low. Consider adding more ETH for multiple transactions.`);
    }
  }
  
  console.log(`\n===========================\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

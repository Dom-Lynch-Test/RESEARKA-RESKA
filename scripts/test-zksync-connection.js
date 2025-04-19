// Script to test connection to zkSync testnet
const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  try {
    console.log(`\n=== TESTING ZKSYNC CONNECTION ===`);
    console.log(`Network configured: ${hre.network.name}`);
    console.log(`RPC URL: ${hre.network.config.url}`);
    
    // Test using ethers v6 provider directly
    console.log("\nTesting RPC connection with ethers...");
    const provider = new ethers.JsonRpcProvider(hre.network.config.url);
    const chainId = await provider.getChainId();
    console.log(`✅ Connected! Chain ID: ${chainId}`);
    
    // Get the latest block
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Latest block number: ${blockNumber}`);
    
    // Verify we're on zkSync Era testnet (280 is the expected chainId)
    if (chainId === 280) {
      console.log("✅ Confirmed connection to zkSync Era Testnet");
    } else {
      console.log(`⚠️ Connected to chain ID ${chainId}, which is not zkSync Era Testnet (280)`);
      if (chainId === 324) {
        console.log("This appears to be zkSync Era Mainnet (324)");
      } else if (chainId === 1) {
        console.log("This appears to be Ethereum Mainnet (1)");
      } else if (chainId === 5) {
        console.log("This appears to be Ethereum Goerli Testnet (5)");
      }
    }
    
    // Test wallet access (without requiring funds)
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`✅ Wallet configured: ${wallet.address}`);
    
    // Get wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance.eq(0)) {
      console.log(`\n⚠️ Your wallet has no ETH on zkSync Era Testnet.`);
      console.log(`To proceed with deployment, you'll need to:`);
      console.log(`1. Get Goerli ETH from a faucet like https://goerlifaucet.com/`);
      console.log(`2. Bridge your Goerli ETH to zkSync using https://portal.zksync.io/bridge`);
    } else {
      console.log("\n✅ Your wallet has ETH and is ready for deployment");
    }
    
    console.log("\n=== CONNECTION TEST SUCCESSFUL ===");
    console.log("You're ready to deploy to zkSync testnet!");
    console.log(`Run the deployment script with: npx hardhat run scripts/deploy-zksync-testnet.js --network zkSyncTestnet`);
    
    return true;
  } catch (error) {
    console.error("\n❌ CONNECTION TEST FAILED ❌");
    console.error("Error details:", error.message);
    
    // Offer diagnostic advice
    console.log("\n=== DIAGNOSTIC STEPS ===");
    console.log("1. Verify your internet connection");
    console.log("2. Check if zkSync testnet is operational: https://uptime.com/s/zksync-era-testnet");
    console.log("3. Try alternate RPC endpoints:");
    console.log("   • Ankr: https://rpc.ankr.com/zksync_era_test");
    console.log("   • Blast: https://blast-zksync-era-testnet.public.blastapi.io");
    console.log("   • BlockPI: https://public.zksync2-testnet.blockpi.network");
    console.log("4. Check for firewall or network restrictions");
    console.log("5. Ensure you're using compatible versions of zksync-web3 with ethers");
    
    return false;
  }
}

// Execute the test
if (require.main === module) {
  main()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

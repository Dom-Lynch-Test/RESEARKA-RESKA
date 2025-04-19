// Modern zkSync connection test script using standard ethers with hardhat
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("\n=== ZKSYNC CONNECTION TEST (ETHERS V6) ===");
  console.log("Testing connection to zkSync Era Testnet...");
  
  try {
    // Get the network name we're using
    const networkName = hre.network.name;
    console.log(`Current network: ${networkName}`);
    
    if (networkName !== 'zkSyncTestnet') {
      console.log("⚠️ Warning: You are not connected to zkSyncTestnet. Use --network zkSyncTestnet");
    }
    
    // Use hardhat's ethers provider
    const provider = ethers.provider;
    console.log(`Provider URL: ${provider.connection.url}`);
    console.log("Provider initialized successfully");
    
    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    console.log(`Connected to chain ID: ${chainId}`);
    
    // Verify we're on zkSync Era Testnet (280)
    if (chainId === 280n) {
      console.log("✅ Successfully connected to zkSync Era Testnet");
    } else {
      console.log(`⚠️ Connected to chain ID ${chainId}, which is not zkSync Era Testnet (280)`);
      if (chainId === 324n) {
        console.log("This appears to be zkSync Era Mainnet");
      } else if (chainId === 1n) {
        console.log("This appears to be Ethereum Mainnet");
      } else if (chainId === 5n) {
        console.log("This appears to be Ethereum Goerli Testnet");
      }
    }
    
    // Get latest block
    const blockNumber = await provider.getBlockNumber();
    console.log(`Latest block number: ${blockNumber}`);
    
    // Try getting a block
    const block = await provider.getBlock(blockNumber);
    console.log(`Latest block timestamp: ${new Date(Number(block.timestamp) * 1000).toLocaleString()}`);
    
    // Try with a wallet
    if (process.env.PRIVATE_KEY) {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      console.log(`\nWallet address: ${wallet.address}`);
      
      // Check balance
      const balance = await provider.getBalance(wallet.address);
      console.log(`Wallet ETH balance: ${ethers.formatEther(balance)} ETH`);
      
      if (balance === 0n) {
        console.log(`\n⚠️ Your wallet has no ETH on zkSync Era Testnet`);
        console.log(`To proceed with deployment, you'll need to:`);
        console.log(`1. Get Goerli ETH from a faucet like https://goerlifaucet.com/`);
        console.log(`2. Bridge your Goerli ETH to zkSync using https://portal.zksync.io/bridge`);
      } else {
        console.log(`\n✅ Your wallet has ${ethers.formatEther(balance)} ETH and is ready for deployment`);
      }
    }
    
    console.log("\n=== CONNECTION TEST SUCCESSFUL ===");
    console.log("You're ready to deploy to zkSync testnet!");
    console.log(`Run: npx hardhat run scripts/deploy-zksync-testnet.js --network zkSyncTestnet`);
    return true;
    
  } catch (error) {
    console.error("\n❌ CONNECTION TEST FAILED");
    console.error(`Error: ${error.message}`);
    
    console.log("\n=== TROUBLESHOOTING STEPS ===");
    console.log("1. Check your internet connection");
    console.log("2. Verify the zkSync Era Testnet status: https://status.zksync.io/");
    console.log("3. Try these alternative RPC endpoints in your .env file:");
    console.log("   - ZKSYNC_TESTNET_URL=https://zksync2-testnet.zksync.io");
    console.log("   - ZKSYNC_TESTNET_URL=https://testnet.era.zksync.dev");
    console.log("   - ZKSYNC_TESTNET_URL=https://zksync-era-testnet.blockpi.network/v1/rpc/public");
    console.log("4. If you continue having issues, try using a VPN or different network");
    console.log("5. Consider following the staged approach as planned:");
    console.log("   - Deploy locally first (already completed)");
    console.log("   - Bridge some Goerli ETH to zkSync testnet wallet");
    console.log("   - Then try zkSync testnet again when funds are available");
    
    return false;
  }
}

// Run the test
if (require.main === module) {
  main()
    .then(result => process.exit(result ? 0 : 1))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

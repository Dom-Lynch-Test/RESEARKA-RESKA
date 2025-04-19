// Minimal zkSync provider check script
// Run with: node scripts/check-zksync-provider.js
const { Provider } = require("zksync-ethers");
require("dotenv").config();

async function main() {
  // Try multiple provider URLs in sequence
  const providerUrls = [
    process.env.ZKSYNC_TESTNET_URL || "https://zksync-era-testnet.blockpi.network/v1/rpc/public",
    "https://testnet.era.zksync.dev",
    "https://zksync2-testnet.zksync.io",
    "https://rpc.ankr.com/zksync_era_test",
  ];
  
  console.log("=== ZKSYNC PROVIDER DIRECT CONNECTION TEST ===");
  console.log("Testing direct connection to multiple RPC endpoints...\n");
  
  for (let i = 0; i < providerUrls.length; i++) {
    const url = providerUrls[i];
    try {
      console.log(`Trying endpoint ${i+1}/${providerUrls.length}: ${url}`);
      const provider = new Provider(url);
      
      // Get chain ID
      const chainId = await provider.getChainId();
      console.log(`✅ SUCCESS: Connected to zkSync with chain ID: ${chainId}`);
      
      if (chainId === 280) {
        console.log(`This is zkSync Era Testnet as expected.`);
      } else if (chainId === 324) {
        console.log(`WARNING: This is zkSync Era Mainnet, not testnet.`);
      } else {
        console.log(`WARNING: Unknown zkSync network with chain ID ${chainId}.`);
      }
      
      // Get block number to confirm full connectivity
      const blockNumber = await provider.getBlockNumber();
      console.log(`Latest block number: ${blockNumber}`);
      
      // Working provider found - print environment variable to set
      console.log(`\n✅ RECOMMENDED: Use this endpoint in your .env file:`);
      console.log(`ZKSYNC_TESTNET_URL=${url}`);
      
      // Exit successfully since we found a working provider
      return true;
    } catch (error) {
      console.log(`❌ ERROR: Endpoint failed with: ${error.message}\n`);
    }
  }
  
  console.log("\n❌ All zkSync RPC endpoints failed!");
  console.log("Consider using a VPN or trying again later.");
  console.log("Alternatively, run a local zkSync node with: npx hardhat node-zksync");
  
  return false;
}

main()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

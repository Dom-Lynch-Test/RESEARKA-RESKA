require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("solidity-coverage");
require("hardhat-gas-reporter");
require("@nomicfoundation/hardhat-chai-matchers");

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.20", // Use a known available version
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    goerli: {
      url: process.env.GOERLI_URL || "https://rpc.ankr.com/eth_goerli",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mainnet: {
      url: process.env.MAINNET_URL || "https://eth.llamarpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    zkSyncTestnet: {
      url: process.env.ZKSYNC_TESTNET_URL || "https://zksync2-testnet.zksync.dev",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    zkSyncMainnet: {
      url: process.env.ZKSYNC_MAINNET_URL || "https://mainnet.era.zksync.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  // Named accounts for deployment scripts
  namedAccounts: {
    deployer: {
      default: 0, // First account by default
      1: process.env.WALLET_ADDRESS, // Mainnet
      5: process.env.WALLET_ADDRESS, // Goerli
    },
  },
  // Gas reporter configuration - Re-enabled
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
  },
  // Configure mocha for testing
  mocha: {
    timeout: 40000,
    reporter: 'spec' // More detailed reporter for better test output
  }
};

// Place zkSync plugins at the top of the file
require("@matterlabs/hardhat-zksync");

// Standard Hardhat plugins
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
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
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
      url: process.env.ZKSYNC_TESTNET_URL || "https://testnet.era.zksync.dev",
      ethNetwork: "goerli", // underlying L1 network
      zksync: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    zkSyncMainnet: {
      url: process.env.ZKSYNC_MAINNET_URL || "https://mainnet.era.zksync.io",
      ethNetwork: "mainnet", // underlying L1 network
      zksync: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  // Named accounts for deployment scripts
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
  // For gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  // For contract verification
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  // Set paths for artifacts
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test"
  }
};

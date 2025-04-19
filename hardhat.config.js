// Updated Hardhat configuration for Sepolia (replacing deprecated Goerli)
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-node");
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("solidity-coverage");
require("hardhat-gas-reporter");
require("@nomicfoundation/hardhat-chai-matchers");

// Default values if environment variables are not set
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const ZKSYNC_TESTNET_URL = process.env.ZKSYNC_TESTNET_URL || "https://sepolia.era.zksync.dev";
const SEPOLIA_URL = process.env.SEPOLIA_URL || "https://rpc.sepolia.org";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
// Added mainnet configuration values
const ZKSYNC_MAINNET_URL = process.env.ZKSYNC_MAINNET_URL || "https://mainnet.era.zksync.io";
const ETHEREUM_MAINNET_URL = process.env.ETHEREUM_MAINNET_URL || "https://ethereum.publicnode.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    // Hardhat local network
    hardhat: {
      chainId: 31337,
      zksync: false
    },
    // Local Hardhat node for standard Ethereum testing
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      zksync: false
    },
    // Local zkSync node for zkSync-specific testing
    zkSyncTestnetLocal: {
      url: "http://localhost:3050",
      ethNetwork: "localhost",
      zksync: true
    },
    // zkSync Era Testnet (Sepolia) configuration
    zkSyncTestnet: {
      url: ZKSYNC_TESTNET_URL,
      ethNetwork: SEPOLIA_URL, // Updated: Using Sepolia as L1 base layer
      zksync: true,
      accounts: [PRIVATE_KEY],
      verifyURL: 'https://explorer.sepolia.era.zksync.dev/contract_verification'
    },
    // zkSync Era Mainnet configuration
    zkSyncMainnet: {
      url: ZKSYNC_MAINNET_URL,
      ethNetwork: ETHEREUM_MAINNET_URL, // Ethereum mainnet as L1
      zksync: true,
      accounts: [PRIVATE_KEY],
      verifyURL: 'https://explorer.era.zksync.io/contract_verification',
      // Gas price and gas limit adjusted for mainnet
      gasPrice: 250000000, // 0.25 Gwei
      timeout: 120000 // 2 minutes timeout for transactions
    },
    // Sepolia testnet for L1 interactions (replacing Goerli)
    sepolia: {
      url: SEPOLIA_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111 // Sepolia chain ID
    }
  },
  // zkSync compiler settings
  zksolc: {
    version: "1.3.14",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
      },
      // Specify EVM legacy assembly to avoid the zksolc warnings
      compilerPath: "",
      experimental: {}
    }
  },
  // For contract verification
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  // For gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  }
};

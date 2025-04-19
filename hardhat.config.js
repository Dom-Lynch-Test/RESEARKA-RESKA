require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.17",
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
    }
  },
  // For contract verification
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  // Disable analytics to prevent EPIPE errors
  analytics: {
    enabled: false
  },
  // Configure mocha to avoid EPIPE errors
  mocha: {
    timeout: 40000,
    reporter: 'min' // Use minimal reporter to reduce output
  },
  // Disable gas reporter to avoid EPIPE errors
  gasReporter: {
    enabled: false
  }
};

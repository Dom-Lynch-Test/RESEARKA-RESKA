/**
 * RESKA Token Vesting Deployment Helper
 * Shared utility functions for vesting schedule deployment
 * 
 * @module vestingDeployer
 * @author RESKA Team
 */

const { Wallet, Provider, utils } = require("zksync-ethers");
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');
require("dotenv").config();

/**
 * Validates environment variables needed for deployment
 * @param {Array<string>} requiredVars - Array of required environment variable names
 * @throws {Error} If any required variables are missing
 */
function validateEnvironment(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Validates Ethereum addresses
 * @param {Object} addresses - Object containing address name-value pairs
 * @throws {Error} If any address is invalid
 */
function validateAddresses(addresses) {
  for (const [name, address] of Object.entries(addresses)) {
    if (!address || !utils.isAddress(address)) {
      throw new Error(`Invalid Ethereum address for ${name}: ${address}`);
    }
  }
}

/**
 * Initializes provider and wallet connection
 * @param {Object} networkConfig - Network configuration from Hardhat
 * @returns {Object} Object containing provider and wallet
 * @throws {Error} If network URL or private key is missing
 */
async function initializeConnection(networkConfig) {
  // Validate essential connection parameters
  if (!networkConfig.url) {
    throw new Error(`Network URL is missing for network: ${networkConfig.name}`);
  }
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const provider = new Provider(networkConfig.url);
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  
  return { provider, wallet };
}

/**
 * Loads contract instances
 * @param {Object} wallet - Connected wallet instance
 * @param {Object} addresses - Object containing token and vesting addresses
 * @returns {Object} Object containing token and vesting contract instances
 */
async function loadContracts(wallet, addresses) {
  // Validate contract addresses
  validateAddresses({
    'TOKEN_ADDRESS': addresses.tokenAddress,
    'VESTING_ADDRESS': addresses.vestingAddress
  });

  // Load ABIs dynamically
  const tokenAbi = (await hre.artifacts.readArtifact('ReskaToken')).abi;
  const vestingAbi = (await hre.artifacts.readArtifact('ReskaTokenVesting')).abi;
  
  const token = new hre.ethers.Contract(addresses.tokenAddress, tokenAbi, wallet);
  const vesting = new hre.ethers.Contract(addresses.vestingAddress, vestingAbi, wallet);
  
  return { token, vesting };
}

/**
 * Verifies token balance in vesting contract
 * @param {Object} token - Token contract instance
 * @param {string} vestingAddress - Vesting contract address
 * @param {bigint} requiredAmount - Required token amount
 * @returns {boolean} True if balance is sufficient, false otherwise
 */
async function checkVestingBalance(token, vestingAddress, requiredAmount) {
  const vestingBalance = await token.balanceOf(vestingAddress);
  console.log(`Vesting contract balance: ${Number(vestingBalance) / 10**6} RESKA`);
  console.log(`Required amount: ${Number(requiredAmount) / 10**6} RESKA`);
  
  return vestingBalance >= requiredAmount;
}

/**
 * Funds vesting contract if needed
 * @param {Object} token - Token contract instance
 * @param {Object} wallet - Connected wallet instance
 * @param {string} vestingAddress - Vesting contract address
 * @param {bigint} requiredAmount - Required token amount
 * @throws {Error} If wallet has insufficient balance
 */
async function fundVestingContractIfNeeded(token, wallet, vestingAddress, requiredAmount) {
  const vestingBalance = await token.balanceOf(vestingAddress);
  if (vestingBalance < requiredAmount) {
    const deficit = requiredAmount - vestingBalance;
    console.log(`Vesting contract needs additional funding of ${Number(deficit) / 10**6} RESKA`);
    
    // Check wallet balance
    const walletBalance = await token.balanceOf(wallet.address);
    if (walletBalance < deficit) {
      throw new Error(`Insufficient tokens in wallet. Required: ${Number(deficit) / 10**6} RESKA, Available: ${Number(walletBalance) / 10**6} RESKA`);
    }
    
    console.log(`Transferring ${Number(deficit) / 10**6} RESKA to vesting contract...`);
    const tx = await token.transfer(vestingAddress, deficit);
    const receipt = await tx.wait();
    
    console.log(`✅ Transfer successful. Transaction hash: ${receipt.hash}`);
    const newBalance = await token.balanceOf(vestingAddress);
    console.log(`New vesting contract balance: ${Number(newBalance) / 10**6} RESKA`);
  }
}

/**
 * Creates a vesting schedule
 * @param {Object} vesting - Vesting contract instance
 * @param {Object} params - Vesting schedule parameters
 * @returns {Object} Transaction receipt
 */
async function createVestingSchedule(vesting, params) {
  // Validate beneficiary address
  validateAddresses({ 'beneficiary': params.beneficiary });
  
  // Estimate gas for the transaction
  const gasEstimate = await vesting.estimateGas.createVestingSchedule(
    params.beneficiary,
    params.startTime,
    params.cliffPeriod,
    params.duration,
    params.slicePeriod,
    params.revocable,
    params.amount
  );
  
  // Add 20% buffer to gas estimate
  const gasLimit = Math.floor(gasEstimate.toNumber() * 1.2);
  
  console.log(`Creating vesting schedule for ${params.beneficiary}...`);
  console.log(`- Amount: ${Number(params.amount) / 10**6} RESKA`);
  console.log(`- Cliff period: ${params.cliffPeriod} seconds`);
  console.log(`- Duration: ${params.duration} seconds`);
  console.log(`- Slice period: ${params.slicePeriod} seconds`);
  console.log(`- Revocable: ${params.revocable}`);
  
  const tx = await vesting.createVestingSchedule(
    params.beneficiary,
    params.startTime,
    params.cliffPeriod,
    params.duration,
    params.slicePeriod,
    params.revocable,
    params.amount,
    { gasLimit }
  );
  
  console.log(`Transaction submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Vesting schedule created successfully`);
  
  return receipt;
}

/**
 * Computes vesting schedule ID
 * @param {Object} vesting - Vesting contract instance
 * @param {string} beneficiary - Beneficiary address
 * @param {number} index - Schedule index for the beneficiary
 * @returns {string} Vesting schedule ID
 */
async function getVestingScheduleId(vesting, beneficiary, index = 0) {
  return await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary, index);
}

/**
 * Updates deployments.json with vesting details
 * @param {string} networkType - Network type (testnet or mainnet)
 * @param {string} category - Vesting category
 * @param {Object} data - Vesting data to save
 */
function updateDeploymentsJson(networkType, category, data) {
  try {
    const deploymentsPath = path.join(__dirname, '..', '..', 'deployments.json');
    let deployments = {};
    
    // Read existing file or create structure
    try {
      const fileContent = fs.readFileSync(deploymentsPath, 'utf8');
      deployments = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid JSON
      deployments = {
        testnet: { token: null, vesting: {}, allocations: {} },
        mainnet: { token: null, vesting: {}, allocations: {} }
      };
    }
    
    // Ensure structure exists
    if (!deployments[networkType]) {
      deployments[networkType] = { token: null, vesting: {}, allocations: {} };
    }
    
    if (!deployments[networkType].vesting) {
      deployments[networkType].vesting = {};
    }
    
    // Update data
    deployments[networkType].vesting[category] = data;
    
    // Write back to file
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log(`Vesting details for ${category} saved to deployments.json`);
  } catch (error) {
    console.error(`Error updating deployments.json:`, error);
  }
}

module.exports = {
  validateEnvironment,
  validateAddresses,
  initializeConnection,
  loadContracts,
  checkVestingBalance,
  fundVestingContractIfNeeded,
  createVestingSchedule,
  getVestingScheduleId,
  updateDeploymentsJson
};

// RESKA Token Full Deployment Sequence
// This script orchestrates the complete deployment of RESKA token and all vesting schedules
// Author: Dom-Lynch-Test/RESEARKA-RESKA [2025-04-20]

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { existsSync } = require('fs');
require('dotenv').config();

// Configuration
const VALID_NETWORKS = ['zkSyncTestnet', 'zkSyncMainnet'];
const NETWORK = process.argv[2];

// Required script files
const REQUIRED_SCRIPTS = [
  'fund-vesting-contract.js',
  'deploy-founder-vesting.js',
  'deploy-investor-vesting.js',
  'deploy-advisor-vesting.js',
  'deploy-airdrop-vesting.js',
  'deploy-ecosystem-vesting.js',
  'deploy-treasury-vesting.js',
  'deploy-escrow-vesting.js',
  'deploy-timelock.js',
  'verify-mainnet.js'
];

// Create a deployments.json file if it doesn't exist
const createDeploymentsFile = () => {
  const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
  if (!fs.existsSync(deploymentsPath)) {
    const initialStructure = {
      testnet: {
        token: null,
        vesting: {},
        allocations: {},
        deploymentDate: null
      },
      mainnet: {
        token: null,
        vesting: {},
        allocations: {},
        deploymentDate: null
      }
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(initialStructure, null, 2));
    console.log('Created deployments.json file.');
  }
};

/**
 * Validates all required script files exist
 * @throws {Error} If any script is missing
 */
function validateScripts() {
  const scriptsDir = path.join(__dirname, 'scripts');
  const missingScripts = REQUIRED_SCRIPTS.filter(script => {
    return !existsSync(path.join(scriptsDir, script));
  });

  if (missingScripts.length > 0) {
    throw new Error(`Missing required script files: ${missingScripts.join(', ')}`);
  }
}

/**
 * Validates required environment variables
 * @throws {Error} If any required env var is missing
 */
function validateEnvironment() {
  const requiredVars = ['PRIVATE_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Executes a command asynchronously with Promise
 * @param {string} command - Command to execute
 * @param {Array<string>} args - Command arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<void>} Promise that resolves on success, rejects on error
 */
function executeCommand(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
      }
    });
    
    childProcess.on('error', (err) => {
      reject(new Error(`Failed to execute command: ${err.message}`));
    });
  });
}

/**
 * Updates deployment timestamp
 * @param {string} networkType - 'testnet' or 'mainnet'
 */
function updateDeploymentTimestamp(networkType) {
  const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  deployments[networkType].deploymentDate = new Date().toISOString();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
}

/**
 * Main deployment sequence
 */
async function deployAll() {
  try {
    // Validate network
    if (!NETWORK) {
      throw new Error(`Network argument is required. Usage: node deploy-all.js [network]`);
    }
    
    if (!VALID_NETWORKS.includes(NETWORK)) {
      throw new Error(`Invalid network: ${NETWORK}. Must be one of: ${VALID_NETWORKS.join(', ')}`);
    }
    
    // Validate environment and scripts
    validateEnvironment();
    validateScripts();
    
    console.log(`\n=== STARTING RESKA TOKEN DEPLOYMENT ON ${NETWORK} ===\n`);
    
    // Create deployments file
    createDeploymentsFile();
    
    // Step 1: Deploy token and vesting contracts
    console.log('\n=== STEP 1: DEPLOYING TOKEN AND VESTING CONTRACTS ===\n');
    await executeCommand('npx', ['hardhat', 'deploy-zksync', '--network', NETWORK]);
    
    // Step 2: Fund vesting contract
    console.log('\n=== STEP 2: FUNDING VESTING CONTRACT ===\n');
    await executeCommand('node', ['scripts/fund-vesting-contract.js', '--network', NETWORK]);

    // Step 3: Deploy founder vesting (50% immediate, 50% 1yr cliff)
    console.log('\n=== STEP 3: DEPLOYING FOUNDER VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-founder-vesting.js', '--network', NETWORK]);
    
    // Step 4: Deploy investor allocations (100% immediate)
    console.log('\n=== STEP 4: DEPLOYING INVESTOR ALLOCATIONS ===\n');
    await executeCommand('node', ['scripts/deploy-investor-vesting.js', '--network', NETWORK]);
    
    // Step 5: Deploy advisor vesting (1yr cliff + quarterly releases)
    console.log('\n=== STEP 5: DEPLOYING ADVISOR VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-advisor-vesting.js', '--network', NETWORK]);
    
    // Step 6: Deploy airdrop/rewards vesting (1yr cliff, then 100%)
    console.log('\n=== STEP 6: DEPLOYING AIRDROP VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-airdrop-vesting.js', '--network', NETWORK]);
    
    // Step 7: Deploy ecosystem vesting (2yr linear)
    console.log('\n=== STEP 7: DEPLOYING ECOSYSTEM VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-ecosystem-vesting.js', '--network', NETWORK]);
    
    // Step 8: Deploy treasury vesting (2yr linear)
    console.log('\n=== STEP 8: DEPLOYING TREASURY VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-treasury-vesting.js', '--network', NETWORK]);
    
    // Step 9: Deploy long-term escrow (3yr cliff)
    console.log('\n=== STEP 9: DEPLOYING LONG-TERM ESCROW VESTING SCHEDULE ===\n');
    await executeCommand('node', ['scripts/deploy-escrow-vesting.js', '--network', NETWORK]);
    
    // Step 10: Deploy timelock controller for governance
    console.log('\n=== STEP 10: DEPLOYING TIMELOCK CONTROLLER ===\n');
    await executeCommand('node', ['scripts/deploy-timelock.js', '--network', NETWORK]);
    
    // Step 11: Verify contracts on Explorer
    if (NETWORK === 'zkSyncMainnet') {
      console.log('\n=== STEP 11: VERIFYING CONTRACTS ON MAINNET ===\n');
      await executeCommand('node', ['scripts/verify-mainnet.js']);
    }
    
    // Update deployments.json with deployment date
    const networkKey = NETWORK === 'zkSyncMainnet' ? 'mainnet' : 'testnet';
    updateDeploymentTimestamp(networkKey);
    
    console.log(`\n=== RESKA TOKEN DEPLOYMENT ON ${NETWORK} COMPLETE ===\n`);
    console.log('Summary of deployment steps:');
    console.log('1. Token and vesting contracts deployed');
    console.log('2. Vesting contract funded');
    console.log('3. Founder vesting schedule deployed (50% immediate, 50% 1yr cliff)');
    console.log('4. Investor allocations deployed (100% immediate)');
    console.log('5. Advisor vesting schedule deployed (1yr cliff + quarterly releases)');
    console.log('6. Airdrop vesting schedule deployed (1yr cliff, then 100%)');
    console.log('7. Ecosystem vesting schedule deployed (2yr linear)');
    console.log('8. Treasury vesting schedule deployed (2yr linear)');
    console.log('9. Long-term escrow deployed (3yr cliff)');
    console.log('10. Timelock controller deployed');
    if (NETWORK === 'zkSyncMainnet') {
      console.log('11. Contracts verified on zkSync Explorer');
    }
    
    console.log(`\nDeployment details saved to deployments.json`);
    console.log(`\nNEXT STEPS:`);
    console.log('1. Monitor token and vesting contract events');
    console.log('2. Prepare announcement for token launch');
    console.log('3. Set up monitoring systems for on-chain activities');
    
  } catch (error) {
    console.error(`\n=== DEPLOYMENT ERROR ===\n`);
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    console.error(`\nDeployment failed. Please check the error above and try again.`);
    process.exit(1);
  }
}

// Execute deployment
deployAll().catch(error => {
  console.error(`Unhandled error in deployment:`, error);
  process.exit(1);
});

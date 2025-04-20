// RESKA Token Full Deployment Sequence
// This script orchestrates the complete deployment of RESKA token and all vesting schedules
// Author: Dom-Lynch-Test/RESEARKA-RESKA [2025-04-20]

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { existsSync } = require('fs');
const hre = require('hardhat');
require('dotenv').config();

// Configuration
const VALID_NETWORKS = ['zkSyncTestnet', 'zkSyncMainnet'];
const NETWORK = process.argv[2];

// Centralized script paths
const SCRIPTS = {
  deployZkSync: 'deploy-zksync',  // Hardhat task
  fundVesting: 'scripts/fund-vesting-contract.js',
  founderVesting: 'scripts/deploy-founder-vesting.js',
  investorVesting: 'scripts/deploy-investor-vesting.js',
  advisorVesting: 'scripts/deploy-advisor-vesting.js',
  airdropVesting: 'scripts/deploy-airdrop-vesting.js',
  ecosystemVesting: 'scripts/deploy-ecosystem-vesting.js',
  treasuryVesting: 'scripts/deploy-treasury-vesting.js',
  escrowVesting: 'scripts/deploy-escrow-vesting.js',
  timelock: 'scripts/deploy-timelock.js',
  verifyMainnet: 'scripts/verify-mainnet.js',
};

// Required script files (excluding Hardhat tasks)
const REQUIRED_SCRIPTS = [
  SCRIPTS.fundVesting,
  SCRIPTS.founderVesting,
  SCRIPTS.investorVesting,
  SCRIPTS.advisorVesting,
  SCRIPTS.airdropVesting,
  SCRIPTS.ecosystemVesting,
  SCRIPTS.treasuryVesting,
  SCRIPTS.escrowVesting,
  SCRIPTS.timelock,
  SCRIPTS.verifyMainnet
].map(script => script.startsWith('scripts/') ? script.substring(8) : script);

// Required Hardhat tasks
const REQUIRED_TASKS = [
  SCRIPTS.deployZkSync
];

/**
 * Validates that all Hardhat tasks exist in the task registry
 * @throws {Error} If any task is missing
 */
async function validateHardhatTasks() {
  const missingTasks = [];
  
  for (const taskName of REQUIRED_TASKS) {
    try {
      // Check if the task exists in Hardhat's registry
      const tasks = await hre.run('help', { all: true });
      const taskExists = tasks.includes(taskName);
      
      if (!taskExists) {
        missingTasks.push(taskName);
      }
    } catch (error) {
      // If we can't check tasks, assume the task might be missing
      console.warn(`Could not verify task '${taskName}': ${error.message}`);
      missingTasks.push(taskName);
    }
  }
  
  if (missingTasks.length > 0) {
    throw new Error(`Missing required Hardhat tasks: ${missingTasks.join(', ')}`);
  }
}

/**
 * Validates all required script files exist
 * @throws {Error} If any script is missing
 */
function validateScripts() {
  const scriptsDir = path.join(__dirname);
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
 * Creates a deployments.json file if it doesn't exist
 */
function createDeploymentsFile() {
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
}

/**
 * Executes a command asynchronously with Promise
 * @param {string} command - Command to execute
 * @param {Array<string>} args - Command arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<{stdout: string, stderr: string}>} Promise with stdout and stderr
 */
function executeCommand(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    
    // Use stdio: 'pipe' to capture stdout and stderr
    const childProcess = spawn(command, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    // Capture stdout
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output); // Echo to console
      stdout += output;
    });
    
    // Capture stderr
    childProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output); // Echo to console
      stderr += output;
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
    
    childProcess.on('error', (err) => {
      const error = new Error(`Failed to execute command: ${err.message}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.originalError = err;
      reject(error);
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
    
    // Validate environment, scripts, and tasks
    validateEnvironment();
    validateScripts();
    await validateHardhatTasks();
    
    console.log(`\n=== STARTING RESKA TOKEN DEPLOYMENT ON ${NETWORK} ===\n`);
    
    // Create deployments file
    createDeploymentsFile();
    
    // Step 1: Deploy token and vesting contracts
    console.log('\n=== STEP 1: DEPLOYING TOKEN AND VESTING CONTRACTS ===\n');
    await executeCommand('npx', ['hardhat', SCRIPTS.deployZkSync, '--network', NETWORK]);
    
    // Step 2: Fund vesting contract
    console.log('\n=== STEP 2: FUNDING VESTING CONTRACT ===\n');
    await executeCommand('node', [SCRIPTS.fundVesting, '--network', NETWORK]);

    // Step 3: Deploy founder vesting (50% immediate, 50% 1yr cliff)
    console.log('\n=== STEP 3: DEPLOYING FOUNDER VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.founderVesting, '--network', NETWORK]);
    
    // Step 4: Deploy investor allocations (100% immediate)
    console.log('\n=== STEP 4: DEPLOYING INVESTOR ALLOCATIONS ===\n');
    await executeCommand('node', [SCRIPTS.investorVesting, '--network', NETWORK]);
    
    // Step 5: Deploy advisor vesting (1yr cliff + quarterly releases)
    console.log('\n=== STEP 5: DEPLOYING ADVISOR VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.advisorVesting, '--network', NETWORK]);
    
    // Step 6: Deploy airdrop/rewards vesting (1yr cliff, then 100%)
    console.log('\n=== STEP 6: DEPLOYING AIRDROP VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.airdropVesting, '--network', NETWORK]);
    
    // Step 7: Deploy ecosystem vesting (2yr linear)
    console.log('\n=== STEP 7: DEPLOYING ECOSYSTEM VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.ecosystemVesting, '--network', NETWORK]);
    
    // Step 8: Deploy treasury vesting (2yr linear)
    console.log('\n=== STEP 8: DEPLOYING TREASURY VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.treasuryVesting, '--network', NETWORK]);
    
    // Step 9: Deploy long-term escrow (3yr cliff)
    console.log('\n=== STEP 9: DEPLOYING LONG-TERM ESCROW VESTING SCHEDULE ===\n');
    await executeCommand('node', [SCRIPTS.escrowVesting, '--network', NETWORK]);
    
    // Step 10: Deploy timelock controller for governance
    console.log('\n=== STEP 10: DEPLOYING TIMELOCK CONTROLLER ===\n');
    await executeCommand('node', [SCRIPTS.timelock, '--network', NETWORK]);
    
    // Step 11: Verify contracts on Explorer
    if (NETWORK === 'zkSyncMainnet') {
      console.log('\n=== STEP 11: VERIFYING CONTRACTS ON MAINNET ===\n');
      await executeCommand('node', [SCRIPTS.verifyMainnet]);
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
    
    // Log additional error context if available
    if (error.stdout) {
      console.error(`\nCommand stdout:\n${error.stdout}`);
    }
    if (error.stderr) {
      console.error(`\nCommand stderr:\n${error.stderr}`);
    }
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

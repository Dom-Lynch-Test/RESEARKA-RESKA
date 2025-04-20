// RESKA Token Full Deployment Sequence
// This script orchestrates the complete deployment of RESKA token and all vesting schedules
// Author: Dom-Lynch-Test/RESEARKA-RESKA [2025-04-20]

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const NETWORK = process.argv[2] || 'zkSyncTestnet'; // Default to testnet unless specified
const VALID_NETWORKS = ['zkSyncTestnet', 'zkSyncMainnet'];

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

// Main deployment sequence
async function deployAll() {
  // Validate network
  if (!VALID_NETWORKS.includes(NETWORK)) {
    console.error(`Invalid network: ${NETWORK}. Must be one of: ${VALID_NETWORKS.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== STARTING RESKA TOKEN DEPLOYMENT ON ${NETWORK} ===\n`);
  
  // Create deployments file
  createDeploymentsFile();
  
  try {
    // Step 1: Deploy token and vesting contracts
    console.log('\n=== STEP 1: DEPLOYING TOKEN AND VESTING CONTRACTS ===\n');
    execSync(`npx hardhat deploy-zksync --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 2: Fund vesting contract
    console.log('\n=== STEP 2: FUNDING VESTING CONTRACT ===\n');
    execSync(`node scripts/fund-vesting-contract.js --network ${NETWORK}`, { stdio: 'inherit' });

    // Step 3: Deploy founder vesting (50% immediate, 50% 1yr cliff)
    console.log('\n=== STEP 3: DEPLOYING FOUNDER VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-founder-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 4: Deploy investor allocations (100% immediate)
    console.log('\n=== STEP 4: DEPLOYING INVESTOR ALLOCATIONS ===\n');
    execSync(`node scripts/deploy-investor-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 5: Deploy advisor vesting (1yr cliff + quarterly releases)
    console.log('\n=== STEP 5: DEPLOYING ADVISOR VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-advisor-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 6: Deploy airdrop/rewards vesting (1yr cliff, then 100%)
    console.log('\n=== STEP 6: DEPLOYING AIRDROP VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-airdrop-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 7: Deploy ecosystem vesting (2yr linear)
    console.log('\n=== STEP 7: DEPLOYING ECOSYSTEM VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-ecosystem-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 8: Deploy treasury vesting (2yr linear)
    console.log('\n=== STEP 8: DEPLOYING TREASURY VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-treasury-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 9: Deploy long-term escrow (3yr cliff)
    console.log('\n=== STEP 9: DEPLOYING LONG-TERM ESCROW VESTING SCHEDULE ===\n');
    execSync(`node scripts/deploy-escrow-vesting.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 10: Deploy timelock controller for governance
    console.log('\n=== STEP 10: DEPLOYING TIMELOCK CONTROLLER ===\n');
    execSync(`node scripts/deploy-timelock.js --network ${NETWORK}`, { stdio: 'inherit' });
    
    // Step 11: Verify contracts on Explorer
    if (NETWORK === 'zkSyncMainnet') {
      console.log('\n=== STEP 11: VERIFYING CONTRACTS ON MAINNET ===\n');
      execSync(`node scripts/verify-mainnet.js`, { stdio: 'inherit' });
    }
    
    // Update deployments.json with deployment date
    const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    const networkKey = NETWORK === 'zkSyncMainnet' ? 'mainnet' : 'testnet';
    deployments[networkKey].deploymentDate = new Date().toISOString();
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    
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
    console.error(error.message);
    console.error(`\nDeployment failed. Please check the error above and try again.`);
    process.exit(1);
  }
}

// Execute deployment
deployAll().catch(error => {
  console.error(error);
  process.exit(1);
});

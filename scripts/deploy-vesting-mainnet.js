// RESKA Token Vesting Deployment Script for zkSync Era Mainnet
const { Wallet, Provider } = require('zksync-ethers');
const { Deployer } = require('@matterlabs/hardhat-zksync-deploy');
const hre = require('hardhat');
const fs = require('fs');
require('dotenv').config();

// Time constants
const DAY = 24 * 60 * 60;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

async function main() {
  console.log('=== RESKA TOKEN VESTING DEPLOYMENT TO ZKSYNC ERA MAINNET ===');

  // Initialize zkSync provider
  const provider = new Provider(process.env.ZKSYNC_MAINNET_URL || 'https://mainnet.era.zksync.io');
  console.log(`Connected to zkSync Era Mainnet`);

  // Initialize wallet
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deploying from address: ${wallet.address}`);

  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  const balanceInEth = Number(balance) / 1e18;
  console.log(`Wallet balance: ${balanceInEth.toFixed(4)} ETH`);

  // Verify sufficient balance
  if (balanceInEth < 0.05) {
    console.error(
      `⚠️ WARNING: Wallet balance is low (${balanceInEth.toFixed(4)} ETH). Deployment may fail.`
    );
    console.error(`Please fund your wallet with at least 0.05 ETH before proceeding.`);
    process.exit(1);
  }

  // Load deployment data to get token address
  let tokenAddress;
  try {
    const deploymentData = JSON.parse(fs.readFileSync('./deployments/zksync-mainnet.json', 'utf8'));
    tokenAddress = deploymentData.ReskaToken;
    console.log(`Found RESKA token at address: ${tokenAddress}`);
  } catch (error) {
    console.error(`Error: Could not find token deployment data. Please deploy the token first.`);
    process.exit(1);
  }

  // Initialize the deployer
  const deployer = new Deployer(hre, wallet);

  // Load contract artifacts
  console.log('\nLoading ReskaTokenVesting artifact...');
  const vestingArtifact = await deployer.loadArtifact('ReskaTokenVesting');

  // Deploy vesting contract
  console.log('Deploying ReskaTokenVesting contract...');
  const vesting = await deployer.deploy(vestingArtifact, [tokenAddress]);
  const vestingAddress = await vesting.getAddress();

  console.log(`\n✅ Vesting contract deployed successfully at: ${vestingAddress}`);

  // Save the vesting address to a file
  const vestingDeploymentData = {
    ReskaTokenVesting: vestingAddress,
    ReskaToken: tokenAddress,
    network: 'zkSyncMainnet',
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
  };

  fs.writeFileSync(
    './deployments/vesting-mainnet.json',
    JSON.stringify(vestingDeploymentData, null, 2)
  );
  console.log('Vesting deployment data saved to deployments/vesting-mainnet.json');

  console.log('\n=== VESTING SETUP INSTRUCTIONS ===');
  console.log('To set up vesting schedules, follow these steps:');
  console.log('1. Approve the vesting contract to spend tokens:');
  console.log(`   await token.approve("${vestingAddress}", ethers.parseUnits("500000000", 6));`);
  console.log('2. Transfer tokens to the vesting contract:');
  console.log(`   await token.transfer("${vestingAddress}", ethers.parseUnits("500000000", 6));`);
  console.log('3. Create vesting schedules for each allocation using the following parameters:');
  console.log('\n   Founder (10%, 1-year cliff, 1-year linear vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.FOUNDER_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     ${YEAR},
     ${YEAR},
     ${MONTH},
     false,
     ethers.parseUnits("100000000", 6)
   );`);

  console.log('\n   Advisors (5%, 6-month cliff, 2-year quarterly vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.ADVISORS_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     ${6 * MONTH},
     ${2 * YEAR},
     ${3 * MONTH},
     false,
     ethers.parseUnits("50000000", 6)
   );`);

  console.log('\n   Investors (5%, no cliff, 2-year linear vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.INVESTORS_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     0,
     ${2 * YEAR},
     ${MONTH},
     true,
     ethers.parseUnits("50000000", 6)
   );`);

  console.log('\n   Ecosystem Development (10%, 3-month cliff, 2-year linear vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.ECOSYSTEM_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     ${3 * MONTH},
     ${2 * YEAR},
     ${MONTH},
     false,
     ethers.parseUnits("100000000", 6)
   );`);

  console.log('\n   Treasury (10%, 3-month cliff, 3-year linear vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.TREASURY_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     ${3 * MONTH},
     ${3 * YEAR},
     ${MONTH},
     false,
     ethers.parseUnits("100000000", 6)
   );`);

  console.log('\n   Long-Term Escrow (10%, 1-year cliff, 4-year linear vesting):');
  console.log(`   await vesting.createVestingSchedule(
     "${process.env.ESCROW_ADDRESS || wallet.address}",
     ${Math.floor(Date.now() / 1000)},
     ${YEAR},
     ${4 * YEAR},
     ${MONTH},
     false,
     ethers.parseUnits("100000000", 6)
   );`);

  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log('Your RESKA token vesting contract is now deployed on zkSync Era Mainnet!');
  console.log(`Vesting contract address: ${vestingAddress}`);
  console.log(`Token address: ${tokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Deployment failed:');
    console.error(error);
    process.exit(1);
  });

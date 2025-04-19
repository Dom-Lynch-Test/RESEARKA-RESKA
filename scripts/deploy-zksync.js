/**
 * Script to deploy the RESEARKA token to zkSync networks
 * Requires @matterlabs/zksync-web3 and ethers
 */

require('dotenv').config();
const { Wallet, Provider, Contract } = require('zksync-web3');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Starting deployment to zkSync...');
  
  // Check if we're deploying to testnet or mainnet
  const network = process.env.HARDHAT_NETWORK || 'zkSyncTestnet';
  console.log(`Deploying to ${network}`);
  
  // Load contract artifact
  const artifactPath = path.resolve(__dirname, '../artifacts/ReskaToken.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('Contract artifact not found. Please compile the contract first.');
    process.exit(1);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const contractBytecode = artifact.contracts['ReskaToken.sol'].ReskaToken.evm.bytecode.object;
  const contractAbi = artifact.contracts['ReskaToken.sol'].ReskaToken.abi;
  
  // Set up provider and wallet
  let provider;
  if (network === 'zkSyncMainnet') {
    provider = new Provider(process.env.ZKSYNC_MAINNET_URL || 'https://mainnet.era.zksync.io');
  } else {
    provider = new Provider(process.env.ZKSYNC_TESTNET_URL || 'https://zksync2-testnet.zksync.dev');
  }
  
  // Check if private key is provided
  if (!process.env.PRIVATE_KEY) {
    console.error('Missing PRIVATE_KEY in .env file');
    process.exit(1);
  }
  
  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const deployer = wallet.address;
  
  console.log(`Deployer address: ${deployer}`);
  
  // Check balance
  const balance = await provider.getBalance(deployer);
  console.log(`Deployer balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.eq(0)) {
    console.error('Deployer has no ETH. Please fund your account before deployment.');
    process.exit(1);
  }
  
  try {
    // Deploy the contract
    console.log('Deploying RESEARKA token...');
    
    // Create contract factory
    const factory = new ethers.ContractFactory(
      contractAbi,
      contractBytecode,
      wallet
    );
    
    // Addresses for token allocations
    // In a real deployment, these would be different addresses
    const founderAddress = process.env.WALLET_ADDRESS || deployer;
    const advisorsAddress = process.env.WALLET_ADDRESS || deployer;
    const investorsAddress = process.env.WALLET_ADDRESS || deployer;
    const airdropsAddress = process.env.WALLET_ADDRESS || deployer;
    const ecosystemAddress = process.env.WALLET_ADDRESS || deployer;
    const treasuryAddress = process.env.WALLET_ADDRESS || deployer;
    const publicSaleAddress = process.env.WALLET_ADDRESS || deployer;
    const escrowAddress = process.env.WALLET_ADDRESS || deployer;
    
    // Deploy with constructor arguments
    const reskaToken = await factory.deploy(
      founderAddress,
      advisorsAddress,
      investorsAddress,
      airdropsAddress,
      ecosystemAddress,
      treasuryAddress,
      publicSaleAddress,
      escrowAddress
    );
    
    // Wait for deployment to complete
    await reskaToken.deployed();
    
    console.log(`RESEARKA token deployed to ${reskaToken.address}`);
    
    // Save deployment info
    const deploymentDir = path.resolve(__dirname, '../deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    const deploymentInfo = {
      network,
      address: reskaToken.address,
      deployer,
      timestamp: new Date().toISOString(),
      txHash: reskaToken.deployTransaction.hash
    };
    
    fs.writeFileSync(
      path.resolve(deploymentDir, `${network}.json`),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('Deployment information saved to deployments directory');
    console.log('Deployment successful!');
    
  } catch (error) {
    console.error('Error during deployment:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

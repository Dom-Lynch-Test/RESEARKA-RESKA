// Script to deploy the contract to a local Hardhat node
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Deploying ReskaToken to local Hardhat node...');
  
  try {
    // Load compiled contract
    const artifactPath = path.resolve(__dirname, '../artifacts/ReskaToken.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Get contract ABI and bytecode
    const contractOutput = artifact.contracts['ReskaToken.sol'].ReskaToken;
    const abi = contractOutput.abi;
    const bytecode = contractOutput.evm.bytecode.object;
    
    // Connect to local Hardhat node
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Get the first account as deployer
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found. Make sure Hardhat node is running.');
    }
    
    const deployer = accounts[0];
    const wallet = provider.getSigner(deployer);
    
    console.log('Deploying from account:', deployer);
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Deploy contract with all allocations set to the deployer address for simplicity
    const reskaToken = await factory.deploy(
      deployer, // founder
      deployer, // advisors
      deployer, // investors
      deployer, // airdrops
      deployer, // ecosystem
      deployer, // treasury
      deployer, // publicSale
      deployer  // escrow
    );
    
    await reskaToken.deployed();
    
    console.log('ReskaToken deployed to:', reskaToken.address);
    
    // Save deployment info to a file for tests to use
    const deploymentInfo = {
      address: reskaToken.address,
      deployer: deployer,
      network: 'localhost',
      timestamp: new Date().toISOString()
    };
    
    const deploymentDir = path.resolve(__dirname, '../deployments');
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.resolve(deploymentDir, 'local.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('Deployment info saved to deployments/local.json');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

// Script to deploy the contract to a local Hardhat node
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log('Deploying ReskaToken to local Hardhat node...');
  
  try {
    // Get signers from Hardhat
    const [deployer] = await ethers.getSigners();
     
    console.log('Deploying from account:', deployer.address);
     
    // Create contract factory using Hardhat's ethers integration
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
     
    // Deploy contract with all allocations set to the deployer address for simplicity
    const reskaToken = await ReskaToken.deploy(
      deployer.address, // founder
      deployer.address, // advisors
      deployer.address, // investors
      deployer.address, // airdrops
      deployer.address, // ecosystem
      deployer.address, // treasury
      deployer.address, // publicSale
      deployer.address  // escrow
    );
     
    // Wait for deployment to complete
    await reskaToken.waitForDeployment();
    
    const reskaTokenAddress = await reskaToken.getAddress();
    console.log('ReskaToken deployed to:', reskaTokenAddress);
     
    // Save deployment info to a file for tests to use
    const deploymentInfo = {
      address: reskaTokenAddress,
      deployer: deployer.address,
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

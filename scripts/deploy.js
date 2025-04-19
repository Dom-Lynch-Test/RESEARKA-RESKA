// Script to deploy the RESKA token
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting RESKA token deployment...");

  // Get the contract factory
  const ReskaToken = await ethers.getContractFactory("ReskaToken");
  
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from address: ${deployer.address}`);
  
  // For simplicity in testing, we'll use the deployer address for all allocations
  // In production, you should use different addresses for each allocation
  const founderAddress = deployer.address;
  const advisorsAddress = deployer.address;
  const investorsAddress = deployer.address;
  const airdropsAddress = deployer.address;
  const ecosystemAddress = deployer.address;
  const treasuryAddress = deployer.address;
  const publicSaleAddress = deployer.address;
  const escrowAddress = deployer.address;
  
  // Deploy the contract
  console.log("Deploying RESKA token...");
  const reskaToken = await ReskaToken.deploy(
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
  
  // Log the contract address
  console.log(`RESKA token deployed to: ${reskaToken.address}`);
  console.log(`Network: ${network.name}`);
  
  // Log verification command
  console.log("\nTo verify the contract on Etherscan, run:");
  console.log(`npx hardhat verify --network ${network.name} ${reskaToken.address} \\`);
  console.log(`  ${founderAddress} \\`);
  console.log(`  ${advisorsAddress} \\`);
  console.log(`  ${investorsAddress} \\`);
  console.log(`  ${airdropsAddress} \\`);
  console.log(`  ${ecosystemAddress} \\`);
  console.log(`  ${treasuryAddress} \\`);
  console.log(`  ${publicSaleAddress} \\`);
  console.log(`  ${escrowAddress}`);
  
  console.log("\nDeployment completed successfully!");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

// Script to verify the local deployment functionality
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Verifying local deployment functionality...\n");

  try {
    // Load deployment info
    const deploymentPath = path.resolve(__dirname, "../deployments/local.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const tokenAddress = deploymentInfo.address;

    console.log(`ReskaToken address: ${tokenAddress}`);
    console.log(`Deployer address: ${deploymentInfo.deployer}\n`);

    // Get signers
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log(`Using deployer: ${deployer.address}`);
    console.log(`Test user 1: ${user1.address}`);
    console.log(`Test user 2: ${user2.address}\n`);

    // Connect to the contract
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    const reskaToken = ReskaToken.attach(tokenAddress);

    // 1. Basic Token Information
    console.log("-- Basic Token Information --");
    const name = await reskaToken.name();
    const symbol = await reskaToken.symbol();
    const decimals = await reskaToken.decimals();
    const totalSupply = await reskaToken.totalSupply();
    
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} tokens\n`);

    // 2. Check Allocations
    console.log("-- Allocation Information --");
    const allocations = await reskaToken.getAllocations();
    const recipients = allocations[0];
    const percentages = allocations[1];
    const types = allocations[2];
    
    console.log("Allocation Breakdown:");
    const allocationTypes = ["FOUNDER", "ADVISORS", "INVESTORS", "AIRDROPS", "ECOSYSTEM", "TREASURY", "PUBLIC_SALE", "ESCROW"];
    
    for (let i = 0; i < recipients.length; i++) {
      console.log(`${allocationTypes[types[i]]}: ${percentages[i]}% - ${recipients[i]}`);
    }
    console.log("");

    // 3. Check deployer balance
    console.log("-- Balance Information --");
    const deployerBalance = await reskaToken.balanceOf(deployer.address);
    console.log(`Deployer balance: ${ethers.formatUnits(deployerBalance, decimals)} tokens\n`);

    // 4. Test transfer functionality
    console.log("-- Testing Transfer Functionality --");
    const transferAmount = ethers.parseUnits("1000", decimals); // 1,000 tokens
    
    console.log(`Transferring ${ethers.formatUnits(transferAmount, decimals)} tokens to ${user1.address}...`);
    const tx = await reskaToken.transfer(user1.address, transferAmount);
    await tx.wait();
    
    const user1Balance = await reskaToken.balanceOf(user1.address);
    console.log(`User1 balance after transfer: ${ethers.formatUnits(user1Balance, decimals)} tokens`);
    
    const deployerBalanceAfter = await reskaToken.balanceOf(deployer.address);
    console.log(`Deployer balance after transfer: ${ethers.formatUnits(deployerBalanceAfter, decimals)} tokens\n`);

    // 5. Test role-based functionality
    console.log("-- Testing Role-Based Access Control --");
    
    // Check roles
    const MINTER_ROLE = await reskaToken.MINTER_ROLE();
    const PAUSER_ROLE = await reskaToken.PAUSER_ROLE();
    
    const deployerIsMinter = await reskaToken.hasRole(MINTER_ROLE, deployer.address);
    const deployerIsPauser = await reskaToken.hasRole(PAUSER_ROLE, deployer.address);
    
    console.log(`Deployer has MINTER_ROLE: ${deployerIsMinter}`);
    console.log(`Deployer has PAUSER_ROLE: ${deployerIsPauser}\n`);

    // 6. Test minting
    console.log("-- Testing Minting Functionality --");
    const mintAmount = ethers.parseUnits("5000", decimals); // 5,000 tokens
    
    console.log(`Minting ${ethers.formatUnits(mintAmount, decimals)} tokens to ${user2.address}...`);
    const mintTx = await reskaToken.mint(user2.address, mintAmount);
    await mintTx.wait();
    
    const user2Balance = await reskaToken.balanceOf(user2.address);
    console.log(`User2 balance after minting: ${ethers.formatUnits(user2Balance, decimals)} tokens`);
    
    const newTotalSupply = await reskaToken.totalSupply();
    console.log(`New total supply: ${ethers.formatUnits(newTotalSupply, decimals)} tokens`);
    
    const additionalMinted = await reskaToken.totalMintedAdditional();
    console.log(`Total additional minted: ${ethers.formatUnits(additionalMinted, decimals)} tokens`);
    
    const remainingMintCap = await reskaToken.remainingMintCap();
    console.log(`Remaining mint capacity: ${ethers.formatUnits(remainingMintCap, decimals)} tokens\n`);

    // 7. Test pause functionality
    console.log("-- Testing Pause Functionality --");
    
    console.log("Pausing token transfers...");
    const pauseTx = await reskaToken.pause();
    await pauseTx.wait();
    
    const isPaused = await reskaToken.paused();
    console.log(`Token is paused: ${isPaused}`);
    
    console.log("Unpausing token transfers...");
    const unpauseTx = await reskaToken.unpause();
    await unpauseTx.wait();
    
    const isUnpaused = !(await reskaToken.paused());
    console.log(`Token is unpaused: ${isUnpaused}\n`);

    console.log("✅ Verification completed successfully! The token contract is functioning correctly.");

  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

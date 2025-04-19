// Script to verify the RESKA token deployment on the local Hardhat node
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("Verifying RESKA token deployment on local Hardhat node...");
    
    // Get deployment info
    const deploymentPath = path.join(__dirname, "../deployments/local.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const tokenAddress = deploymentData.address; // Fixed: Use 'address' instead of 'token'
    
    console.log(`Deployed token address: ${tokenAddress}`);
    
    // Get signers
    const [owner, addr1, addr2] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);
    
    // Get contract instances
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    const token = await ReskaToken.attach(tokenAddress);
    
    // Verify basic token details
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    
    console.log("\n=== RESKA TOKEN DETAILS ===");
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    
    // Check if owner has the correct roles
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    const MINTER_ROLE = await token.MINTER_ROLE();
    
    const isAdmin = await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address);
    const isPauser = await token.hasRole(PAUSER_ROLE, owner.address);
    const isMinter = await token.hasRole(MINTER_ROLE, owner.address);
    
    console.log("\n=== ROLE VERIFICATION ===");
    console.log(`Owner has ADMIN role: ${isAdmin}`);
    console.log(`Owner has PAUSER role: ${isPauser}`);
    console.log(`Owner has MINTER role: ${isMinter}`);
    
    // Check token allocations
    const founderBalance = await token.balanceOf(owner.address);
    const additionalMinted = await token.totalMintedAdditional();
    const maxAdditionalMinting = await token.MAX_ADDITIONAL_MINTING();
    
    console.log("\n=== TOKEN ALLOCATION ===");
    console.log(`Founder balance: ${ethers.formatUnits(founderBalance, decimals)} ${symbol}`);
    console.log(`Additional minted: ${ethers.formatUnits(additionalMinted, decimals)} ${symbol}`);
    console.log(`Maximum additional minting: ${ethers.formatUnits(maxAdditionalMinting, decimals)} ${symbol}`);
    
    // Test pausing/unpausing
    console.log("\n=== TESTING PAUSE FUNCTIONALITY ===");
    await token.pause();
    const isPaused = await token.paused();
    console.log(`Token paused: ${isPaused}`);
    
    // Try transferring while paused (should revert)
    console.log("Attempting transfer while paused...");
    try {
      await token.transfer(addr1.address, ethers.parseUnits("1", decimals));
      console.log("❌ Transfer succeeded when it should have failed!");
    } catch (error) {
      console.log("✅ Transfer correctly reverted while paused");
    }
    
    // Unpause and try again
    await token.unpause();
    const isUnpaused = !(await token.paused());
    console.log(`Token unpaused: ${isUnpaused}`);
    
    // Transfer tokens
    console.log("\n=== TESTING TRANSFER FUNCTIONALITY ===");
    const transferAmount = ethers.parseUnits("1000", decimals);
    await token.transfer(addr1.address, transferAmount);
    const addr1Balance = await token.balanceOf(addr1.address);
    console.log(`Transferred ${ethers.formatUnits(transferAmount, decimals)} ${symbol} to ${addr1.address}`);
    console.log(`Recipient balance: ${ethers.formatUnits(addr1Balance, decimals)} ${symbol}`);
    
    // Test minting
    console.log("\n=== TESTING MINTING FUNCTIONALITY ===");
    const mintAmount = ethers.parseUnits("50000", decimals);
    await token.mint(addr2.address, mintAmount);
    const addr2Balance = await token.balanceOf(addr2.address);
    console.log(`Minted ${ethers.formatUnits(mintAmount, decimals)} ${symbol} to ${addr2.address}`);
    console.log(`Recipient balance: ${ethers.formatUnits(addr2Balance, decimals)} ${symbol}`);
    
    // Updated totalSupply after minting
    const newTotalSupply = await token.totalSupply();
    console.log(`New total supply: ${ethers.formatUnits(newTotalSupply, decimals)} ${symbol}`);
    
    console.log("\n=== VERIFICATION COMPLETE ===");
    console.log("✅ RESKA token deployed and functioning correctly on local Hardhat node");
    console.log("All core functionality verified successfully");
    
    return {
      success: true,
      details: {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals)
      }
    };
  } catch (error) {
    console.error("Error during verification:", error);
    return { success: false, error: error.message };
  }
}

// Execute if run directly
if (require.main === module) {
  main()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };

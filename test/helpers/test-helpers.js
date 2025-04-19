const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Helper to deploy the token with standard parameters for testing
async function deployTokenFixture() {
  const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  
  // Deploy token with all roles assigned to owner for testing simplicity
  const ReskaToken = await ethers.getContractFactory("ReskaToken");
  const token = await ReskaToken.deploy(
    owner.address, // founder
    owner.address, // advisors
    owner.address, // investors
    owner.address, // airdrops
    owner.address, // ecosystem
    owner.address, // treasury
    owner.address, // public sale
    owner.address  // escrow
  );

  return { token, owner, addr1, addr2, addrs };
}

// Helper to deploy vesting contract with token
async function deployVestingFixture() {
  // First deploy the token
  const { token, owner, addr1, addr2, addrs } = await deployTokenFixture();
  
  // Deploy the vesting contract
  const ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
  const vesting = await ReskaTokenVesting.deploy(token.address);
  
  // Constants useful for vesting tests with 6 decimals
  const DECIMALS = 6;
  const VESTING_AMOUNT = ethers.parseUnits("10000000", DECIMALS); // 10 million tokens
  const ONE_DAY = 24 * 60 * 60;
  const ONE_MONTH = 30 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;
  
  // Transfer tokens to the vesting contract
  const vestingAddress = await vesting.getAddress();
  await token.transfer(vestingAddress, VESTING_AMOUNT);
  
  return { 
    token, 
    vesting, 
    owner, 
    beneficiary1: addr1, 
    beneficiary2: addr2,
    addrs,
    constants: {
      DECIMALS,
      VESTING_AMOUNT,
      ONE_DAY,
      ONE_MONTH,
      ONE_YEAR
    }
  };
}

module.exports = {
  deployTokenFixture,
  deployVestingFixture,
  time
};

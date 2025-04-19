const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MinimalReskaTokenVesting", function() {
  // Our main variables
  let reskaToken;
  let reskaTokenVesting;
  let owner;
  let beneficiary1;
  let beneficiary2;
  
  // Constants for testing with 6 decimals
  const DECIMALS = 6;
  const INITIAL_SUPPLY = ethers.parseUnits("1000000000", DECIMALS); // 1 billion tokens
  const VESTING_AMOUNT = ethers.parseUnits("10000000", DECIMALS); // 10 million tokens
  const ONE_MONTH = 30 * 24 * 60 * 60; // 30 days in seconds
  const ONE_YEAR = 365 * 24 * 60 * 60; // 1 year in seconds

  beforeEach(async function() {
    // Get signers
    [owner, beneficiary1, beneficiary2] = await ethers.getSigners();

    // Deploy the token contract
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    reskaToken = await ReskaToken.deploy(
      owner.address,  // founder
      owner.address,  // advisors
      owner.address,  // investors
      owner.address,  // airdrops
      owner.address,  // ecosystem
      owner.address,  // treasury
      owner.address,  // public sale
      owner.address   // escrow
    );

    // Deploy the vesting contract
    const ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
    reskaTokenVesting = await ReskaTokenVesting.deploy(reskaToken.address);
    
    // Transfer tokens to the vesting contract
    await reskaToken.transfer(reskaTokenVesting.address, VESTING_AMOUNT);
  });

  // Basic deployment tests
  describe("Basic Tests", function() {
    it("should have the correct token decimals", async function() {
      // Verify our token uses 6 decimals
      expect(await reskaToken.decimals()).to.equal(DECIMALS);
    });
    
    it("should receive the correct vesting amount", async function() {
      const vestingBalance = await reskaToken.balanceOf(reskaTokenVesting.address);
      expect(vestingBalance).to.equal(VESTING_AMOUNT);
    });
  });
});

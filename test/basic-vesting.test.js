const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BasicVestingTest", function() {
  let token;
  let vesting;
  let owner;
  let beneficiary;
  const DECIMALS = 6;

  beforeEach(async function() {
    [owner, beneficiary] = await ethers.getSigners();
    
    // Deploy token with simplified approach
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    token = await ReskaToken.deploy(
      owner.address, // founder
      owner.address, // advisors
      owner.address, // investors
      owner.address, // airdrops
      owner.address, // ecosystem
      owner.address, // treasury
      owner.address, // public sale
      owner.address  // escrow
    );

    // Deploy vesting contract
    const ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
    vesting = await ReskaTokenVesting.deploy(token.address);
    
    // Verify that token has 6 decimals
    expect(await token.decimals()).to.equal(6);

    // Transfer some tokens to the vesting contract
    const vestingAmount = ethers.parseUnits("100000", DECIMALS);
    await token.transfer(vesting.address, vestingAmount);
  });

  it("should properly setup token with 6 decimals for vesting", async function() {
    // 1. Check that token has 6 decimals
    expect(await token.decimals()).to.equal(6);
    
    // 2. Check vesting contract has the tokens
    const vestingBalance = await token.balanceOf(vesting.address);
    expect(vestingBalance).to.be.gt(0);
    
    // 3. Check that token can be retrieved from vesting contract
    const tokenAddress = await vesting.getToken();
    expect(tokenAddress).to.equal(token.address);
    
    // 4. Log the actual details for clarity
    console.log(`Token deployed with ${await token.decimals()} decimals`);
    console.log(`Vesting contract balance: ${ethers.formatUnits(vestingBalance, DECIMALS)} RESKA`);
    
    // This test just verifies the setup is correct
    // Full vesting logic tests are in the reskatokenvesting.test.js file
  });
});

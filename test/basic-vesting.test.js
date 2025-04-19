const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("BasicVestingTest", function() {
  // Core constants
  const DECIMALS = 6;
  const INITIAL_SUPPLY = ethers.parseUnits("1000000000", DECIMALS); // 1 billion tokens
  const VESTING_AMOUNT = ethers.parseUnits("100000", DECIMALS); // 100,000 tokens

  async function deployFixture() {
    // Get signers
    const [deployer, beneficiary] = await ethers.getSigners();
    
    // Get contract factories directly
    const ReskaTokenFactory = await ethers.getContractFactory("ReskaToken");
    const ReskaTokenVestingFactory = await ethers.getContractFactory("ReskaTokenVesting");
    
    // Deploy token with proper arguments
    const token = await ReskaTokenFactory.deploy(
      deployer.address, // founder
      deployer.address, // advisors
      deployer.address, // investors
      deployer.address, // airdrops
      deployer.address, // ecosystem
      deployer.address, // treasury
      deployer.address, // public sale
      deployer.address  // escrow
    );
    
    // Get token address properly
    const tokenAddress = await token.getAddress();
    console.log("Token deployed at:", tokenAddress);
    
    // Deploy vesting using proper address
    const vesting = await ReskaTokenVestingFactory.deploy(tokenAddress);
    
    // Get vesting address properly
    const vestingAddress = await vesting.getAddress();
    console.log("Vesting deployed at:", vestingAddress);
    
    // Transfer tokens to vesting contract
    await token.transfer(vestingAddress, VESTING_AMOUNT);

    return { token, vesting, deployer, beneficiary };
  }

  it("should properly interact with the vesting contract", async function() {
    // Deploy using our fixture
    const { token, vesting, deployer, beneficiary } = await loadFixture(deployFixture);
    
    // Verify token decimals
    expect(await token.decimals()).to.equal(DECIMALS);
    
    // Get addresses properly
    const tokenAddress = await token.getAddress();
    const vestingAddress = await vesting.getAddress();
    
    // Check vesting contract's token reference
    expect(await vesting.getToken()).to.equal(tokenAddress);
    
    // Check vesting contract balance
    const vestingBalance = await token.balanceOf(vestingAddress);
    expect(vestingBalance).to.equal(VESTING_AMOUNT);
    
    // Log for visibility
    console.log(`Token deployed with ${await token.decimals()} decimals`);
    console.log(`Vesting contract balance: ${ethers.formatUnits(vestingBalance, DECIMALS)} RESKA`);
  });
});

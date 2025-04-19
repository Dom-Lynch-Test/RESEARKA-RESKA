const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReskaTokenVesting", function() {
  let ReskaToken;
  let ReskaTokenVesting;
  let reskaToken;
  let reskaTokenVesting;
  let owner;
  let beneficiary1;
  let beneficiary2;
  let addrs;

  // Constants for testing
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens
  const VESTING_AMOUNT_1 = ethers.utils.parseEther("10000000"); // 10 million tokens
  const VESTING_AMOUNT_2 = ethers.utils.parseEther("5000000"); // 5 million tokens
  const ONE_MONTH = 30 * 24 * 60 * 60; // 30 days in seconds
  const ONE_YEAR = 365 * 24 * 60 * 60; // 1 year in seconds
  const ONE_DAY = 24 * 60 * 60; // 1 day in seconds

  beforeEach(async function() {
    // Get signers
    [owner, beneficiary1, beneficiary2, ...addrs] = await ethers.getSigners();

    // Deploy ReskaToken
    ReskaToken = await ethers.getContractFactory("ReskaToken");
    reskaToken = await ReskaToken.deploy(
      owner.address, // founder
      owner.address, // advisors
      owner.address, // investors
      owner.address, // airdrops
      owner.address, // ecosystem
      owner.address, // treasury
      owner.address, // public sale
      owner.address  // escrow
    );
    await reskaToken.deployed();

    // Deploy ReskaTokenVesting
    ReskaTokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
    reskaTokenVesting = await ReskaTokenVesting.deploy(reskaToken.address);
    await reskaTokenVesting.deployed();

    // Transfer tokens to the vesting contract
    await reskaToken.transfer(reskaTokenVesting.address, VESTING_AMOUNT_1.add(VESTING_AMOUNT_2));
  });

  describe("Deployment", function() {
    it("Should set the right token", async function() {
      expect(await reskaTokenVesting.getToken()).to.equal(reskaToken.address);
    });

    it("Should set the right owner", async function() {
      expect(await reskaTokenVesting.owner()).to.equal(owner.address);
    });

    it("Should have the correct token balance", async function() {
      const balance = await reskaToken.balanceOf(reskaTokenVesting.address);
      expect(balance).to.equal(VESTING_AMOUNT_1.add(VESTING_AMOUNT_2));
    });
  });

  describe("Vesting Schedule Creation", function() {
    it("Should create a vesting schedule", async function() {
      const now = Math.floor(Date.now() / 1000);
      
      await reskaTokenVesting.createVestingSchedule(
        beneficiary1.address,
        now,              // start time
        6 * ONE_MONTH,    // cliff period (6 months)
        ONE_YEAR,         // duration (1 year)
        ONE_MONTH,        // slice period (1 month)
        true,             // revocable
        VESTING_AMOUNT_1  // amount
      );

      // Check vesting schedule count
      expect(await reskaTokenVesting.getVestingSchedulesCount()).to.equal(1);
      
      // Check vesting schedule total amount
      expect(await reskaTokenVesting.getVestingSchedulesTotalAmount()).to.equal(VESTING_AMOUNT_1);
      
      // Check vesting schedule for beneficiary
      expect(await reskaTokenVesting.getVestingSchedulesCountByHolder(beneficiary1.address)).to.equal(1);
      
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary1.address, 0);
      
      // Get vesting schedule
      const vestingSchedule = await reskaTokenVesting.getVestingSchedule(vestingScheduleId);
      
      // Check vesting schedule details
      expect(vestingSchedule.beneficiary).to.equal(beneficiary1.address);
      expect(vestingSchedule.amountTotal).to.equal(VESTING_AMOUNT_1);
      expect(vestingSchedule.released).to.equal(0);
      expect(vestingSchedule.revocable).to.equal(true);
      expect(vestingSchedule.revoked).to.equal(false);
    });

    it("Should fail to create a vesting schedule with zero address", async function() {
      const now = Math.floor(Date.now() / 1000);
      
      await expect(
        reskaTokenVesting.createVestingSchedule(
          ethers.constants.AddressZero,
          now,
          6 * ONE_MONTH,
          ONE_YEAR,
          ONE_MONTH,
          true,
          VESTING_AMOUNT_1
        )
      ).to.be.revertedWith("TokenVesting: beneficiary cannot be zero address");
    });

    it("Should fail to create a vesting schedule with zero amount", async function() {
      const now = Math.floor(Date.now() / 1000);
      
      await expect(
        reskaTokenVesting.createVestingSchedule(
          beneficiary1.address,
          now,
          6 * ONE_MONTH,
          ONE_YEAR,
          ONE_MONTH,
          true,
          0
        )
      ).to.be.revertedWith("TokenVesting: amount must be > 0");
    });
  });

  describe("Token Release", function() {
    beforeEach(async function() {
      // Create a vesting schedule
      const now = Math.floor(Date.now() / 1000);
      
      await reskaTokenVesting.createVestingSchedule(
        beneficiary1.address,
        now,              // start time
        6 * ONE_MONTH,    // cliff period (6 months)
        ONE_YEAR,         // duration (1 year)
        ONE_MONTH,        // slice period (1 month)
        true,             // revocable
        VESTING_AMOUNT_1  // amount
      );
    });

    it("Should not release tokens before cliff", async function() {
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary1.address, 0);
      
      // Try to release tokens
      await expect(
        reskaTokenVesting.connect(beneficiary1).release(vestingScheduleId)
      ).to.be.revertedWith("TokenVesting: no tokens are due");
    });

    it("Should release tokens after cliff", async function() {
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary1.address, 0);
      
      // Advance time past cliff (6 months + 1 day)
      await ethers.provider.send("evm_increaseTime", [6 * ONE_MONTH + ONE_DAY]);
      await ethers.provider.send("evm_mine");
      
      // Release tokens
      await reskaTokenVesting.connect(beneficiary1).release(vestingScheduleId);
      
      // Check beneficiary balance
      const balance = await reskaToken.balanceOf(beneficiary1.address);
      expect(balance).to.be.gt(0);
      
      // Get vesting schedule
      const vestingSchedule = await reskaTokenVesting.getVestingSchedule(vestingScheduleId);
      
      // Check released amount
      expect(vestingSchedule.released).to.equal(balance);
    });

    it("Should release all tokens after vesting period", async function() {
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary1.address, 0);
      
      // Advance time past vesting period (1 year + 1 day)
      await ethers.provider.send("evm_increaseTime", [ONE_YEAR + ONE_DAY]);
      await ethers.provider.send("evm_mine");
      
      // Release tokens
      await reskaTokenVesting.connect(beneficiary1).release(vestingScheduleId);
      
      // Check beneficiary balance
      const balance = await reskaToken.balanceOf(beneficiary1.address);
      expect(balance).to.equal(VESTING_AMOUNT_1);
      
      // Get vesting schedule
      const vestingSchedule = await reskaTokenVesting.getVestingSchedule(vestingScheduleId);
      
      // Check released amount
      expect(vestingSchedule.released).to.equal(VESTING_AMOUNT_1);
    });
  });

  describe("Vesting Revocation", function() {
    beforeEach(async function() {
      // Create a revocable vesting schedule
      const now = Math.floor(Date.now() / 1000);
      
      await reskaTokenVesting.createVestingSchedule(
        beneficiary1.address,
        now,              // start time
        6 * ONE_MONTH,    // cliff period (6 months)
        ONE_YEAR,         // duration (1 year)
        ONE_MONTH,        // slice period (1 month)
        true,             // revocable
        VESTING_AMOUNT_1  // amount
      );
      
      // Create a non-revocable vesting schedule
      await reskaTokenVesting.createVestingSchedule(
        beneficiary2.address,
        now,              // start time
        6 * ONE_MONTH,    // cliff period (6 months)
        ONE_YEAR,         // duration (1 year)
        ONE_MONTH,        // slice period (1 month)
        false,            // not revocable
        VESTING_AMOUNT_2  // amount
      );
    });

    it("Should revoke a revocable vesting schedule", async function() {
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary1.address, 0);
      
      // Advance time past cliff (6 months + 1 day)
      await ethers.provider.send("evm_increaseTime", [6 * ONE_MONTH + ONE_DAY]);
      await ethers.provider.send("evm_mine");
      
      // Revoke vesting schedule
      await reskaTokenVesting.revoke(vestingScheduleId);
      
      // Get vesting schedule
      const vestingSchedule = await reskaTokenVesting.getVestingSchedule(vestingScheduleId);
      
      // Check revoked status
      expect(vestingSchedule.revoked).to.equal(true);
      
      // Check that some tokens were released to the beneficiary
      const balance = await reskaToken.balanceOf(beneficiary1.address);
      expect(balance).to.be.gt(0);
      
      // Check that the released amount matches the beneficiary balance
      expect(vestingSchedule.released).to.equal(balance);
    });

    it("Should not revoke a non-revocable vesting schedule", async function() {
      // Get vesting schedule ID
      const vestingScheduleId = await reskaTokenVesting.getVestingScheduleIdAtHolderIndex(beneficiary2.address, 0);
      
      // Try to revoke vesting schedule
      await expect(
        reskaTokenVesting.revoke(vestingScheduleId)
      ).to.be.revertedWith("TokenVesting: vesting schedule is not revocable");
    });
  });

  describe("Withdrawal", function() {
    beforeEach(async function() {
      // Create a vesting schedule using half of the tokens
      const now = Math.floor(Date.now() / 1000);
      
      await reskaTokenVesting.createVestingSchedule(
        beneficiary1.address,
        now,              // start time
        6 * ONE_MONTH,    // cliff period (6 months)
        ONE_YEAR,         // duration (1 year)
        ONE_MONTH,        // slice period (1 month)
        true,             // revocable
        VESTING_AMOUNT_1  // amount (half of the total)
      );
    });

    it("Should allow owner to withdraw non-vested tokens", async function() {
      // Check initial balance
      const initialBalance = await reskaToken.balanceOf(owner.address);
      
      // Withdraw non-vested tokens
      await reskaTokenVesting.withdraw(VESTING_AMOUNT_2);
      
      // Check final balance
      const finalBalance = await reskaToken.balanceOf(owner.address);
      
      // Check that the owner received the tokens
      expect(finalBalance.sub(initialBalance)).to.equal(VESTING_AMOUNT_2);
    });

    it("Should not allow withdrawing more than non-vested tokens", async function() {
      // Try to withdraw more than non-vested tokens
      await expect(
        reskaTokenVesting.withdraw(VESTING_AMOUNT_1.add(VESTING_AMOUNT_2))
      ).to.be.revertedWith("TokenVesting: cannot withdraw vested tokens");
    });
  });
});

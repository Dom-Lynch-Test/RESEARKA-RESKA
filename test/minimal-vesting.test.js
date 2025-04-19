const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployVestingFixture, time } = require("./helpers/test-helpers");

describe("MinimalReskaTokenVesting", function() {
  // Basic deployment tests
  describe("Basic Tests", function() {
    it("should have the correct token decimals", async function() {
      const { token, constants } = await loadFixture(deployVestingFixture);
      
      // Verify our token uses 6 decimals
      expect(await token.decimals()).to.equal(constants.DECIMALS);
    });
    
    it("should receive the correct vesting amount", async function() {
      const { token, vesting, constants } = await loadFixture(deployVestingFixture);
      
      const vestingAddress = await vesting.getAddress();
      const vestingBalance = await token.balanceOf(vestingAddress);
      expect(vestingBalance).to.equal(constants.VESTING_AMOUNT);
    });
    
    it("should expose the token address", async function() {
      const { token, vesting } = await loadFixture(deployVestingFixture);
      
      const tokenAddress = await token.getAddress();
      expect(await vesting.getToken()).to.equal(tokenAddress);
    });
  });
  
  // Test schedule creation
  describe("Schedule Creation", function() {
    it("should create a vesting schedule", async function() {
      const { vesting, beneficiary1, owner, constants } = await loadFixture(deployVestingFixture);
      
      const amount = ethers.parseUnits("1000", constants.DECIMALS);
      const now = await time.latest();
      const startTime = now;
      const cliff = constants.ONE_MONTH;
      const duration = constants.ONE_YEAR;
      const slicePeriodSeconds = constants.ONE_DAY;
      const revocable = true;
      
      const tx = await vesting.createVestingSchedule(
        await beneficiary1.getAddress(),
        startTime,
        cliff,
        duration,
        slicePeriodSeconds,
        revocable,
        amount
      );
      
      // Check event emission
      await expect(tx)
        .to.emit(vesting, "VestingScheduleCreated")
        .withArgs(await beneficiary1.getAddress(), amount);
      
      // Verify schedule exists
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        await beneficiary1.getAddress(),
        0
      );
      
      // Get the schedule and verify its properties
      const schedule = await vesting.getVestingSchedule(scheduleId);
      expect(schedule.beneficiary).to.equal(await beneficiary1.getAddress());
      expect(schedule.amountTotal).to.equal(amount);
    });
  });
});

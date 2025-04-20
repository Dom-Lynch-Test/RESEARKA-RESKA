/**
 * RESKA Token Vesting Fuzz Tests
 * 
 * This suite uses property-based testing to validate the vesting
 * implementation across a wide range of parameters, time periods,
 * and edge cases.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = ethers.utils;
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { MaxUint256 } = ethers.constants;

// Random number utilities for fuzzing
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBigNumber(min, max) {
  const range = max.sub(min);
  const randomValue = ethers.BigNumber.from(ethers.utils.randomBytes(32)).mod(range).add(min);
  return randomValue;
}

describe("RESKA Token Vesting Fuzz Tests", function() {
  // Test constants
  const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
  const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
  const DAY_IN_SECONDS = 24 * 60 * 60;
  const DECIMALS = 6;
  const MIN_AMOUNT = parseUnits("1", DECIMALS);
  const MAX_AMOUNT = parseUnits("10000000", DECIMALS); // 10M tokens
  
  // Test fixtures
  let ReskaToken, TokenVesting;
  let token, vesting;
  let owner, beneficiary1, beneficiary2, beneficiary3, accounts;
  let startTime;
  
  before(async function() {
    // Load contract factories
    ReskaToken = await ethers.getContractFactory("ReskaToken");
    TokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
  });
  
  beforeEach(async function() {
    // Get signers
    [owner, beneficiary1, beneficiary2, beneficiary3, ...accounts] = await ethers.getSigners();
    
    // Deploy token with all roles assigned to owner
    token = await ReskaToken.deploy(
      owner.address, // founder
      owner.address, // advisors
      owner.address, // investors
      owner.address, // airdrops
      owner.address, // ecosystem
      owner.address, // treasury
      owner.address, // publicSale
      owner.address  // escrow
    );
    await token.deployed();
    
    // Deploy vesting contract
    vesting = await TokenVesting.deploy(token.address);
    await vesting.deployed();
    
    // Mint tokens to owner
    const initialSupply = parseUnits("1000000000", DECIMALS); // 1B tokens
    await token.mint(owner.address, initialSupply);
    
    // Fund vesting contract
    await token.transfer(vesting.address, initialSupply.div(2)); // 500M tokens
    
    // Set current block timestamp as the base for tests
    startTime = (await ethers.provider.getBlock('latest')).timestamp;
  });
  
  /**
   * Fuzz test for standard vesting schedule creation
   * Tests multiple random combinations of:
   * - Cliff periods
   * - Vesting durations
   * - Slice periods
   * - Amounts
   */
  it("should correctly release tokens according to various vesting schedules - fuzz test", async function() {
    // Run multiple test iterations with random parameters
    for (let i = 0; i < 10; i++) {
      // Generate random parameters (bounded within reasonable ranges)
      const cliffPeriod = randomInt(0, YEAR_IN_SECONDS * 2); // 0 to 2 years
      const duration = randomInt(cliffPeriod, cliffPeriod + YEAR_IN_SECONDS * 3); // cliff to cliff+3 years
      const slicePeriod = randomInt(DAY_IN_SECONDS, MONTH_IN_SECONDS * 6); // 1 day to 6 months
      const amount = randomBigNumber(MIN_AMOUNT, MAX_AMOUNT);
      const revocable = Math.random() > 0.5; // 50% chance of being revocable
      
      // Log test parameters
      console.log(`\nTest #${i+1}:`);
      console.log(`- Cliff: ${cliffPeriod} seconds`);
      console.log(`- Duration: ${duration} seconds`);
      console.log(`- Slice period: ${slicePeriod} seconds`);
      console.log(`- Amount: ${formatUnits(amount, DECIMALS)} RESKA`);
      console.log(`- Revocable: ${revocable}`);
      
      // Create vesting schedule
      await vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        cliffPeriod,
        duration,
        slicePeriod,
        revocable,
        amount
      );
      
      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary1.address, i);
      
      // Verify the schedule was created correctly
      const schedule = await vesting.getVestingSchedule(scheduleId);
      expect(schedule.beneficiary).to.equal(beneficiary1.address);
      expect(schedule.cliff).to.equal(startTime + cliffPeriod);
      expect(schedule.start).to.equal(startTime);
      expect(schedule.duration).to.equal(duration);
      expect(schedule.slicePeriodSeconds).to.equal(slicePeriod);
      expect(schedule.amountTotal).to.equal(amount);
      expect(schedule.released).to.equal(0);
      expect(schedule.revocable).to.equal(revocable);
      
      // Time-travel to various points and check releases
      const testPoints = [
        Math.floor(cliffPeriod / 2),               // Before cliff
        cliffPeriod + 1,                           // Just after cliff
        cliffPeriod + Math.floor(duration / 4),    // 25% through vesting
        cliffPeriod + Math.floor(duration / 2),    // 50% through vesting
        cliffPeriod + Math.floor(duration * 3 / 4),// 75% through vesting
        cliffPeriod + duration + 1                 // After vesting complete
      ];
      
      for (const timePoint of testPoints) {
        // Time-travel
        await time.increaseTo(startTime + timePoint);
        
        // Calculate expected releasable amount
        let expectedReleasable;
        
        if (timePoint < cliffPeriod) {
          // Before cliff, nothing is releasable
          expectedReleasable = ethers.BigNumber.from(0);
        } else if (timePoint >= cliffPeriod + duration) {
          // After vesting period, everything should be releasable
          expectedReleasable = amount.sub(schedule.released);
        } else {
          // During vesting period, calculate based on elapsed time
          const timeFromCliff = timePoint - cliffPeriod;
          const vestedSlices = Math.floor(timeFromCliff / slicePeriod) + 1;
          const totalSlices = Math.ceil(duration / slicePeriod);
          expectedReleasable = amount.mul(vestedSlices).div(totalSlices).sub(schedule.released);
        }
        
        // Check contract's releasable amount calculation
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);
        
        // We allow for a small rounding difference due to integer division
        const tolerance = parseUnits("1", 0); // 1 token unit tolerance
        expect(actualReleasable).to.be.closeTo(expectedReleasable, tolerance);
        
        // If releasable amount exists, release tokens and verify balances
        if (actualReleasable.gt(0)) {
          const beneficiaryBalanceBefore = await token.balanceOf(beneficiary1.address);
          
          // Release tokens
          await vesting.connect(beneficiary1).release(scheduleId, actualReleasable);
          
          // Verify beneficiary received tokens
          const beneficiaryBalanceAfter = await token.balanceOf(beneficiary1.address);
          expect(beneficiaryBalanceAfter).to.equal(beneficiaryBalanceBefore.add(actualReleasable));
          
          // Verify schedule updated
          const updatedSchedule = await vesting.getVestingSchedule(scheduleId);
          expect(updatedSchedule.released).to.equal(schedule.released.add(actualReleasable));
          
          // Update our reference
          schedule.released = updatedSchedule.released;
        }
      }
      
      // Try revocation if schedule is revocable
      if (revocable) {
        // Check if there are tokens left to revoke
        const remainingAmount = amount.sub(schedule.released);
        
        if (remainingAmount.gt(0)) {
          const ownerBalanceBefore = await token.balanceOf(owner.address);
          
          // Revoke the schedule
          await vesting.revoke(scheduleId);
          
          // Verify owner received the remaining tokens
          const ownerBalanceAfter = await token.balanceOf(owner.address);
          expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(remainingAmount));
          
          // Verify schedule is revoked
          const revokedSchedule = await vesting.getVestingSchedule(scheduleId);
          expect(revokedSchedule.revoked).to.equal(true);
        }
      }
    }
  });
  
  /**
   * Fuzz test for multiple simultaneous vesting schedules
   * Validates that different beneficiaries with different schedules
   * can release their tokens independently
   */
  it("should handle multiple vesting schedules correctly - fuzz test", async function() {
    const numBeneficiaries = 3;
    const beneficiaries = [beneficiary1, beneficiary2, beneficiary3];
    const scheduleIds = [];
    const scheduleParams = [];
    
    // Create multiple schedules with different parameters
    for (let i = 0; i < numBeneficiaries; i++) {
      const cliffPeriod = randomInt(0, YEAR_IN_SECONDS);
      const duration = randomInt(cliffPeriod + MONTH_IN_SECONDS, cliffPeriod + YEAR_IN_SECONDS * 2);
      const slicePeriod = randomInt(DAY_IN_SECONDS, MONTH_IN_SECONDS * 3);
      const amount = randomBigNumber(MIN_AMOUNT, MAX_AMOUNT);
      const revocable = Math.random() > 0.5;
      
      // Store parameters for later verification
      scheduleParams.push({
        beneficiary: beneficiaries[i],
        cliffPeriod,
        duration,
        slicePeriod,
        amount,
        revocable,
        released: ethers.BigNumber.from(0)
      });
      
      // Create vesting schedule
      await vesting.createVestingSchedule(
        beneficiaries[i].address,
        startTime,
        cliffPeriod,
        duration,
        slicePeriod,
        revocable,
        amount
      );
      
      // Store schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiaries[i].address, i);
      scheduleIds.push(scheduleId);
    }
    
    // Test at various time points
    const timePoints = [
      MONTH_IN_SECONDS * 3,    // 3 months
      MONTH_IN_SECONDS * 6,    // 6 months
      YEAR_IN_SECONDS,         // 1 year
      YEAR_IN_SECONDS * 2,     // 2 years
      YEAR_IN_SECONDS * 3      // 3 years
    ];
    
    for (const timePoint of timePoints) {
      // Time-travel
      await time.increaseTo(startTime + timePoint);
      
      // Check each beneficiary's vesting schedule
      for (let i = 0; i < numBeneficiaries; i++) {
        const params = scheduleParams[i];
        const scheduleId = scheduleIds[i];
        
        // Calculate expected releasable amount
        let expectedReleasable;
        
        if (timePoint < params.cliffPeriod) {
          // Before cliff
          expectedReleasable = ethers.BigNumber.from(0);
        } else if (timePoint >= params.cliffPeriod + params.duration) {
          // After vesting completion
          expectedReleasable = params.amount.sub(params.released);
        } else {
          // During vesting period
          const timeFromCliff = timePoint - params.cliffPeriod;
          const vestedSlices = Math.floor(timeFromCliff / params.slicePeriod) + 1;
          const totalSlices = Math.ceil(params.duration / params.slicePeriod);
          expectedReleasable = params.amount.mul(vestedSlices).div(totalSlices).sub(params.released);
        }
        
        // Get actual releasable amount
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);
        
        // Allow for small rounding errors
        const tolerance = parseUnits("1", 0);
        expect(actualReleasable).to.be.closeTo(expectedReleasable, tolerance);
        
        // Release tokens if available
        if (actualReleasable.gt(0)) {
          const balanceBefore = await token.balanceOf(params.beneficiary.address);
          
          // Release tokens
          await vesting.connect(params.beneficiary).release(scheduleId, actualReleasable);
          
          // Verify balance change
          const balanceAfter = await token.balanceOf(params.beneficiary.address);
          expect(balanceAfter).to.equal(balanceBefore.add(actualReleasable));
          
          // Update released amount for future calculations
          params.released = params.released.add(actualReleasable);
        }
      }
    }
  });
  
  /**
   * Test edge cases and error handling
   */
  it("should handle edge cases and errors correctly - fuzz test", async function() {
    // Edge case: Zero amount vesting schedule
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        0
      )
    ).to.be.revertedWith("TokenVesting: amount must be > 0");
    
    // Edge case: Zero duration vesting schedule
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        0,
        MONTH_IN_SECONDS,
        false,
        parseUnits("1000", DECIMALS)
      )
    ).to.be.revertedWith("TokenVesting: duration must be > 0");
    
    // Edge case: Zero slice period
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        YEAR_IN_SECONDS,
        0,
        false,
        parseUnits("1000", DECIMALS)
      )
    ).to.be.revertedWith("TokenVesting: slicePeriodSeconds must be > 0");
    
    // Edge case: Very large values
    const largeAmount = MaxUint256;
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        YEAR_IN_SECONDS,
        YEAR_IN_SECONDS * 10,
        MONTH_IN_SECONDS,
        false,
        largeAmount
      )
    ).to.be.reverted; // Will revert due to insufficient balance
    
    // Edge case: Release more than releasable
    // First create a valid schedule
    const amount = parseUnits("1000", DECIMALS);
    await vesting.createVestingSchedule(
      beneficiary1.address,
      startTime,
      YEAR_IN_SECONDS,
      YEAR_IN_SECONDS * 2,
      MONTH_IN_SECONDS,
      false,
      amount
    );
    
    const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary1.address, 0);
    
    // Try to release tokens before cliff
    await expect(
      vesting.connect(beneficiary1).release(scheduleId, amount)
    ).to.be.revertedWith("TokenVesting: cannot release tokens, not enough vested tokens");
    
    // Time travel past cliff, release half, then try to release too much
    await time.increaseTo(startTime + YEAR_IN_SECONDS + YEAR_IN_SECONDS / 2); // 50% through vesting after cliff
    
    const releasable = await vesting.computeReleasableAmount(scheduleId);
    await vesting.connect(beneficiary1).release(scheduleId, releasable);
    
    // Try to release more
    await expect(
      vesting.connect(beneficiary1).release(scheduleId, 1)
    ).to.be.revertedWith("TokenVesting: cannot release tokens, not enough vested tokens");
    
    // Edge case: Attempt to release from non-existent schedule
    const fakeScheduleId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nonexistent"));
    await expect(
      vesting.connect(beneficiary1).release(fakeScheduleId, 1)
    ).to.be.reverted;
    
    // Edge case: Non-owner trying to revoke
    const validCliff = MONTH_IN_SECONDS * 6;
    const validDuration = YEAR_IN_SECONDS;
    const validAmount = parseUnits("5000", DECIMALS);
    
    await vesting.createVestingSchedule(
      beneficiary2.address,
      startTime,
      validCliff,
      validDuration,
      MONTH_IN_SECONDS,
      true, // revocable
      validAmount
    );
    
    const revocableScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary2.address, 0);
    
    // Non-owner attempt to revoke
    await expect(
      vesting.connect(beneficiary2).revoke(revocableScheduleId)
    ).to.be.reverted; // Access control revert
    
    // Owner can revoke
    await vesting.revoke(revocableScheduleId);
    
    // Edge case: Try to revoke already revoked schedule
    await expect(
      vesting.revoke(revocableScheduleId)
    ).to.be.revertedWith("TokenVesting: vesting schedule already revoked");
  });
  
  /**
   * Test specific RESKA vesting schedules defined in the project
   */
  it("should correctly implement RESKA vesting schedules", async function() {
    // Founder vesting: 50% immediate, 50% 1-year cliff
    const founderAmount = parseUnits("100000000", DECIMALS); // 100M RESKA
    const immediateAmount = founderAmount.div(2);
    const vestedAmount = founderAmount.sub(immediateAmount);
    
    // Transfer immediate amount
    await token.transfer(beneficiary1.address, immediateAmount);
    
    // Create vesting for the rest
    await vesting.createVestingSchedule(
      beneficiary1.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS, // Monthly releases
      false, // Not revocable
      vestedAmount
    );
    
    // Advisor vesting: 1-year cliff, then quarterly releases (25% each)
    const advisorAmount = parseUnits("50000000", DECIMALS); // 50M RESKA
    await vesting.createVestingSchedule(
      beneficiary2.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year duration (four quarters)
      MONTH_IN_SECONDS * 3, // Quarterly releases
      false, // Not revocable
      advisorAmount
    );
    
    // Ecosystem development: Linear vesting over 2 years (no cliff)
    const ecosystemAmount = parseUnits("100000000", DECIMALS); // 100M RESKA
    await vesting.createVestingSchedule(
      beneficiary3.address,
      startTime,
      0, // No cliff
      YEAR_IN_SECONDS * 2, // 2-year duration
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      ecosystemAmount
    );
    
    // Get schedule IDs
    const founderScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary1.address, 0);
    const advisorScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary2.address, 0);
    const ecosystemScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(beneficiary3.address, 0);
    
    // Time points to test
    const timePoints = [
      { description: "6 months (before cliffs)", time: MONTH_IN_SECONDS * 6 },
      { description: "1 year (after founder/advisor cliff)", time: YEAR_IN_SECONDS },
      { description: "1 year + 3 months (after 1st advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 3 },
      { description: "1 year + 6 months (after 2nd advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 6 },
      { description: "1 year + 9 months (after 3rd advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 9 },
      { description: "2 years (after all vesting complete)", time: YEAR_IN_SECONDS * 2 }
    ];
    
    for (const { description, time } of timePoints) {
      console.log(`\nTesting at ${description}:`);
      
      // Time travel
      await time.increaseTo(startTime + time);
      
      // Check founder vesting
      const founderReleasable = await vesting.computeReleasableAmount(founderScheduleId);
      console.log(`- Founder releasable: ${formatUnits(founderReleasable, DECIMALS)} RESKA`);
      
      // Check advisor vesting
      const advisorReleasable = await vesting.computeReleasableAmount(advisorScheduleId);
      console.log(`- Advisor releasable: ${formatUnits(advisorReleasable, DECIMALS)} RESKA`);
      
      // Check ecosystem vesting
      const ecosystemReleasable = await vesting.computeReleasableAmount(ecosystemScheduleId);
      console.log(`- Ecosystem releasable: ${formatUnits(ecosystemReleasable, DECIMALS)} RESKA`);
      
      // Verify expected token releases
      // Founder
      if (time < YEAR_IN_SECONDS) {
        // Before cliff, nothing should be releasable
        expect(founderReleasable).to.equal(0);
      } else if (time >= YEAR_IN_SECONDS * 2) {
        // After vesting, all tokens should be releasable
        expect(founderReleasable).to.equal(vestedAmount);
      } else {
        // During vesting, proportional amount should be releasable
        const vestedProportion = (time - YEAR_IN_SECONDS) / YEAR_IN_SECONDS;
        const expectedReleasable = vestedAmount.mul(Math.floor(vestedProportion * 12 + 1)).div(12);
        expect(founderReleasable).to.be.closeTo(expectedReleasable, parseUnits("1", DECIMALS));
      }
      
      // Advisor
      if (time < YEAR_IN_SECONDS) {
        // Before cliff, nothing should be releasable
        expect(advisorReleasable).to.equal(0);
      } else if (time >= YEAR_IN_SECONDS * 2) {
        // After vesting, all tokens should be releasable
        expect(advisorReleasable).to.equal(advisorAmount);
      } else {
        // During vesting, quarterly releases
        const quartersPassed = Math.floor((time - YEAR_IN_SECONDS) / (MONTH_IN_SECONDS * 3)) + 1;
        const expectedReleasable = advisorAmount.mul(quartersPassed).div(4);
        expect(advisorReleasable).to.be.closeTo(expectedReleasable, parseUnits("1", DECIMALS));
      }
      
      // Ecosystem (linear from start)
      if (time >= YEAR_IN_SECONDS * 2) {
        // After vesting, all tokens should be releasable
        expect(ecosystemReleasable).to.equal(ecosystemAmount);
      } else {
        // During vesting, linear release
        const vestedProportion = time / (YEAR_IN_SECONDS * 2);
        const expectedReleasable = ecosystemAmount.mul(Math.floor(vestedProportion * 24 + 1)).div(24);
        expect(ecosystemReleasable).to.be.closeTo(expectedReleasable, parseUnits("1", DECIMALS));
      }
      
      // Release tokens for each beneficiary
      if (founderReleasable.gt(0)) {
        await vesting.connect(beneficiary1).release(founderScheduleId, founderReleasable);
      }
      
      if (advisorReleasable.gt(0)) {
        await vesting.connect(beneficiary2).release(advisorScheduleId, advisorReleasable);
      }
      
      if (ecosystemReleasable.gt(0)) {
        await vesting.connect(beneficiary3).release(ecosystemScheduleId, ecosystemReleasable);
      }
    }
  });
});

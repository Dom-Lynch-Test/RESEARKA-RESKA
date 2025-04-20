/**
 * RESKA Token Vesting Fuzz Tests
 *
 * This suite uses property-based testing to validate the vesting
 * implementation across a wide range of parameters, time periods,
 * and edge cases.
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers.utils;
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const fc = require('fast-check');

describe('RESKA Token Vesting Fuzz Tests', function () {
  // Test constants
  const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
  const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
  const DAY_IN_SECONDS = 24 * 60 * 60;
  const DECIMALS = 6;
  const MIN_AMOUNT = parseUnits('1', DECIMALS);
  const MAX_AMOUNT = parseUnits('10000000', DECIMALS); // 10M tokens

  /**
   * Deploy the token and vesting contracts for testing
   */
  async function deployVestingFixture() {
    // Get signers
    const [owner, beneficiary1, beneficiary2, beneficiary3] = await ethers.getSigners();

    // Load contract factories
    const ReskaToken = await ethers.getContractFactory('ReskaToken');
    const TokenVesting = await ethers.getContractFactory('ReskaTokenVesting');

    // Deploy token with all roles assigned to owner
    const token = await ReskaToken.deploy(
      owner.address, // founder
      owner.address, // advisors
      owner.address, // investors
      owner.address, // airdrops
      owner.address, // ecosystem
      owner.address, // treasury
      owner.address, // publicSale
      owner.address // escrow
    );
    await token.deployed();

    // Deploy vesting contract
    const vesting = await TokenVesting.deploy(token.address);
    await vesting.deployed();

    // Mint tokens to owner
    const initialSupply = parseUnits('1000000000', DECIMALS); // 1B tokens
    await token.mint(owner.address, initialSupply);

    // Fund vesting contract
    await token.transfer(vesting.address, initialSupply.div(2)); // 500M tokens

    // Set current block timestamp as the base for tests
    const startTime = (await ethers.provider.getBlock('latest')).timestamp;

    return {
      token,
      vesting,
      owner,
      beneficiary1,
      beneficiary2,
      beneficiary3,
      startTime,
      initialSupply,
    };
  }

  /**
   * Helper to generate deterministic BigNumber based on a seed
   * @param {BigNumber} min - Minimum value
   * @param {BigNumber} max - Maximum value
   * @param {number} seed - Seed for deterministic generation
   * @returns {BigNumber} - Deterministic value between min and max
   */
  function deterministicBigNumber(min, max, seed) {
    const hash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['uint256'], [seed]));
    const range = max.sub(min);
    return min.add(ethers.BigNumber.from(hash).mod(range));
  }

  /**
   * Individual fuzz tests for each parameter set
   * Each test is isolated with its own contract deployment
   */
  for (let testIndex = 1; testIndex <= 5; testIndex++) {
    it(`should correctly handle vesting schedule with parameter set #${testIndex}`, async function () {
      // Use separate test fixture for each test case
      const { token, vesting, owner, beneficiary1, startTime } =
        await loadFixture(deployVestingFixture);

      // Generate deterministic parameters based on test index
      // We use the testIndex to seed our "random" values, making them reproducible
      const cliffPeriod = deterministicBigNumber(
        ethers.BigNumber.from(0),
        ethers.BigNumber.from(YEAR_IN_SECONDS * 2),
        testIndex * 1000 + 1
      ).toNumber();

      const duration = deterministicBigNumber(
        ethers.BigNumber.from(MONTH_IN_SECONDS),
        ethers.BigNumber.from(YEAR_IN_SECONDS * 3),
        testIndex * 1000 + 2
      ).toNumber();

      const slicePeriod = deterministicBigNumber(
        ethers.BigNumber.from(DAY_IN_SECONDS),
        ethers.BigNumber.from(MONTH_IN_SECONDS * 6),
        testIndex * 1000 + 3
      ).toNumber();

      const amount = deterministicBigNumber(MIN_AMOUNT, MAX_AMOUNT, testIndex * 1000 + 4);

      // Deterministic boolean based on test index
      const revocable = testIndex % 2 === 0;

      // Create vesting schedule with these parameters
      await vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        cliffPeriod,
        duration,
        slicePeriod,
        revocable,
        amount
      );

      // Get the schedule ID - using the correct index (0 for first schedule)
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        beneficiary1.address,
        0 // This is correct here as we create only one schedule per beneficiary per test
      );

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
        Math.floor(cliffPeriod / 2), // Before cliff
        cliffPeriod + 1, // Just after cliff
        cliffPeriod + Math.floor(duration / 4), // 25% through vesting
        cliffPeriod + Math.floor(duration / 2), // 50% through vesting
        cliffPeriod + Math.floor((duration * 3) / 4), // 75% through vesting
        cliffPeriod + duration + 1, // After vesting complete
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
        const tolerance = parseUnits('1', 0); // 1 token unit tolerance
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

          // Update our reference for next iteration
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
        }
      }
    });
  }

  /**
   * Test multiple beneficiaries with different vesting schedules
   * This uses fast-check for property-based testing
   */
  it('should handle multiple beneficiaries with different vesting schedules', async function () {
    await fc.assert(
      fc.asyncProperty(
        // Generate parameters for three different beneficiaries
        fc.tuple(
          fc.integer(0, YEAR_IN_SECONDS).noShrink(), // cliff1
          fc.integer(MONTH_IN_SECONDS, YEAR_IN_SECONDS * 3).noShrink(), // duration1
          fc.integer(0, YEAR_IN_SECONDS).noShrink(), // cliff2
          fc.integer(MONTH_IN_SECONDS, YEAR_IN_SECONDS * 3).noShrink(), // duration2
          fc.integer(0, YEAR_IN_SECONDS).noShrink(), // cliff3
          fc.integer(MONTH_IN_SECONDS, YEAR_IN_SECONDS * 3).noShrink() // duration3
        ),

        async ([cliff1, duration1, cliff2, duration2, cliff3, duration3]) => {
          // Deploy fresh contracts for each property test
          const { vesting, beneficiary1, beneficiary2, beneficiary3, startTime } =
            await loadFixture(deployVestingFixture);

          // Fixed slice period for simplicity
          const slicePeriod = MONTH_IN_SECONDS;

          // Create amounts for each beneficiary (deterministic)
          const amount1 = parseUnits('1000000', DECIMALS);
          const amount2 = parseUnits('2000000', DECIMALS);
          const amount3 = parseUnits('3000000', DECIMALS);

          // Create three different vesting schedules
          await vesting.createVestingSchedule(
            beneficiary1.address,
            startTime,
            cliff1,
            duration1,
            slicePeriod,
            false,
            amount1
          );

          await vesting.createVestingSchedule(
            beneficiary2.address,
            startTime,
            cliff2,
            duration2,
            slicePeriod,
            true,
            amount2
          );

          await vesting.createVestingSchedule(
            beneficiary3.address,
            startTime,
            cliff3,
            duration3,
            slicePeriod,
            false,
            amount3
          );

          // Get correct schedule IDs for each beneficiary (first schedule for each)
          const scheduleId1 = await vesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiary1.address,
            0
          );
          const scheduleId2 = await vesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiary2.address,
            0
          );
          const scheduleId3 = await vesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiary3.address,
            0
          );

          // Time travel to halfway through the longest duration
          const maxDuration = Math.max(cliff1 + duration1, cliff2 + duration2, cliff3 + duration3);
          const midpoint = Math.floor(maxDuration / 2);

          await time.increaseTo(startTime + midpoint);

          // Check releasable amounts for each beneficiary
          const releasable1 = await vesting.computeReleasableAmount(scheduleId1);
          const releasable2 = await vesting.computeReleasableAmount(scheduleId2);
          const releasable3 = await vesting.computeReleasableAmount(scheduleId3);

          // Validate that schedules with passed cliffs have releasable amounts
          if (midpoint > cliff1) {
            // If we're past the cliff, should have releasable tokens
            expect(releasable1).to.be.gt(0);
          } else {
            // Before cliff, nothing is releasable
            expect(releasable1).to.equal(0);
          }

          if (midpoint > cliff2) {
            expect(releasable2).to.be.gt(0);
          } else {
            expect(releasable2).to.equal(0);
          }

          if (midpoint > cliff3) {
            expect(releasable3).to.be.gt(0);
          } else {
            expect(releasable3).to.equal(0);
          }

          return true;
        }
      ),
      { numRuns: 3 } // Limit to 3 test cases for reasonable test time
    );
  });

  /**
   * Test specific RESKA vesting schedules with exact parameters
   */
  it('should validate the specific RESKA vesting schedules', async function () {
    const { vesting, beneficiary1, beneficiary2, startTime } =
      await loadFixture(deployVestingFixture);

    const founderAmount = parseUnits('5000000', DECIMALS);
    const advisorAmount = parseUnits('2500000', DECIMALS);

    // Create founder schedule (50% with 1-year cliff, then monthly releases)
    await vesting.createVestingSchedule(
      beneficiary1.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS, // Monthly releases
      false, // Not revocable
      founderAmount
    );

    // Create advisor schedule (1-year cliff, then quarterly releases)
    await vesting.createVestingSchedule(
      beneficiary2.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS * 3, // Quarterly releases
      false, // Not revocable
      advisorAmount
    );

    // Get the correct schedule IDs
    const founderScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
      beneficiary1.address,
      0
    );
    const advisorScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
      beneficiary2.address,
      0
    );

    // Before cliff - nothing releasable
    expect(await vesting.computeReleasableAmount(founderScheduleId)).to.equal(0);
    expect(await vesting.computeReleasableAmount(advisorScheduleId)).to.equal(0);

    // Time travel to 1 year (cliff end)
    await time.increaseTo(startTime + YEAR_IN_SECONDS);

    // After cliff, first slice should be releasable
    const founderFirstSlice = founderAmount.div(12); // Monthly over 1 year = 1/12 per month
    const advisorFirstSlice = advisorAmount.div(4); // Quarterly over 1 year = 1/4 per quarter

    const founderReleasable = await vesting.computeReleasableAmount(founderScheduleId);
    const advisorReleasable = await vesting.computeReleasableAmount(advisorScheduleId);

    expect(founderReleasable).to.be.closeTo(founderFirstSlice, founderFirstSlice.div(100));
    expect(advisorReleasable).to.be.closeTo(advisorFirstSlice, advisorFirstSlice.div(100));

    // Release first slices
    await vesting.connect(beneficiary1).release(founderScheduleId, founderReleasable);
    await vesting.connect(beneficiary2).release(advisorScheduleId, advisorReleasable);

    // Time travel to 1 year + 3 months
    await time.increaseTo(startTime + YEAR_IN_SECONDS + MONTH_IN_SECONDS * 3);

    // Founder should have 3 more months available (3/12 of total)
    // Advisor should have second quarter available (1/4 of total)
    const founderReleasable2 = await vesting.computeReleasableAmount(founderScheduleId);
    const advisorReleasable2 = await vesting.computeReleasableAmount(advisorScheduleId);

    expect(founderReleasable2).to.be.closeTo(founderFirstSlice.mul(3), founderFirstSlice.div(10));
    expect(advisorReleasable2).to.be.closeTo(advisorFirstSlice, advisorFirstSlice.div(10));
  });

  /**
   * Test edge cases with zero values and error conditions
   */
  it('should handle edge cases and error conditions correctly', async function () {
    const { vesting, beneficiary1, startTime } = await loadFixture(deployVestingFixture);

    // Test case: Zero amount
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        0 // Zero amount
      )
    ).to.be.revertedWith('TokenVesting: amount must be > 0');

    // Test case: Zero duration
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        0, // Zero duration
        MONTH_IN_SECONDS,
        false,
        parseUnits('1000', DECIMALS)
      )
    ).to.be.revertedWith('TokenVesting: duration must be > 0');

    // Test case: Zero slice period
    await expect(
      vesting.createVestingSchedule(
        beneficiary1.address,
        startTime,
        0,
        YEAR_IN_SECONDS,
        0, // Zero slice period
        false,
        parseUnits('1000', DECIMALS)
      )
    ).to.be.revertedWith('TokenVesting: slicePeriod must be >= 1');
  });
});

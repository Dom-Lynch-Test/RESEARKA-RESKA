/**
 * RESKA Token Vesting Fuzz Tests
 *
 * This suite uses property-based testing to validate the vesting
 * implementation across a wide range of parameters, time periods,
 * and edge cases.
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers;
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

    // Deploy token
    const token = await ReskaToken.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );
    await token.waitForDeployment();

    // Note: Initial supply is already minted and distributed in the constructor
    // Owner will have their allocation percentages (treasury, public sale, and escrow roles)

    // Deploy vesting
    const tokenAddress = await token.getAddress();
    const vesting = await TokenVesting.deploy(tokenAddress);
    await vesting.waitForDeployment();

    // Get owner balance after initial distribution
    const ownerBalance = await token.balanceOf(owner.address);

    // Fund vesting contract with what owner has available
    const vestingAddress = await vesting.getAddress();
    await token.approve(vestingAddress, ownerBalance);
    await token.transfer(vestingAddress, ownerBalance / 2n);

    // Set current block timestamp as the base for tests
    const startTime = (await ethers.provider.getBlock('latest')).timestamp;

    return {
      vesting,
      owner,
      beneficiary1,
      beneficiary2,
      beneficiary3,
      startTime,
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
    const hashBigInt = BigInt(hash);
    const rangeBigInt = BigInt(range);
    const result = min.add(BigInt(hashBigInt % rangeBigInt));
    return result;
  }

  /**
   * Individual fuzz tests for each parameter set
   * Each test is isolated with its own contract deployment
   */
  for (let testIndex = 1; testIndex <= 5; testIndex++) {
    it(`should correctly handle vesting schedule with parameter set #${testIndex}`, async function () {
      // Use separate test fixture for each test case
      const { vesting, owner, beneficiary1, startTime } = await loadFixture(deployVestingFixture);

      // Generate deterministic parameters based on test index
      const cliffPeriod = Number(
        deterministicBigNumber(0n, BigInt(YEAR_IN_SECONDS * 2), testIndex * 1000 + 1)
      );

      const duration = Number(
        deterministicBigNumber(
          BigInt(MONTH_IN_SECONDS),
          BigInt(YEAR_IN_SECONDS * 3),
          testIndex * 1000 + 2
        )
      );

      const slicePeriod = Number(
        deterministicBigNumber(
          BigInt(DAY_IN_SECONDS),
          BigInt(MONTH_IN_SECONDS * 6),
          testIndex * 1000 + 3
        )
      );

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
          expectedReleasable = 0n;
        } else if (timePoint >= cliffPeriod + duration) {
          // After vesting period, everything should be releasable
          expectedReleasable = amount - schedule.released;
        } else {
          // During vesting period, calculate based on elapsed time
          const timeFromCliff = timePoint - cliffPeriod;
          const vestedSlices = Math.floor(timeFromCliff / slicePeriod) + 1;
          const totalSlices = Math.ceil(duration / slicePeriod);
          expectedReleasable =
            (amount * BigInt(vestedSlices)) / BigInt(totalSlices) - schedule.released;
        }

        // Check contract's releasable amount calculation
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);

        // We allow for a small rounding difference due to integer division
        const tolerance = 1n; // 1 token unit tolerance
        expect(actualReleasable).to.be.closeTo(expectedReleasable, tolerance);

        // If releasable amount exists, release tokens and verify balances
        if (actualReleasable > 0) {
          const beneficiaryBalanceBefore = await beneficiary1.getBalance();

          // Release tokens
          await vesting.connect(beneficiary1).release(scheduleId, actualReleasable);

          // Verify beneficiary received tokens
          const beneficiaryBalanceAfter = await beneficiary1.getBalance();
          expect(beneficiaryBalanceAfter).to.equal(beneficiaryBalanceBefore.add(actualReleasable));

          // Verify schedule updated
          const updatedSchedule = await vesting.getVestingSchedule(scheduleId);
          expect(updatedSchedule.released).to.equal(schedule.released + actualReleasable);

          // Update our reference for next iteration
          schedule.released = updatedSchedule.released;
        }
      }

      // Try revocation if schedule is revocable
      if (revocable) {
        // Check if there are tokens left to revoke
        const remainingAmount = amount - schedule.released;

        if (remainingAmount > 0) {
          const ownerBalanceBefore = await owner.getBalance();

          // Revoke the schedule
          await vesting.revoke(scheduleId);

          // Verify owner received the remaining tokens
          const ownerBalanceAfter = await owner.getBalance();
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
            false, // Not revocable
            amount1
          );

          await vesting.createVestingSchedule(
            beneficiary2.address,
            startTime,
            cliff2,
            duration2,
            slicePeriod,
            true, // Revocable
            amount2
          );

          await vesting.createVestingSchedule(
            beneficiary3.address,
            startTime,
            cliff3,
            duration3,
            slicePeriod,
            false, // Not revocable
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
    const founderFirstSlice = founderAmount / 12n; // Monthly over 1 year = 1/12 per month
    const advisorFirstSlice = advisorAmount / 4n; // Quarterly over 1 year = 1/4 per quarter

    const founderReleasable = await vesting.computeReleasableAmount(founderScheduleId);
    const advisorReleasable = await vesting.computeReleasableAmount(advisorScheduleId);

    const founderTolerance = founderFirstSlice / 100n;
    const advisorTolerance = advisorFirstSlice / 100n;

    expect(founderReleasable).to.be.closeTo(founderFirstSlice, founderTolerance);
    expect(advisorReleasable).to.be.closeTo(advisorFirstSlice, advisorTolerance);

    // Release first slices
    await vesting.connect(beneficiary1).release(founderScheduleId, founderReleasable);
    await vesting.connect(beneficiary2).release(advisorScheduleId, advisorReleasable);

    // Time travel to 1 year + 3 months
    await time.increaseTo(startTime + YEAR_IN_SECONDS + MONTH_IN_SECONDS * 3);

    // Founder should have 3 more months available (3/12 of total)
    // Advisor should have second quarter available (1/4 of total)
    const founderReleasable2 = await vesting.computeReleasableAmount(founderScheduleId);
    const advisorReleasable2 = await vesting.computeReleasableAmount(advisorScheduleId);

    expect(founderReleasable2).to.be.closeTo(founderFirstSlice * 3n, founderFirstSlice / 10n);
    expect(advisorReleasable2).to.be.closeTo(advisorFirstSlice, advisorFirstSlice / 10n);
  });

  /**
   * Test edge cases with zero values and error conditions
   */
  it('should handle edge cases and error conditions correctly', async function () {
    // Load the fixture
    const { vesting, owner } = await loadFixture(deployVestingFixture);

    // Test zero amount
    await expect(
      vesting.createVestingSchedule(
        owner.address,
        Math.floor(Date.now() / 1000),
        0,
        60 * 60 * 24 * 365, // 1 year
        60 * 60 * 24 * 30, // 30 days
        false,
        0
      )
    ).to.be.revertedWithCustomError(vesting, 'AmountIsZero');
  });

  /**
   * Test fuzz scenario
   */
  it('should validate fuzz scenario', async function () {
    const { vesting, beneficiary1, startTime } = await loadFixture(deployVestingFixture);

    const fuzzScenario = fc.record({
      amount: fc.bigInt(MIN_AMOUNT, MAX_AMOUNT),
      cliff: fc.integer(0, YEAR_IN_SECONDS),
      duration: fc.integer(MONTH_IN_SECONDS, YEAR_IN_SECONDS * 3),
      slicePeriod: fc.integer(DAY_IN_SECONDS, MONTH_IN_SECONDS * 6),
      revocable: fc.boolean(),
      timestamps: fc.array(fc.integer(0, YEAR_IN_SECONDS * 2), {
        minLength: 1,
        maxLength: 10,
      }),
    });

    await fc.assert(
      fc.asyncProperty(
        fuzzScenario,
        async ({ amount, cliff, duration, slicePeriod, revocable, timestamps }) => {
          // Create the schedule with deterministic parameters
          await vesting.createVestingSchedule(
            beneficiary1.address,
            startTime,
            cliff,
            duration,
            slicePeriod,
            revocable,
            amount
          );

          // Get the schedule ID for the created schedule
          const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
            beneficiary1.address,
            0
          );

          // Time-travel to various points and check releases
          for (const timePoint of timestamps) {
            // Time-travel
            await time.increaseTo(startTime + timePoint);

            // Calculate expected releasable amount
            let expectedReleasable;

            if (timePoint < cliff) {
              // Before cliff, nothing is releasable
              expectedReleasable = 0n;
            } else if (timePoint >= cliff + duration) {
              // After vesting period, everything should be releasable
              expectedReleasable = amount;
            } else {
              // During vesting period, calculate based on elapsed time
              const timeFromCliff = timePoint - cliff;
              const vestedSlices = Math.floor(timeFromCliff / slicePeriod) + 1;
              const totalSlices = Math.ceil(duration / slicePeriod);
              expectedReleasable = (amount * BigInt(vestedSlices)) / BigInt(totalSlices);
            }

            // Check contract's releasable amount calculation
            const actualReleasable = await vesting.computeReleasableAmount(scheduleId);

            // We allow for a small rounding difference due to integer division
            const tolerance = 1n; // 1 token unit tolerance
            expect(actualReleasable).to.be.closeTo(expectedReleasable, tolerance);
          }

          return true;
        }
      ),
      { numRuns: 3 } // Limit to 3 test cases for reasonable test time
    );
  });
});

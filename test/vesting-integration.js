/**
 * RESKA Token Vesting Integration Tests
 *
 * These tests validate the comprehensive functionality of the token vesting
 * system through simulations of real-world scenarios and behaviors.
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { parseUnits } = ethers;
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('RESKA Token Vesting Integration Tests', function () {
  // Testing constants
  const DECIMALS = 6;
  const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
  const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;

  /**
   * Deploy fresh contracts for each test
   */
  async function deployVestingFixture() {
    // Get signers
    const [owner, founder, advisors, investor1, investor2, airdrop1, airdrop2, ecosystem] =
      await ethers.getSigners();

    // Deploy token
    const ReskaToken = await ethers.getContractFactory('ReskaToken');
    const token = await ReskaToken.deploy(
      founder.address,
      advisors.address,
      investor1.address,
      airdrop1.address,
      ecosystem.address,
      owner.address, // treasury
      owner.address, // public sale
      owner.address // escrow
    );
    // Wait for deployment to complete
    await token.waitForDeployment();

    // Deploy vesting
    const TokenVesting = await ethers.getContractFactory('ReskaTokenVesting');
    const tokenAddress = await token.getAddress();
    const vesting = await TokenVesting.deploy(tokenAddress);
    // Wait for deployment to complete
    await vesting.waitForDeployment();

    // Mint initial supply
    const initialSupply = parseUnits('100000000', DECIMALS); // 100M tokens instead of 1B
    await token.mint(owner.address, initialSupply);

    // Fund vesting contract
    const vestingAddress = await vesting.getAddress();
    await token.approve(vestingAddress, initialSupply);
    const halfSupply = initialSupply / 2n;
    await token.transfer(vestingAddress, halfSupply);

    // Set timestamp for testing
    const startTime = (await ethers.provider.getBlock('latest')).timestamp;

    return {
      token,
      vesting,
      owner,
      founder,
      advisors,
      investor1,
      investor2,
      airdrop1,
      airdrop2,
      ecosystem,
      startTime,
      initialSupply,
    };
  }

  /**
   * Test the founder vesting schedule - 1 year cliff, 1 year linear
   */
  describe('Founder allocation', function () {
    it('should lock tokens until the cliff period ends', async function () {
      const { vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Founder allocation: 10% of supply = 10M tokens
      const founderAllocation = parseUnits('10000000', DECIMALS);

      // Create vesting schedule
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS, // 1-year linear vesting after cliff
        MONTH_IN_SECONDS, // Monthly releases
        false, // Not revocable
        founderAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );

      // Check releasable amount - should be 0 before cliff
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);

      // Time travel to just before cliff end
      await time.increaseTo(startTime + YEAR_IN_SECONDS - 10);

      // Still should be 0
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);
    });

    it('should release the first batch after cliff period', async function () {
      const { token, vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Founder allocation: 10% of supply = 10M tokens
      const founderAllocation = parseUnits('10000000', DECIMALS);

      // Create vesting schedule
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS, // 1-year linear vesting after cliff
        MONTH_IN_SECONDS, // Monthly releases
        false, // Not revocable
        founderAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );

      // Time travel to just after cliff
      await time.increaseTo(startTime + YEAR_IN_SECONDS + 10);

      // Should be able to release first month's worth
      const expectedFirstRelease = founderAllocation / 12n; // 1/12 of total (12 months in vesting period)
      const actualReleasable = await vesting.computeReleasableAmount(scheduleId);

      // Allow 1% tolerance for rounding
      const tolerance = expectedFirstRelease / 100n;
      expect(actualReleasable).to.be.closeTo(expectedFirstRelease, tolerance);

      // Founder can release tokens
      await vesting.connect(founder).release(scheduleId, actualReleasable);

      // Verify founder received tokens
      const founderAddress = await founder.getAddress();
      expect(await token.balanceOf(founderAddress)).to.equal(actualReleasable);
    });

    it('should follow the correct linear release schedule', async function () {
      const { token, vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Founder allocation: 10% of supply = 10M tokens
      const founderAllocation = parseUnits('10000000', DECIMALS);

      // Create vesting schedule
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS, // 1-year linear vesting after cliff
        MONTH_IN_SECONDS, // Monthly releases
        false, // Not revocable
        founderAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );

      // Define time points to check
      const timePoints = [
        { elapsed: MONTH_IN_SECONDS * 6, expectedPct: 6 / 12 },
        { elapsed: YEAR_IN_SECONDS, expectedPct: 12 / 12 },
        { elapsed: MONTH_IN_SECONDS * 18, expectedPct: 18 / 12 },
        { elapsed: YEAR_IN_SECONDS * 2, expectedPct: 24 / 12 },
      ];

      let totalReleased = ethers.BigNumber.from(0);

      // Test each time point
      for (const { elapsed, expectedPct } of timePoints) {
        // Time travel to the next point
        await time.increaseTo(startTime + YEAR_IN_SECONDS + elapsed);

        // Calculate expected total vested by this time
        const expectedTotal = (founderAllocation * BigInt(expectedPct * 100)) / 100n;
        const expectedReleasable = expectedTotal - totalReleased;

        // Check releasable amount
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);
        expect(actualReleasable).to.be.closeTo(expectedReleasable, expectedReleasable / 100n);

        // Release tokens
        if (actualReleasable.gt(0)) {
          await vesting.connect(founder).release(scheduleId, actualReleasable);
          totalReleased = totalReleased.add(actualReleasable);
        }
      }

      // Verify all tokens were released
      expect(totalReleased).to.be.closeTo(founderAllocation, founderAllocation / 100n);
      const founderAddress = await founder.getAddress();
      expect(await token.balanceOf(founderAddress)).to.be.closeTo(
        founderAllocation,
        founderAllocation / 100n
      );
    });
  });

  /**
   * Test advisor vesting schedule - 1 year cliff, quarterly releases
   */
  describe('Advisor allocation', function () {
    it('should lock tokens until the cliff period ends', async function () {
      const { vesting, advisors, startTime } = await loadFixture(deployVestingFixture);

      // Advisor allocation: 5% of supply = 5M tokens
      const advisorAllocation = parseUnits('5000000', DECIMALS);

      // Create vesting schedule
      await vesting.createVestingSchedule(
        advisors.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS, // 1-year vesting after cliff
        MONTH_IN_SECONDS * 3, // Quarterly releases
        false, // Not revocable
        advisorAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        advisors.address,
        0
      );

      // Check at 11 months (before cliff)
      await time.increaseTo(startTime + MONTH_IN_SECONDS * 11);
      expect(await vesting.computeReleasableAmount(scheduleId)).to.equal(0);
    });

    it('should release quarterly after the cliff period', async function () {
      const { vesting, advisors, startTime } = await loadFixture(deployVestingFixture);

      // Advisor allocation: 5% of supply = 5M tokens
      const advisorAllocation = parseUnits('5000000', DECIMALS);

      // Create vesting schedule
      await vesting.createVestingSchedule(
        advisors.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS, // 1-year vesting after cliff
        MONTH_IN_SECONDS * 3, // Quarterly releases
        false, // Not revocable
        advisorAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        advisors.address,
        0
      );

      // Define quarters to test
      const quarters = [
        { elapsed: MONTH_IN_SECONDS * 0, expectedPct: 1 / 4 },
        { elapsed: MONTH_IN_SECONDS * 3, expectedPct: 2 / 4 },
        { elapsed: MONTH_IN_SECONDS * 6, expectedPct: 3 / 4 },
        { elapsed: MONTH_IN_SECONDS * 9, expectedPct: 4 / 4 },
      ];

      let totalReleased = ethers.BigNumber.from(0);

      // Test each quarter
      for (const { elapsed, expectedPct } of quarters) {
        // Time travel to end of cliff + quarter
        await time.increaseTo(startTime + YEAR_IN_SECONDS + elapsed);

        // Expected amount by this time
        const expectedTotal = (advisorAllocation * BigInt(expectedPct * 100)) / 100n;
        const expectedReleasable = expectedTotal - totalReleased;

        // Check releasable amount
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);
        expect(actualReleasable).to.be.closeTo(expectedReleasable, expectedReleasable / 100n);

        // Release tokens
        if (actualReleasable.gt(0)) {
          await vesting.connect(advisors).release(scheduleId, actualReleasable);
          totalReleased = totalReleased.add(actualReleasable);
        }
      }

      // Verify all tokens were released by end
      expect(totalReleased).to.be.closeTo(advisorAllocation, advisorAllocation / 100n);
    });
  });

  /**
   * Test investor vesting schedule - 2 year linear from start
   */
  describe('Investor allocation', function () {
    it('should release tokens linearly from the start', async function () {
      const { vesting, investor1, startTime } = await loadFixture(deployVestingFixture);

      // Investor allocation: 5% of supply = 5M tokens
      const investorAllocation = parseUnits('5000000', DECIMALS);

      // Create vesting schedule - no cliff, linear over 2 years
      await vesting.createVestingSchedule(
        investor1.address,
        startTime,
        0, // No cliff
        YEAR_IN_SECONDS * 2, // 2-year linear vesting
        MONTH_IN_SECONDS, // Monthly releases
        true, // Revocable
        investorAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        investor1.address,
        0
      );

      // Define time points to test
      const timePoints = [
        { elapsed: MONTH_IN_SECONDS * 6, expectedPct: 6 / (12 * 2) },
        { elapsed: YEAR_IN_SECONDS, expectedPct: 12 / (12 * 2) },
        { elapsed: MONTH_IN_SECONDS * 18, expectedPct: 18 / (12 * 2) },
        { elapsed: YEAR_IN_SECONDS * 2, expectedPct: 24 / (12 * 2) },
      ];

      let totalReleased = ethers.BigNumber.from(0);

      // Test each time point
      for (const { elapsed, expectedPct } of timePoints) {
        // Time travel
        await time.increaseTo(startTime + elapsed);

        // Expected amount by this time
        const expectedTotal = (investorAllocation * BigInt(expectedPct * 100)) / 100n;
        const expectedReleasable = expectedTotal - totalReleased;

        // Check releasable amount
        const actualReleasable = await vesting.computeReleasableAmount(scheduleId);
        expect(actualReleasable).to.be.closeTo(expectedReleasable, expectedReleasable / 100n);

        // Release tokens
        if (actualReleasable.gt(0)) {
          await vesting.connect(investor1).release(scheduleId, actualReleasable);
          totalReleased = totalReleased.add(actualReleasable);
        }
      }

      // Verify all tokens were released
      expect(totalReleased).to.be.closeTo(investorAllocation, investorAllocation / 100n);
    });

    it('should allow revoking investor vesting', async function () {
      const { token, vesting, owner, investor2, startTime } =
        await loadFixture(deployVestingFixture);

      // Investor allocation
      const investorAllocation = parseUnits('2500000', DECIMALS);

      // Create vesting schedule - revocable
      await vesting.createVestingSchedule(
        investor2.address,
        startTime,
        0, // No cliff
        YEAR_IN_SECONDS * 2, // 2-year linear vesting
        MONTH_IN_SECONDS, // Monthly releases
        true, // Revocable
        investorAllocation
      );

      // Get the schedule ID
      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        investor2.address,
        0
      );

      // Time travel to 6 months
      await time.increaseTo(startTime + MONTH_IN_SECONDS * 6);

      // Release available tokens
      const releasableAmount = await vesting.computeReleasableAmount(scheduleId);
      await vesting.connect(investor2).release(scheduleId, releasableAmount);

      // Revoke remaining vesting
      const ownerBalanceBefore = await token.balanceOf(owner.address);
      await vesting.connect(owner).revoke(scheduleId);

      // Check that the owner received the remaining tokens
      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const expectedRemaining = investorAllocation - releasableAmount;

      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.be.closeTo(
        expectedRemaining,
        expectedRemaining / 100n
      );

      // Verify schedule is revoked
      const schedule = await vesting.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.equal(true);

      // Trying to release more should fail
      await expect(vesting.connect(investor2).release(scheduleId, 1)).to.be.revertedWith(
        'TokenVesting: vesting schedule revoked'
      );
    });
  });

  /**
   * Test multiple beneficiaries and complex scenarios
   */
  describe('Multiple beneficiaries', function () {
    it('should handle multiple vesting schedules correctly', async function () {
      const { token, vesting, founder, advisors, investor1, airdrop1, ecosystem, startTime } =
        await loadFixture(deployVestingFixture);

      // Create different schedules for different beneficiaries
      const founderAmount = parseUnits('1000000', DECIMALS);
      const advisorAmount = parseUnits('500000', DECIMALS);
      const investorAmount = parseUnits('500000', DECIMALS);
      const airdropAmount = parseUnits('200000', DECIMALS);
      const ecosystemAmount = parseUnits('1000000', DECIMALS);

      // Founder: 1-year cliff, 1-year vesting
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        founderAmount
      );

      // Advisor: 1-year cliff, 1-year vesting (quarterly)
      await vesting.createVestingSchedule(
        advisors.address,
        startTime,
        YEAR_IN_SECONDS,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS * 3,
        false,
        advisorAmount
      );

      // Investor: No cliff, 2-year vesting
      await vesting.createVestingSchedule(
        investor1.address,
        startTime,
        0,
        YEAR_IN_SECONDS * 2,
        MONTH_IN_SECONDS,
        true,
        investorAmount
      );

      // Airdrop: 25% immediate, 75% over 1 year
      const immediateAirdrop = airdropAmount / 4n;
      const vestedAirdrop = airdropAmount - immediateAirdrop;

      // Transfer immediate tokens
      await token.transfer(airdrop1.address, immediateAirdrop);

      // Create vesting for the rest
      await vesting.createVestingSchedule(
        airdrop1.address,
        startTime,
        0,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        vestedAirdrop
      );

      // Ecosystem: 6-month cliff, 2-year vesting
      await vesting.createVestingSchedule(
        ecosystem.address,
        startTime,
        MONTH_IN_SECONDS * 6,
        YEAR_IN_SECONDS * 2,
        MONTH_IN_SECONDS,
        true,
        ecosystemAmount
      );

      // Get all schedule IDs
      const founderScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );
      const advisorScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        advisors.address,
        0
      );
      const investorScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        investor1.address,
        0
      );
      const airdropScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        airdrop1.address,
        0
      );
      const ecosystemScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        ecosystem.address,
        0
      );

      // Time travel to 6 months
      await time.increaseTo(startTime + MONTH_IN_SECONDS * 6);

      // Check each schedule
      // Founder (still in cliff)
      expect(await vesting.computeReleasableAmount(founderScheduleId)).to.equal(0);

      // Advisor (still in cliff)
      expect(await vesting.computeReleasableAmount(advisorScheduleId)).to.equal(0);

      // Investor (linear, should have 25% available)
      const expectedInvestorAmount = investorAmount / 4n; // 6/24 months
      const actualInvestorAmount = await vesting.computeReleasableAmount(investorScheduleId);
      expect(actualInvestorAmount).to.be.closeTo(
        expectedInvestorAmount,
        expectedInvestorAmount / 100n
      );

      // Airdrop (linear, should have 50% available)
      const expectedAirdropAmount = vestedAirdrop / 2n; // 6/12 months
      const actualAirdropAmount = await vesting.computeReleasableAmount(airdropScheduleId);
      expect(actualAirdropAmount).to.be.closeTo(
        expectedAirdropAmount,
        expectedAirdropAmount / 100n
      );

      // Ecosystem (just ended cliff, should have first month)
      const expectedEcosystemAmount = ecosystemAmount / 24n; // 1/24 months
      const actualEcosystemAmount = await vesting.computeReleasableAmount(ecosystemScheduleId);
      expect(actualEcosystemAmount).to.be.closeTo(
        expectedEcosystemAmount,
        expectedEcosystemAmount / 100n
      );

      // Release tokens for all that have releasable amounts
      await vesting.connect(investor1).release(investorScheduleId, actualInvestorAmount);
      await vesting.connect(airdrop1).release(airdropScheduleId, actualAirdropAmount);
      await vesting.connect(ecosystem).release(ecosystemScheduleId, actualEcosystemAmount);

      // Check balances
      expect(await token.balanceOf(investor1.address)).to.equal(actualInvestorAmount);
      expect(await token.balanceOf(airdrop1.address)).to.equal(
        immediateAirdrop + actualAirdropAmount
      );
      expect(await token.balanceOf(ecosystem.address)).to.equal(actualEcosystemAmount);

      // Time travel to 1 year
      await time.increaseTo(startTime + YEAR_IN_SECONDS);

      // Now founder and advisor schedules passed cliff
      const expectedFounderAmount = founderAmount / 12n; // 1/12 months after cliff
      const actualFounderAmount = await vesting.computeReleasableAmount(founderScheduleId);
      expect(actualFounderAmount).to.be.closeTo(
        expectedFounderAmount,
        expectedFounderAmount / 100n
      );

      const expectedAdvisorAmount = advisorAmount / 4n; // 1/4 quarters after cliff
      const actualAdvisorAmount = await vesting.computeReleasableAmount(advisorScheduleId);
      expect(actualAdvisorAmount).to.be.closeTo(
        expectedAdvisorAmount,
        expectedAdvisorAmount / 100n
      );

      // Release these too
      await vesting.connect(founder).release(founderScheduleId, actualFounderAmount);
      await vesting.connect(advisors).release(advisorScheduleId, actualAdvisorAmount);

      // Verify all balances
      expect(await token.balanceOf(founder.address)).to.equal(actualFounderAmount);
      expect(await token.balanceOf(advisors.address)).to.equal(actualAdvisorAmount);
    });
  });

  /**
   * Test error handling and edge cases
   */
  describe('Error handling and edge cases', function () {
    it('should handle zero values correctly', async function () {
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

    it('should handle large values correctly', async function () {
      const { vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Very long cliff
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS * 10, // 10-year cliff
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        parseUnits('1000', DECIMALS)
      );

      // Very long duration
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        0,
        YEAR_IN_SECONDS * 20, // 20-year duration
        MONTH_IN_SECONDS,
        false,
        parseUnits('1000', DECIMALS)
      );
    });

    it('should handle releasing with insufficient vested tokens', async function () {
      const { vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Create schedule with cliff
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS,
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        parseUnits('1000', DECIMALS)
      );

      const scheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );

      // Attempt to release before cliff
      await expect(vesting.connect(founder).release(scheduleId, 1)).to.be.revertedWith(
        'TokenVesting: cannot release tokens, not enough vested tokens'
      );
    });

    it('should handle multiple schedules for the same beneficiary', async function () {
      const { vesting, founder, startTime } = await loadFixture(deployVestingFixture);

      // Create two different schedules
      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        0, // No cliff
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        parseUnits('1000', DECIMALS)
      );

      await vesting.createVestingSchedule(
        founder.address,
        startTime,
        YEAR_IN_SECONDS, // 1-year cliff
        YEAR_IN_SECONDS,
        MONTH_IN_SECONDS,
        false,
        parseUnits('2000', DECIMALS)
      );

      // Get both schedule IDs
      const scheduleId1 = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        0
      );
      const scheduleId2 = await vesting.computeVestingScheduleIdForAddressAndIndex(
        founder.address,
        1
      );

      // Verify they're different
      expect(scheduleId1).to.not.equal(scheduleId2);

      // Time travel 1 month
      await time.increaseTo(startTime + MONTH_IN_SECONDS);

      // First schedule should have tokens available, second should not
      expect(await vesting.computeReleasableAmount(scheduleId1)).to.be.gt(0);
      expect(await vesting.computeReleasableAmount(scheduleId2)).to.equal(0);
    });
  });
});

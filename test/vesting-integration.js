/**
 * RESKA Token Vesting Integration Tests
 * 
 * This test suite implements end-to-end tests for the full RESKA token
 * vesting system, validating the complete deployment flow and all
 * vesting schedules in an integrated test environment.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits, formatUnits } = ethers.utils;
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("RESKA Token Vesting Integration Tests", function() {
  // Constants
  const DAY_IN_SECONDS = 24 * 60 * 60;
  const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
  const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;
  const DECIMALS = 6;
  
  // Token allocation percentages (total: 100%)
  const ALLOCATIONS = {
    FOUNDER: 10,      // 10% - 50% immediate, 50% 1yr cliff
    ADVISORS: 5,      // 5% - 1yr cliff + quarterly releases
    INVESTORS: 5,     // 5% - 100% immediate
    AIRDROPS: 40,     // 40% - 1yr cliff, then 100%
    ECOSYSTEM: 10,    // 10% - Linear 2yr
    TREASURY: 10,     // 10% - Linear 2yr
    PUBLIC_SALE: 10,  // 10% - 100% immediate (DEX liquidity)
    ESCROW: 10        // 10% - 3yr cliff
  };
  
  // Initial token supply
  const TOTAL_SUPPLY = parseUnits("1000000000", DECIMALS); // 1 billion tokens
  
  /**
   * Deploy the complete RESKA token system fixture
   */
  async function deployReskaTokenSystemFixture() {
    // Get signers
    const [
      deployer,
      founder,
      advisors,
      investors,
      airdrops,
      ecosystem,
      treasury,
      publicSale,
      escrow,
      ...accounts
    ] = await ethers.getSigners();
    
    // Load contract factories
    const ReskaToken = await ethers.getContractFactory("ReskaToken");
    const TokenVesting = await ethers.getContractFactory("TokenVesting");
    
    // Get current block timestamp
    const startTime = (await ethers.provider.getBlock('latest')).timestamp;
    
    // Step 1: Deploy token contract
    const token = await ReskaToken.deploy(
      founder.address,
      advisors.address,
      investors.address,
      airdrops.address,
      ecosystem.address,
      treasury.address,
      publicSale.address,
      escrow.address
    );
    await token.deployed();
    
    // Step 2: Deploy vesting contract
    const vesting = await TokenVesting.deploy(token.address);
    await vesting.deployed();
    
    // Step 3: Mint tokens (as the deployer, who has the DEFAULT_ADMIN_ROLE)
    await token.mint(deployer.address, TOTAL_SUPPLY);
    
    // Calculate allocation amounts
    const founderVestedAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.FOUNDER).div(100).div(2); // 50% of founder tokens
    const founderImmediateAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.FOUNDER).div(100).div(2);
    const advisorsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ADVISORS).div(100);
    const investorsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.INVESTORS).div(100);
    const airdropsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.AIRDROPS).div(100);
    const ecosystemAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ECOSYSTEM).div(100);
    const treasuryAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.TREASURY).div(100);
    const publicSaleAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.PUBLIC_SALE).div(100);
    const escrowAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ESCROW).div(100);
    
    // Calculate total amount for vesting contract
    const totalVestedAmount = founderVestedAmount
      .add(advisorsAmount)
      .add(airdropsAmount)
      .add(ecosystemAmount)
      .add(treasuryAmount)
      .add(escrowAmount);
    
    // Step 4: Fund vesting contract
    await token.transfer(vesting.address, totalVestedAmount);
    
    // Step 5: Transfer immediate allocations
    await token.transfer(founder.address, founderImmediateAmount);
    await token.transfer(investors.address, investorsAmount);
    await token.transfer(publicSale.address, publicSaleAmount);
    
    // Step 6: Create all vesting schedules
    // 6.1: Founder schedule (50% with 1-year cliff)
    await vesting.createVestingSchedule(
      founder.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS, // Monthly releases
      false, // Not revocable
      founderVestedAmount
    );
    
    // 6.2: Advisor schedule (1-year cliff, quarterly releases)
    await vesting.createVestingSchedule(
      advisors.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS * 3, // Quarterly releases
      false, // Not revocable
      advisorsAmount
    );
    
    // 6.3: Airdrop schedule (1-year cliff, then 100%)
    await vesting.createVestingSchedule(
      airdrops.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      1, // Instant vesting after cliff
      1, // Single release
      true, // Revocable
      airdropsAmount
    );
    
    // 6.4: Ecosystem schedule (linear over 2 years)
    await vesting.createVestingSchedule(
      ecosystem.address,
      startTime,
      0, // No cliff
      YEAR_IN_SECONDS * 2, // 2-year vesting
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      ecosystemAmount
    );
    
    // 6.5: Treasury schedule (linear over 2 years)
    await vesting.createVestingSchedule(
      treasury.address,
      startTime,
      0, // No cliff
      YEAR_IN_SECONDS * 2, // 2-year vesting
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      treasuryAmount
    );
    
    // 6.6: Long-term escrow schedule (3-year cliff)
    await vesting.createVestingSchedule(
      escrow.address,
      startTime,
      YEAR_IN_SECONDS * 3, // 3-year cliff
      1, // Instant vesting after cliff
      1, // Single release
      false, // Not revocable
      escrowAmount
    );
    
    // Create schedule IDs map
    const scheduleIds = {
      founder: await vesting.computeVestingScheduleIdForAddressAndIndex(founder.address, 0),
      advisors: await vesting.computeVestingScheduleIdForAddressAndIndex(advisors.address, 0),
      airdrops: await vesting.computeVestingScheduleIdForAddressAndIndex(airdrops.address, 0),
      ecosystem: await vesting.computeVestingScheduleIdForAddressAndIndex(ecosystem.address, 0),
      treasury: await vesting.computeVestingScheduleIdForAddressAndIndex(treasury.address, 0),
      escrow: await vesting.computeVestingScheduleIdForAddressAndIndex(escrow.address, 0)
    };
    
    // Return all the deployed contracts and necessary data
    return {
      token,
      vesting,
      deployer,
      founder,
      advisors,
      investors,
      airdrops,
      ecosystem,
      treasury,
      publicSale,
      escrow,
      accounts,
      startTime,
      scheduleIds,
      amounts: {
        founderVestedAmount,
        founderImmediateAmount,
        advisorsAmount,
        investorsAmount,
        airdropsAmount,
        ecosystemAmount,
        treasuryAmount,
        publicSaleAmount,
        escrowAmount,
        totalVestedAmount
      }
    };
  }
  
  /**
   * Test the initial deployment state
   */
  it("should deploy the complete RESKA token system correctly", async function() {
    // Use fixture to deploy the system
    const { token, vesting, deployer, founder, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Validate token state
    expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    
    // Validate roles
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.true;
    expect(await token.hasRole(await token.MINTER_ROLE(), deployer.address)).to.be.true;
    expect(await token.hasRole(await token.PAUSER_ROLE(), deployer.address)).to.be.true;
    
    // Validate vesting contract state
    expect(await token.balanceOf(vesting.address)).to.equal(amounts.totalVestedAmount);
    
    // Validate immediate allocations
    expect(await token.balanceOf(founder.address)).to.equal(amounts.founderImmediateAmount);
  });
  
  /**
   * Test founder allocation release schedule
   */
  it("should release founder allocation according to schedule", async function() {
    const { vesting, token, founder, startTime, scheduleIds, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Verify no tokens are releasable before cliff
    expect(await vesting.computeReleasableAmount(scheduleIds.founder)).to.equal(0);
    
    // Time travel to 1 year (cliff end)
    await time.increaseTo(startTime + YEAR_IN_SECONDS);
    
    // After cliff, first slice should be releasable (approximately 1/12 of total)
    const expectedFirstSlice = amounts.founderVestedAmount.div(12);
    const releasableAtCliff = await vesting.computeReleasableAmount(scheduleIds.founder);
    
    expect(releasableAtCliff).to.be.closeTo(expectedFirstSlice, expectedFirstSlice.div(20)); // 5% tolerance
    
    // Release the available tokens
    await vesting.connect(founder).release(scheduleIds.founder, releasableAtCliff);
    
    // Verify tokens were received
    expect(await token.balanceOf(founder.address)).to.equal(
      amounts.founderImmediateAmount.add(releasableAtCliff)
    );
    
    // Time travel to 2 years (full vesting)
    await time.increaseTo(startTime + YEAR_IN_SECONDS * 2);
    
    // All remaining tokens should be releasable
    const releasableAtEnd = await vesting.computeReleasableAmount(scheduleIds.founder);
    const totalExpected = amounts.founderVestedAmount.sub(releasableAtCliff);
    
    expect(releasableAtEnd).to.be.closeTo(totalExpected, parseUnits("1", 0)); // 1 token unit tolerance
    
    // Release the remaining tokens
    await vesting.connect(founder).release(scheduleIds.founder, releasableAtEnd);
    
    // Verify final balance is correct (immediate + vested)
    const finalBalance = await token.balanceOf(founder.address);
    const expectedFinalBalance = amounts.founderImmediateAmount.add(amounts.founderVestedAmount);
    
    expect(finalBalance).to.be.closeTo(expectedFinalBalance, parseUnits("1", 0)); // 1 token unit tolerance
  });
  
  /**
   * Test advisor allocation release schedule
   */
  it("should release advisor allocation according to quarterly schedule", async function() {
    const { vesting, token, advisors, startTime, scheduleIds, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Verify no tokens are releasable before cliff
    expect(await vesting.computeReleasableAmount(scheduleIds.advisors)).to.equal(0);
    
    // Time travel to 1 year (cliff end)
    await time.increaseTo(startTime + YEAR_IN_SECONDS);
    
    // After cliff, first quarter should be releasable
    const expectedQuarter = amounts.advisorsAmount.div(4);
    const releasableAtCliff = await vesting.computeReleasableAmount(scheduleIds.advisors);
    
    expect(releasableAtCliff).to.be.closeTo(expectedQuarter, expectedQuarter.div(20)); // 5% tolerance
    
    // Release the first quarter
    await vesting.connect(advisors).release(scheduleIds.advisors, releasableAtCliff);
    
    // Time travel to 1 year + 3 months (end of first quarter after cliff)
    await time.increaseTo(startTime + YEAR_IN_SECONDS + MONTH_IN_SECONDS * 3);
    
    // Second quarter should be releasable
    const releasableQuarter2 = await vesting.computeReleasableAmount(scheduleIds.advisors);
    
    expect(releasableQuarter2).to.be.closeTo(expectedQuarter, expectedQuarter.div(20)); // 5% tolerance
    
    // Release second quarter
    await vesting.connect(advisors).release(scheduleIds.advisors, releasableQuarter2);
    
    // Time travel to 1 year + 6 months (end of second quarter after cliff)
    await time.increaseTo(startTime + YEAR_IN_SECONDS + MONTH_IN_SECONDS * 6);
    
    // Third quarter should be releasable
    const releasableQuarter3 = await vesting.computeReleasableAmount(scheduleIds.advisors);
    
    expect(releasableQuarter3).to.be.closeTo(expectedQuarter, expectedQuarter.div(20)); // 5% tolerance
    
    // Release third quarter
    await vesting.connect(advisors).release(scheduleIds.advisors, releasableQuarter3);
    
    // Time travel to 2 years (full vesting)
    await time.increaseTo(startTime + YEAR_IN_SECONDS * 2);
    
    // Final quarter should be releasable
    const releasableQuarter4 = await vesting.computeReleasableAmount(scheduleIds.advisors);
    
    expect(releasableQuarter4).to.be.closeTo(expectedQuarter, expectedQuarter.div(20)); // 5% tolerance
    
    // Release final quarter
    await vesting.connect(advisors).release(scheduleIds.advisors, releasableQuarter4);
    
    // Verify final balance is the full amount
    const finalBalance = await token.balanceOf(advisors.address);
    
    expect(finalBalance).to.be.closeTo(amounts.advisorsAmount, parseUnits("1", 0)); // 1 token unit tolerance
  });
  
  /**
   * Test airdrop allocation release schedule
   */
  it("should release airdrop allocation in full after cliff", async function() {
    const { vesting, token, airdrops, startTime, scheduleIds, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Verify no tokens are releasable before cliff
    expect(await vesting.computeReleasableAmount(scheduleIds.airdrops)).to.equal(0);
    
    // Time travel to 1 year (cliff end)
    await time.increaseTo(startTime + YEAR_IN_SECONDS);
    
    // After cliff, full amount should be releasable
    const releasableAtCliff = await vesting.computeReleasableAmount(scheduleIds.airdrops);
    
    expect(releasableAtCliff).to.equal(amounts.airdropsAmount);
    
    // Release all tokens
    await vesting.connect(airdrops).release(scheduleIds.airdrops, releasableAtCliff);
    
    // Verify all tokens were received
    expect(await token.balanceOf(airdrops.address)).to.equal(amounts.airdropsAmount);
  });
  
  /**
   * Test ecosystem allocation linear release schedule
   */
  it("should linearly release ecosystem allocation over 2 years", async function() {
    const { vesting, token, ecosystem, startTime, scheduleIds, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Check at 6 months (25% of duration)
    await time.increaseTo(startTime + MONTH_IN_SECONDS * 6);
    
    const expectedAt6Months = amounts.ecosystemAmount.mul(25).div(100);
    const releasableAt6Months = await vesting.computeReleasableAmount(scheduleIds.ecosystem);
    
    expect(releasableAt6Months).to.be.closeTo(expectedAt6Months, expectedAt6Months.div(10)); // 10% tolerance
    
    // Release at 6 months
    await vesting.connect(ecosystem).release(scheduleIds.ecosystem, releasableAt6Months);
    
    // Check at 1 year (50% of duration)
    await time.increaseTo(startTime + YEAR_IN_SECONDS);
    
    const expectedAt1Year = amounts.ecosystemAmount.mul(50).div(100).sub(releasableAt6Months);
    const releasableAt1Year = await vesting.computeReleasableAmount(scheduleIds.ecosystem);
    
    expect(releasableAt1Year).to.be.closeTo(expectedAt1Year, expectedAt1Year.div(10)); // 10% tolerance
    
    // Release at 1 year
    await vesting.connect(ecosystem).release(scheduleIds.ecosystem, releasableAt1Year);
    
    // Check at 2 years (100% of duration)
    await time.increaseTo(startTime + YEAR_IN_SECONDS * 2);
    
    // Calculate remaining amount (should be close to 50%)
    const releasedSoFar = releasableAt6Months.add(releasableAt1Year);
    const expectedRemaining = amounts.ecosystemAmount.sub(releasedSoFar);
    const releasableRemaining = await vesting.computeReleasableAmount(scheduleIds.ecosystem);
    
    expect(releasableRemaining).to.be.closeTo(expectedRemaining, expectedRemaining.div(10)); // 10% tolerance
    
    // Release remaining
    await vesting.connect(ecosystem).release(scheduleIds.ecosystem, releasableRemaining);
    
    // Verify final balance is the full amount
    const finalBalance = await token.balanceOf(ecosystem.address);
    
    expect(finalBalance).to.be.closeTo(amounts.ecosystemAmount, parseUnits("1", 0)); // 1 token unit tolerance
  });
  
  /**
   * Test escrow allocation with 3-year cliff
   */
  it("should release escrow allocation after 3-year cliff", async function() {
    const { vesting, token, escrow, startTime, scheduleIds, amounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Before 3 years, nothing should be releasable
    expect(await vesting.computeReleasableAmount(scheduleIds.escrow)).to.equal(0);
    
    // Time travel to 2 years (still before cliff)
    await time.increaseTo(startTime + YEAR_IN_SECONDS * 2);
    
    // Still nothing releasable
    expect(await vesting.computeReleasableAmount(scheduleIds.escrow)).to.equal(0);
    
    // Time travel to 3 years (cliff end)
    await time.increaseTo(startTime + YEAR_IN_SECONDS * 3);
    
    // Full amount should be releasable
    const releasableAt3Years = await vesting.computeReleasableAmount(scheduleIds.escrow);
    
    expect(releasableAt3Years).to.equal(amounts.escrowAmount);
    
    // Release all tokens
    await vesting.connect(escrow).release(scheduleIds.escrow, releasableAt3Years);
    
    // Verify all tokens were received
    expect(await token.balanceOf(escrow.address)).to.equal(amounts.escrowAmount);
  });
  
  /**
   * Test revocation functionality
   */
  it("should handle revocation correctly", async function() {
    const { vesting, token, deployer, accounts, startTime } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Create a new vesting schedule for testing revocation
    const testAmount = parseUnits("10000", DECIMALS);
    await token.transfer(vesting.address, testAmount);
    
    const testUser = accounts[0];
    
    // Create revocable schedule
    await vesting.createVestingSchedule(
      testUser.address,
      startTime,
      MONTH_IN_SECONDS * 6, // 6-month cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      testAmount
    );
    
    const testScheduleId = await vesting.computeVestingScheduleIdForAddressAndIndex(testUser.address, 0);
    
    // Time travel to middle of vesting period
    await time.increaseTo(startTime + MONTH_IN_SECONDS * 9); // 3 months after cliff
    
    // Check releasable amount before revocation
    const releasableBefore = await vesting.computeReleasableAmount(testScheduleId);
    
    // Release available tokens
    if (releasableBefore.gt(0)) {
      await vesting.connect(testUser).release(testScheduleId, releasableBefore);
    }
    
    // Get owner balance before revocation
    const ownerBalanceBefore = await token.balanceOf(deployer.address);
    
    // Get remaining amount in the schedule
    const schedule = await vesting.getVestingSchedule(testScheduleId);
    const remainingAmount = schedule.amountTotal.sub(schedule.released);
    
    // Revoke the schedule
    await vesting.revoke(testScheduleId);
    
    // Verify schedule is marked as revoked
    const revokedSchedule = await vesting.getVestingSchedule(testScheduleId);
    expect(revokedSchedule.revoked).to.be.true;
    
    // Verify remaining tokens were sent to owner
    const ownerBalanceAfter = await token.balanceOf(deployer.address);
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(remainingAmount));
    
    // Verify no more tokens can be released
    const releasableAfter = await vesting.computeReleasableAmount(testScheduleId);
    expect(releasableAfter).to.equal(0);
    
    // Try to release more tokens (should fail)
    await expect(
      vesting.connect(testUser).release(testScheduleId, 1)
    ).to.be.revertedWith("TokenVesting: cannot release tokens, no tokens are due");
  });
  
  /**
   * Test pause functionality of the token
   */
  it("should handle pausing and unpausing correctly", async function() {
    const { token, accounts } = await loadFixture(deployReskaTokenSystemFixture);
    
    // Verify token is not paused initially
    expect(await token.paused()).to.be.false;
    
    // Pause the token
    await token.pause();
    expect(await token.paused()).to.be.true;
    
    // Try to transfer tokens while paused (should fail)
    await expect(
      token.transfer(accounts[0].address, 1000)
    ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    
    // Unpause the token
    await token.unpause();
    expect(await token.paused()).to.be.false;
    
    // Verify transfers work again
    const testAmount = 1000;
    await token.transfer(accounts[0].address, testAmount);
    expect(await token.balanceOf(accounts[0].address)).to.equal(testAmount);
  });
});

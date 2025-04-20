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
const { time } = require("@nomicfoundation/hardhat-network-helpers");

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
  
  // Fixtures
  let ReskaToken, TokenVesting;
  let token, vesting;
  let founder, advisors, investors, airdrops, ecosystem, treasury, publicSale, escrow;
  let accounts;
  let startTime;
  let scheduleIds = {};
  
  before(async function() {
    // Load contract factories
    ReskaToken = await ethers.getContractFactory("ReskaToken");
    TokenVesting = await ethers.getContractFactory("ReskaTokenVesting");
    
    // Get signers
    [
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
    
    // Get current block timestamp
    startTime = (await ethers.provider.getBlock('latest')).timestamp;
    console.log(`Test starting at timestamp: ${startTime}`);
  });
  
  /**
   * Run a full deployment of the RESKA token system
   */
  it("should deploy the complete RESKA token system correctly", async function() {
    console.log("\n=== DEPLOYING RESKA TOKEN SYSTEM ===");
    
    // Step 1: Deploy token contract
    console.log("Deploying ReskaToken contract...");
    token = await ReskaToken.deploy(
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
    console.log(`Token deployed at: ${token.address}`);
    
    // Step 2: Deploy vesting contract
    console.log("Deploying TokenVesting contract...");
    vesting = await TokenVesting.deploy(token.address);
    await vesting.deployed();
    console.log(`Vesting contract deployed at: ${vesting.address}`);
    
    // Step 3: Mint tokens (as the deployer, who has the DEFAULT_ADMIN_ROLE)
    console.log(`Minting ${formatUnits(TOTAL_SUPPLY, DECIMALS)} RESKA tokens...`);
    await token.mint(deployer.address, TOTAL_SUPPLY);
    
    // Step 4: Validate initial state
    expect(await token.balanceOf(deployer.address)).to.equal(TOTAL_SUPPLY);
    expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    
    // Validate roles
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), deployer.address)).to.be.true;
    expect(await token.hasRole(await token.MINTER_ROLE(), deployer.address)).to.be.true;
    expect(await token.hasRole(await token.PAUSER_ROLE(), deployer.address)).to.be.true;
    
    console.log("Basic deployment validation passed!");
  });
  
  /**
   * Set up all vesting schedules and initial allocations
   */
  it("should set up all vesting schedules correctly", async function() {
    console.log("\n=== SETTING UP VESTING SCHEDULES ===");
    
    // Step 1: Fund vesting contract with tokens for all vested allocations
    // Calculate how many tokens need to be transferred to vesting contract
    const founderVestedAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.FOUNDER).div(100).div(2); // 50% of founder tokens
    const advisorsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ADVISORS).div(100);
    const airdropsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.AIRDROPS).div(100);
    const ecosystemAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ECOSYSTEM).div(100);
    const treasuryAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.TREASURY).div(100);
    const escrowAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ESCROW).div(100);
    
    const totalVestedAmount = founderVestedAmount
      .add(advisorsAmount)
      .add(airdropsAmount)
      .add(ecosystemAmount)
      .add(treasuryAmount)
      .add(escrowAmount);
    
    console.log(`Funding vesting contract with ${formatUnits(totalVestedAmount, DECIMALS)} RESKA...`);
    await token.transfer(vesting.address, totalVestedAmount);
    expect(await token.balanceOf(vesting.address)).to.equal(totalVestedAmount);
    
    // Step 2: Distribute immediate allocations
    // Founder immediate 50%
    const founderImmediateAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.FOUNDER).div(100).div(2);
    console.log(`Transferring ${formatUnits(founderImmediateAmount, DECIMALS)} RESKA to founder immediately...`);
    await token.transfer(founder.address, founderImmediateAmount);
    
    // 100% of investor allocation immediate
    const investorsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.INVESTORS).div(100);
    console.log(`Transferring ${formatUnits(investorsAmount, DECIMALS)} RESKA to investors immediately...`);
    await token.transfer(investors.address, investorsAmount);
    
    // 100% of public sale immediate
    const publicSaleAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.PUBLIC_SALE).div(100);
    console.log(`Transferring ${formatUnits(publicSaleAmount, DECIMALS)} RESKA to public sale immediately...`);
    await token.transfer(publicSale.address, publicSaleAmount);
    
    // Step 3: Create all vesting schedules
    console.log("\nSetting up vesting schedules...");
    
    // 3.1: Founder vesting schedule (50% with 1-year cliff)
    console.log(`Creating founder vesting schedule: ${formatUnits(founderVestedAmount, DECIMALS)} RESKA (50% of allocation)`);
    console.log(`- 1 year cliff, then monthly releases over 1 year`);
    await vesting.createVestingSchedule(
      founder.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS, // Monthly releases
      false, // Not revocable
      founderVestedAmount
    );
    scheduleIds.founder = await vesting.computeVestingScheduleIdForAddressAndIndex(founder.address, 0);
    
    // 3.2: Advisor vesting schedule (1-year cliff, then quarterly releases)
    console.log(`Creating advisor vesting schedule: ${formatUnits(advisorsAmount, DECIMALS)} RESKA`);
    console.log(`- 1 year cliff, then quarterly releases over 1 year`);
    await vesting.createVestingSchedule(
      advisors.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      YEAR_IN_SECONDS, // 1-year vesting after cliff
      MONTH_IN_SECONDS * 3, // Quarterly releases
      false, // Not revocable
      advisorsAmount
    );
    scheduleIds.advisors = await vesting.computeVestingScheduleIdForAddressAndIndex(advisors.address, 0);
    
    // 3.3: Airdrop vesting schedule (1-year cliff, then 100%)
    console.log(`Creating airdrop vesting schedule: ${formatUnits(airdropsAmount, DECIMALS)} RESKA`);
    console.log(`- 1 year cliff, then 100% release`);
    await vesting.createVestingSchedule(
      airdrops.address,
      startTime,
      YEAR_IN_SECONDS, // 1-year cliff
      1, // Instant vesting after cliff
      1, // Single release
      true, // Revocable
      airdropsAmount
    );
    scheduleIds.airdrops = await vesting.computeVestingScheduleIdForAddressAndIndex(airdrops.address, 0);
    
    // 3.4: Ecosystem vesting schedule (linear over 2 years)
    console.log(`Creating ecosystem vesting schedule: ${formatUnits(ecosystemAmount, DECIMALS)} RESKA`);
    console.log(`- Linear vesting over 2 years (no cliff)`);
    await vesting.createVestingSchedule(
      ecosystem.address,
      startTime,
      0, // No cliff
      YEAR_IN_SECONDS * 2, // 2-year vesting
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      ecosystemAmount
    );
    scheduleIds.ecosystem = await vesting.computeVestingScheduleIdForAddressAndIndex(ecosystem.address, 0);
    
    // 3.5: Treasury vesting schedule (linear over 2 years)
    console.log(`Creating treasury vesting schedule: ${formatUnits(treasuryAmount, DECIMALS)} RESKA`);
    console.log(`- Linear vesting over 2 years (no cliff)`);
    await vesting.createVestingSchedule(
      treasury.address,
      startTime,
      0, // No cliff
      YEAR_IN_SECONDS * 2, // 2-year vesting
      MONTH_IN_SECONDS, // Monthly releases
      true, // Revocable
      treasuryAmount
    );
    scheduleIds.treasury = await vesting.computeVestingScheduleIdForAddressAndIndex(treasury.address, 0);
    
    // 3.6: Long-term escrow vesting schedule (3-year cliff)
    console.log(`Creating escrow vesting schedule: ${formatUnits(escrowAmount, DECIMALS)} RESKA`);
    console.log(`- 3 year cliff, then 100% release`);
    await vesting.createVestingSchedule(
      escrow.address,
      startTime,
      YEAR_IN_SECONDS * 3, // 3-year cliff
      1, // Instant vesting after cliff
      1, // Single release
      false, // Not revocable
      escrowAmount
    );
    scheduleIds.escrow = await vesting.computeVestingScheduleIdForAddressAndIndex(escrow.address, 0);
    
    // Step 4: Verify initial balances
    console.log("\nVerifying initial token distribution...");
    
    expect(await token.balanceOf(founder.address)).to.equal(founderImmediateAmount);
    expect(await token.balanceOf(investors.address)).to.equal(investorsAmount);
    expect(await token.balanceOf(publicSale.address)).to.equal(publicSaleAmount);
    
    expect(await token.balanceOf(advisors.address)).to.equal(0);
    expect(await token.balanceOf(airdrops.address)).to.equal(0);
    expect(await token.balanceOf(ecosystem.address)).to.equal(0);
    expect(await token.balanceOf(treasury.address)).to.equal(0);
    expect(await token.balanceOf(escrow.address)).to.equal(0);
    
    console.log("Vesting schedules set up successfully!");
  });
  
  /**
   * Test time-based vesting releases
   */
  it("should release tokens according to vesting schedules", async function() {
    console.log("\n=== TESTING TOKEN VESTING OVER TIME ===");
    
    // Define time points for testing
    const timePoints = [
      { label: "After 1 month", time: MONTH_IN_SECONDS },
      { label: "After 6 months", time: MONTH_IN_SECONDS * 6 },
      { label: "After 1 year (cliff end for founder/advisor/airdrop)", time: YEAR_IN_SECONDS },
      { label: "After 1 year + 3 months (1st advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 3 },
      { label: "After 1 year + 6 months (2nd advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 6 },
      { label: "After 1 year + 9 months (3rd advisor quarter)", time: YEAR_IN_SECONDS + MONTH_IN_SECONDS * 9 },
      { label: "After 2 years (full vesting for founder/advisor/ecosystem/treasury)", time: YEAR_IN_SECONDS * 2 },
      { label: "After 3 years (escrow cliff)", time: YEAR_IN_SECONDS * 3 }
    ];
    
    // Track released amounts
    const released = {
      founder: ethers.BigNumber.from(0),
      advisors: ethers.BigNumber.from(0),
      airdrops: ethers.BigNumber.from(0),
      ecosystem: ethers.BigNumber.from(0),
      treasury: ethers.BigNumber.from(0),
      escrow: ethers.BigNumber.from(0)
    };
    
    // Test each time point
    for (const { label, time } of timePoints) {
      console.log(`\n${label} (timestamp: ${startTime + time}):`);
      
      // Fast forward time
      await time.increaseTo(startTime + time);
      
      // Check and release tokens for each beneficiary
      await checkAndRelease("founder", founder);
      await checkAndRelease("advisors", advisors);
      await checkAndRelease("airdrops", airdrops);
      await checkAndRelease("ecosystem", ecosystem);
      await checkAndRelease("treasury", treasury);
      await checkAndRelease("escrow", escrow);
    }
    
    // Helper function to check and release tokens for a beneficiary
    async function checkAndRelease(allocationName, beneficiary) {
      const scheduleId = scheduleIds[allocationName];
      const releasable = await vesting.computeReleasableAmount(scheduleId);
      
      console.log(`- ${allocationName.charAt(0).toUpperCase() + allocationName.slice(1)} releasable: ${formatUnits(releasable, DECIMALS)} RESKA`);
      
      if (releasable.gt(0)) {
        const balanceBefore = await token.balanceOf(beneficiary.address);
        
        // Release tokens
        await vesting.connect(beneficiary).release(scheduleId, releasable);
        
        // Update released amount for tracking
        released[allocationName] = released[allocationName].add(releasable);
        
        // Verify balance change
        const balanceAfter = await token.balanceOf(beneficiary.address);
        expect(balanceAfter).to.equal(balanceBefore.add(releasable));
        
        console.log(`  Released ${formatUnits(releasable, DECIMALS)} RESKA (total released: ${formatUnits(released[allocationName], DECIMALS)})`);
      }
    }
    
    // Verify all tokens have been properly released
    console.log("\nFinal release verification:");
    
    // Calculate expected total vested amounts
    const founderVestedAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.FOUNDER).div(100).div(2);
    const advisorsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ADVISORS).div(100);
    const airdropsAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.AIRDROPS).div(100);
    const ecosystemAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ECOSYSTEM).div(100);
    const treasuryAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.TREASURY).div(100);
    const escrowAmount = TOTAL_SUPPLY.mul(ALLOCATIONS.ESCROW).div(100);
    
    // Verify all tokens were released (allowing for minor rounding discrepancies)
    const tolerance = parseUnits("1", 0); // 1 token unit tolerance
    
    expect(released.founder).to.be.closeTo(founderVestedAmount, tolerance);
    expect(released.advisors).to.be.closeTo(advisorsAmount, tolerance);
    expect(released.airdrops).to.be.closeTo(airdropsAmount, tolerance);
    expect(released.ecosystem).to.be.closeTo(ecosystemAmount, tolerance);
    expect(released.treasury).to.be.closeTo(treasuryAmount, tolerance);
    expect(released.escrow).to.be.closeTo(escrowAmount, tolerance);
    
    console.log("All vesting schedules correctly released their tokens!");
  });
  
  /**
   * Test revocation functionality
   */
  it("should handle revocation correctly", async function() {
    console.log("\n=== TESTING REVOCATION FUNCTIONALITY ===");
    
    // Create a new vesting schedule for testing revocation
    const testAmount = parseUnits("10000", DECIMALS);
    await token.transfer(vesting.address, testAmount);
    
    const testUser = accounts[0];
    
    console.log(`Creating test vesting schedule for ${testUser.address}...`);
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
    console.log(`Releasable before revocation: ${formatUnits(releasableBefore, DECIMALS)} RESKA`);
    
    // Release available tokens
    if (releasableBefore.gt(0)) {
      await vesting.connect(testUser).release(testScheduleId, releasableBefore);
      console.log(`Released ${formatUnits(releasableBefore, DECIMALS)} RESKA to test user`);
    }
    
    // Get contract owner balance before revocation
    const ownerBalanceBefore = await token.balanceOf(deployer.address);
    
    // Get remaining amount in the schedule
    const schedule = await vesting.getVestingSchedule(testScheduleId);
    const remainingAmount = schedule.amountTotal.sub(schedule.released);
    console.log(`Remaining in schedule: ${formatUnits(remainingAmount, DECIMALS)} RESKA`);
    
    // Revoke the schedule
    console.log("Revoking vesting schedule...");
    await vesting.revoke(testScheduleId);
    
    // Verify schedule is marked as revoked
    const revokedSchedule = await vesting.getVestingSchedule(testScheduleId);
    expect(revokedSchedule.revoked).to.be.true;
    
    // Verify remaining tokens were sent to owner
    const ownerBalanceAfter = await token.balanceOf(deployer.address);
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore.add(remainingAmount));
    console.log(`Verified ${formatUnits(remainingAmount, DECIMALS)} RESKA returned to owner`);
    
    // Verify no more tokens can be released
    const releasableAfter = await vesting.computeReleasableAmount(testScheduleId);
    expect(releasableAfter).to.equal(0);
    
    // Try to release more tokens (should fail)
    await expect(
      vesting.connect(testUser).release(testScheduleId, 1)
    ).to.be.revertedWith("TokenVesting: cannot release tokens, no tokens are due");
    
    console.log("Revocation functionality works correctly!");
  });
  
  /**
   * Test pause functionality of the token
   */
  it("should handle pausing and unpausing correctly", async function() {
    console.log("\n=== TESTING PAUSE FUNCTIONALITY ===");
    
    // Verify token is not paused initially
    expect(await token.paused()).to.be.false;
    
    // Pause the token
    console.log("Pausing token...");
    await token.pause();
    expect(await token.paused()).to.be.true;
    
    // Try to transfer tokens while paused (should fail)
    await expect(
      token.transfer(accounts[0].address, 1000)
    ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
    
    console.log("Verified transfers are blocked while paused");
    
    // Unpause the token
    console.log("Unpausing token...");
    await token.unpause();
    expect(await token.paused()).to.be.false;
    
    // Verify transfers work again
    const testAmount = 1000;
    await token.transfer(accounts[0].address, testAmount);
    console.log(`Verified transfers work after unpausing (sent ${testAmount} tokens)`);
    
    console.log("Pause functionality works correctly!");
  });
});

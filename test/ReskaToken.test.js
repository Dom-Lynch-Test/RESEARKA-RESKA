const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployTokenFixture } = require("./helpers/test-helpers");

describe("ReskaToken", function () {
  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.name()).to.equal("RESEARKA");
      expect(await token.symbol()).to.equal("RESKA");
    });

    it("Should assign the total supply to the owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have the correct initial supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      const expectedSupply = ethers.parseUnits("1000000000", 6); // 1 billion tokens with 6 decimals
      expect(await token.totalSupply()).to.equal(expectedSupply);
    });

    it("Should set up roles correctly", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      
      // Check that the owner has both roles
      const MINTER_ROLE = await token.MINTER_ROLE();
      const PAUSER_ROLE = await token.PAUSER_ROLE();
      
      expect(await token.hasRole(MINTER_ROLE, owner.address)).to.equal(true);
      expect(await token.hasRole(PAUSER_ROLE, owner.address)).to.equal(true);
    });
  });

  describe("Allocations", function () {
    it("Should have correct allocation percentages", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      // Test the first allocation (FOUNDER)
      const founderAllocation = await token.allocations(0);
      expect(founderAllocation.percentage).to.equal(10);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Transfer 50 tokens from owner to addr1
      await token.transfer(addr1.address, 50);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Get the initial balance of the owner
      const ownerBalance = await token.balanceOf(owner.address);
      
      // Try to send more tokens than the owner has
      await expect(
        token.connect(addr1).transfer(owner.address, ownerBalance + 1n)
      ).to.be.reverted;
    });
  });

  describe("Pausable", function () {
    it("Should pause and unpause token transfers", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      // Pause the token
      await token.pause();
      
      // Try to transfer while paused
      await expect(
        token.transfer(addr1.address, 50)
      ).to.be.reverted;
      
      // Unpause the token
      await token.unpause();
      
      // Try to transfer after unpausing
      await token.transfer(addr1.address, 50);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);
    });

    it("Should not allow non-pausers to pause", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(addr1).pause()
      ).to.be.reverted;
    });
  });

  describe("Minting", function () {
    it("Should allow minting up to the additional cap", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const initialSupply = await token.totalSupply();
      const additionalAmount = ethers.parseUnits("500000000", 6); // 500 million tokens with 6 decimals
      
      // Mint additional tokens
      await token.mint(addr1.address, additionalAmount);
      
      // Check the balance of addr1
      expect(await token.balanceOf(addr1.address)).to.equal(additionalAmount);
      
      // Check the new total supply
      expect(await token.totalSupply()).to.equal(initialSupply + additionalAmount);
    });

    it("Should not allow minting beyond the additional cap", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      
      const tooMuch = ethers.parseUnits("500000001", 6); // 500 million + 1 tokens with 6 decimals
      
      // Try to mint too many tokens
      await expect(
        token.mint(owner.address, tooMuch)
      ).to.be.revertedWithCustomError(token, "ExceedsMintCap");
    });

    it("Should not allow non-minters to mint", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(addr1).mint(addr1.address, 1000)
      ).to.be.reverted;
    });
  });
});

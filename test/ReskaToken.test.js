const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReskaToken", function () {
  let ReskaToken;
  let reskaToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the contract factory and signers
    ReskaToken = await ethers.getContractFactory("ReskaToken");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // For testing, we'll use the owner address for all allocations
    // Deploy the contract
    reskaToken = await ReskaToken.deploy(
      owner.address, // founder
      owner.address, // advisors
      owner.address, // investors
      owner.address, // airdrops
      owner.address, // ecosystem
      owner.address, // treasury
      owner.address, // publicSale
      owner.address, // escrow
    );
    await reskaToken.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await reskaToken.name()).to.equal("RESKA Token");
      expect(await reskaToken.symbol()).to.equal("RESKA");
    });

    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await reskaToken.balanceOf(owner.address);
      expect(await reskaToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have the correct initial supply", async function () {
      const expectedSupply = ethers.utils.parseEther("1000000000"); // 1 billion tokens
      expect(await reskaToken.totalSupply()).to.equal(expectedSupply);
    });

    it("Should set up roles correctly", async function () {
      expect(await reskaToken.hasRole(await reskaToken.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await reskaToken.hasRole(await reskaToken.PAUSER_ROLE(), owner.address)).to.equal(true);
      expect(await reskaToken.hasRole(await reskaToken.MINTER_ROLE(), owner.address)).to.equal(true);
    });
  });

  describe("Allocations", function () {
    it("Should have correct allocation percentages", async function () {
      const [recipients, percentages] = await reskaToken.getAllocations();
      
      expect(percentages[0]).to.equal(10); // Founder: 10%
      expect(percentages[1]).to.equal(5);  // Advisors: 5%
      expect(percentages[2]).to.equal(5);  // Investors: 5%
      expect(percentages[3]).to.equal(40); // Airdrops: 40%
      expect(percentages[4]).to.equal(10); // Ecosystem: 10%
      expect(percentages[5]).to.equal(10); // Treasury: 10%
      expect(percentages[6]).to.equal(10); // Public Sale: 10%
      expect(percentages[7]).to.equal(10); // Escrow: 10%
      
      // Total should be 100%
      const totalPercentage = percentages.reduce((a, b) => a + b, 0);
      expect(totalPercentage).to.equal(100);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to addr1
      await reskaToken.transfer(addr1.address, 50);
      const addr1Balance = await reskaToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);

      // Transfer 50 tokens from addr1 to addr2
      await reskaToken.connect(addr1).transfer(addr2.address, 50);
      const addr2Balance = await reskaToken.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await reskaToken.balanceOf(owner.address);

      // Try to send 1 token from addr1 (0 tokens) to owner
      await expect(
        reskaToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed
      expect(await reskaToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });

  describe("Pausable", function () {
    it("Should pause and unpause token transfers", async function () {
      // Pause the token
      await reskaToken.pause();
      
      // Try to transfer tokens while paused
      await expect(
        reskaToken.transfer(addr1.address, 50)
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause the token
      await reskaToken.unpause();
      
      // Transfer should now work
      await reskaToken.transfer(addr1.address, 50);
      expect(await reskaToken.balanceOf(addr1.address)).to.equal(50);
    });

    it("Should not allow non-pausers to pause", async function () {
      await expect(
        reskaToken.connect(addr1).pause()
      ).to.be.revertedWith("AccessControl:");
    });
  });

  describe("Minting", function () {
    it("Should allow minting up to the additional cap", async function () {
      const initialSupply = await reskaToken.totalSupply();
      const additionalAmount = ethers.utils.parseEther("500000000"); // 500 million tokens
      
      // Mint additional tokens
      await reskaToken.mint(addr1.address, additionalAmount);
      
      // Check new supply
      expect(await reskaToken.totalSupply()).to.equal(initialSupply.add(additionalAmount));
      expect(await reskaToken.balanceOf(addr1.address)).to.equal(additionalAmount);
    });

    it("Should not allow minting beyond the additional cap", async function () {
      const tooMuch = ethers.utils.parseEther("500000001"); // 500 million + 1 tokens
      
      // Try to mint too many tokens
      await expect(
        reskaToken.mint(addr1.address, tooMuch)
      ).to.be.revertedWith("Exceeds maximum additional minting cap");
    });

    it("Should not allow non-minters to mint", async function () {
      await expect(
        reskaToken.connect(addr1).mint(addr2.address, 100)
      ).to.be.revertedWith("AccessControl:");
    });
  });
});

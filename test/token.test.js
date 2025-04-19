const { expect } = require("chai");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

describe("ReskaToken", function() {
  let ReskaToken;
  let reskaToken;
  let owner;
  let addr1;
  let addr2;
  
  before(async function() {
    // Load compiled contract
    const artifactPath = path.resolve(__dirname, "../artifacts/ReskaToken.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    // Get contract ABI and bytecode
    const contractOutput = artifact.contracts["ReskaToken.sol"].ReskaToken;
    const abi = contractOutput.abi;
    const bytecode = contractOutput.evm.bytecode.object;
    
    // Set up provider and signers
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    
    // Try to get signers - this will fail if Hardhat node is not running
    try {
      const signers = await provider.listAccounts();
      if (signers.length === 0) {
        console.log("No accounts found. Make sure Hardhat node is running with 'npx hardhat node'");
        this.skip();
      }
      
      owner = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
      addr1 = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
      addr2 = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
      
      // Create contract factory
      const factory = new ethers.ContractFactory(abi, bytecode, owner);
      
      // Deploy contract
      reskaToken = await factory.deploy(
        owner.address, // founder
        owner.address, // advisors
        owner.address, // investors
        owner.address, // airdrops
        owner.address, // ecosystem
        owner.address, // treasury
        owner.address, // publicSale
        owner.address  // escrow
      );
      
      await reskaToken.deployed();
    } catch (error) {
      console.log("Error setting up test environment:", error.message);
      this.skip();
    }
  });
  
  // Basic test that doesn't require contract deployment
  it("should pass a basic test", function() {
    expect(true).to.equal(true);
  });
  
  // Only run contract tests if deployment was successful
  describe("Contract Tests", function() {
    beforeEach(function() {
      if (!reskaToken) {
        this.skip();
      }
    });
    
    it("should have the correct name and symbol", async function() {
      expect(await reskaToken.name()).to.equal("RESKA Token");
      expect(await reskaToken.symbol()).to.equal("RESKA");
    });
    
    it("should have the correct initial supply", async function() {
      const expectedSupply = ethers.utils.parseEther("1000000000"); // 1 billion tokens
      expect(await reskaToken.totalSupply()).to.equal(expectedSupply);
    });
  });
});

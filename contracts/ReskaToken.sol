// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReskaToken
 * @dev ERC20 token with role-based access control, pausable functionality, and allocation tracking
 */
contract ReskaToken is ERC20, ERC20Burnable, Pausable, AccessControl {
    // Roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens with 18 decimals
    uint256 public constant MAX_ADDITIONAL_MINTING = 500_000_000 * 10**18; // 500 million additional tokens max
    
    // Allocation tracking
    uint256 public totalMintedAdditional;
    
    // Allocation percentages and addresses
    struct Allocation {
        address recipient;
        uint8 percentage;
    }
    
    Allocation[] public allocations;
    
    // Events
    event TokensAllocated(address indexed recipient, uint256 amount, string allocationName);
    event AdditionalTokensMinted(address indexed to, uint256 amount);
    
    /**
     * @dev Constructor that sets up initial token allocations and mints the initial supply
     * @param _founderAddress Address for founder allocation (10%)
     * @param _advisorsAddress Address for advisors allocation (5%)
     * @param _investorsAddress Address for investors allocation (5%)
     * @param _airdropsAddress Address for airdrops/rewards allocation (40%)
     * @param _ecosystemAddress Address for ecosystem development allocation (10%)
     * @param _treasuryAddress Address for treasury reserve allocation (10%)
     * @param _publicSaleAddress Address for public sale/DEX liquidity allocation (10%)
     * @param _escrowAddress Address for long-term escrow allocation (10%)
     */
    constructor(
        address _founderAddress,
        address _advisorsAddress,
        address _investorsAddress,
        address _airdropsAddress,
        address _ecosystemAddress,
        address _treasuryAddress,
        address _publicSaleAddress,
        address _escrowAddress
    ) ERC20("RESEARKA", "RESKA") {
        // Validate addresses
        require(_founderAddress != address(0), "Founder address cannot be zero");
        require(_advisorsAddress != address(0), "Advisors address cannot be zero");
        require(_investorsAddress != address(0), "Investors address cannot be zero");
        require(_airdropsAddress != address(0), "Airdrops address cannot be zero");
        require(_ecosystemAddress != address(0), "Ecosystem address cannot be zero");
        require(_treasuryAddress != address(0), "Treasury address cannot be zero");
        require(_publicSaleAddress != address(0), "Public sale address cannot be zero");
        require(_escrowAddress != address(0), "Escrow address cannot be zero");
        
        // Set up allocations
        allocations.push(Allocation(_founderAddress, 10));    // 10% to Founder
        allocations.push(Allocation(_advisorsAddress, 5));    // 5% to Advisors
        allocations.push(Allocation(_investorsAddress, 5));   // 5% to Investors
        allocations.push(Allocation(_airdropsAddress, 40));   // 40% to Airdrops/Rewards
        allocations.push(Allocation(_ecosystemAddress, 10));  // 10% to Ecosystem Development
        allocations.push(Allocation(_treasuryAddress, 10));   // 10% to Treasury Reserve
        allocations.push(Allocation(_publicSaleAddress, 10)); // 10% to Public Sale/DEX Liquidity
        allocations.push(Allocation(_escrowAddress, 10));     // 10% to Long-Term Escrow
        
        // Validate total allocation equals 100%
        uint8 totalAllocation = 0;
        for (uint i = 0; i < allocations.length; i++) {
            totalAllocation += allocations[i].percentage;
        }
        require(totalAllocation == 100, "Total allocation must equal 100%");
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Mint and distribute initial supply according to allocations
        for (uint i = 0; i < allocations.length; i++) {
            uint256 amount = (INITIAL_SUPPLY * allocations[i].percentage) / 100;
            _mint(allocations[i].recipient, amount);
            
            // Emit event with allocation name
            string memory allocationName;
            if (i == 0) allocationName = "Founder";
            else if (i == 1) allocationName = "Advisors";
            else if (i == 2) allocationName = "Investors";
            else if (i == 3) allocationName = "Airdrops/Rewards";
            else if (i == 4) allocationName = "Ecosystem Development";
            else if (i == 5) allocationName = "Treasury Reserve";
            else if (i == 6) allocationName = "Public Sale/DEX Liquidity";
            else if (i == 7) allocationName = "Long-Term Escrow";
            
            emit TokensAllocated(allocations[i].recipient, amount, allocationName);
        }
    }
    
    /**
     * @dev Pauses all token transfers
     * Requirements:
     * - Caller must have the PAUSER_ROLE
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses all token transfers
     * Requirements:
     * - Caller must have the PAUSER_ROLE
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Mints additional tokens, subject to the maximum additional minting cap
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * Requirements:
     * - Caller must have the MINTER_ROLE
     * - Total additional minting cannot exceed MAX_ADDITIONAL_MINTING
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        // Check if additional minting exceeds the cap
        require(totalMintedAdditional + amount <= MAX_ADDITIONAL_MINTING, "Exceeds maximum additional minting cap");
        
        totalMintedAdditional += amount;
        _mint(to, amount);
        
        emit AdditionalTokensMinted(to, amount);
    }
    
    /**
     * @dev Returns all allocation addresses and percentages
     * @return recipients Array of recipient addresses
     * @return percentages Array of allocation percentages
     */
    function getAllocations() external view returns (address[] memory recipients, uint8[] memory percentages) {
        recipients = new address[](allocations.length);
        percentages = new uint8[](allocations.length);
        
        for (uint i = 0; i < allocations.length; i++) {
            recipients[i] = allocations[i].recipient;
            percentages[i] = allocations[i].percentage;
        }
        
        return (recipients, percentages);
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     * @param from Address sending tokens
     * @param to Address receiving tokens
     * @param amount Amount of tokens being transferred
     * Requirements:
     * - Token transfers must not be paused
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}

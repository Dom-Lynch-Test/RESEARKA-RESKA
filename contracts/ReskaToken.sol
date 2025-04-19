// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Custom Errors
error ZeroAddress();
error InvalidAllocationTotal();
error MintToZeroAddress();
error AmountMustBePositive();
error ExceedsMintCap();
error RenounceRoleZeroAddress();

/**
 * @title ReskaToken
 * @dev ERC20 token with role-based access control, pausable functionality, and allocation tracking
 * @custom:security-contact security@researka.com
 */
contract ReskaToken is ERC20, ERC20Burnable, Pausable, AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens with 18 decimals
    uint256 public constant MAX_ADDITIONAL_MINTING = 500_000_000 * 10**18; // 500 million additional tokens max
    
    // Allocation tracking
    uint256 public totalMintedAdditional;
    
    // Allocation types
    enum AllocationTypes {
        FOUNDER,
        ADVISORS,
        INVESTORS,
        AIRDROPS,
        ECOSYSTEM,
        TREASURY,
        PUBLIC_SALE,
        ESCROW
    }
    
    // Allocation percentages and addresses
    struct Allocation {
        address recipient;
        uint8 percentage;
        AllocationTypes allocationType;
    }
    
    Allocation[] public allocations;
    
    // Events
    event TokensAllocated(address indexed recipient, uint256 amount, AllocationTypes indexed allocationType, string allocationName);
    event AdditionalTokensMinted(address indexed to, uint256 amount);
    event RoleRenounced(bytes32 indexed role, address indexed account);
    
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
        if (_founderAddress == address(0)) revert ZeroAddress();
        if (_advisorsAddress == address(0)) revert ZeroAddress();
        if (_investorsAddress == address(0)) revert ZeroAddress();
        if (_airdropsAddress == address(0)) revert ZeroAddress();
        if (_ecosystemAddress == address(0)) revert ZeroAddress();
        if (_treasuryAddress == address(0)) revert ZeroAddress();
        if (_publicSaleAddress == address(0)) revert ZeroAddress();
        if (_escrowAddress == address(0)) revert ZeroAddress();
        
        // Set up allocations
        allocations.push(Allocation(_founderAddress, 10, AllocationTypes.FOUNDER));       // 10% to Founder
        allocations.push(Allocation(_advisorsAddress, 5, AllocationTypes.ADVISORS));      // 5% to Advisors
        allocations.push(Allocation(_investorsAddress, 5, AllocationTypes.INVESTORS));    // 5% to Investors
        allocations.push(Allocation(_airdropsAddress, 40, AllocationTypes.AIRDROPS));     // 40% to Airdrops/Rewards
        allocations.push(Allocation(_ecosystemAddress, 10, AllocationTypes.ECOSYSTEM));   // 10% to Ecosystem Development
        allocations.push(Allocation(_treasuryAddress, 10, AllocationTypes.TREASURY));     // 10% to Treasury Reserve
        allocations.push(Allocation(_publicSaleAddress, 10, AllocationTypes.PUBLIC_SALE));// 10% to Public Sale/DEX Liquidity
        allocations.push(Allocation(_escrowAddress, 10, AllocationTypes.ESCROW));         // 10% to Long-Term Escrow
        
        // Validate total allocation equals 100%
        uint8 totalAllocation = 0;
        for (uint i = 0; i < allocations.length; i++) {
            totalAllocation += allocations[i].percentage;
        }
        if (totalAllocation != 100) revert InvalidAllocationTotal();
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Mint and distribute initial supply according to allocations
        for (uint i = 0; i < allocations.length; i++) {
            uint256 amount = (INITIAL_SUPPLY * allocations[i].percentage) / 100;
            _mint(allocations[i].recipient, amount);
            
            // Emit event with allocation name and type
            string memory allocationName = _getAllocationName(allocations[i].allocationType);
            emit TokensAllocated(
                allocations[i].recipient, 
                amount, 
                allocations[i].allocationType, 
                allocationName
            );
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
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) nonReentrant {
        if (to == address(0)) revert MintToZeroAddress();
        if (amount == 0) revert AmountMustBePositive(); // Use == 0 for positive check
        
        // Check if additional minting exceeds the cap
        if (totalMintedAdditional + amount > MAX_ADDITIONAL_MINTING) revert ExceedsMintCap();
        
        totalMintedAdditional += amount;
        _mint(to, amount);
        
        emit AdditionalTokensMinted(to, amount);
    }
    
    /**
     * @dev Returns all allocation addresses and percentages
     * @return recipients Array of recipient addresses
     * @return percentages Array of allocation percentages
     * @return types Array of allocation types
     */
    function getAllocations() external view returns (
        address[] memory recipients, 
        uint8[] memory percentages,
        AllocationTypes[] memory types
    ) {
        recipients = new address[](allocations.length);
        percentages = new uint8[](allocations.length);
        types = new AllocationTypes[](allocations.length);
        
        for (uint i = 0; i < allocations.length; i++) {
            recipients[i] = allocations[i].recipient;
            percentages[i] = allocations[i].percentage;
            types[i] = allocations[i].allocationType;
        }
        
        return (recipients, percentages, types);
    }
    
    /**
     * @dev Returns the remaining amount that can be minted
     * @return uint256 The remaining amount that can be minted
     */
    function remainingMintCap() external view returns (uint256) {
        return MAX_ADDITIONAL_MINTING - totalMintedAdditional;
    }
    
    /**
     * @dev Allows an admin to renounce a role from an account safely
     * @param role The role to renounce
     * @param account The account to remove the role from
     * Requirements:
     * - Caller must have the DEFAULT_ADMIN_ROLE
     */
    function safeRenounceRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert RenounceRoleZeroAddress();
        revokeRole(role, account);
        emit RoleRenounced(role, account);
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
        override(ERC20)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev Internal helper function to get the allocation name from the allocation type
     * @param allocationType The allocation type enum
     * @return The string representation of the allocation type
     */
    function _getAllocationName(AllocationTypes allocationType) internal pure returns (string memory) {
        if (allocationType == AllocationTypes.FOUNDER) return "Founder";
        if (allocationType == AllocationTypes.ADVISORS) return "Advisors";
        if (allocationType == AllocationTypes.INVESTORS) return "Investors";
        if (allocationType == AllocationTypes.AIRDROPS) return "Airdrops/Rewards";
        if (allocationType == AllocationTypes.ECOSYSTEM) return "Ecosystem Development";
        if (allocationType == AllocationTypes.TREASURY) return "Treasury Reserve";
        if (allocationType == AllocationTypes.PUBLIC_SALE) return "Public Sale/DEX Liquidity";
        if (allocationType == AllocationTypes.ESCROW) return "Long-Term Escrow";
        return "Unknown";
    }
}

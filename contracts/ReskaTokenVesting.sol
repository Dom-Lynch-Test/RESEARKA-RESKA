// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Custom Errors
error ZeroAddress();
error AmountMustBePositive();
error DurationMustBePositive();
error SlicePeriodMustBePositive();
error DurationTooShort();
error InsufficientContractBalance();
error ScheduleNotFound();
error ScheduleNotRevocable();
error ScheduleAlreadyRevoked();
error IndexOutOfBounds();
error NotBeneficiary();
error NoTokensToRelease();
error CannotWithdrawVestedTokens();

/**
 * @title ReskaTokenVesting
 * @dev A token vesting contract for RESEARKA token that allows for cliff and gradual vesting
 * @custom:security-contact security@researka.com
 */
contract ReskaTokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Vesting schedule structure
    struct VestingSchedule {
        // Beneficiary address
        address beneficiary;
        // Cliff period in seconds
        uint256 cliff;
        // Start time of the vesting period
        uint256 start;
        // Duration of the vesting period in seconds
        uint256 duration;
        // Duration of a slice period in seconds
        uint256 slicePeriodSeconds;
        // Whether or not the vesting is revocable
        bool revocable;
        // Total amount of tokens to be vested
        uint256 amountTotal;
        // Amount of tokens released
        uint256 released;
        // Whether or not the vesting has been revoked
        bool revoked;
        // Whether or not the vesting schedule has been created
        bool created;
    }

    // Address of the ERC20 token
    IERC20 private immutable _token;

    // Array of vesting schedules
    bytes32[] private vestingSchedulesIds;
    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    mapping(address => bytes32[]) private holderVestingSchedulesIds;

    // Total amount of vested tokens
    uint256 private vestingSchedulesTotalAmount;

    // Vesting schedule created event
    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 slicePeriodSeconds
    );

    // Tokens released event
    event TokensReleased(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );

    // Vesting revoked event
    event VestingRevoked(bytes32 indexed scheduleId);

    /**
     * @dev Constructor that initializes the vesting contract with the token address
     * @param token_ Address of the ERC20 token contract
     */
    constructor(address token_) {
        if (token_ == address(0)) revert ZeroAddress();
        _token = IERC20(token_);
    }

    /**
     * @dev Returns the address of the ERC20 token managed by the vesting contract
     * @return The token address
     */
    function getToken() external view returns (address) {
        return address(_token);
    }

    /**
     * @dev Returns the total amount of vesting schedules
     * @return The total amount of vesting schedules
     */
    function getVestingSchedulesTotalAmount() external view returns (uint256) {
        return vestingSchedulesTotalAmount;
    }

    /**
     * @dev Returns the number of vesting schedules
     * @return The number of vesting schedules
     */
    function getVestingSchedulesCount() external view returns (uint256) {
        return vestingSchedulesIds.length;
    }

    /**
     * @dev Returns the vesting schedule ID at the given index
     * @param index The index in the vestingSchedulesIds array
     * @return The vesting schedule ID
     */
    function getVestingScheduleIdAtIndex(uint256 index) external view returns (bytes32) {
        if (index >= vestingSchedulesIds.length) revert IndexOutOfBounds();
        return vestingSchedulesIds[index];
    }

    /**
     * @dev Returns the vesting schedule information for a given holder and index
     * @param holder The address of the holder
     * @param index The index of the vesting schedule
     * @return The vesting schedule ID
     */
    function getVestingScheduleIdAtHolderIndex(address holder, uint256 index) external view returns (bytes32) {
        if (index >= holderVestingSchedulesIds[holder].length) revert IndexOutOfBounds();
        return holderVestingSchedulesIds[holder][index];
    }

    /**
     * @dev Returns the number of vesting schedules for a given holder
     * @param holder The address of the holder
     * @return The number of vesting schedules
     */
    function getVestingSchedulesCountByHolder(address holder) external view returns (uint256) {
        return holderVestingSchedulesIds[holder].length;
    }

    /**
     * @dev Returns the vesting schedule information for a given identifier
     * @param scheduleId The ID of the vesting schedule
     * @return The vesting schedule structure
     */
    function getVestingSchedule(bytes32 scheduleId) external view returns (VestingSchedule memory) {
        if (!vestingSchedules[scheduleId].created) revert ScheduleNotFound();
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Returns the releasable amount of tokens for a vesting schedule
     * @param scheduleId The ID of the vesting schedule
     * @return The amount of releasable tokens
     */
    function getReleasableAmount(bytes32 scheduleId) public view returns (uint256) {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];
        if (!vestingSchedule.created) revert ScheduleNotFound();
        return _computeReleasableAmount(vestingSchedule);
    }

    /**
     * @dev Returns the vesting schedule ID for an address and an index
     * @param holder The address of the holder
     * @param index The index of the vesting schedule
     * @return The vesting schedule ID
     */
    function computeVestingScheduleIdForAddressAndIndex(address holder, uint256 index) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @dev Creates a new vesting schedule for a beneficiary
     * @param _beneficiary The address of the beneficiary
     * @param _start The start time of the vesting schedule
     * @param _cliff The cliff period in seconds
     * @param _duration The duration of the vesting in seconds
     * @param _slicePeriodSeconds The duration of a slice period in seconds
     * @param _revocable Whether the vesting is revocable or not
     * @param _amount The amount of tokens to be vested
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    ) external onlyOwner {
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_amount == 0) revert AmountMustBePositive();
        if (_duration == 0) revert DurationMustBePositive();
        if (_slicePeriodSeconds == 0) revert SlicePeriodMustBePositive();
        if (_duration < _cliff) revert DurationTooShort();

        // Check that the contract has enough tokens
        uint256 contractBalance = _token.balanceOf(address(this));
        if (contractBalance < vestingSchedulesTotalAmount + _amount) revert InsufficientContractBalance();

        // Compute the vesting schedule ID
        bytes32 vestingScheduleId = computeVestingScheduleIdForAddressAndIndex(
            _beneficiary,
            holderVestingSchedulesIds[_beneficiary].length
        );

        // Create the vesting schedule
        vestingSchedules[vestingScheduleId] = VestingSchedule({
            beneficiary: _beneficiary,
            cliff: _start + _cliff,
            start: _start,
            duration: _duration,
            slicePeriodSeconds: _slicePeriodSeconds,
            revocable: _revocable,
            amountTotal: _amount,
            released: 0,
            revoked: false,
            created: true
        });

        // Add the vesting schedule to the list
        vestingSchedulesIds.push(vestingScheduleId);
        holderVestingSchedulesIds[_beneficiary].push(vestingScheduleId);

        // Update the total amount
        vestingSchedulesTotalAmount += _amount;

        emit VestingScheduleCreated(
            vestingScheduleId,
            _beneficiary,
            _amount,
            _start,
            _cliff,
            _duration,
            _slicePeriodSeconds
        );
    }

    /**
     * @dev Release vested tokens to the beneficiary
     * @param scheduleId The ID of the vesting schedule
     */
    function release(bytes32 scheduleId) external nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];

        // --- Checks ---
        if (!vestingSchedule.created) revert ScheduleNotFound();
        if (vestingSchedule.beneficiary != msg.sender) revert NotBeneficiary();
        if (vestingSchedule.revoked) revert ScheduleAlreadyRevoked();

        uint256 releasableAmount = _computeReleasableAmount(vestingSchedule);
        if (releasableAmount == 0) revert NoTokensToRelease();

        // --- Effects ---
        // Update released amount *before* external call
        vestingSchedule.released += releasableAmount;

        // --- Interactions ---
        _token.safeTransfer(vestingSchedule.beneficiary, releasableAmount);

        emit TokensReleased(scheduleId, vestingSchedule.beneficiary, releasableAmount);
    }

    /**
     * @dev Revoke a vesting schedule
     * @param scheduleId The ID of the vesting schedule
     */
    function revoke(bytes32 scheduleId) external onlyOwner nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];

        // --- Checks ---
        if (!vestingSchedule.created) revert ScheduleNotFound();
        if (!vestingSchedule.revocable) revert ScheduleNotRevocable();
        if (vestingSchedule.revoked) revert ScheduleAlreadyRevoked();

        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        uint256 nonVestedAmount = vestingSchedule.amountTotal - vestedAmount;
        uint256 releasedAmount = vestingSchedule.released;

        // --- Effects ---
        vestingSchedule.revoked = true;
        vestingSchedule.amountTotal = releasedAmount + (nonVestedAmount > 0 ? 0 : vestedAmount - releasedAmount);

        // Update global tracking if needed (adjust total vested amount)
        if (nonVestedAmount > 0) {
            vestingSchedulesTotalAmount -= nonVestedAmount;
        }

        // --- Interactions ---
        // Transfer non-vested tokens back to owner (if any)
        if (nonVestedAmount > 0) {
            _token.safeTransfer(owner(), nonVestedAmount);
        }

        emit VestingRevoked(scheduleId);
    }

    /**
     * @dev Withdraws non-vested tokens in case of emergency
     * @param amount The amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        // Check that there are enough non-vested tokens to withdraw
        if (amount > _token.balanceOf(address(this)) - vestingSchedulesTotalAmount) revert CannotWithdrawVestedTokens();
        
        // Transfer tokens to the owner
        _token.safeTransfer(owner(), amount);
    }

    /**
     * @dev Computes the releasable amount of tokens for a vesting schedule
     * @param vestingSchedule The vesting schedule
     * @return The amount of releasable tokens
     */
    function _computeReleasableAmount(VestingSchedule storage vestingSchedule) private view returns (uint256) {
        uint256 currentTime = block.timestamp;

        if (currentTime < vestingSchedule.start + vestingSchedule.cliff) {
            return 0;
        }

        if (currentTime >= vestingSchedule.start + vestingSchedule.duration || vestingSchedule.revoked) {
            return vestingSchedule.amountTotal - vestingSchedule.released;
        }

        uint256 timeElapsed = currentTime - vestingSchedule.start;
        uint256 vestedSlices = timeElapsed / vestingSchedule.slicePeriodSeconds;
        uint256 vestedAmount = (vestingSchedule.amountTotal * vestedSlices * vestingSchedule.slicePeriodSeconds) / vestingSchedule.duration;

        uint256 releasable = vestedAmount > vestingSchedule.released ? vestedAmount - vestingSchedule.released : 0;

        return releasable;
    }
}

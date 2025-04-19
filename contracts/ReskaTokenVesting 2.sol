// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title ReskaTokenVesting
 * @dev A token vesting contract for RESEARKA token that allows for cliff and gradual vesting
 * @custom:security-contact security@researka.com
 */
contract ReskaTokenVesting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
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
        require(token_ != address(0), "TokenVesting: token cannot be zero address");
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
        require(index < vestingSchedulesIds.length, "TokenVesting: index out of bounds");
        return vestingSchedulesIds[index];
    }

    /**
     * @dev Returns the vesting schedule information for a given holder and index
     * @param holder The address of the holder
     * @param index The index of the vesting schedule
     * @return The vesting schedule ID
     */
    function getVestingScheduleIdAtHolderIndex(address holder, uint256 index) external view returns (bytes32) {
        require(index < holderVestingSchedulesIds[holder].length, "TokenVesting: index out of bounds");
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
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Returns the releasable amount of tokens for a vesting schedule
     * @param scheduleId The ID of the vesting schedule
     * @return The amount of releasable tokens
     */
    function getReleasableAmount(bytes32 scheduleId) public view returns (uint256) {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];
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
        require(_beneficiary != address(0), "TokenVesting: beneficiary cannot be zero address");
        require(_amount > 0, "TokenVesting: amount must be > 0");
        require(_duration > 0, "TokenVesting: duration must be > 0");
        require(_slicePeriodSeconds > 0, "TokenVesting: slicePeriodSeconds must be > 0");
        require(_duration >= _cliff, "TokenVesting: duration must be >= cliff");
        
        // Check that the contract has enough tokens
        uint256 contractBalance = _token.balanceOf(address(this));
        require(contractBalance >= vestingSchedulesTotalAmount.add(_amount), "TokenVesting: insufficient token balance");
        
        // Compute the vesting schedule ID
        bytes32 vestingScheduleId = computeVestingScheduleIdForAddressAndIndex(
            _beneficiary,
            holderVestingSchedulesIds[_beneficiary].length
        );
        
        // Create the vesting schedule
        vestingSchedules[vestingScheduleId] = VestingSchedule({
            beneficiary: _beneficiary,
            cliff: _start.add(_cliff),
            start: _start,
            duration: _duration,
            slicePeriodSeconds: _slicePeriodSeconds,
            revocable: _revocable,
            amountTotal: _amount,
            released: 0,
            revoked: false
        });
        
        // Add the vesting schedule to the list
        vestingSchedulesIds.push(vestingScheduleId);
        holderVestingSchedulesIds[_beneficiary].push(vestingScheduleId);
        
        // Update the total amount of vested tokens
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.add(_amount);
        
        // Emit the event
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
        
        // Check that the caller is the beneficiary
        require(msg.sender == vestingSchedule.beneficiary, "TokenVesting: only beneficiary can release vested tokens");
        
        // Compute the releasable amount
        uint256 amount = _computeReleasableAmount(vestingSchedule);
        require(amount > 0, "TokenVesting: no tokens are due");
        
        // Update the released amount
        vestingSchedule.released = vestingSchedule.released.add(amount);
        
        // Update the total amount
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.sub(amount);
        
        // Transfer the tokens to the beneficiary
        _token.safeTransfer(vestingSchedule.beneficiary, amount);
        
        // Emit the event
        emit TokensReleased(scheduleId, vestingSchedule.beneficiary, amount);
    }

    /**
     * @dev Revoke a vesting schedule
     * @param scheduleId The ID of the vesting schedule
     */
    function revoke(bytes32 scheduleId) external onlyOwner {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];
        
        // Check that the vesting schedule is revocable
        require(vestingSchedule.revocable, "TokenVesting: vesting schedule is not revocable");
        
        // Check that the vesting schedule has not been revoked
        require(!vestingSchedule.revoked, "TokenVesting: vesting schedule already revoked");
        
        // Compute the releasable amount
        uint256 releasableAmount = _computeReleasableAmount(vestingSchedule);
        
        // Compute the refundable amount
        uint256 refundAmount = vestingSchedule.amountTotal.sub(vestingSchedule.released).sub(releasableAmount);
        
        // Update the revoked status
        vestingSchedule.revoked = true;
        
        // Update the total amount
        vestingSchedulesTotalAmount = vestingSchedulesTotalAmount.sub(refundAmount);
        
        // Emit the event
        emit VestingRevoked(scheduleId);
        
        // Transfer the releasable tokens to the beneficiary
        if (releasableAmount > 0) {
            vestingSchedule.released = vestingSchedule.released.add(releasableAmount);
            _token.safeTransfer(vestingSchedule.beneficiary, releasableAmount);
            emit TokensReleased(scheduleId, vestingSchedule.beneficiary, releasableAmount);
        }
    }

    /**
     * @dev Withdraw tokens from the contract
     * @param amount The amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= _token.balanceOf(address(this)).sub(vestingSchedulesTotalAmount), "TokenVesting: cannot withdraw vested tokens");
        _token.safeTransfer(owner(), amount);
    }

    /**
     * @dev Computes the releasable amount of tokens for a vesting schedule
     * @param vestingSchedule The vesting schedule
     * @return The amount of releasable tokens
     */
    function _computeReleasableAmount(VestingSchedule memory vestingSchedule) internal view returns (uint256) {
        // If the vesting schedule has been revoked, return 0
        if (vestingSchedule.revoked) {
            return 0;
        }
        
        // If the current time is before the cliff, return 0
        uint256 currentTime = block.timestamp;
        if (currentTime < vestingSchedule.cliff) {
            return 0;
        }
        
        // If the current time is after the end of the vesting period, return the total amount minus the released amount
        if (currentTime >= vestingSchedule.start.add(vestingSchedule.duration)) {
            return vestingSchedule.amountTotal.sub(vestingSchedule.released);
        }
        
        // Compute the number of full vesting periods that have elapsed
        uint256 timeFromStart = currentTime.sub(vestingSchedule.start);
        uint256 secondsPerSlice = vestingSchedule.slicePeriodSeconds;
        uint256 vestedSlicePeriods = timeFromStart.div(secondsPerSlice);
        uint256 vestedSeconds = vestedSlicePeriods.mul(secondsPerSlice);
        
        // Compute the amount of tokens that are vested
        uint256 vestedAmount = vestingSchedule.amountTotal.mul(vestedSeconds).div(vestingSchedule.duration);
        
        // Return the vested amount minus the released amount
        return vestedAmount.sub(vestingSchedule.released);
    }
}

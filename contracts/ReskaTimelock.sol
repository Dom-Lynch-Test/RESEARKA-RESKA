// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title ReskaTimelock
 * @dev Timelock controller for RESKA token governance.
 * This contract creates a time delay for administrative actions, allowing
 * token holders to observe and react to pending governance actions.
 */
contract ReskaTimelock is TimelockController {
    /**
     * @dev Constructor for the RESKA timelock controller.
     * @param minDelay The minimum delay in seconds for operations
     * @param proposers The list of addresses that can propose operations
     * @param executors The list of addresses that can execute operations
     * @param admin The optional admin address (typically set to address(0) for decentralization)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}

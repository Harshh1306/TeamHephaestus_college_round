// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Attests authorized membership roots; Semaphore proofs remain off-chain.
contract MembershipRegistry {
    address public immutable authority;
    uint256 public epoch;
    uint256 public root;
    event MembershipPublished(uint256 indexed epoch, uint256 root);
    error Unauthorized();
    error InvalidEpoch();
    constructor() { authority = msg.sender; }
    function publish(uint256 nextEpoch, uint256 nextRoot) external {
        if (msg.sender != authority) revert Unauthorized();
        if (nextEpoch <= epoch || nextRoot == 0) revert InvalidEpoch();
        epoch = nextEpoch;
        root = nextRoot;
        emit MembershipPublished(nextEpoch, nextRoot);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Immutable batch commitments. No complaint, case ID or nullifier is stored on-chain.
contract AuditAnchor {
    address public immutable owner;
    mapping(bytes32 => bytes32) public roots;
    event BatchAnchored(bytes32 indexed batchId, bytes32 root, uint256 commitmentVersion);
    error Unauthorized();
    error InvalidBatch();
    constructor() { owner = msg.sender; }
    function anchor(bytes32 batchId, bytes32 root) external {
        if (msg.sender != owner) revert Unauthorized();
        if (root == bytes32(0) || batchId == bytes32(0) || roots[batchId] != bytes32(0)) revert InvalidBatch();
        roots[batchId] = root;
        emit BatchAnchored(batchId, root, 1);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MandateAnchorRegistry {
    enum Kind {
        Policy,
        Intent,
        Report,
        Evidence
    }

    struct Anchor {
        address recorder;
        uint64 timestamp;
        uint8 kind;
        bool exists;
    }

    mapping(bytes32 => Anchor) private anchors;
    uint256 public totalAnchors;

    event Anchored(
        bytes32 indexed contentHash,
        uint8 indexed kind,
        address indexed recorder,
        uint64 timestamp
    );

    error ZeroHash();
    error InvalidKind(uint8 kind);
    error LengthMismatch();
    error AlreadyAnchored(bytes32 contentHash, address recorder, uint64 timestamp);

    function anchor(bytes32 contentHash, uint8 kind) external {
        _anchor(contentHash, kind, msg.sender);
    }

    function anchorMany(
        bytes32[] calldata contentHashes,
        uint8[] calldata kinds
    ) external {
        if (contentHashes.length != kinds.length) revert LengthMismatch();
        for (uint256 i = 0; i < contentHashes.length; i++) {
            _anchor(contentHashes[i], kinds[i], msg.sender);
        }
    }

    function getAnchor(
        bytes32 contentHash
    )
        external
        view
        returns (address recorder, uint64 timestamp, uint8 kind, bool exists)
    {
        Anchor storage entry = anchors[contentHash];
        return (entry.recorder, entry.timestamp, entry.kind, entry.exists);
    }

    function getAnchors(
        bytes32[] calldata contentHashes
    ) external view returns (Anchor[] memory result) {
        result = new Anchor[](contentHashes.length);
        for (uint256 i = 0; i < contentHashes.length; i++) {
            result[i] = anchors[contentHashes[i]];
        }
    }

    function _anchor(bytes32 contentHash, uint8 kind, address recorder) private {
        if (contentHash == bytes32(0)) revert ZeroHash();
        if (kind > uint8(Kind.Evidence)) revert InvalidKind(kind);
        Anchor storage existing = anchors[contentHash];
        if (existing.exists) {
            revert AlreadyAnchored(
                contentHash,
                existing.recorder,
                existing.timestamp
            );
        }
        uint64 timestamp = uint64(block.timestamp);
        anchors[contentHash] = Anchor({
            recorder: recorder,
            timestamp: timestamp,
            kind: kind,
            exists: true
        });
        totalAnchors += 1;
        emit Anchored(contentHash, kind, recorder, timestamp);
    }
}

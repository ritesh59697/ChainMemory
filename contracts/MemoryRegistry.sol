// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MemoryRegistry {
    struct MemoryRecord {
        string sessionId;
        string rootHash;
        uint256 timestamp;
        string preview;
    }

    // List of all memory records
    MemoryRecord[] public records;

    // Mapping from sessionId to its records
    mapping(string => MemoryRecord[]) private sessionRecords;

    event MemoryRegistered(
        string indexed sessionId,
        string rootHash,
        uint256 timestamp,
        string preview
    );

    /**
     * @dev Registers a new 0G storage memory pointer on-chain.
     */
    function registerMemory(
        string calldata sessionId,
        string calldata rootHash,
        uint256 timestamp,
        string calldata preview
    ) external {
        MemoryRecord memory record = MemoryRecord(
            sessionId,
            rootHash,
            timestamp,
            preview
        );
        records.push(record);
        sessionRecords[sessionId].push(record);
        emit MemoryRegistered(sessionId, rootHash, timestamp, preview);
    }

    /**
     * @dev Returns all registered records.
     */
    function getAllRecords() external view returns (MemoryRecord[] memory) {
        return records;
    }

    /**
     * @dev Returns all registered records for a specific session.
     */
    function getSessionRecords(string calldata sessionId) external view returns (MemoryRecord[] memory) {
        return sessionRecords[sessionId];
    }
}

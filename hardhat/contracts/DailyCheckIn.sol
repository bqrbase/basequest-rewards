// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DailyCheckIn is Ownable {
    mapping(address => uint256) public lastCheckIn;

    event CheckedIn(address indexed user, uint256 timestamp);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function checkIn() external {
        if (block.timestamp < lastCheckIn[msg.sender] + 1 days) {
            revert("Already checked in today");
        }
        lastCheckIn[msg.sender] = block.timestamp;
        emit CheckedIn(msg.sender, block.timestamp);
    }
}

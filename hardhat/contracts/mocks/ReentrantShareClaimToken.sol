// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MockERC20} from "./MockERC20.sol";

interface IShareClaim {
    function claim(uint256 fid, bytes32 castHash) external;
}

/**
 * @dev Test token that reenters `claim` during transfer. Used to prove
 *      ReentrancyGuard on BqrShareRewardsPoolProduction.
 */
contract ReentrantShareClaimToken is MockERC20 {
    IShareClaim public target;
    uint256 public fid;
    bytes32 public castHash;
    bool public attacking;

    function arm(address target_, uint256 fid_, bytes32 castHash_) external {
        target = IShareClaim(target_);
        fid = fid_;
        castHash = castHash_;
        attacking = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        if (attacking && address(target) != address(0)) {
            attacking = false;
            target.claim(fid, castHash);
        }
        return ok;
    }
}

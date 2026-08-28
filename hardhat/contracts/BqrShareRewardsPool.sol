// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BqrShareRewardsPool
 * @notice TEST-ONLY refillable BQR treasury for Farcaster Share Rewards.
 * @dev Independent from RewardsDistributor and Task2Earn escrow.
 *      THIS VERSION HAS NO qualifyShare GATE.
 *      Eligibility is enforced by the Farcaster app (Neynar Verify), not on-chain.
 *      Anyone who calls `claim(fid, castHash)` and pays gas can receive 25 BQR
 *      if claimId is unused, the FID is off cooldown, and the pool has balance.
 *      There is NO claimSigner, NO EIP-712, and NO lifetime pool cap.
 *      `totalPaid` is informational only.
 *
 *      Do not treat this bytecode as the live Mainnet pool at
 *      0x967EdCDcf74d6793F1c6d09a1056ec66481513cB.
 */
contract BqrShareRewardsPool is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant COOLDOWN = 24 hours;

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice BQR token (Base B20 Asset, ERC-20 compatible). Immutable after deploy.
    IERC20 public immutable bqrToken;

    /// @notice Fixed payout per successful claim (25 BQR, 18 decimals).
    uint256 public immutable rewardAmount;

    /// @notice Aggregate BQR base units paid out. Informational; NOT a cap.
    uint256 public totalPaid;

    /// @notice claimId => whether already paid.
    mapping(bytes32 => bool) internal _usedClaimId;

    /// @notice fid => timestamp of last successful on-chain claim.
    mapping(uint256 => uint256) public lastClaimAt;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidToken();
    error InvalidFid();
    error InvalidCastHash();
    error ClaimAlreadyUsed();
    error FidCooldown();
    error InsufficientPoolBalance();
    error InvalidRecipient();
    error InvalidAmount();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Funded(address indexed from, uint256 amount);

    event ShareRewardClaimed(
        address indexed account,
        uint256 indexed fid,
        bytes32 indexed claimId,
        bytes32 castHash,
        uint256 amount
    );

    event BqrWithdrawn(address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @param initialOwner Contract owner (Ownable2Step). May fund, pause, and withdraw.
     *        Does not authorize individual claims.
     * @param bqrToken_ BQR token address (non-zero).
     */
    constructor(address initialOwner, address bqrToken_) Ownable(initialOwner) {
        if (bqrToken_ == address(0)) {
            revert InvalidToken();
        }

        bqrToken = IERC20(bqrToken_);
        rewardAmount = 25e18;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice BQR balance held by this pool.
    function tokenBalance() external view returns (uint256) {
        return bqrToken.balanceOf(address(this));
    }

    /// @notice Replay-protection id: keccak256(account, fid, castHash).
    function getClaimId(
        address account,
        uint256 fid,
        bytes32 castHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(account, fid, castHash));
    }

    /// @notice Whether `claimId` has already been paid.
    function isClaimIdUsed(bytes32 claimId) external view returns (bool) {
        return _usedClaimId[claimId];
    }

    /**
     * @notice Timestamp when `fid` becomes eligible to claim again.
     * @dev Returns 0 if `fid` has never successfully claimed on-chain.
     */
    function nextEligibleAt(uint256 fid) external view returns (uint256) {
        uint256 last = lastClaimAt[fid];
        if (last == 0) {
            return 0;
        }
        return last + COOLDOWN;
    }

    /*//////////////////////////////////////////////////////////////
                           OWNER: FUNDING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Pull `amount` BQR from the owner into this pool.
     * @dev Owner must `approve` this contract first. Repeatable; no lifetime cap.
     *      Available while paused so the pool can be refilled during an incident.
     */
    function fund(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        bqrToken.safeTransferFrom(owner(), address(this), amount);
        emit Funded(owner(), amount);
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER: PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause user claims. Funding remains available.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause user claims.
    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER: WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraw unused BQR from this pool while paused.
     * @dev Does not interact with RewardsDistributor or Task2Earn escrow.
     */
    function withdrawUnusedBqr(
        address to,
        uint256 amount
    ) external onlyOwner whenPaused nonReentrant {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        bqrToken.safeTransfer(to, amount);
        emit BqrWithdrawn(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                 CLAIM
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Claim a fixed 25 BQR payout for `msg.sender`.
     * @dev Caller pays gas. Amount is immutable (not a function argument).
     *      TEST-ONLY: no on-chain Share qualification. Neynar Verify is the
     *      application eligibility authority.
     *      CEI: validate → mark used / cooldown / totalPaid → transfer → emit.
     */
    function claim(uint256 fid, bytes32 castHash) external whenNotPaused nonReentrant {
        bytes32 claimId = _validateClaim(msg.sender, fid, castHash);

        _usedClaimId[claimId] = true;
        lastClaimAt[fid] = block.timestamp;
        totalPaid += rewardAmount;

        bqrToken.safeTransfer(msg.sender, rewardAmount);

        emit ShareRewardClaimed(msg.sender, fid, claimId, castHash, rewardAmount);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _validateClaim(
        address account,
        uint256 fid,
        bytes32 castHash
    ) internal view returns (bytes32 claimId) {
        if (fid == 0) {
            revert InvalidFid();
        }
        if (castHash == bytes32(0)) {
            revert InvalidCastHash();
        }

        claimId = getClaimId(account, fid, castHash);
        if (_usedClaimId[claimId]) {
            revert ClaimAlreadyUsed();
        }

        uint256 last = lastClaimAt[fid];
        if (last != 0 && block.timestamp < last + COOLDOWN) {
            revert FidCooldown();
        }

        uint256 available = bqrToken.balanceOf(address(this));
        if (available < rewardAmount) {
            revert InsufficientPoolBalance();
        }
    }
}

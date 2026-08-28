// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BqrShareRewardsPoolProduction
 * @notice Production refillable BQR treasury for Farcaster Share Rewards.
 * @dev Independent from RewardsDistributor, Task2Earn escrow, and the TEST-ONLY
 *      pool at 0x75b99B36DDc4206A3c3A5d89436606e637003151.
 *
 *      Operator may only `authorize(account, fid, castHash)`.
 *      Users call `claim(fid, castHash)` and pay gas.
 *      Payout is always 25 BQR to `msg.sender`.
 *
 *      No EIP-712, EAS, CastAdd, Farcaster on-chain verification, or claimSigner.
 */
contract BqrShareRewardsPoolProduction is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant COOLDOWN = 1 days;

    enum ClaimState {
        None,
        Authorized,
        Claimed
    }

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Dedicated authorize-only operator. Immutable after deploy.
    address public immutable operator;

    /// @notice BQR token. Immutable after deploy.
    IERC20 public immutable bqrToken;

    /// @notice Fixed payout per successful claim (25 BQR, 18 decimals).
    uint256 public immutable rewardAmount;

    /// @notice Aggregate BQR base units paid out. Informational; NOT a cap.
    uint256 public totalPaid;

    /// @notice claimId => authorization / consumption state.
    mapping(bytes32 => ClaimState) internal _claimState;

    /// @notice fid => timestamp of last successful on-chain claim.
    mapping(uint256 => uint256) public lastClaimAt;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidToken();
    error InvalidOperator();
    error InvalidFid();
    error InvalidCastHash();
    error InvalidAccount();
    error NotOperator();
    error NotAuthorized();
    error AlreadyAuthorized();
    error ClaimAlreadyUsed();
    error FidCooldown();
    error InsufficientPoolBalance();
    error InvalidRecipient();
    error InvalidAmount();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Funded(address indexed from, uint256 amount);

    event ShareAuthorized(
        address indexed account,
        uint256 indexed fid,
        bytes32 castHash,
        bytes32 claimId
    );

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
     * @param initialOwner Treasury owner (Ownable2Step). May fund, pause, and withdraw
     *        unused BQR while paused. Cannot authorize claims.
     * @param operator_ Authorize-only operator. Cannot move BQR, pause, or change owner.
     * @param bqrToken_ BQR token address (non-zero).
     */
    constructor(
        address initialOwner,
        address operator_,
        address bqrToken_
    ) Ownable(initialOwner) {
        if (operator_ == address(0)) {
            revert InvalidOperator();
        }
        if (bqrToken_ == address(0)) {
            revert InvalidToken();
        }

        operator = operator_;
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

    /// @notice Replay-protection id: keccak256(abi.encode(account, fid, castHash)).
    function getClaimId(
        address account,
        uint256 fid,
        bytes32 castHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(account, fid, castHash));
    }

    /// @notice Whether `claimId` has a live operator authorization.
    function isAuthorized(bytes32 claimId) external view returns (bool) {
        return _claimState[claimId] == ClaimState.Authorized;
    }

    /// @notice Whether `claimId` has already been paid.
    function isClaimIdUsed(bytes32 claimId) external view returns (bool) {
        return _claimState[claimId] == ClaimState.Claimed;
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

    /// @notice Pause authorize and claim. Funding remains available.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause authorize and claim.
    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER: WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraw unused BQR from this pool while paused.
     * @dev Operator has no access. Does not interact with RewardsDistributor
     *      or Task2Earn escrow.
     */
    function withdrawUnusedBqr(
        uint256 amount,
        address to
    ) external onlyOwner whenPaused nonReentrant {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 available = bqrToken.balanceOf(address(this));
        if (amount > available) {
            revert InsufficientPoolBalance();
        }

        bqrToken.safeTransfer(to, amount);
        emit BqrWithdrawn(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                         OPERATOR: AUTHORIZE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Bind a one-time claim authorization to `(account, fid, castHash)`.
     * @dev Does not transfer BQR. Cannot overwrite an existing authorization
     *      or a consumed claim.
     */
    function authorize(
        address account,
        uint256 fid,
        bytes32 castHash
    ) external whenNotPaused {
        if (msg.sender != operator) {
            revert NotOperator();
        }
        if (account == address(0)) {
            revert InvalidAccount();
        }
        if (fid == 0) {
            revert InvalidFid();
        }
        if (castHash == bytes32(0)) {
            revert InvalidCastHash();
        }

        bytes32 claimId = getClaimId(account, fid, castHash);
        ClaimState state = _claimState[claimId];
        if (state == ClaimState.Authorized) {
            revert AlreadyAuthorized();
        }
        if (state == ClaimState.Claimed) {
            revert ClaimAlreadyUsed();
        }

        _claimState[claimId] = ClaimState.Authorized;
        emit ShareAuthorized(account, fid, castHash, claimId);
    }

    /*//////////////////////////////////////////////////////////////
                                 CLAIM
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Claim a fixed 25 BQR payout for `msg.sender`.
     * @dev Caller pays gas. Amount is immutable (not a function argument).
     *      Requires a matching operator authorization for
     *      `(msg.sender, fid, castHash)`.
     *      CEI: validate → mark claimed / cooldown / totalPaid → transfer → emit.
     */
    function claim(uint256 fid, bytes32 castHash) external whenNotPaused nonReentrant {
        bytes32 claimId = _validateClaim(msg.sender, fid, castHash);

        _claimState[claimId] = ClaimState.Claimed;
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
        ClaimState state = _claimState[claimId];
        if (state == ClaimState.None) {
            revert NotAuthorized();
        }
        if (state == ClaimState.Claimed) {
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

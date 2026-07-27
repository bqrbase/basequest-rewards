// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title RewardsDistributor
 * @notice V1 BQR (B20 Asset) Merkle rewards vault on Base.
 * @dev Unused BQR may be withdrawn by the owner only while paused.
 *      BQR is interacted with via the ERC-20 interface (IERC20).
 *      Leaf = keccak256(account, rewardId, amount). Campaign isolation via per-campaign
 *      merkleRoot; replay via claimId = keccak256(campaignId, account, rewardId).
 */
contract RewardsDistributor is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Campaign configuration. `merkleRoot`, `startTime`, and `endTime` are immutable
     *         after `createCampaign`.
     * @param merkleRoot Fixed Merkle root for this campaign.
     * @param startTime Inclusive start timestamp (0 = immediate once active).
     * @param endTime End timestamp; 0 = no expiry. When non-zero, must be > startTime.
     * @param active Whether claims are accepted for this campaign.
     * @param campaignType Metadata: 0=quest, 1=referral, 2=seasonal, 3=other.
     */
    struct Campaign {
        bytes32 merkleRoot;
        uint64 startTime;
        uint64 endTime;
        bool active;
        uint8 campaignType;
    }

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice BQR token (Base B20 Asset, ERC-20 compatible). Immutable after deploy.
    IERC20 public immutable bqrToken;

    /// @notice Number of campaigns created (also next campaign id).
    uint256 public campaignCount;

    /// @notice campaignId => Campaign
    mapping(uint256 => Campaign) internal _campaigns;

    /// @notice claimId => whether already claimed
    mapping(bytes32 => bool) internal _claimed;

    /// @notice Aggregate BQR base units successfully claimed (updated in a later phase).
    uint256 public totalClaimed;

    /// @dev Reserved for future storage variables (upgrade-safe layout).
    uint256[50] private __gap;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error ZeroAddress();
    error InvalidToken();
    error InvalidAmount();
    error InvalidProof();
    error InvalidTimeRange();
    error CampaignNotFound();
    error CampaignInactive();
    error CampaignNotStarted();
    error CampaignEnded();
    error AlreadyClaimed(bytes32 claimId);
    error InsufficientDistributorBalance(uint256 requested, uint256 available);
    error RootNotSet();
    error ClaimKeyZero();
    error Unauthorized();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event CampaignCreated(
        uint256 indexed campaignId,
        uint8 campaignType,
        bytes32 merkleRoot,
        uint64 startTime,
        uint64 endTime
    );

    event CampaignActiveUpdated(uint256 indexed campaignId, bool active);

    event Funded(address indexed from, uint256 amount);

    event RewardClaimed(
        address indexed account,
        uint256 indexed campaignId,
        bytes32 indexed claimId,
        bytes32 rewardId,
        uint256 amount
    );

    event BqrWithdrawn(address indexed to, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @param initialOwner Contract owner (Ownable2Step).
     * @param bqrToken_ BQR token address (non-zero).
     */
    constructor(address initialOwner, address bqrToken_) Ownable(initialOwner) {
        if (bqrToken_ == address(0)) {
            revert ZeroAddress();
        }
        bqrToken = IERC20(bqrToken_);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice BQR balance held by this distributor.
     */
    function tokenBalance() external view returns (uint256) {
        return bqrToken.balanceOf(address(this));
    }

    /**
     * @notice Return campaign configuration for `campaignId`.
     * @dev Does not revert for unused ids; returns empty/default Campaign.
     */
    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _campaigns[campaignId];
    }

    /**
     * @notice Whether `claimId` has already been consumed.
     */
    function isClaimed(bytes32 claimId) external view returns (bool) {
        return _claimed[claimId];
    }

    /**
     * @notice Whether `(campaignId, account, rewardId)` has already been claimed.
     */
    function isClaimed(
        uint256 campaignId,
        address account,
        bytes32 rewardId
    ) external view returns (bool) {
        return _claimed[_claimId(campaignId, account, rewardId)];
    }

    /**
     * @notice Compute the replay-protection claim id (amount is NOT included).
     */
    function getClaimId(
        uint256 campaignId,
        address account,
        bytes32 rewardId
    ) external pure returns (bytes32) {
        return _claimId(campaignId, account, rewardId);
    }

    /*//////////////////////////////////////////////////////////////
                         OWNER: CAMPAIGNS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a campaign with a fixed Merkle root and time window.
     * @dev `merkleRoot`, `startTime`, and `endTime` cannot be changed later.
     * @return campaignId 1-based campaign identifier.
     */
    function createCampaign(
        uint8 campaignType,
        bytes32 merkleRoot,
        uint64 startTime,
        uint64 endTime
    ) external onlyOwner returns (uint256 campaignId) {
        if (merkleRoot == bytes32(0)) {
            revert RootNotSet();
        }
        // endTime == 0 means no expiry; otherwise require a positive-length window.
        if (endTime != 0 && endTime <= startTime) {
            revert InvalidTimeRange();
        }

        unchecked {
            campaignId = ++campaignCount;
        }

        _campaigns[campaignId] = Campaign({
            merkleRoot: merkleRoot,
            startTime: startTime,
            endTime: endTime,
            active: true,
            campaignType: campaignType
        });

        emit CampaignCreated(campaignId, campaignType, merkleRoot, startTime, endTime);
    }

    /**
     * @notice Enable or disable claims for an existing campaign.
     * @dev Does not modify root, window, or campaignType.
     */
    function setCampaignActive(uint256 campaignId, bool active) external onlyOwner {
        Campaign storage campaign = _campaigns[campaignId];
        if (campaign.merkleRoot == bytes32(0)) {
            revert CampaignNotFound();
        }

        campaign.active = active;
        emit CampaignActiveUpdated(campaignId, active);
    }

    /*//////////////////////////////////////////////////////////////
                           OWNER: FUNDING
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Pull `amount` BQR from the owner into this distributor.
     * @dev Owner must `approve` this contract first. No internal accounting beyond the transfer.
     */
    function fund(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        bqrToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER: PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause user-facing operations (claims).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause user-facing operations.
    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                          OWNER: WITHDRAW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Withdraw unused BQR from the distributor while paused.
     * @dev CEI: validate → transfer → emit. No other storage writes.
     */
    function withdrawUnusedBqr(
        address to,
        uint256 amount
    ) external onlyOwner whenPaused nonReentrant {
        if (to == address(0)) {
            revert ZeroAddress();
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
     * @notice Claim BQR for `msg.sender` using a Merkle proof.
     * @dev CEI: validate → mark claimed → update `totalClaimed` → transfer → emit.
     * @return claimId Replay-protection id for `(campaignId, msg.sender, rewardId)`.
     */
    function claim(
        uint256 campaignId,
        bytes32 rewardId,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external whenNotPaused nonReentrant returns (bytes32 claimId) {
        // 1) Checks
        claimId = _validateClaim(campaignId, msg.sender, rewardId, amount, merkleProof);

        // 2) Effects
        _claimed[claimId] = true;
        totalClaimed += amount;

        // 3) Interactions
        bqrToken.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, campaignId, claimId, rewardId, amount);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev claimId = keccak256(abi.encodePacked(campaignId, account, rewardId))
     */
    function _claimId(
        uint256 campaignId,
        address account,
        bytes32 rewardId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(campaignId, account, rewardId));
    }

    /**
     * @dev Merkle leaf = keccak256(abi.encodePacked(account, rewardId, amount)).
     *      Campaign isolation is via per-campaign merkleRoot; replay via claimId
     *      (which still includes campaignId).
     */
    function _claimLeaf(
        address account,
        bytes32 rewardId,
        uint256 amount
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(account, rewardId, amount));
    }

    /**
     * @dev Run all claim validations. Reverts with custom errors on failure.
     *      No state writes.
     */
    function _validateClaim(
        uint256 campaignId,
        address account,
        bytes32 rewardId,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) internal view returns (bytes32 claimId) {
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (rewardId == bytes32(0)) {
            revert ClaimKeyZero();
        }

        // 1) Campaign exists.
        if (campaignId == 0 || campaignId > campaignCount) {
            revert CampaignNotFound();
        }

        Campaign storage campaign = _campaigns[campaignId];

        // 2) Campaign is active.
        if (!campaign.active) {
            revert CampaignInactive();
        }

        // 3) Time window [startTime, endTime] inclusive; endTime == 0 => no expiry.
        if (block.timestamp < campaign.startTime) {
            revert CampaignNotStarted();
        }
        if (campaign.endTime != 0 && block.timestamp > campaign.endTime) {
            revert CampaignEnded();
        }

        // 4) Merkle root exists.
        if (campaign.merkleRoot == bytes32(0)) {
            revert RootNotSet();
        }

        // 5) Compute claimId (amount excluded).
        claimId = _claimId(campaignId, account, rewardId);

        // 6) Replay protection check (no write in this phase).
        if (_claimed[claimId]) {
            revert AlreadyClaimed(claimId);
        }

        // 7) Verify Merkle proof for leaf bound to account, rewardId, amount
        //    against this campaign's root.
        bytes32 leaf = _claimLeaf(account, rewardId, amount);
        if (!MerkleProof.verifyCalldata(merkleProof, campaign.merkleRoot, leaf)) {
            revert InvalidProof();
        }
    }
}

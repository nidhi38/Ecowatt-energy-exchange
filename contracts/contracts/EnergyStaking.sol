// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EnergyStaking
 * @notice Stake ECOW tokens and earn energy-backed rewards at ~12% APY.
 * @dev Rewards are calculated per-second and funded by the owner depositing ECOW.
 *      Users may stake any amount, and unstake after LOCK_PERIOD (30 days).
 */
contract EnergyStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable ecowToken;

    uint256 public constant LOCK_PERIOD  = 30 days;
    uint256 public constant APY_BPS      = 1200;         // 12% APY (basis points)
    uint256 public constant SECONDS_YEAR = 365 days;

    struct Stake {
        uint256 amount;
        uint256 stakedAt;
        uint256 lastClaim;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    uint256 public rewardPool;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardPoolFunded(uint256 amount);

    constructor(address _ecowToken, address initialOwner) Ownable(initialOwner) {
        ecowToken = IERC20(_ecowToken);
    }

    // ── User actions ───────────────────────────────────────────────────────

    /**
     * @notice Stake ECOW tokens into the energy pool.
     * @param amount ECOW amount (18-dec) to stake.
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Staking: zero amount");

        // Auto-claim any pending rewards before adding more stake
        Stake storage s = stakes[msg.sender];
        if (s.amount > 0) {
            _claimRewards(msg.sender);
        }

        ecowToken.safeTransferFrom(msg.sender, address(this), amount);

        s.amount    += amount;
        s.stakedAt   = s.stakedAt == 0 ? block.timestamp : s.stakedAt;
        s.lastClaim  = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake ECOW tokens after the lock period and collect all rewards.
     * @param amount ECOW amount (18-dec) to withdraw.
     */
    function unstake(uint256 amount) external nonReentrant {
        Stake storage s = stakes[msg.sender];
        require(s.amount >= amount, "Staking: insufficient stake");
        require(block.timestamp >= s.stakedAt + LOCK_PERIOD, "Staking: still locked");

        uint256 reward = _claimRewards(msg.sender);

        s.amount    -= amount;
        totalStaked -= amount;
        if (s.amount == 0) {
            s.stakedAt  = 0;
            s.lastClaim = 0;
        }

        ecowToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, reward);
    }

    /**
     * @notice Claim accrued rewards without unstaking.
     */
    function claimRewards() external nonReentrant {
        uint256 reward = _claimRewards(msg.sender);
        require(reward > 0, "Staking: no rewards");
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    /**
     * @notice Fund the reward pool with ECOW tokens.
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        ecowToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _claimRewards(address user) internal returns (uint256 reward) {
        Stake storage s = stakes[user];
        if (s.amount == 0) return 0;

        uint256 elapsed = block.timestamp - s.lastClaim;
        reward = (s.amount * APY_BPS * elapsed) / (10_000 * SECONDS_YEAR);

        if (reward > rewardPool) reward = rewardPool;

        s.lastClaim = block.timestamp;

        if (reward > 0) {
            rewardPool -= reward;
            ecowToken.safeTransfer(user, reward);
            emit RewardClaimed(user, reward);
        }
    }

    // ── View ───────────────────────────────────────────────────────────────

    /**
     * @notice Pending rewards for a user (not yet claimed).
     */
    function pendingRewards(address user) external view returns (uint256) {
        Stake memory s = stakes[user];
        if (s.amount == 0) return 0;
        uint256 elapsed = block.timestamp - s.lastClaim;
        uint256 reward  = (s.amount * APY_BPS * elapsed) / (10_000 * SECONDS_YEAR);
        return reward > rewardPool ? rewardPool : reward;
    }

    /**
     * @notice Seconds remaining until a user can unstake.
     */
    function unlockIn(address user) external view returns (uint256) {
        Stake memory s = stakes[user];
        if (s.amount == 0 || block.timestamp >= s.stakedAt + LOCK_PERIOD) return 0;
        return (s.stakedAt + LOCK_PERIOD) - block.timestamp;
    }

    /**
     * @notice Full stake info for a user.
     */
    function getStake(address user) external view returns (
        uint256 amount, uint256 stakedAt, uint256 lockEnds, uint256 pendingReward
    ) {
        Stake memory s = stakes[user];
        amount        = s.amount;
        stakedAt      = s.stakedAt;
        lockEnds      = s.stakedAt + LOCK_PERIOD;
        uint256 elapsed = block.timestamp - s.lastClaim;
        pendingReward = (s.amount * APY_BPS * elapsed) / (10_000 * SECONDS_YEAR);
        if (pendingReward > rewardPool) pendingReward = rewardPool;
    }
}

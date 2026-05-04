import { expect } from "chai";
import { ethers } from "hardhat";
import { ECOWToken, EnergyStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EnergyStaking", function () {
  let token: ECOWToken;
  let staking: EnergyStaking;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;

  const STAKE_AMOUNT = ethers.parseEther("10000");
  const REWARD_POOL  = ethers.parseEther("50000");

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const TokenFactory   = await ethers.getContractFactory("ECOWToken");
    token = await TokenFactory.deploy(owner.address) as ECOWToken;

    const StakingFactory = await ethers.getContractFactory("EnergyStaking");
    staking = await StakingFactory.deploy(await token.getAddress(), owner.address) as EnergyStaking;

    // Fund reward pool and user
    await token.mint(owner.address, REWARD_POOL);
    await token.mint(user1.address, STAKE_AMOUNT);
    await token.approve(await staking.getAddress(), REWARD_POOL);
    await staking.fundRewardPool(REWARD_POOL);
    await token.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
  });

  it("User can stake tokens", async function () {
    await staking.connect(user1).stake(STAKE_AMOUNT);
    expect(await staking.totalStaked()).to.equal(STAKE_AMOUNT);
  });

  it("Accrues rewards over time", async function () {
    await staking.connect(user1).stake(STAKE_AMOUNT);
    await time.increase(30 * 24 * 60 * 60); // 30 days
    const pending = await staking.pendingRewards(user1.address);
    expect(pending).to.be.gt(0n);
  });

  it("Cannot unstake before lock period", async function () {
    await staking.connect(user1).stake(STAKE_AMOUNT);
    await expect(staking.connect(user1).unstake(STAKE_AMOUNT))
      .to.be.revertedWith("Staking: still locked");
  });

  it("Can unstake after lock period with rewards", async function () {
    await staking.connect(user1).stake(STAKE_AMOUNT);
    await time.increase(30 * 24 * 60 * 60 + 1);
    await staking.connect(user1).unstake(STAKE_AMOUNT);
    const balance = await token.balanceOf(user1.address);
    expect(balance).to.be.gt(STAKE_AMOUNT); // got back stake + rewards
  });
});

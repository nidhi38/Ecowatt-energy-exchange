import { expect } from "chai";
import { ethers } from "hardhat";
import { ECOWToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ECOWToken", function () {
  let token: ECOWToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ECOWToken");
    token = await Factory.deploy(owner.address) as ECOWToken;
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("EcoWatt Energy Token");
      expect(await token.symbol()).to.equal("ECOW");
    });

    it("Should set the owner as a minter", async function () {
      expect(await token.minters(owner.address)).to.be.true;
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });

  describe("Minting", function () {
    it("Owner can mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Non-minter cannot mint", async function () {
      const amount = ethers.parseEther("1000");
      await expect(token.connect(user1).mint(user2.address, amount))
        .to.be.revertedWith("ECOWToken: not a minter");
    });

    it("Added minter can mint", async function () {
      await token.addMinter(user1.address);
      const amount = ethers.parseEther("500");
      await token.connect(user1).mint(user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Cannot exceed max supply", async function () {
      const overMax = (await token.MAX_SUPPLY()) + 1n;
      await expect(token.mint(user1.address, overMax))
        .to.be.revertedWith("ECOWToken: exceeds max supply");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("User can burn their tokens and get kWh refund event", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(token.connect(user1).burnForEnergy(burnAmount))
        .to.emit(token, "EnergyBurned");
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
    });
  });

  describe("Energy conversions", function () {
    it("kwhOf returns correct value", async function () {
      const ecow = ethers.parseEther("10");  // 10 ECOW
      const kwh  = await token.kwhOf(ecow);
      // 10 ECOW * 0.1 = 1 kWh
      expect(kwh).to.equal(ethers.parseEther("1"));
    });

    it("ecowOf returns correct value", async function () {
      const kwh  = ethers.parseEther("5");   // 5 kWh
      const ecow = await token.ecowOf(kwh);
      // 5 kWh / 0.1 = 50 ECOW
      expect(ecow).to.equal(ethers.parseEther("50"));
    });
  });
});

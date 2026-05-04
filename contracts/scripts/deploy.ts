import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ── 1. Deploy ECOW Token ────────────────────────────────────────────────
  console.log("1/3  Deploying ECOWToken...");
  const ECOWToken = await ethers.getContractFactory("ECOWToken");
  const ecowToken = await ECOWToken.deploy(deployer.address);
  await ecowToken.waitForDeployment();
  const ecowAddr = await ecowToken.getAddress();
  console.log("     ECOWToken deployed to:", ecowAddr);

  // ── 2. Deploy Energy Marketplace ───────────────────────────────────────
  console.log("2/3  Deploying EnergyMarketplace...");
  const EnergyMarketplace = await ethers.getContractFactory("EnergyMarketplace");
  const marketplace = await EnergyMarketplace.deploy(ecowAddr, deployer.address);
  await marketplace.waitForDeployment();
  const marketAddr = await marketplace.getAddress();
  console.log("     EnergyMarketplace deployed to:", marketAddr);

  // ── 3. Deploy Energy Staking ────────────────────────────────────────────
  console.log("3/3  Deploying EnergyStaking...");
  const EnergyStaking = await ethers.getContractFactory("EnergyStaking");
  const staking = await EnergyStaking.deploy(ecowAddr, deployer.address);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("     EnergyStaking deployed to:", stakingAddr);

  // ── Post-deploy: authorise minters ──────────────────────────────────────
  console.log("\nConfiguring minter permissions...");
  await (await ecowToken.addMinter(marketAddr)).wait();
  console.log("  + Marketplace added as ECOW minter");
  await (await ecowToken.addMinter(stakingAddr)).wait();
  console.log("  + Staking pool added as ECOW minter");

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("Deployment complete. Update your .env and frontend:");
  console.log("═══════════════════════════════════════════════════");
  console.log(`ECOW_TOKEN_ADDRESS=${ecowAddr}`);
  console.log(`MARKETPLACE_ADDRESS=${marketAddr}`);
  console.log(`STAKING_ADDRESS=${stakingAddr}`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

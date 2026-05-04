# EcoWatt Smart Contracts

Three Solidity contracts that power the EcoWatt energy-trading platform.

```
contracts/
├── contracts/
│   ├── ECOWToken.sol          ERC-20 energy token (mint, burn, permits)
│   ├── EnergyMarketplace.sol  P2P buy/sell marketplace with fee collection
│   └── EnergyStaking.sol      30-day lock staking pool at ~12% APY
├── scripts/
│   └── deploy.ts              One-shot deployment + minter wiring
├── test/
│   ├── ECOWToken.test.ts      Token unit tests
│   └── EnergyStaking.test.ts  Staking unit tests
├── hardhat.config.ts          Multi-network Hardhat config
├── .env.example               Required environment variables
└── package.json               Hardhat toolchain
```

---

## Quick Start

### 1. Install dependencies

```bash
cd contracts
npm install        # or: yarn install / pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in DEPLOYER_PRIVATE_KEY, ALCHEMY_API_KEY, etc.
```

### 3. Compile contracts

```bash
npm run compile
```

### 4. Run tests

```bash
npm run test
# With gas report:
REPORT_GAS=true npm run test
```

### 5. Deploy

```bash
# Local Hardhat node (no .env needed)
npm run deploy:local

# Sepolia testnet
npm run deploy:sepolia

# Ethereum mainnet
npm run deploy:mainnet

# Other networks: polygon, arbitrum, base
npm run deploy:polygon
npm run deploy:base
```

After deployment the script prints the three contract addresses. Copy them into `contracts/.env` and your frontend `.env`.

### 6. Verify on Etherscan

```bash
npx hardhat verify --network sepolia <ECOW_TOKEN_ADDRESS> <DEPLOYER_ADDRESS>
npx hardhat verify --network sepolia <MARKETPLACE_ADDRESS> <ECOW_TOKEN_ADDRESS> <DEPLOYER_ADDRESS>
npx hardhat verify --network sepolia <STAKING_ADDRESS> <ECOW_TOKEN_ADDRESS> <DEPLOYER_ADDRESS>
```

---

## Contract Addresses (fill in after deploy)

| Contract           | Network  | Address |
|--------------------|----------|---------|
| ECOWToken          | Sepolia  |         |
| EnergyMarketplace  | Sepolia  |         |
| EnergyStaking      | Sepolia  |         |

---

## Token Economics

| Action | Rate |
|--------|------|
| Mint cost | 0.1 kWh per ECOW |
| Burn refund | 0.08 kWh per ECOW |
| Staking APY | ~12% |
| Lock period | 30 days |
| Max supply | 100,000,000 ECOW |
| Marketplace fee | 0.5% (configurable up to 5%) |

---

## Supported Networks

- Ethereum Mainnet & Sepolia
- Polygon Mainnet & Mumbai
- Arbitrum One
- Base Mainnet & Base Sepolia
- Local Hardhat node

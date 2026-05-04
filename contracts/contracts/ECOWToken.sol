// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title ECOWToken
 * @notice EcoWatt Energy Token — 1 ECOW = 0.1 kWh of verified renewable energy
 * @dev ERC-20 token with mint/burn backed by real energy certificates (RECs).
 *      Only the Marketplace and Staking contracts (and the owner) may mint.
 */
contract ECOWToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18; // 100M ECOW
    uint256 public constant KWH_PER_ECOW = 1e17;                 // 0.1 kWh (18 decimals)
    uint256 public constant KWH_REFUND_RATE = 8e16;              // 0.08 kWh per ECOW burned

    /// @notice Authorised minters (marketplace, staking, owner)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event EnergyMinted(address indexed to, uint256 ecow, uint256 kwhEquivalent);
    event EnergyBurned(address indexed from, uint256 ecow, uint256 kwhRefund);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "ECOWToken: not a minter");
        _;
    }

    constructor(address initialOwner)
        ERC20("EcoWatt Energy Token", "ECOW")
        Ownable(initialOwner)
        ERC20Permit("EcoWatt Energy Token")
    {
        minters[initialOwner] = true;
    }

    // ── Minter management ──────────────────────────────────────────────────

    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // ── Token operations ───────────────────────────────────────────────────

    /**
     * @notice Mint ECOW tokens in exchange for on-chain energy credits.
     * @param to      Recipient address
     * @param amount  ECOW amount (18-decimal wei)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "ECOWToken: exceeds max supply");
        _mint(to, amount);
        emit EnergyMinted(to, amount, (amount * KWH_PER_ECOW) / 10 ** 18);
    }

    /**
     * @notice Burn ECOW tokens and emit the kWh refund amount (off-chain settlement).
     * @param amount ECOW amount (18-decimal wei) to destroy
     */
    function burnForEnergy(uint256 amount) external {
        _burn(msg.sender, amount);
        uint256 kwhRefund = (amount * KWH_REFUND_RATE) / 10 ** 18;
        emit EnergyBurned(msg.sender, amount, kwhRefund);
    }

    // ── View helpers ───────────────────────────────────────────────────────

    /// @notice kWh equivalent for a given ECOW amount
    function kwhOf(uint256 ecow) external pure returns (uint256) {
        return (ecow * KWH_PER_ECOW) / 10 ** 18;
    }

    /// @notice ECOW equivalent for a given kWh amount
    function ecowOf(uint256 kwh) external pure returns (uint256) {
        return (kwh * 10 ** 18) / KWH_PER_ECOW;
    }
}

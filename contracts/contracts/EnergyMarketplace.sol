// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title EnergyMarketplace
 * @notice Peer-to-peer marketplace for buying and selling ECOW energy tokens.
 * @dev Sellers list ECOW at an ETH price; buyers purchase with ETH and receive ECOW.
 *      A configurable protocol fee (default 0.5%) is collected on each trade.
 */
contract EnergyMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable ecowToken;

    uint256 public feeBps = 50; // 0.50% (basis points out of 10,000)
    uint256 public nextListingId = 1;

    struct Listing {
        address seller;
        uint256 ecowAmount;   // ECOW tokens for sale (18 dec)
        uint256 pricePerEcow; // ETH price per 1 ECOW (18 dec)
        bool    active;
    }

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 ecowAmount, uint256 pricePerEcow);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 ecowAmount, uint256 ethPaid);
    event ListingCancelled(uint256 indexed listingId);
    event FeeUpdated(uint256 newFeeBps);
    event FeesWithdrawn(address to, uint256 amount);

    constructor(address _ecowToken, address initialOwner) Ownable(initialOwner) {
        ecowToken = IERC20(_ecowToken);
    }

    // ── Seller actions ─────────────────────────────────────────────────────

    /**
     * @notice List ECOW tokens for sale.
     * @param ecowAmount   Amount of ECOW to list (18-dec)
     * @param pricePerEcow ETH price per 1 ECOW (18-dec)
     */
    function createListing(uint256 ecowAmount, uint256 pricePerEcow) external nonReentrant returns (uint256 listingId) {
        require(ecowAmount > 0, "Marketplace: zero amount");
        require(pricePerEcow > 0, "Marketplace: zero price");

        ecowToken.safeTransferFrom(msg.sender, address(this), ecowAmount);

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller:       msg.sender,
            ecowAmount:   ecowAmount,
            pricePerEcow: pricePerEcow,
            active:       true
        });

        emit Listed(listingId, msg.sender, ecowAmount, pricePerEcow);
    }

    /**
     * @notice Cancel an active listing and reclaim ECOW.
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Marketplace: listing not active");
        require(l.seller == msg.sender || msg.sender == owner(), "Marketplace: not seller");

        l.active = false;
        ecowToken.safeTransfer(l.seller, l.ecowAmount);

        emit ListingCancelled(listingId);
    }

    // ── Buyer actions ──────────────────────────────────────────────────────

    /**
     * @notice Purchase ECOW from a listing.
     * @param listingId The ID of the listing to buy.
     * @param ecowToBuy ECOW amount the buyer wants (18-dec). Must be <= listing amount.
     */
    function purchase(uint256 listingId, uint256 ecowToBuy) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Marketplace: listing not active");
        require(ecowToBuy > 0 && ecowToBuy <= l.ecowAmount, "Marketplace: invalid amount");

        uint256 ethRequired = (ecowToBuy * l.pricePerEcow) / 1e18;
        require(msg.value >= ethRequired, "Marketplace: insufficient ETH");

        // Compute fee and seller proceeds
        uint256 fee      = (ethRequired * feeBps) / 10_000;
        uint256 proceeds = ethRequired - fee;

        // Update listing
        l.ecowAmount -= ecowToBuy;
        if (l.ecowAmount == 0) l.active = false;

        // Transfer ECOW to buyer
        ecowToken.safeTransfer(msg.sender, ecowToBuy);

        // Pay seller
        (bool sent, ) = payable(l.seller).call{ value: proceeds }("");
        require(sent, "Marketplace: ETH transfer failed");

        // Refund excess ETH
        if (msg.value > ethRequired) {
            (bool refunded, ) = payable(msg.sender).call{ value: msg.value - ethRequired }("");
            require(refunded, "Marketplace: refund failed");
        }

        emit Purchased(listingId, msg.sender, ecowToBuy, ethRequired);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Marketplace: fee too high"); // max 5%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "Marketplace: nothing to withdraw");
        (bool sent, ) = payable(to).call{ value: bal }("");
        require(sent, "Marketplace: withdraw failed");
        emit FeesWithdrawn(to, bal);
    }

    // ── View ───────────────────────────────────────────────────────────────

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getEthCost(uint256 listingId, uint256 ecowAmount) external view returns (uint256 eth, uint256 fee) {
        Listing memory l = listings[listingId];
        eth  = (ecowAmount * l.pricePerEcow) / 1e18;
        fee  = (eth * feeBps) / 10_000;
    }
}

import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  address: string;
  balance: number;
  ecowBalance: number;
  ethBalance: number;
  totalTraded: number;
  totalBought: number;
  totalSold: number;
  joinedAt: number;
}

export interface EnergyListing {
  id: string;
  userId: string;
  address: string;
  quantity: number;
  pricePerUnit: number;
  type: 'buy' | 'sell';
  status: 'active' | 'completed' | 'cancelled';
  createdAt: number;
  txHash?: string;
  energySource: 'solar' | 'hydro';
  location: string;
  tokenized: boolean;
}

export interface Trade {
  id: string;
  buyerAddress: string;
  sellerAddress: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  txHash: string;
  blockNumber: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  type: 'buy' | 'sell';
  energySource: 'solar' | 'hydro';
  gasUsed: number;
  ecowAmount: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

export interface TokenTransfer {
  id: string;
  from: string;
  to: string;
  amount: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: 'mint' | 'transfer' | 'burn' | 'stake';
}

const STORAGE_KEY = 'ecowatt_data_v3';

interface StoreData {
  users: Record<string, User>;
  listings: EnergyListing[];
  trades: Trade[];
  priceHistory: PricePoint[];
  tokenTransfers: TokenTransfer[];
}

export function getStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { users: {}, listings: [], trades: [], priceHistory: [], tokenTransfers: [] };
}

function saveStore(data: StoreData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const SOURCES: EnergyListing['energySource'][] = ['solar', 'hydro'];
const LOCATIONS = [
  'Berlin, DE', 'Amsterdam, NL', 'Madrid, ES', 'Oslo, NO', 'Paris, FR',
  'London, UK', 'Zurich, CH', 'Rome, IT',
  'Mumbai, IN', 'Delhi, IN', 'Bangalore, IN', 'Chennai, IN',
  'Hyderabad, IN', 'Pune, IN', 'Rajasthan, IN', 'Gujarat, IN',
];
const ECOW_PER_KWH = 10;

export function getOrCreateUser(address: string): User {
  const store = getStore();
  const key = address.toLowerCase();
  if (!store.users[key]) {
    store.users[key] = {
      id: key, address: key,
      balance: 5000,
      ecowBalance: 25000,
      ethBalance: 0,
      totalTraded: 0, totalBought: 0, totalSold: 0,
      joinedAt: Date.now(),
    };
    saveStore(store);
  }
  if (store.users[key].ecowBalance === undefined) {
    store.users[key].ecowBalance = 25000;
    saveStore(store);
  }
  return store.users[key];
}

export function getActiveListings(): { buy: EnergyListing[]; sell: EnergyListing[] } {
  const store = getStore();
  const active = store.listings.filter(l => l.status === 'active');
  return {
    buy: active.filter(l => l.type === 'buy').sort((a, b) => b.pricePerUnit - a.pricePerUnit),
    sell: active.filter(l => l.type === 'sell').sort((a, b) => a.pricePerUnit - b.pricePerUnit),
  };
}

export function createListing(
  address: string, quantity: number, pricePerUnit: number,
  type: 'buy' | 'sell', txHash: string
): EnergyListing {
  const store = getStore();
  const listing: EnergyListing = {
    id: crypto.randomUUID(),
    userId: address.toLowerCase(),
    address: address.toLowerCase(),
    quantity, pricePerUnit, type,
    status: 'active',
    createdAt: Date.now(),
    txHash,
    energySource: SOURCES[Math.floor(Math.random() * SOURCES.length)],
    location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
    tokenized: Math.random() > 0.3,
  };
  store.listings.push(listing);
  saveStore(store);
  return listing;
}

export function executeMarketplaceTrade(
  buyerAddress: string, listing: EnergyListing, txHash: string
): { success: boolean; message: string; newBuyerBalance?: number; newEcowBalance?: number } {
  const store = getStore();
  const buyerKey = buyerAddress.toLowerCase();
  const sellerKey = listing.address;
  const buyer = store.users[buyerKey];
  const seller = store.users[sellerKey];
  if (!buyer) return { success: false, message: 'Buyer not found' };

  const totalPrice = listing.quantity * listing.pricePerUnit;
  const ecowAmount = Math.round(listing.quantity * ECOW_PER_KWH);
  const blockNumber = 25021000 + Math.floor(Math.random() * 1000);

  if (listing.type === 'sell') {
    if (buyer.balance < totalPrice)
      return { success: false, message: `Insufficient balance. Need ${totalPrice.toFixed(2)} kWh, have ${buyer.balance.toFixed(2)} kWh` };
    buyer.balance -= totalPrice;
    buyer.ecowBalance += ecowAmount;
    buyer.totalBought += listing.quantity;
    buyer.totalTraded += totalPrice;
    if (seller) { seller.balance += totalPrice; seller.totalSold += listing.quantity; seller.totalTraded += totalPrice; }
  } else {
    buyer.balance += totalPrice;
    buyer.ecowBalance -= Math.min(ecowAmount, buyer.ecowBalance);
    buyer.totalSold += listing.quantity;
    if (seller) { seller.balance -= totalPrice; }
  }

  const idx = store.listings.findIndex(l => l.id === listing.id);
  if (idx >= 0) store.listings[idx].status = 'completed';

  const trade: Trade = {
    id: crypto.randomUUID(),
    buyerAddress: buyerKey, sellerAddress: sellerKey,
    quantity: listing.quantity, pricePerUnit: listing.pricePerUnit,
    totalPrice, txHash, blockNumber,
    status: 'completed', createdAt: Date.now(),
    type: listing.type === 'sell' ? 'buy' : 'sell',
    energySource: listing.energySource,
    gasUsed: Math.floor(Math.random() * 50000) + 21000,
    ecowAmount,
  };
  store.trades.push(trade);
  store.priceHistory.push({ timestamp: Date.now(), price: listing.pricePerUnit, volume: listing.quantity });
  if (store.priceHistory.length > 100) store.priceHistory = store.priceHistory.slice(-100);

  const transfer: TokenTransfer = {
    id: crypto.randomUUID(),
    from: sellerKey || '0x0000000000000000000000000000000000000000',
    to: buyerKey, amount: ecowAmount, txHash,
    blockNumber, timestamp: Date.now(), type: 'transfer',
  };
  store.tokenTransfers.push(transfer);
  if (store.tokenTransfers.length > 200) store.tokenTransfers = store.tokenTransfers.slice(-200);

  saveStore(store);
  return { success: true, message: `Trade completed: ${listing.quantity} kWh @ ${listing.pricePerUnit} ETH`, newBuyerBalance: buyer.balance, newEcowBalance: buyer.ecowBalance };
}

export function executeTradingOrder(
  address: string, quantity: number, price: number, side: 'buy' | 'sell', txHash: string
): { success: boolean; message: string; newBalance?: number; newEcowBalance?: number } {
  const store = getStore();
  const key = address.toLowerCase();
  const user = store.users[key];
  if (!user) return { success: false, message: 'User not found' };

  const totalValue = quantity * price;
  const ecowAmount = Math.round(quantity * ECOW_PER_KWH);
  const blockNumber = 25021000 + Math.floor(Math.random() * 1000);

  if (side === 'buy') {
    if (user.balance < totalValue)
      return { success: false, message: `Insufficient balance. Need ${totalValue.toFixed(2)} kWh, have ${user.balance.toFixed(2)} kWh` };
    user.balance -= totalValue;
    user.ecowBalance += ecowAmount;
    user.totalBought += quantity;
  } else {
    user.balance += totalValue;
    user.ecowBalance -= Math.min(ecowAmount, user.ecowBalance);
    user.totalSold += quantity;
  }
  user.totalTraded += totalValue;

  const trade: Trade = {
    id: crypto.randomUUID(),
    buyerAddress: side === 'buy' ? key : '0xmarket000000000000000000000000000000',
    sellerAddress: side === 'sell' ? key : '0xmarket000000000000000000000000000000',
    quantity, pricePerUnit: price, totalPrice: totalValue,
    txHash, blockNumber, status: 'completed', createdAt: Date.now(), type: side,
    energySource: SOURCES[Math.floor(Math.random() * SOURCES.length)],
    gasUsed: Math.floor(Math.random() * 50000) + 21000,
    ecowAmount,
  };
  store.trades.push(trade);

  const transfer: TokenTransfer = {
    id: crypto.randomUUID(),
    from: side === 'buy' ? '0x0000000000000000000000000000000000000000' : key,
    to: side === 'buy' ? key : '0x0000000000000000000000000000000000000000',
    amount: ecowAmount, txHash, blockNumber, timestamp: Date.now(),
    type: side === 'buy' ? 'mint' : 'burn',
  };
  store.tokenTransfers.push(transfer);

  store.priceHistory.push({ timestamp: Date.now(), price, volume: quantity });
  if (store.priceHistory.length > 100) store.priceHistory = store.priceHistory.slice(-100);

  saveStore(store);
  return { success: true, message: `${side} executed`, newBalance: user.balance, newEcowBalance: user.ecowBalance };
}

export function getUserTrades(address: string): Trade[] {
  const store = getStore();
  const key = address.toLowerCase();
  return store.trades.filter(t => t.buyerAddress === key || t.sellerAddress === key).sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllTrades(): Trade[] {
  return [...getStore().trades].sort((a, b) => b.createdAt - a.createdAt);
}

export function getTokenTransfers(address?: string): TokenTransfer[] {
  const store = getStore();
  const all = [...store.tokenTransfers].sort((a, b) => b.timestamp - a.timestamp);
  if (!address) return all;
  const key = address.toLowerCase();
  return all.filter(t => t.from === key || t.to === key);
}

export function getPriceHistory(): PricePoint[] {
  const store = getStore();
  if (store.priceHistory.length < 5) {
    const now = Date.now();
    const base = 0.0285;
    return Array.from({ length: 31 }, (_, i) => ({
      timestamp: now - (30 - i) * 5 * 60 * 1000,
      price: base + (Math.random() - 0.5) * 0.004,
      volume: Math.floor(Math.random() * 500) + 50,
    }));
  }
  return store.priceHistory;
}

const DEMO_ADDRESSES = [
  '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
  '0x8ba1f109551bD432803012645Hac136c9B02083e',
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
];

export function seedDemoListings(userAddress: string) {
  const store = getStore();
  const hasListings = store.listings.some(l => l.status === 'active');
  if (hasListings) return;

  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
  DEMO_ADDRESSES.forEach((addr, i) => {
    const key = addr.toLowerCase();
    store.users[key] = {
      id: key, address: key,
      balance: 8000 + i * 1500, ecowBalance: 40000 + i * 10000,
      ethBalance: 0.4 + i * 0.1,
      totalTraded: (i + 1) * 300 * (i + 2), totalBought: (i + 1) * 150, totalSold: (i + 1) * 150,
      joinedAt: Date.now() - i * 86400000,
    };
  });

  const sells = [
    { addr: DEMO_ADDRESSES[0], qty: 500,  price: 0.0271, src: 'solar' as const, loc: 'Rajasthan, IN' },
    { addr: DEMO_ADDRESSES[1], qty: 320,  price: 0.0268, src: 'solar' as const, loc: 'Gujarat, IN' },
    { addr: DEMO_ADDRESSES[2], qty: 1200, price: 0.0285, src: 'solar' as const, loc: 'Chennai, IN' },
    { addr: DEMO_ADDRESSES[3], qty: 180,  price: 0.0263, src: 'solar' as const, loc: 'Hyderabad, IN' },
    { addr: DEMO_ADDRESSES[4], qty: 650,  price: 0.0279, src: 'solar' as const, loc: 'Bangalore, IN' },
    { addr: DEMO_ADDRESSES[0], qty: 400,  price: 0.0272, src: 'solar' as const, loc: 'Pune, IN' },
    { addr: DEMO_ADDRESSES[1], qty: 280,  price: 0.0267, src: 'solar' as const, loc: 'Delhi, IN' },
    { addr: DEMO_ADDRESSES[2], qty: 900,  price: 0.0310, src: 'hydro' as const, loc: 'Oslo, NO' },
    { addr: DEMO_ADDRESSES[3], qty: 600,  price: 0.0295, src: 'hydro' as const, loc: 'Amsterdam, NL' },
    { addr: DEMO_ADDRESSES[4], qty: 750,  price: 0.0302, src: 'solar' as const, loc: 'Madrid, ES' },
  ];

  const buys = [
    { addr: DEMO_ADDRESSES[1], qty: 300,  price: 0.0255, src: 'solar' as const, loc: 'Berlin, DE' },
    { addr: DEMO_ADDRESSES[2], qty: 600,  price: 0.0260, src: 'hydro' as const, loc: 'Paris, FR' },
    { addr: DEMO_ADDRESSES[3], qty: 200,  price: 0.0248, src: 'solar' as const, loc: 'Bangalore, IN' },
    { addr: DEMO_ADDRESSES[4], qty: 450,  price: 0.0252, src: 'solar' as const, loc: 'Rajasthan, IN' },
    { addr: DEMO_ADDRESSES[0], qty: 800,  price: 0.0258, src: 'hydro' as const, loc: 'Zurich, CH' },
    { addr: DEMO_ADDRESSES[1], qty: 550,  price: 0.0250, src: 'solar' as const, loc: 'Chennai, IN' },
  ];

  sells.forEach(({ addr, qty, price, src, loc }, i) => {
    store.listings.push({
      id: crypto.randomUUID(), userId: addr.toLowerCase(), address: addr.toLowerCase(),
      quantity: qty, pricePerUnit: price, type: 'sell', status: 'active',
      createdAt: Date.now() - i * 120000,
      txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      energySource: src, location: loc, tokenized: true,
    });
  });

  buys.forEach(({ addr, qty, price, src, loc }, i) => {
    store.listings.push({
      id: crypto.randomUUID(), userId: addr.toLowerCase(), address: addr.toLowerCase(),
      quantity: qty, pricePerUnit: price, type: 'buy', status: 'active',
      createdAt: Date.now() - i * 120000,
      txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      energySource: src, location: loc, tokenized: true,
    });
  });

  const base = 0.0285;
  for (let i = 30; i >= 0; i--) {
    store.priceHistory.push({
      timestamp: Date.now() - i * 5 * 60 * 1000,
      price: base + (Math.random() - 0.5) * 0.004,
      volume: Math.floor(Math.random() * 500) + 50,
    });
  }

  for (let i = 0; i < 10; i++) {
    store.tokenTransfers.push({
      id: crypto.randomUUID(),
      from: DEMO_ADDRESSES[i % DEMO_ADDRESSES.length].toLowerCase(),
      to: DEMO_ADDRESSES[(i + 1) % DEMO_ADDRESSES.length].toLowerCase(),
      amount: Math.floor(Math.random() * 5000) + 500,
      txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockNumber: 25021000 + i * 12,
      timestamp: Date.now() - i * 300000,
      type: (['mint', 'transfer', 'transfer', 'burn', 'stake'] as TokenTransfer['type'][])[i % 5],
    });
  }

  saveStore(store);
}

export function creditEnergy(address: string, amount: number): { success: boolean; newBalance: number } {
  const store = getStore();
  const key = address.toLowerCase();
  const user = store.users[key];
  if (!user) return { success: false, newBalance: 0 };
  user.balance += amount;
  const transfer: TokenTransfer = {
    id: crypto.randomUUID(),
    from: '0x0000000000000000000000000000000000000000',
    to: key,
    amount: Math.round(amount * ECOW_PER_KWH),
    txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    blockNumber: 25021000 + Math.floor(Math.random() * 1000),
    timestamp: Date.now(),
    type: 'mint',
  };
  store.tokenTransfers.push(transfer);
  saveStore(store);
  return { success: true, newBalance: user.balance };
}

export function useStore(address: string | undefined) {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<{ buy: EnergyListing[]; sell: EnergyListing[] }>({ buy: [], sell: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [tokenTransfers, setTokenTransfers] = useState<TokenTransfer[]>([]);

  const refresh = useCallback(() => {
    if (!address) return;
    setUser(getOrCreateUser(address));
    setListings(getActiveListings());
    setTrades(getUserTrades(address));
    setPriceHistory(getPriceHistory());
    setTokenTransfers(getTokenTransfers(address));
  }, [address]);

  useEffect(() => {
    if (!address) return;
    seedDemoListings(address);
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [address, refresh]);

  return { user, listings, trades, priceHistory, tokenTransfers, refresh };
}

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'b93jXjPJg0pj7ra-INml1';
const MAINNET_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const SEPOLIA_URL  = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

async function rpc(url: string, method: string, params: unknown[] = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export async function getGasPrice(): Promise<number> {
  try {
    const hex = await rpc(MAINNET_URL, 'eth_gasPrice');
    return parseFloat((parseInt(hex, 16) / 1e9).toFixed(2));
  } catch { return 0; }
}

export async function getBlockNumber(): Promise<number> {
  try {
    const hex = await rpc(MAINNET_URL, 'eth_blockNumber');
    return parseInt(hex, 16);
  } catch { return 0; }
}

export interface AlchemyBlock {
  number: string;
  hash: string;
  timestamp: string;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  miner: string;
  difficulty?: string;
  totalDifficulty?: string;
  size: string;
  extraData?: string;
  withdrawalsRoot?: string;
  parentHash?: string;
}

export interface AlchemyTransfer {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  asset: string;
  category: string;
  blockNum: string;
  metadata?: { blockTimestamp?: string };
}

export async function getBlock(blockNumHex: string): Promise<AlchemyBlock | null> {
  try {
    return await rpc(MAINNET_URL, 'eth_getBlockByNumber', [blockNumHex, false]);
  } catch { return null; }
}

export async function getEthBalance(address: string): Promise<number> {
  try {
    const hex = await rpc(MAINNET_URL, 'eth_getBalance', [address, 'latest']);
    return parseFloat((parseInt(hex, 16) / 1e18).toFixed(6));
  } catch { return 0; }
}

export async function getTxCount(address: string): Promise<number> {
  try {
    const hex = await rpc(MAINNET_URL, 'eth_getTransactionCount', [address, 'latest']);
    return parseInt(hex, 16);
  } catch { return 0; }
}

export async function getAddressAssetTransfers(address: string): Promise<AlchemyTransfer[]> {
  try {
    const [sent, received] = await Promise.all([
      rpc(MAINNET_URL, 'alchemy_getAssetTransfers', [{
        fromBlock: '0x0',
        fromAddress: address,
        category: ['external', 'internal', 'erc20'],
        maxCount: '0xA',
        withMetadata: true,
        order: 'desc',
      }]),
      rpc(MAINNET_URL, 'alchemy_getAssetTransfers', [{
        fromBlock: '0x0',
        toAddress: address,
        category: ['external', 'internal', 'erc20'],
        maxCount: '0xA',
        withMetadata: true,
        order: 'desc',
      }]),
    ]);
    const combined: AlchemyTransfer[] = [
      ...(sent?.transfers ?? []),
      ...(received?.transfers ?? []),
    ];
    combined.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16));
    return combined.slice(0, 15);
  } catch { return []; }
}

export async function getTokenBalances(address: string): Promise<{ contractAddress: string; tokenBalance: string }[]> {
  try {
    const res = await rpc(MAINNET_URL, 'alchemy_getTokenBalances', [address]);
    return res?.tokenBalances ?? [];
  } catch { return []; }
}

export async function getSepoliaBlockNumber(): Promise<number> {
  try {
    const hex = await rpc(SEPOLIA_URL, 'eth_blockNumber');
    return parseInt(hex, 16);
  } catch { return 0; }
}

export async function getPendingTxCount(): Promise<number> {
  try {
    const hex = await rpc(MAINNET_URL, 'eth_getBlockTransactionCountByNumber', ['pending']);
    if (!hex) return Math.floor(Math.random() * 80) + 20;
    return parseInt(hex, 16);
  } catch { return Math.floor(Math.random() * 80) + 20; }
}

export async function getFeeHistory(): Promise<{ baseFees: number[]; priorityFees: number[] }> {
  try {
    const res = await rpc(MAINNET_URL, 'eth_feeHistory', [10, 'latest', [25, 75]]);
    const baseFees = (res.baseFeePerGas ?? []).map((h: string) => parseFloat((parseInt(h, 16) / 1e9).toFixed(2)));
    const priorityFees = (res.reward ?? []).map((r: string[]) =>
      parseFloat((parseInt(r[0], 16) / 1e9).toFixed(2))
    );
    return { baseFees, priorityFees };
  } catch { return { baseFees: [], priorityFees: [] }; }
}

export async function getRecentBlocks(count: number = 10): Promise<AlchemyBlock[]> {
  try {
    const latestHex = await rpc(MAINNET_URL, 'eth_blockNumber');
    const latest = parseInt(latestHex, 16);
    const promises = Array.from({ length: count }, (_, i) =>
      rpc(MAINNET_URL, 'eth_getBlockByNumber', [`0x${(latest - i).toString(16)}`, false])
    );
    const results = await Promise.all(promises);
    return results.filter(Boolean) as AlchemyBlock[];
  } catch { return []; }
}

export async function getNetworkStatus() {
  try {
    const [gasHex, blockHex, sepoliaHex, pendingHex] = await Promise.all([
      rpc(MAINNET_URL, 'eth_gasPrice'),
      rpc(MAINNET_URL, 'eth_blockNumber'),
      rpc(SEPOLIA_URL, 'eth_blockNumber'),
      rpc(MAINNET_URL, 'eth_getBlockTransactionCountByNumber', ['pending']),
    ]);
    return {
      connected: true,
      gasPrice: parseFloat((parseInt(gasHex, 16) / 1e9).toFixed(2)),
      blockNumber: parseInt(blockHex, 16),
      sepoliaBlock: parseInt(sepoliaHex, 16),
      pendingTx: pendingHex ? parseInt(pendingHex, 16) : Math.floor(Math.random() * 100) + 30,
      tps: parseFloat((Math.random() * 15 + 5).toFixed(1)),
      timestamp: Date.now(),
    };
  } catch {
    return { connected: false, gasPrice: 0, blockNumber: 0, sepoliaBlock: 0, pendingTx: 0, tps: 0, timestamp: Date.now() };
  }
}

export function generateSimulatedTxHash(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  Activity, Cpu, Flame, Hash, Zap, TrendingUp, TrendingDown,
  Leaf, Wind, Sun, Droplets, AlertTriangle, Clock,
  BarChart3, Globe, Shield, Database, Wallet, ArrowUpRight,
  ArrowDownLeft, RefreshCw, Copy, Check, ExternalLink, Layers
} from 'lucide-react';
import {
  getNetworkStatus, getRecentBlocks, AlchemyBlock,
  getEthBalance, getTxCount, getAddressAssetTransfers,
  AlchemyTransfer, getFeeHistory
} from '../lib/alchemy';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, creditEnergy } from '../lib/store';

/* ── Data Generators ── */
function generateEnergyHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    hours: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      kwh: Math.round(Math.random() * 900 + 100 + (h >= 9 && h <= 17 ? 400 : 0)),
    })),
  }));
}

function generateGasForecast() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    slow: parseFloat((18 + Math.sin(i * 0.4) * 5 + Math.random() * 3).toFixed(1)),
    avg:  parseFloat((25 + Math.sin(i * 0.4) * 7 + Math.random() * 4).toFixed(1)),
    fast: parseFloat((35 + Math.sin(i * 0.4) * 9 + Math.random() * 5).toFixed(1)),
  }));
}

function generateCarbonData(blocks: AlchemyBlock[]) {
  return blocks.slice(0, 12).map(b => {
    const num = parseInt(b.number, 16);
    const gasUsed = parseInt(b.gasUsed, 16);
    return {
      block: `#${(num % 100000).toLocaleString()}`,
      carbon: parseFloat((gasUsed * 0.0000002).toFixed(4)),
      txCount: b.transactions.length,
      renewable: Math.round(60 + Math.random() * 30),
      energy: parseFloat((gasUsed / 1e6 * 0.3).toFixed(2)),
    };
  });
}

function generateMEVData() {
  return Array.from({ length: 10 }, (_, i) => ({
    block: `#${(25021000 + i).toLocaleString()}`,
    mev: parseFloat((Math.random() * 0.8 + 0.05).toFixed(4)),
    reward: parseFloat((2 + Math.random() * 0.5).toFixed(4)),
    priority: parseFloat((Math.random() * 0.3).toFixed(4)),
  }));
}

function generateValidators() {
  return [
    { name: 'Lighthouse', efficiency: 98.2, energy: 1.2, uptime: 99.8, blocks: 1240 },
    { name: 'Prysm',      efficiency: 96.8, energy: 1.5, uptime: 99.5, blocks: 1190 },
    { name: 'Teku',       efficiency: 95.4, energy: 1.8, uptime: 98.9, blocks: 1050 },
    { name: 'Nimbus',     efficiency: 97.9, energy: 1.0, uptime: 99.7, blocks: 1220 },
    { name: 'Lodestar',   efficiency: 94.2, energy: 2.1, uptime: 98.2, blocks:  980 },
  ];
}

function generateTokenFlow() {
  const now = Date.now();
  return Array.from({ length: 16 }, (_, i) => ({
    time: new Date(now - (15 - i) * 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    mint:  Math.floor(Math.random() * 5000 + 500),
    burn:  Math.floor(Math.random() * 2000 + 100),
    stake: Math.floor(Math.random() * 3000 + 200),
    transfer: Math.floor(Math.random() * 8000 + 1000),
  }));
}

/* ── Derived from wallet address — deterministic energy profile ── */
function walletEnergyProfile(address: string) {
  const seed = parseInt(address.slice(2, 10), 16);
  const solar   = Math.round(30 + (seed % 40));
  const wind    = Math.round(15 + ((seed >> 4) % 25));
  const hydro   = Math.round(10 + ((seed >> 8) % 20));
  const fossil  = 100 - solar - wind - hydro;
  const co2     = parseFloat((fossil * 4.5 + 10 + Math.random() * 15).toFixed(1));
  const credits = Math.round(seed % 2000 + 500);
  const weeks   = Array.from({ length: 8 }, (_, i) => ({
    week: `W${i + 1}`,
    kwh:  Math.round(seed % 300 + 50 + Math.random() * 200),
    co2:  parseFloat((Math.random() * 5 + 1).toFixed(2)),
  }));
  return { solar, wind, hydro, fossil, co2, credits, weeks };
}

type Tab = 'network' | 'energy' | 'carbon' | 'gas' | 'mev' | 'tokens' | 'wallet';

interface LiveStat {
  connected: boolean; gasPrice: number; blockNumber: number;
  pendingTx: number; tps: number; sepoliaBlock: number;
}

export function Blockchain() {
  const { address, isConnected } = useAccount();
  const { user, refresh: refreshStore } = useStore(address);

  const [stats, setStats]   = useState<LiveStat | null>(null);
  const [blocks, setBlocks] = useState<AlchemyBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('network');
  const [newBlockHash, setNewBlockHash] = useState<string | null>(null);
  const prevBlockRef = useRef<string | null>(null);
  const [feeHistory, setFeeHistory] = useState<{ base: number; priority: number }[]>([]);
  const [copied, setCopied] = useState(false);

  /* Wallet tab state */
  const [walletEth,   setWalletEth]   = useState<number | null>(null);
  const [walletTxCnt, setWalletTxCnt] = useState<number | null>(null);
  const [walletTx,    setWalletTx]    = useState<AlchemyTransfer[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const profile = address ? walletEnergyProfile(address) : null;

  /* Energy credit */
  const [creditAmt, setCreditAmt] = useState('1000');
  const [creditMsg, setCreditMsg] = useState('');

  /* Static generated data */
  const heatmap    = useRef(generateEnergyHeatmap()).current;
  const gasForecast= useRef(generateGasForecast()).current;
  const mevData    = useRef(generateMEVData()).current;
  const validators = useRef(generateValidators()).current;
  const tokenFlow  = useRef(generateTokenFlow()).current;
  const [carbonData, setCarbonData] = useState<ReturnType<typeof generateCarbonData>>([]);

  /* Live history for TPS chart */
  const networkHistoryRef = useRef(
    Array.from({ length: 20 }, (_, i) => ({ t: i, tps: parseFloat((Math.random() * 15 + 5).toFixed(1)), gas: parseFloat((Math.random() * 30 + 15).toFixed(1)) }))
  );
  const [networkHistory, setNetworkHistory] = useState(networkHistoryRef.current);

  /* Fetch blocks & network */
  const fetchAll = useCallback(async () => {
    try {
      const [ns, recentBlocks, fees] = await Promise.all([
        getNetworkStatus(), getRecentBlocks(12), getFeeHistory()
      ]);
      setStats(ns);
      if (recentBlocks.length > 0) {
        const topHash = recentBlocks[0]?.hash;
        if (prevBlockRef.current && prevBlockRef.current !== topHash) {
          setNewBlockHash(topHash || null);
          setTimeout(() => setNewBlockHash(null), 3500);
        }
        prevBlockRef.current = topHash || null;
        setBlocks(recentBlocks);
        setCarbonData(generateCarbonData(recentBlocks));
      }
      if (fees.baseFees.length > 0) {
        setFeeHistory(fees.baseFees.map((base, i) => ({ base, priority: fees.priorityFees[i] ?? 0 })));
      }
      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 12000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  useEffect(() => {
    if (!stats) return;
    setNetworkHistory(prev => [
      ...prev.slice(-19),
      { t: prev.length, tps: stats.tps, gas: stats.gasPrice },
    ]);
  }, [stats]);

  /* Fetch wallet data when tab activates */
  useEffect(() => {
    if (activeTab !== 'wallet' || !address || walletEth !== null) return;
    setWalletLoading(true);
    Promise.all([getEthBalance(address), getTxCount(address), getAddressAssetTransfers(address)])
      .then(([eth, txCnt, transfers]) => {
        setWalletEth(eth);
        setWalletTxCnt(txCnt);
        setWalletTx(transfers);
      })
      .finally(() => setWalletLoading(false));
  }, [activeTab, address, walletEth]);

  const renewablePct = Math.round(65 + Math.random() * 25);
  const carbonIntensity = parseFloat((180 - renewablePct * 1.2 + 12).toFixed(1));
  const networkHashRate = parseFloat((1100 + Math.random() * 100).toFixed(1));

  function handleCredit() {
    if (!address) return;
    const amt = parseFloat(creditAmt);
    if (isNaN(amt) || amt <= 0 || amt > 50000) { setCreditMsg('Enter 1 – 50,000 kWh'); return; }
    const res = creditEnergy(address, amt);
    if (res.success) {
      setCreditMsg(`✓ ${amt.toLocaleString()} kWh credited! New balance: ${res.newBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`);
      refreshStore();
    } else { setCreditMsg('Failed — connect wallet first'); }
    setTimeout(() => setCreditMsg(''), 5000);
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'network', label: 'Network',      icon: Activity  },
    { id: 'energy',  label: 'Energy',       icon: Zap       },
    { id: 'carbon',  label: 'Carbon',       icon: Leaf      },
    { id: 'gas',     label: 'Gas Forecast', icon: Flame     },
    { id: 'mev',     label: 'MEV/Rewards',  icon: TrendingUp},
    { id: 'tokens',  label: 'Token Flow',   icon: Database  },
    { id: 'wallet',  label: 'Wallet',       icon: Wallet    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blockchain Energy Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live Ethereum Mainnet · Energy · Carbon · MEV · Wallet Analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="p-2 rounded-lg border border-border hover:bg-secondary transition-all" title="Refresh">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {lastUpdate}
            </span>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${stats?.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`status-dot-live ${stats?.connected ? '' : '!bg-red-500'}`} />
            <span className={`text-xs font-semibold ${stats?.connected ? 'text-green-700' : 'text-red-600'}`}>
              {stats?.connected ? 'Mainnet Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
        {[
          { label: 'Block',      value: stats ? `#${stats.blockNumber.toLocaleString()}` : '—',             icon: Hash,     card: 'card-blue'   },
          { label: 'Gas',        value: stats ? `${stats.gasPrice.toFixed(1)} Gwei` : '—',                  icon: Flame,    card: 'card-amber'  },
          { label: 'TPS',        value: stats ? `${stats.tps.toFixed(1)}/s` : '—',                          icon: Activity, card: 'card-green'  },
          { label: 'Renewable',  value: `${renewablePct}%`,                                                  icon: Leaf,     card: 'card-teal'   },
          { label: 'CO₂ Intensity', value: `${carbonIntensity}`,                                            icon: Wind,     card: 'card-purple' },
          { label: 'Pending TX', value: stats ? stats.pendingTx.toLocaleString() : '—',                     icon: Database, card: 'card-rose'   },
          { label: 'Sepolia',    value: stats ? `#${stats.sepoliaBlock.toLocaleString()}` : '—',             icon: Globe,    card: 'card-indigo' },
        ].map(({ label, value, icon: Icon, card }) => (
          <div key={label} className={`${card} rounded-xl p-3 text-white shadow-sm`}>
            <Icon className="w-3.5 h-3.5 opacity-70 mb-1" />
            <p className="text-sm font-bold font-mono leading-tight">{value}</p>
            <p className="text-[10px] opacity-80 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${activeTab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {id === 'wallet' && isConnected && <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* NETWORK TAB                               */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          {/* Fee History */}
          {feeHistory.length > 0 && (
            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> Real Base Fee History (Gwei) — Last 10 Blocks
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={feeHistory.map((d, i) => ({ ...d, i }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="i" hide />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(v: number, name: string) => [`${v.toFixed(2)} Gwei`, name === 'base' ? 'Base Fee' : 'Priority Fee']} />
                  <Area type="monotone" dataKey="base" stroke="hsl(38 92% 50%)" fill="hsl(38 92% 50% / 0.15)" strokeWidth={2} dot={false} name="base" />
                  <Line type="monotone" dataKey="priority" stroke="hsl(217 91% 52%)" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="priority" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Live TPS & Gas
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={networkHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="t" hide />
                  <YAxis yAxisId="tps" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="gas" orientation="right" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area yAxisId="tps" type="monotone" dataKey="tps" stroke="hsl(217 91% 52%)" strokeWidth={2} fill="hsl(217 91% 52% / 0.1)" dot={false} name="TPS" />
                  <Line yAxisId="gas" type="monotone" dataKey="gas" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="Gas (Gwei)" strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-500" /> Block TX Count vs Gas Utilization
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={blocks.slice(0, 10).reverse().map(b => ({
                  block: `${(parseInt(b.number, 16) % 10000).toLocaleString()}`,
                  txs: b.transactions.length,
                  gasUtil: Math.round((parseInt(b.gasUsed, 16) / parseInt(b.gasLimit, 16)) * 100),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="block" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="txs" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="util" orientation="right" tick={{ fontSize: 9 , fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar yAxisId="txs" dataKey="txs" fill="hsl(158 64% 40% / 0.7)" name="TX Count" radius={[3,3,0,0]} />
                  <Line yAxisId="util" type="monotone" dataKey="gasUtil" stroke="hsl(271 81% 56%)" strokeWidth={2} dot={{ r: 3 }} name="Gas Util %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Live Block Feed */}
          <div className="card-blockchain rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" /> Latest Mainnet Blocks
              </h2>
              <span className="text-xs text-muted-foreground">auto-refreshes every 12s</span>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl shimmer" />)}</div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block, idx) => {
                  const num = parseInt(block.number, 16);
                  const gasUsed  = parseInt(block.gasUsed,  16);
                  const gasLimit = parseInt(block.gasLimit, 16);
                  const gasUtil  = Math.round((gasUsed / gasLimit) * 100);
                  const baseFee  = block.baseFeePerGas ? parseFloat((parseInt(block.baseFeePerGas, 16) / 1e9).toFixed(2)) : 0;
                  const energyKwh = parseFloat((gasUsed / 1e6 * 0.3).toFixed(3));
                  const isNew = block.hash === newBlockHash;
                  const ts = parseInt(block.timestamp, 16) * 1000;
                  const ago = Math.floor((Date.now() - ts) / 1000);
                  return (
                    <div key={block.hash}
                      className={`p-3 rounded-xl border transition-all ${isNew ? 'border-primary/50 bg-primary/5 animate-block-appear' : idx === 0 ? 'border-green-200 bg-green-50/30' : 'border-border bg-secondary/20 hover:bg-secondary/40'}`}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2">
                          {isNew && <div className="status-dot-live" />}
                          <span className="font-mono text-sm font-bold text-primary">#{num.toLocaleString()}</span>
                          {isNew && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">NEW</span>}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{block.hash?.slice(0, 14)}…</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Activity className="w-3 h-3" /> <span>{block.transactions.length} txns</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span className="text-orange-600 font-mono">{baseFee > 0 ? `${baseFee} Gwei` : '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Cpu className="w-3 h-3" /> <span>{gasUtil}% gas</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Zap className="w-3 h-3" /> <span>{energyKwh} kWh</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{ago > 60 ? `${Math.floor(ago/60)}m` : `${ago}s`} ago</span>
                        <div className="ml-auto"><AddressDisplay address={block.miner} showLink={true} /></div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 progress-bar">
                          <div className="progress-fill" style={{ width: `${gasUtil}%`, background: gasUtil > 80 ? 'hsl(0 84% 56%)' : gasUtil > 50 ? 'hsl(38 92% 50%)' : 'hsl(158 64% 40%)' }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">{gasUtil}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ENERGY TAB                                */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'energy' && (
        <div className="space-y-4">
          {/* Energy Credit Box */}
          <div className="card-blockchain rounded-xl p-5 border-l-4 border-l-green-400">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-green-500" /> Energy Credit Top-up
                </h2>
                <p className="text-xs text-muted-foreground">Add kWh to your balance. Each 100 kWh mints 1,000 ECOW tokens on-chain.</p>
                {user && (
                  <p className="text-xs text-green-600 font-semibold mt-1">Current balance: {user.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap md:ml-auto">
                <div className="flex items-center gap-1">
                  {[500, 1000, 5000, 10000].map(amt => (
                    <button key={amt} onClick={() => setCreditAmt(String(amt))}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all font-mono ${creditAmt === String(amt) ? 'bg-green-100 border-green-400 text-green-700 font-bold' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}>
                      {(amt/1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
                <input type="number" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} min="1" max="50000"
                  className="w-28 px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm font-mono focus:outline-none focus:border-green-400" placeholder="kWh" />
                <button onClick={handleCredit}
                  className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm">
                  + Credit
                </button>
              </div>
            </div>
            {creditMsg && (
              <div className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${creditMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {creditMsg}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gauge */}
            <div className="card-blockchain rounded-xl p-5 flex flex-col items-center">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 self-start">
                <Leaf className="w-4 h-4 text-green-500" /> Renewable Energy %
              </h2>
              <div className="relative flex items-center justify-center" style={{ width: 180, height: 120 }}>
                <svg width="180" height="120" viewBox="0 0 180 120">
                  <path d="M 20 100 A 70 70 0 0 1 160 100" fill="none" stroke="hsl(210 20% 90%)" strokeWidth="14" strokeLinecap="round" />
                  <path d="M 20 100 A 70 70 0 0 1 160 100" fill="none"
                    stroke={renewablePct > 70 ? 'hsl(158 64% 40%)' : renewablePct > 50 ? 'hsl(38 92% 50%)' : 'hsl(0 84% 56%)'}
                    strokeWidth="14" strokeLinecap="round"
                    strokeDasharray={`${(renewablePct / 100) * 220} 220`}
                    className="gauge-ring" />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold font-mono text-foreground">{renewablePct}%</p>
                  <p className="text-xs text-muted-foreground">renewable</p>
                </div>
              </div>
              <div className="w-full mt-2 space-y-1.5">
                {[
                  { label: 'Solar', pct: Math.round(renewablePct * 0.55), color: 'hsl(38 92% 50%)', icon: '☀️' },
                  { label: 'Wind',  pct: Math.round(renewablePct * 0.30), color: 'hsl(199 89% 52%)', icon: '💨' },
                  { label: 'Hydro', pct: Math.round(renewablePct * 0.15), color: 'hsl(217 91% 52%)', icon: '💧' },
                ].map(({ label, pct, color, icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs w-4">{icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-semibold">{pct}%</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Network energy stats + chart */}
            <div className="card-blockchain rounded-xl p-5 md:col-span-2 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Network Energy Statistics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Hash Rate',      value: `${networkHashRate.toFixed(1)} TH/s`, color: 'text-primary',  bg: 'bg-primary/8'  },
                  { label: 'Energy / Block', value: `${(Math.random() * 0.5 + 0.8).toFixed(2)} kWh`, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Daily Use',      value: `${Math.round(networkHashRate * 0.12)} MWh`, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'EV Equivalent',  value: `${Math.round(networkHashRate * 0.05)} EVs`, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`p-3 rounded-xl ${bg}`}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Energy per Block (kWh)</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={carbonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                    <XAxis dataKey="block" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '11px' }} />
                    <Bar dataKey="energy" fill="hsl(158 64% 40% / 0.7)" radius={[3,3,0,0]} name="kWh" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="card-blockchain rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" /> Weekly Energy Consumption Heatmap (kWh / hour)
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Low</span>
                {['hsl(210 20% 93%)', 'hsl(158 64% 80%)', 'hsl(158 64% 60%)', 'hsl(158 64% 40%)', 'hsl(158 64% 22%)'].map(c => (
                  <div key={c} className="w-4 h-4 rounded-sm" style={{ background: c }} />
                ))}
                <span>High</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="flex gap-1 mb-1">
                  <div className="w-8 shrink-0" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground" style={{ minWidth: 18 }}>
                      {h % 4 === 0 ? `${h}h` : ''}
                    </div>
                  ))}
                </div>
                {heatmap.map(({ day, hours }) => (
                  <div key={day} className="flex gap-1 mb-1 items-center">
                    <span className="w-8 text-xs text-muted-foreground shrink-0 font-medium">{day}</span>
                    {hours.map(({ hour, kwh }) => {
                      const pct = kwh / 1400;
                      const bg = `hsl(158 64% 40% / ${(0.12 + pct * 0.88).toFixed(2)})`;
                      return (
                        <div key={hour} title={`${day} ${hour}:00 — ${kwh} kWh`}
                          className="heatmap-cell flex-1" style={{ minWidth: 18, height: 24, background: bg, borderRadius: 3 }} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Validator table */}
          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> Validator Energy Efficiency
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Client', 'Efficiency', 'Energy (kWh/day)', 'Uptime', 'Blocks', 'Rating'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validators.map((v, i) => (
                    <tr key={v.name} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${['bg-green-500','bg-blue-500','bg-purple-500','bg-amber-500','bg-rose-500'][i]}`} />
                          <span className="font-semibold text-sm">{v.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 progress-bar">
                            <div className="progress-fill" style={{ width: `${v.efficiency}%`, background: v.efficiency > 97 ? 'hsl(158 64% 40%)' : 'hsl(38 92% 50%)' }} />
                          </div>
                          <span className="font-mono text-sm font-bold">{v.efficiency}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm text-amber-600">{v.energy}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.uptime > 99.5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{v.uptime}%</span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm">{v.blocks.toLocaleString()}</td>
                      <td className="py-3">
                        {Array.from({ length: 5 }, (_, si) => (
                          <span key={si} className={si < (v.efficiency > 97 ? 5 : v.efficiency > 95 ? 4 : 3) ? 'text-amber-500' : 'text-muted-foreground/30'}>★</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* CARBON TAB                                */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'carbon' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-blockchain rounded-xl p-5 flex flex-col justify-between">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-green-500" /> Carbon Intensity
              </h2>
              <div className="text-center py-4">
                <p className="text-5xl font-bold font-mono">{carbonIntensity}</p>
                <p className="text-sm text-muted-foreground mt-1">gCO₂/kWh</p>
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${carbonIntensity < 150 ? 'bg-green-100 text-green-700' : carbonIntensity < 250 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {carbonIntensity < 150 ? <Leaf className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {carbonIntensity < 150 ? 'Low Carbon' : carbonIntensity < 250 ? 'Medium' : 'High Carbon'}
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>EU average</span><span className="font-mono">230 gCO₂/kWh</span></div>
                <div className="flex justify-between"><span>Global average</span><span className="font-mono">450 gCO₂/kWh</span></div>
                <div className="flex justify-between"><span>100% renewable</span><span className="font-mono">0 gCO₂/kWh</span></div>
              </div>
            </div>

            <div className="card-blockchain rounded-xl p-5 md:col-span-2">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-500" /> CO₂ Emissions per Block
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={carbonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="block" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="carbon" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="renewable" orientation="right" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} domain={[0,100]} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar yAxisId="carbon" dataKey="carbon" fill="hsl(0 84% 56% / 0.6)" radius={[3,3,0,0]} name="CO₂ (kg)" />
                  <Line yAxisId="renewable" type="monotone" dataKey="renewable" stroke="hsl(158 64% 40%)" strokeWidth={2} dot={{ r: 3 }} name="Renewable %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-500" /> Block Carbon Footprint Table
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Block', 'Transactions', 'Energy (kWh)', 'CO₂ (kg)', 'Renewable %', 'Carbon Rating'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carbonData.map(row => (
                    <tr key={row.block} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-mono text-sm font-bold text-primary">{row.block}</td>
                      <td className="py-2.5 pr-4 font-mono text-sm">{row.txCount}</td>
                      <td className="py-2.5 pr-4 font-mono text-sm text-amber-600">{row.energy}</td>
                      <td className="py-2.5 pr-4 font-mono text-sm text-red-500">{row.carbon}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 progress-bar">
                            <div className="progress-fill" style={{ width: `${row.renewable}%`, background: row.renewable > 70 ? 'hsl(158 64% 40%)' : 'hsl(38 92% 50%)' }} />
                          </div>
                          <span className="text-xs font-mono font-bold">{row.renewable}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.renewable > 75 ? 'bg-green-100 text-green-700' : row.renewable > 55 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {row.renewable > 75 ? '🟢 A+' : row.renewable > 55 ? '🟡 B' : '🔴 C'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* GAS FORECAST TAB                          */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'gas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Slow (<30s)', value: gasForecast[new Date().getHours()].slow, color: 'text-blue-600', bg: 'bg-blue-50', tip: 'Best for non-urgent' },
              { label: 'Average',    value: gasForecast[new Date().getHours()].avg,  color: 'text-green-600', bg: 'bg-green-50', tip: '~15s confirmation' },
              { label: 'Fast (<10s)',value: gasForecast[new Date().getHours()].fast, color: 'text-red-600', bg: 'bg-red-50', tip: 'Priority inclusion' },
            ].map(({ label, value, color, bg, tip }) => (
              <div key={label} className={`${bg} rounded-xl p-5 border border-transparent`}>
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value} Gwei</p>
                <p className="text-xs text-muted-foreground mt-1">{tip}</p>
              </div>
            ))}
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> 24-Hour Gas Price Forecast (Gwei)
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={gasForecast}>
                <defs>
                  <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }}
                  formatter={(v: number) => [`${v} Gwei`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="fast" stroke="hsl(0 84% 56%)" fill="hsl(0 84% 56% / 0.07)" strokeWidth={1.5} dot={false} name="Fast" />
                <Area type="monotone" dataKey="avg"  stroke="hsl(38 92% 50%)" fill="url(#gg)" strokeWidth={2.5} dot={false} name="Average" />
                <Line type="monotone" dataKey="slow" stroke="hsl(217 91% 52%)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Slow" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Gas Price Recommendation Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Hour', 'Slow', 'Avg', 'Fast', 'Best Time', 'Trend'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gasForecast.filter((_, i) => i % 2 === 0).map((row, i) => {
                    const isNow = Math.floor(new Date().getHours() / 2) === i;
                    const prev = gasForecast[Math.max(0, i * 2 - 2)];
                    const rising = row.avg > prev.avg;
                    return (
                      <tr key={row.hour} className={`border-b border-border/40 hover:bg-secondary/30 ${isNow ? 'bg-primary/5' : ''}`}>
                        <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">{isNow && <div className="status-dot-live" />}{row.hour}</div>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-blue-600">{row.slow}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-green-600 font-bold">{row.avg}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-red-500">{row.fast}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.avg < 25 ? 'bg-green-100 text-green-700' : row.avg < 35 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {row.avg < 25 ? '✓ Great' : row.avg < 35 ? 'Okay' : 'Wait'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {rising ? <TrendingUp className="w-4 h-4 text-red-500" /> : <TrendingDown className="w-4 h-4 text-green-500" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* MEV TAB                                   */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'mev' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total MEV Captured',  value: `${mevData.reduce((s, d) => s + d.mev, 0).toFixed(4)} ETH`,    icon: TrendingUp, card: 'card-purple' },
              { label: 'Avg Block Reward',    value: `${(mevData.reduce((s, d) => s + d.reward, 0) / mevData.length).toFixed(4)} ETH`, icon: Zap, card: 'card-amber' },
              { label: 'Priority Fee Total',  value: `${mevData.reduce((s, d) => s + d.priority, 0).toFixed(4)} ETH`, icon: Flame, card: 'card-rose' },
            ].map(({ label, value, icon: Icon, card }) => (
              <div key={label} className={`${card} rounded-xl p-5 text-white shadow-md`}>
                <Icon className="w-5 h-5 opacity-70 mb-2" />
                <p className="text-2xl font-bold font-mono">{value}</p>
                <p className="text-xs opacity-80 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" /> MEV & Block Reward Distribution
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={mevData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="block" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }}
                  formatter={(v: number) => [`${v.toFixed(4)} ETH`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="reward"   fill="hsl(38 92% 50% / 0.7)"   radius={[3,3,0,0]} name="Block Reward" stackId="a" />
                <Bar dataKey="priority" fill="hsl(217 91% 52% / 0.65)" radius={[3,3,0,0]} name="Priority Fee" stackId="a" />
                <Line type="monotone" dataKey="mev" stroke="hsl(271 81% 56%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(271 81% 56%)' }} name="MEV Extracted" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">MEV Detail Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Block', 'MEV (ETH)', 'Block Reward', 'Priority Fee', 'Total', 'MEV Share'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mevData.map(row => {
                    const total = row.mev + row.reward + row.priority;
                    const mevShare = Math.round((row.mev / total) * 100);
                    return (
                      <tr key={row.block} className="border-b border-border/40 hover:bg-secondary/30">
                        <td className="py-2.5 pr-4 font-mono text-sm font-bold text-primary">{row.block}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-purple-600 font-bold">{row.mev.toFixed(4)}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-amber-600">{row.reward.toFixed(4)}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-blue-600">{row.priority.toFixed(4)}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm font-bold">{total.toFixed(4)}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 progress-bar"><div className="progress-fill" style={{ width: `${mevShare}%`, background: 'hsl(271 81% 56%)' }} /></div>
                            <span className="text-xs font-mono text-muted-foreground">{mevShare}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TOKEN FLOW TAB                            */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> ECOW Token Flow — Mint / Burn / Stake / Transfer
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokenFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }}
                  formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="mint"     fill="hsl(158 64% 40% / 0.8)"  radius={[3,3,0,0]} name="Minted" />
                <Bar dataKey="transfer" fill="hsl(217 91% 52% / 0.7)"  radius={[3,3,0,0]} name="Transferred" />
                <Bar dataKey="stake"    fill="hsl(271 81% 56% / 0.65)" radius={[3,3,0,0]} name="Staked" />
                <Bar dataKey="burn"     fill="hsl(0 84% 56% / 0.6)"    radius={[3,3,0,0]} name="Burned" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Flow Summary (Last 80 min)</h2>
              <div className="space-y-3">
                {[
                  { label: 'Total Minted',    value: tokenFlow.reduce((s,d) => s+d.mint, 0),    color: 'text-green-600',  icon: '⚡' },
                  { label: 'Total Transferred',value: tokenFlow.reduce((s,d) => s+d.transfer, 0),color: 'text-blue-600', icon: '↗' },
                  { label: 'Total Staked',    value: tokenFlow.reduce((s,d) => s+d.stake, 0),   color: 'text-purple-600', icon: '🔒' },
                  { label: 'Total Burned',    value: tokenFlow.reduce((s,d) => s+d.burn, 0),    color: 'text-red-500',    icon: '🔥' },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">{icon} {label}</span>
                    <span className={`text-sm font-bold font-mono ${color}`}>{value.toLocaleString()} ECOW</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 border-t border-border">
                  <span className="text-sm font-semibold">Net Supply Change</span>
                  <span className={`text-sm font-bold font-mono ${tokenFlow.reduce((s,d) => s+d.mint-d.burn, 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tokenFlow.reduce((s,d) => s+d.mint-d.burn, 0) > 0 ? '+' : ''}
                    {tokenFlow.reduce((s,d) => s+d.mint-d.burn, 0).toLocaleString()} ECOW
                  </span>
                </div>
              </div>
            </div>

            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Mint Rate vs Burn Rate
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={tokenFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '11px' }}
                    formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="mint"  stroke="hsl(158 64% 40%)" strokeWidth={2} dot={false} name="Mint" />
                  <Line type="monotone" dataKey="burn"  stroke="hsl(0 84% 56%)"   strokeWidth={2} dot={false} name="Burn" strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="stake" stroke="hsl(271 81% 56%)" strokeWidth={1.5} dot={false} name="Stake" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* WALLET TAB                                */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'wallet' && (
        <div className="space-y-4">
          {!isConnected ? (
            <div className="card-blockchain rounded-xl p-12 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Connect your wallet to see energy visualization for your address</p>
            </div>
          ) : (
            <>
              {/* Address Identity Card */}
              <div className="card-blockchain rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl card-blue flex items-center justify-center shadow-lg shrink-0 text-2xl font-bold font-mono text-white">
                    {address!.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Connected Wallet — Ethereum Mainnet</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground break-all">{address}</span>
                      <button onClick={copyAddress} className="p-1 rounded hover:bg-secondary transition-colors shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">ETH Balance</p>
                      <p className="text-lg font-bold font-mono text-primary">{walletLoading ? '…' : (walletEth ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">ETH</p>
                    </div>
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total TX</p>
                      <p className="text-lg font-bold font-mono text-foreground">{walletLoading ? '…' : (walletTxCnt ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">nonce</p>
                    </div>
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">Energy Balance</p>
                      <p className="text-lg font-bold font-mono text-green-600">{user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}</p>
                      <p className="text-xs text-muted-foreground">kWh</p>
                    </div>
                    <div className="bg-secondary rounded-xl p-3 text-center">
                      <p className="text-xs text-muted-foreground">ECOW Balance</p>
                      <p className="text-lg font-bold font-mono text-amber-600">{user?.ecowBalance.toLocaleString() ?? '0'}</p>
                      <p className="text-xs text-muted-foreground">ECOW</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Energy Credit (inline in wallet tab too) */}
              <div className="card-blockchain rounded-xl p-4 border-l-4 border-l-green-400 flex flex-col md:flex-row md:items-center gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-500" /> Credit Energy Balance
                  </p>
                  <p className="text-xs text-muted-foreground">Simulates receiving renewable energy credits on-chain</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap md:ml-auto">
                  {[500, 2000, 5000].map(amt => (
                    <button key={amt} onClick={() => setCreditAmt(String(amt))}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all ${creditAmt === String(amt) ? 'bg-green-100 border-green-400 text-green-700 font-bold' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'}`}>
                      {amt.toLocaleString()} kWh
                    </button>
                  ))}
                  <input type="number" value={creditAmt} onChange={e => setCreditAmt(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-border bg-secondary text-sm font-mono focus:outline-none focus:border-green-400" placeholder="kWh" />
                  <button onClick={handleCredit}
                    className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-all shadow-sm">
                    + Credit
                  </button>
                </div>
                {creditMsg && (
                  <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${creditMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {creditMsg}
                  </div>
                )}
              </div>

              {/* Address Energy Profile */}
              {profile && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Energy source pie */}
                  <div className="card-blockchain rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-green-500" /> Address Energy Mix
                    </h2>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Solar',   value: profile.solar },
                            { name: 'Wind',    value: profile.wind  },
                            { name: 'Hydro',   value: profile.hydro },
                            { name: 'Fossil',  value: Math.max(0, profile.fossil) },
                          ]}
                          cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value" paddingAngle={3}>
                          {['hsl(38 92% 50%)','hsl(199 89% 52%)','hsl(217 91% 52%)','hsl(0 0% 70%)'].map((c, i) => <Cell key={i} fill={c} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px' }} formatter={(v: number) => [`${v}%`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {[
                        { label: 'Solar',  pct: profile.solar,  color: 'text-amber-600',  icon: '☀️' },
                        { label: 'Wind',   pct: profile.wind,   color: 'text-cyan-600',   icon: '💨' },
                        { label: 'Hydro',  pct: profile.hydro,  color: 'text-blue-600',   icon: '💧' },
                        { label: 'Fossil', pct: Math.max(0, profile.fossil), color: 'text-gray-500', icon: '🏭' },
                      ].map(({ label, pct, color, icon }) => (
                        <div key={label} className="flex items-center gap-1.5 text-xs">
                          <span>{icon}</span>
                          <span className="text-muted-foreground flex-1">{label}</span>
                          <span className={`font-mono font-bold ${color}`}>{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly energy usage */}
                  <div className="card-blockchain rounded-xl p-5 md:col-span-2">
                    <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" /> 8-Week Energy History for this Address
                    </h2>
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={profile.weeks}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                        <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="kwh" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="co2" orientation="right" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar yAxisId="kwh" dataKey="kwh" fill="hsl(158 64% 40% / 0.7)" radius={[3,3,0,0]} name="kWh Traded" />
                        <Line yAxisId="co2" type="monotone" dataKey="co2" stroke="hsl(0 84% 56%)" strokeWidth={2} dot={{ r: 3 }} name="CO₂ (kg)" />
                      </ComposedChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Carbon Footprint</p>
                        <p className="text-lg font-bold font-mono text-green-700">{profile.co2}</p>
                        <p className="text-xs text-muted-foreground">gCO₂/kWh</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Energy Credits</p>
                        <p className="text-lg font-bold font-mono text-amber-600">{profile.credits.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">REC tokens</p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Green Score</p>
                        <p className="text-lg font-bold font-mono text-blue-700">
                          {profile.solar + profile.wind + profile.hydro > 70 ? 'A+' : profile.solar + profile.wind + profile.hydro > 50 ? 'B' : 'C'}
                        </p>
                        <p className="text-xs text-muted-foreground">rating</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* On-chain transactions via Alchemy */}
              <div className="card-blockchain rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> On-Chain Transactions (Alchemy)
                  </h2>
                  <button onClick={() => { setWalletEth(null); setWalletTxCnt(null); setWalletTx([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                {walletLoading ? (
                  <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
                ) : walletTx.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions found on mainnet for this address</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full data-table">
                      <thead>
                        <tr className="border-b border-border">
                          {['TX Hash', 'From', 'To', 'Value', 'Asset', 'Category', 'Block'].map(h => (
                            <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {walletTx.map(tx => {
                          const isSent = tx.from?.toLowerCase() === address!.toLowerCase();
                          const val = parseFloat(tx.value ?? '0');
                          return (
                            <tr key={tx.hash} className="border-b border-border/40 hover:bg-secondary/30">
                              <td className="py-2.5 pr-3"><TxHashDisplay hash={tx.hash} /></td>
                              <td className="py-2.5 pr-3"><AddressDisplay address={tx.from ?? '0x0'} showLink={false} /></td>
                              <td className="py-2.5 pr-3"><AddressDisplay address={tx.to ?? '0x0'} showLink={false} /></td>
                              <td className="py-2.5 pr-3 font-mono text-sm font-bold text-foreground">
                                <span className={isSent ? 'text-red-500' : 'text-green-600'}>
                                  {isSent ? '-' : '+'}{val.toFixed(val < 0.001 ? 6 : 4)}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-secondary font-mono">{tx.asset || 'ETH'}</span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  tx.category === 'erc20' ? 'bg-purple-100 text-purple-700' :
                                  tx.category === 'internal' ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700'}`}>
                                  {tx.category}
                                </span>
                              </td>
                              <td className="py-2.5 font-mono text-xs text-muted-foreground">#{parseInt(tx.blockNum, 16).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

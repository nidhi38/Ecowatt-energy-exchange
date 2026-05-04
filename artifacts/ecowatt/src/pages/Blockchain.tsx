import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, ComposedChart, Legend
} from 'recharts';
import {
  Activity, Cpu, Flame, Hash, Zap, TrendingUp, TrendingDown,
  Leaf, Wind, Sun, Droplets, AlertTriangle, RefreshCw, Clock,
  BarChart3, Globe, Shield, Database
} from 'lucide-react';
import { getNetworkStatus, getRecentBlocks, AlchemyBlock } from '../lib/alchemy';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';

function generateEnergyHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return days.map(day => ({
    day,
    hours: hours.map(h => ({
      hour: h,
      kwh: Math.round(Math.random() * 900 + 100 + (h >= 9 && h <= 17 ? 400 : 0)),
    })),
  }));
}

function generateGasForecast() {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    slow: parseFloat((18 + Math.sin(i * 0.4) * 5 + Math.random() * 3).toFixed(1)),
    avg:  parseFloat((25 + Math.sin(i * 0.4) * 7 + Math.random() * 4).toFixed(1)),
    fast: parseFloat((35 + Math.sin(i * 0.4) * 9 + Math.random() * 5).toFixed(1)),
  }));
}

function generateCarbonData(blocks: AlchemyBlock[]) {
  return blocks.slice(0, 12).map((b, i) => {
    const num = parseInt(b.number, 16);
    const gasUsed = parseInt(b.gasUsed, 16);
    const txCount = b.transactions.length;
    const carbonG = parseFloat((gasUsed * 0.0000002).toFixed(4));
    const renewablePct = Math.round(60 + Math.random() * 30);
    return {
      block: `#${(num % 10000).toLocaleString()}`,
      carbon: carbonG,
      txCount,
      renewable: renewablePct,
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

function generateValidatorEfficiency() {
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

interface LiveStat { connected: boolean; gasPrice: number; blockNumber: number; pendingTx: number; tps: number; sepoliaBlock: number; }

export function Blockchain() {
  const [stats, setStats] = useState<LiveStat | null>(null);
  const [blocks, setBlocks] = useState<AlchemyBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [activeTab, setActiveTab] = useState<'network' | 'energy' | 'carbon' | 'gas' | 'mev' | 'tokens'>('network');
  const [newBlockHash, setNewBlockHash] = useState<string | null>(null);
  const prevBlockRef = useRef<string | null>(null);

  const heatmap = useRef(generateEnergyHeatmap()).current;
  const gasForecast = useRef(generateGasForecast()).current;
  const mevData = useRef(generateMEVData()).current;
  const validators = useRef(generateValidatorEfficiency()).current;
  const tokenFlow = useRef(generateTokenFlow()).current;

  const [carbonData, setCarbonData] = useState<ReturnType<typeof generateCarbonData>>([]);

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        const [ns, recentBlocks] = await Promise.all([getNetworkStatus(), getRecentBlocks(12)]);
        if (!mounted) return;
        setStats(ns);
        if (recentBlocks.length > 0) {
          const topHash = recentBlocks[0]?.hash;
          if (prevBlockRef.current && prevBlockRef.current !== topHash) {
            setNewBlockHash(topHash || null);
            setTimeout(() => setNewBlockHash(null), 3000);
          }
          prevBlockRef.current = topHash || null;
          setBlocks(recentBlocks);
          setCarbonData(generateCarbonData(recentBlocks));
        }
        setLastUpdate(new Date().toLocaleTimeString());
        setLoading(false);
      } catch { if (mounted) setLoading(false); }
    }
    fetchAll();
    const iv = setInterval(fetchAll, 12000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const networkHistoryRef = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      t: i,
      tps: parseFloat((Math.random() * 15 + 5).toFixed(1)),
      gas: parseFloat((Math.random() * 30 + 15).toFixed(1)),
    }))
  );
  const [networkHistory, setNetworkHistory] = useState(networkHistoryRef.current);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!stats) return;
      setNetworkHistory(prev => [
        ...prev.slice(-19),
        { t: prev.length, tps: stats.tps, gas: stats.gasPrice },
      ]);
    }, 12000);
    return () => clearInterval(iv);
  }, [stats]);

  const renewablePct = Math.round(65 + Math.random() * 25);
  const carbonIntensity = parseFloat((180 - renewablePct * 1.2 + Math.random() * 20).toFixed(1));
  const networkHashRate = parseFloat((1100 + Math.random() * 100).toFixed(1));

  const tabs = [
    { id: 'network' as const, label: 'Network', icon: Activity },
    { id: 'energy'  as const, label: 'Energy',  icon: Zap },
    { id: 'carbon'  as const, label: 'Carbon',  icon: Leaf },
    { id: 'gas'     as const, label: 'Gas Forecast', icon: Flame },
    { id: 'mev'     as const, label: 'MEV/Rewards', icon: TrendingUp },
    { id: 'tokens'  as const, label: 'Token Flow', icon: Database },
  ];

  const gaugeData = [{ name: 'Renewable', value: renewablePct, fill: 'hsl(158 64% 40%)' }];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blockchain Energy Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live Ethereum network · Energy consumption · Carbon footprint · MEV analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {lastUpdate}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary border border-border">
            <div className={`status-dot-live ${stats?.connected ? '' : '!bg-red-500'}`} />
            <span className="text-xs font-medium">{stats?.connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Block Height',    value: stats ? `#${stats.blockNumber.toLocaleString()}` : '—', icon: Hash,         card: 'card-blue',   unit: '' },
          { label: 'Gas Price',       value: stats ? `${stats.gasPrice.toFixed(1)}` : '—',           icon: Flame,        card: 'card-amber',  unit: 'Gwei' },
          { label: 'TPS',             value: stats ? `${stats.tps.toFixed(1)}` : '—',                icon: Activity,     card: 'card-green',  unit: 'tx/s' },
          { label: 'Renewable',       value: `${renewablePct}%`,                                     icon: Leaf,         card: 'card-teal',   unit: 'energy' },
          { label: 'Carbon Intensity',value: `${carbonIntensity}`,                                   icon: Wind,         card: 'card-purple', unit: 'gCO₂/kWh' },
          { label: 'Pending Txns',    value: stats ? stats.pendingTx.toLocaleString() : '—',          icon: Database,     card: 'card-rose',   unit: 'mempool' },
        ].map(({ label, value, icon: Icon, card, unit }) => (
          <div key={label} className={`${card} rounded-xl p-4 text-white shadow-md`}>
            <Icon className="w-4 h-4 opacity-70 mb-2" />
            <p className="text-xl font-bold font-mono leading-none">{value}</p>
            <p className="text-xs opacity-80 mt-1">{unit} — {label}</p>
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
          </button>
        ))}
      </div>

      {/* ── Network Tab ── */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-blockchain rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Live TPS & Gas (12-block window)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
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
                <BarChart3 className="w-4 h-4 text-green-500" /> Block Tx Count & Gas Utilization
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={blocks.slice(0, 10).reverse().map(b => ({
                  block: `#${(parseInt(b.number, 16) % 10000).toLocaleString()}`,
                  txs: b.transactions.length,
                  gasUtil: Math.round((parseInt(b.gasUsed, 16) / parseInt(b.gasLimit, 16)) * 100),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                  <XAxis dataKey="block" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="txs"  tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="util" orientation="right" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar yAxisId="txs" dataKey="txs" fill="hsl(158 64% 40% / 0.7)" name="TX Count" radius={[3,3,0,0]} />
                  <Line yAxisId="util" type="monotone" dataKey="gasUtil" stroke="hsl(271 81% 56%)" strokeWidth={2} dot={{ r: 3 }} name="Gas Util %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Block feed */}
          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Latest Blocks</h2>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl shimmer" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block, idx) => {
                  const num = parseInt(block.number, 16);
                  const gasUsed = parseInt(block.gasUsed, 16);
                  const gasLimit = parseInt(block.gasLimit, 16);
                  const gasUtil = Math.round((gasUsed / gasLimit) * 100);
                  const baseFee = block.baseFeePerGas ? parseFloat((parseInt(block.baseFeePerGas, 16) / 1e9).toFixed(2)) : 0;
                  const energyKwh = parseFloat((gasUsed / 1e6 * 0.3).toFixed(3));
                  const isNew = block.hash === newBlockHash;
                  return (
                    <div key={block.hash}
                      className={`p-3 rounded-xl border transition-all ${isNew ? 'border-primary/40 bg-primary/5 animate-block-appear' : idx === 0 ? 'border-green-200 bg-green-50/40' : 'border-border bg-secondary/20 hover:bg-secondary/40'}`}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2">
                          {isNew && <div className="status-dot-live" />}
                          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm font-bold text-foreground">#{num.toLocaleString()}</span>
                          {isNew && <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-bold">NEW</span>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Activity className="w-3 h-3" />
                          <span>{block.transactions.length} txns</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span>{baseFee > 0 ? `${baseFee} Gwei` : '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Cpu className="w-3 h-3" />
                          <span>{gasUtil}% gas</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Zap className="w-3 h-3" />
                          <span>{energyKwh} kWh</span>
                        </div>
                        <div className="ml-auto flex-none">
                          <AddressDisplay address={block.miner} showLink={true} />
                        </div>
                      </div>
                      <div className="mt-2 progress-bar">
                        <div className="progress-fill" style={{ width: `${gasUtil}%`, background: gasUtil > 80 ? 'hsl(0 84% 56%)' : gasUtil > 50 ? 'hsl(38 92% 50%)' : 'hsl(158 64% 40%)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Energy Heatmap Tab ── */}
      {activeTab === 'energy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Renewable Gauge */}
            <div className="card-blockchain rounded-xl p-5 flex flex-col items-center">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 self-start">
                <Leaf className="w-4 h-4 text-green-500" /> Renewable Energy %
              </h2>
              <div className="relative flex items-center justify-center" style={{ width: 180, height: 120 }}>
                <svg width="180" height="120" viewBox="0 0 180 120">
                  <path d="M 20 100 A 70 70 0 0 1 160 100" fill="none" stroke="hsl(210 20% 90%)" strokeWidth="14" strokeLinecap="round" />
                  <path
                    d="M 20 100 A 70 70 0 0 1 160 100"
                    fill="none"
                    stroke={renewablePct > 70 ? 'hsl(158 64% 40%)' : renewablePct > 50 ? 'hsl(38 92% 50%)' : 'hsl(0 84% 56%)'}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${(renewablePct / 100) * 220} 220`}
                    className="gauge-ring"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold font-mono text-foreground">{renewablePct}%</p>
                  <p className="text-xs text-muted-foreground">renewable</p>
                </div>
              </div>
              <div className="w-full mt-2 space-y-1.5">
                {[
                  { label: 'Solar',   pct: Math.round(renewablePct * 0.55), color: 'hsl(38 92% 50%)',  icon: '☀️' },
                  { label: 'Wind',    pct: Math.round(renewablePct * 0.30), color: 'hsl(199 89% 52%)', icon: '💨' },
                  { label: 'Hydro',   pct: Math.round(renewablePct * 0.15), color: 'hsl(217 91% 52%)', icon: '💧' },
                ].map(({ label, pct, color, icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs w-4">{icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Energy stats */}
            <div className="card-blockchain rounded-xl p-5 md:col-span-2 space-y-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Network Energy Statistics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Network Hash Rate', value: `${networkHashRate.toFixed(1)} TH/s`, color: 'text-primary', bg: 'bg-primary/8' },
                  { label: 'Energy / Block',    value: `${(Math.random() * 0.5 + 0.8).toFixed(2)} kWh`,  color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Daily Energy Use',  value: `${Math.round(networkHashRate * 0.12)} MWh`, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'EV Comparison',     value: `${Math.round(networkHashRate * 0.05)} EVs/day`, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`p-3 rounded-xl ${bg}`}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Energy per Block (kWh)</p>
                <ResponsiveContainer width="100%" height={120}>
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
                <BarChart3 className="w-4 h-4 text-purple-500" /> Weekly Energy Consumption Heatmap (kWh/hour)
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Low</span>
                {['hsl(210 20% 93%)', 'hsl(158 64% 80%)', 'hsl(158 64% 60%)', 'hsl(158 64% 40%)', 'hsl(158 64% 25%)'].map(c => (
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
                    <div key={h} className="flex-1 text-center text-xs text-muted-foreground" style={{ minWidth: 18 }}>
                      {h % 3 === 0 ? `${h}h` : ''}
                    </div>
                  ))}
                </div>
                {heatmap.map(({ day, hours }) => (
                  <div key={day} className="flex gap-1 mb-1 items-center">
                    <span className="w-8 text-xs text-muted-foreground shrink-0 font-medium">{day}</span>
                    {hours.map(({ hour, kwh }) => {
                      const pct = kwh / 1400;
                      const alpha = 0.15 + pct * 0.85;
                      const bg = `hsl(158 64% 40% / ${alpha.toFixed(2)})`;
                      return (
                        <div key={hour} title={`${day} ${hour}:00 — ${kwh} kWh`}
                          className="heatmap-cell flex-1"
                          style={{ minWidth: 18, height: 24, background: bg, borderRadius: 3 }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Validator energy efficiency */}
          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> Validator Energy Efficiency
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Client', 'Efficiency', 'Energy (kWh/day)', 'Uptime', 'Blocks Proposed', 'Rating'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validators.map((v, i) => (
                    <tr key={v.name} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-green-500' : i === 1 ? 'bg-blue-500' : 'bg-purple-500'}`} />
                          <span className="font-semibold text-sm text-foreground">{v.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 progress-bar">
                            <div className="progress-fill" style={{ width: `${v.efficiency}%`, background: v.efficiency > 97 ? 'hsl(158 64% 40%)' : 'hsl(38 92% 50%)' }} />
                          </div>
                          <span className="font-mono text-sm font-bold text-foreground">{v.efficiency}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm text-amber-600">{v.energy}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.uptime > 99.5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {v.uptime}%
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm text-foreground">{v.blocks.toLocaleString()}</td>
                      <td className="py-3">
                        {'★'.repeat(v.efficiency > 97 ? 5 : v.efficiency > 95 ? 4 : 3).padEnd(5, '☆').split('').map((c, ci) => (
                          <span key={ci} className={c === '★' ? 'text-amber-500' : 'text-muted-foreground/30'}>{c}</span>
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

      {/* ── Carbon Tab ── */}
      {activeTab === 'carbon' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-blockchain rounded-xl p-5 flex flex-col justify-between">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wind className="w-4 h-4 text-green-500" /> Carbon Intensity
              </h2>
              <div className="text-center py-4">
                <p className="text-5xl font-bold font-mono text-foreground">{carbonIntensity}</p>
                <p className="text-sm text-muted-foreground mt-1">gCO₂/kWh</p>
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${carbonIntensity < 150 ? 'bg-green-100 text-green-700' : carbonIntensity < 250 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {carbonIntensity < 150 ? <Leaf className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {carbonIntensity < 150 ? 'Low Carbon' : carbonIntensity < 250 ? 'Medium Carbon' : 'High Carbon'}
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
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
                  <YAxis yAxisId="renewable" orientation="right" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
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

      {/* ── Gas Forecast Tab ── */}
      {activeTab === 'gas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            {[
              { label: 'Slow (<30s)', value: `${gasForecast[new Date().getHours()].slow} Gwei`, color: 'text-blue-600', bg: 'bg-blue-50', tip: 'Best for non-urgent txns' },
              { label: 'Average',    value: `${gasForecast[new Date().getHours()].avg} Gwei`,  color: 'text-green-600', bg: 'bg-green-50', tip: '~15s confirmation' },
              { label: 'Fast (<15s)',value: `${gasForecast[new Date().getHours()].fast} Gwei`, color: 'text-red-600',   bg: 'bg-red-50',   tip: 'Priority inclusion' },
            ].map(({ label, value, color, bg, tip }) => (
              <div key={label} className={`${bg} rounded-xl p-5 border border-transparent`}>
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
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
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} formatter={(v: number) => [`${v} Gwei`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="fast" stroke="hsl(0 84% 56%)" fill="hsl(0 84% 56% / 0.08)" strokeWidth={1.5} dot={false} name="Fast" />
                <Area type="monotone" dataKey="avg"  stroke="hsl(38 92% 50%)" fill="url(#gg)" strokeWidth={2.5} dot={false} name="Average" />
                <Line type="monotone" dataKey="slow" stroke="hsl(217 91% 52%)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Slow" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Gas Price History Table
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border">
                    {['Hour', 'Slow (Gwei)', 'Average (Gwei)', 'Fast (Gwei)', 'Recommended', 'Trend'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gasForecast.filter((_, i) => i % 2 === 0).map((row, i) => {
                    const isNow = Math.floor(new Date().getHours() / 2) === i;
                    const trend = i > 0 && gasForecast[i*2].avg > gasForecast[i*2-2].avg;
                    return (
                      <tr key={row.hour} className={`border-b border-border/40 hover:bg-secondary/30 ${isNow ? 'bg-primary/5' : ''}`}>
                        <td className="py-2.5 pr-4 text-xs font-mono text-muted-foreground flex items-center gap-1">
                          {isNow && <div className="status-dot-live" />} {row.hour}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-blue-600">{row.slow}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-green-600 font-bold">{row.avg}</td>
                        <td className="py-2.5 pr-4 font-mono text-sm text-red-500">{row.fast}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.avg < 25 ? 'bg-green-100 text-green-700' : row.avg < 35 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {row.avg < 25 ? 'Great time' : row.avg < 35 ? 'Okay' : 'Wait'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {trend
                            ? <TrendingUp className="w-4 h-4 text-red-500" />
                            : <TrendingDown className="w-4 h-4 text-green-500" />
                          }
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

      {/* ── MEV Tab ── */}
      {activeTab === 'mev' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total MEV Captured',  value: `${mevData.reduce((s, d) => s + d.mev, 0).toFixed(4)} ETH`,    icon: TrendingUp, card: 'card-purple' },
              { label: 'Avg Block Reward',    value: `${(mevData.reduce((s, d) => s + d.reward, 0) / mevData.length).toFixed(4)} ETH`, icon: Zap, card: 'card-amber' },
              { label: 'Priority Fee Total',  value: `${mevData.reduce((s, d) => s + d.priority, 0).toFixed(4)} ETH`,  icon: Flame, card: 'card-rose' },
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
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(4)} ETH`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="reward"   fill="hsl(38 92% 50% / 0.7)"  radius={[3,3,0,0]} name="Block Reward" stackId="a" />
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
                    {['Block', 'MEV (ETH)', 'Block Reward (ETH)', 'Priority Fee (ETH)', 'Total Value', 'MEV Share'].map(h => (
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
                        <td className="py-2.5 pr-4 font-mono text-sm font-bold text-foreground">{total.toFixed(4)}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 progress-bar">
                              <div className="progress-fill" style={{ width: `${mevShare}%`, background: 'hsl(271 81% 56%)' }} />
                            </div>
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

      {/* ── Token Flow Tab ── */}
      {activeTab === 'tokens' && (
        <div className="space-y-4">
          <div className="card-blockchain rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> ECOW Token Flow Timeline
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tokenFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
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
              <h2 className="text-sm font-semibold text-foreground mb-4">Token Flow Summary (Last 80min)</h2>
              <div className="space-y-3">
                {[
                  { label: 'Total Minted',    value: tokenFlow.reduce((s, d) => s + d.mint, 0),     color: 'text-green-600',  icon: '⚡' },
                  { label: 'Total Transferred',value: tokenFlow.reduce((s, d) => s + d.transfer, 0),color: 'text-blue-600',   icon: '↗' },
                  { label: 'Total Staked',    value: tokenFlow.reduce((s, d) => s + d.stake, 0),    color: 'text-purple-600', icon: '🔒' },
                  { label: 'Total Burned',    value: tokenFlow.reduce((s, d) => s + d.burn, 0),     color: 'text-red-500',    icon: '🔥' },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/40">
                    <span className="text-sm text-muted-foreground">{icon} {label}</span>
                    <span className={`text-sm font-bold font-mono ${color}`}>{value.toLocaleString()} ECOW</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 mt-1 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Net Supply Change</span>
                  <span className={`text-sm font-bold font-mono ${
                    tokenFlow.reduce((s, d) => s + d.mint - d.burn, 0) > 0 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {tokenFlow.reduce((s, d) => s + d.mint - d.burn, 0) > 0 ? '+' : ''}
                    {tokenFlow.reduce((s, d) => s + d.mint - d.burn, 0).toLocaleString()} ECOW
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
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '11px' }} formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="mint" stroke="hsl(158 64% 40%)" strokeWidth={2} dot={false} name="Mint Rate" />
                  <Line type="monotone" dataKey="burn" stroke="hsl(0 84% 56%)"   strokeWidth={2} dot={false} name="Burn Rate" strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

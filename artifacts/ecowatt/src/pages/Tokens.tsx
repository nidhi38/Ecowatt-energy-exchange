import { useAccount } from 'wagmi';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Coins, Zap, TrendingUp, ArrowUpRight, ArrowDownLeft,
  Flame, Layers, Sun, Droplets, Leaf, RefreshCw, Filter
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, getTokenTransfers } from '../lib/store';

const TOKEN_CONTRACT = '0x7f268357A8c2552623316e2562D90e642BB538E5';

type Tab = 'all' | 'mint' | 'burn' | 'stake' | 'transfer';

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; cardColor: string }> = {
  all:      { label: 'All Events',   icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-foreground',  bg: 'bg-secondary',       border: 'border-border',         cardColor: 'card-blue'   },
  mint:     { label: 'Minted',       icon: <Zap className="w-3.5 h-3.5" />,        color: 'text-green-700',   bg: 'bg-green-50',         border: 'border-green-200',      cardColor: 'card-green'  },
  burn:     { label: 'Burned',       icon: <Flame className="w-3.5 h-3.5" />,      color: 'text-red-700',     bg: 'bg-red-50',           border: 'border-red-200',        cardColor: 'card-rose'   },
  stake:    { label: 'Staked',       icon: <Layers className="w-3.5 h-3.5" />,     color: 'text-purple-700',  bg: 'bg-purple-50',        border: 'border-purple-200',     cardColor: 'card-purple' },
  transfer: { label: 'Transferred',  icon: <ArrowUpRight className="w-3.5 h-3.5" />,color:'text-blue-700',    bg: 'bg-blue-50',          border: 'border-blue-200',       cardColor: 'card-blue'   },
};

export function Tokens() {
  const { address, isConnected } = useAccount();
  const { tokenTransfers, priceHistory, user } = useStore(address);
  const allTransfers = getTokenTransfers();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [showMine, setShowMine] = useState(false);

  if (!isConnected) return <WalletConnect />;

  const priceChart = priceHistory.slice(-24).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat((p.price * 1000).toFixed(4)),
    volume: p.volume,
  }));

  const typeCounts: Record<string, number> = {};
  allTransfers.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + t.amount; });
  const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  const pieColors: Record<string, string> = {
    mint: 'hsl(158 64% 40%)', transfer: 'hsl(217 91% 52%)',
    burn: 'hsl(0 84% 56%)', stake: 'hsl(271 81% 56%)',
  };

  const totalMinted   = allTransfers.filter(t => t.type === 'mint').reduce((s, t) => s + t.amount, 0);
  const totalBurned   = allTransfers.filter(t => t.type === 'burn').reduce((s, t) => s + t.amount, 0);
  const totalStaked   = allTransfers.filter(t => t.type === 'stake').reduce((s, t) => s + t.amount, 0);
  const totalTransfer = allTransfers.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);
  const totalSupply   = 1_000_000;
  const circulatingSupply = totalSupply - totalStaked;

  const base = showMine && address ? tokenTransfers : allTransfers;
  const filtered = activeTab === 'all' ? base : base.filter(t => t.type === activeTab);

  // per-tab timeline for the mini chart at top of list
  const timelineBuckets: Record<string, number> = {};
  filtered.slice(0, 30).forEach(t => {
    const key = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timelineBuckets[key] = (timelineBuckets[key] || 0) + t.amount;
  });
  const timelineData = Object.entries(timelineBuckets).reverse().map(([time, amount]) => ({ time, amount }));

  const cfg = TAB_CONFIG[activeTab];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ECOW Token</h1>
        <p className="text-sm text-muted-foreground mt-0.5">EcoWatt energy token — 1 ECOW = 0.1 kWh of renewable energy</p>
      </div>

      {/* Contract Card */}
      <div className="card-blockchain rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl card-amber flex items-center justify-center shadow-lg shrink-0">
            <Coins className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-foreground">EcoWatt Energy Token</h2>
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold">ECOW</span>
              <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded">ERC-20</span>
            </div>
            <AddressDisplay address={TOKEN_CONTRACT} short={false} label="Contract" className="flex-wrap" />
            <p className="text-xs text-muted-foreground mt-1.5">Ethereum Mainnet · Renewable Energy Backed · 1 ECOW = 0.1 kWh</p>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Your Balance</p>
              <p className="text-lg font-bold font-mono text-amber-600">{user?.ecowBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground">ECOW</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Supply</p>
              <p className="text-lg font-bold font-mono text-foreground">{totalSupply.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">ECOW</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Circulating</p>
              <p className="text-lg font-bold font-mono text-blue-600">{circulatingSupply.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">ECOW</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Energy Backed</p>
              <p className="text-lg font-bold font-mono text-green-600">{(circulatingSupply * 0.1).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">kWh</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Four stat cards for Mint / Burn / Stake / Transfer ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { tab: 'mint'     as Tab, label: 'Total Minted',    value: totalMinted,   icon: Zap,         color: 'card-green',  unit: 'ECOW' },
          { tab: 'burn'     as Tab, label: 'Total Burned',    value: totalBurned,   icon: Flame,       color: 'card-rose',   unit: 'ECOW' },
          { tab: 'stake'    as Tab, label: 'Total Staked',    value: totalStaked,   icon: Layers,      color: 'card-purple', unit: 'ECOW' },
          { tab: 'transfer' as Tab, label: 'Transfers',       value: allTransfers.filter(t => t.type === 'transfer').length, icon: TrendingUp, color: 'card-blue', unit: 'events' },
        ] as { tab: Tab; label: string; value: number; icon: React.FC<{ className?: string }>; color: string; unit: string }[]).map(({ tab, label, value, icon: Icon, color, unit }) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-xl ${color} p-4 text-white shadow-md text-left transition-all hover:scale-[1.02] ${activeTab === tab ? 'ring-2 ring-offset-2 ring-white/40' : ''}`}>
            <Icon className="w-5 h-5 opacity-70 mb-2" />
            <p className="text-2xl font-bold font-mono">{typeof value === 'number' && value > 100 ? value.toLocaleString() : value}</p>
            <p className="text-xs opacity-80 mt-0.5">{unit} — {label}</p>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-blockchain rounded-xl p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">ECOW Price Index (mETH)</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={priceChart}>
              <defs>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(38 92% 50%)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }}
                formatter={(v: number, name: string) => [name === 'price' ? `${v.toFixed(4)} mETH` : `${v} kWh`, name === 'price' ? 'Price' : 'Volume']} />
              <Area type="monotone" dataKey="price" stroke="hsl(38 92% 50%)" strokeWidth={2.5} fill="url(#eg)" dot={false} name="price" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Token Distribution</h2>
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={pieColors[d.name] || 'hsl(215 16% 47%)'} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px' }} formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2 mt-2">
            {pieData.map(d => {
              const pct = Math.round((d.value / (totalMinted + totalBurned + totalStaked + totalTransfer || 1)) * 100);
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pieColors[d.name] }} />
                  <span className="text-xs font-medium text-foreground capitalize flex-1">{d.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{d.value.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Supply metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Mint Rate',      value: `+${Math.floor(Math.random()*200+50)}/hr`, color: 'text-green-600'  },
          { label: 'Burn Rate',      value: `-${Math.floor(Math.random()*80+20)}/hr`,  color: 'text-red-500'    },
          { label: 'Staked %',       value: `${((totalStaked/totalSupply)*100).toFixed(1)}%`,color: 'text-purple-600'},
          { label: 'Energy Backed',  value: `${(circulatingSupply*0.1/1000).toFixed(1)} MWh`, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-stat rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Transfer Log with Tabs ── */}
      <div className="card-blockchain rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" /> Token Event Log
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMine(!showMine)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${showMine ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}>
              {showMine ? 'My events' : 'All events'}
            </button>
          </div>
        </div>

        {/* Tab row */}
        <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4 flex-wrap">
          {(Object.keys(TAB_CONFIG) as Tab[]).map(tab => {
            const c = TAB_CONFIG[tab];
            const count = tab === 'all' ? base.length : base.filter(t => t.type === tab).length;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${activeTab === tab ? `${c.bg} ${c.color} border ${c.border} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}>
                {c.icon}
                <span>{c.label}</span>
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab ? c.color : 'text-muted-foreground'} bg-white/60`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Mini timeline for selected tab */}
        {timelineData.length > 1 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={timelineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="amount" fill={
                  activeTab === 'mint' ? 'hsl(158 64% 40% / 0.7)' :
                  activeTab === 'burn' ? 'hsl(0 84% 56% / 0.7)' :
                  activeTab === 'stake' ? 'hsl(271 81% 56% / 0.7)' :
                  'hsl(217 91% 52% / 0.7)'
                } radius={[2,2,0,0]} />
                <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }}
                  formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No {activeTab === 'all' ? '' : activeTab} events yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border">
                  {['Type', 'From', 'To', 'Amount (ECOW)', 'Energy', 'Block', 'TX Hash', 'Time'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 25).map(t => {
                  const c = TAB_CONFIG[t.type as Tab] ?? TAB_CONFIG.transfer;
                  const isMe = address && (t.from === address.toLowerCase() || t.to === address.toLowerCase());
                  return (
                    <tr key={t.id} className={`border-b border-border/40 hover:bg-secondary/30 ${isMe ? 'bg-primary/3' : ''}`}>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${c.bg} ${c.border} ${c.color}`}>
                          {c.icon}
                          <span className="capitalize">{t.type}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.type === 'mint' ? (
                          <span className="text-xs font-mono text-green-600 italic">⚡ Protocol</span>
                        ) : (
                          <AddressDisplay address={t.from} showLink={false} />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.type === 'burn' ? (
                          <span className="text-xs font-mono text-red-600 italic">🔥 Burned</span>
                        ) : (
                          <AddressDisplay address={t.to} showLink={false} />
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-sm font-bold text-amber-600">
                        {t.amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-green-600">
                        {(t.amount * 0.1).toFixed(1)} kWh
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">#{t.blockNumber.toLocaleString()}</td>
                      <td className="py-2.5 pr-3"><TxHashDisplay hash={t.txHash} /></td>
                      <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 25 && (
              <p className="text-xs text-center text-muted-foreground py-3">Showing 25 of {filtered.length} events</p>
            )}
          </div>
        )}
      </div>

      {/* Activity summary */}
      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" /> Token Flow Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Net Supply',       value: totalMinted - totalBurned, suffix: 'ECOW', plus: true },
            { label: 'Staked / Supply',  value: parseFloat(((totalStaked/totalSupply)*100).toFixed(2)), suffix: '%', plus: false },
            { label: 'Energy Equivalent',value: parseFloat(((totalMinted - totalBurned)*0.1/1000).toFixed(1)), suffix: 'MWh', plus: false },
            { label: 'CO₂ Saved',        value: parseFloat(((totalMinted - totalBurned)*0.1*0.23).toFixed(0)), suffix: 'kg CO₂', plus: false },
          ].map(({ label, value, suffix, plus }) => (
            <div key={label} className="p-4 bg-secondary rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${plus && value > 0 ? 'text-green-600' : 'text-foreground'}`}>
                {plus && value > 0 ? '+' : ''}{value.toLocaleString()} {suffix}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

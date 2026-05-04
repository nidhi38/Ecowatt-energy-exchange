import { useAccount } from 'wagmi';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import {
  Coins, Zap, TrendingUp, ArrowUpRight,
  Flame, Layers, Leaf, Filter, CheckCircle, XCircle,
  Send, Loader
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, getTokenTransfers, mintTokens, burnTokens, stakeTokens, transferTokens } from '../lib/store';

const TOKEN_CONTRACT = '0x7f268357A8c2552623316e2562D90e642BB538E5';
const STAKING_POOL  = '0xStakingPool0000000000000000000000000000';

/* ── Log-filter tabs ── */
type LogTab = 'all' | 'mint' | 'burn' | 'stake' | 'transfer';
const LOG_TABS: Record<LogTab, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  all:      { label: 'All',         icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-foreground', bg: 'bg-secondary',  border: 'border-border'      },
  mint:     { label: 'Minted',      icon: <Zap className="w-3.5 h-3.5" />,        color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200'   },
  burn:     { label: 'Burned',      icon: <Flame className="w-3.5 h-3.5" />,      color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200'     },
  stake:    { label: 'Staked',      icon: <Layers className="w-3.5 h-3.5" />,     color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200'  },
  transfer: { label: 'Transferred', icon: <ArrowUpRight className="w-3.5 h-3.5" />,color:'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200'    },
};

/* ── Action tabs ── */
type ActionTab = 'mint' | 'burn' | 'stake' | 'transfer';

interface ToastMsg { ok: boolean; text: string; txHash?: string }

export function Tokens() {
  const { address, isConnected } = useAccount();
  const { tokenTransfers, priceHistory, user, refresh } = useStore(address);
  const allTransfers = getTokenTransfers();

  /* Log view state */
  const [logTab, setLogTab]   = useState<LogTab>('all');
  const [showMine, setShowMine] = useState(false);

  /* Action panel state */
  const [actionTab, setActionTab] = useState<ActionTab>('mint');
  const [amount, setAmount]       = useState('');
  const [toAddr, setToAddr]       = useState('');
  const [busy, setBusy]           = useState(false);
  const [toast, setToast]         = useState<ToastMsg | null>(null);

  if (!isConnected) return <WalletConnect />;

  /* ── Computed values ── */
  const priceChart = priceHistory.slice(-24).map(p => ({
    time:  new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat((p.price * 1000).toFixed(4)),
  }));

  const typeCounts: Record<string, number> = {};
  allTransfers.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + t.amount; });
  const pieData   = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  const pieColors: Record<string, string> = {
    mint: 'hsl(158 64% 40%)', transfer: 'hsl(217 91% 52%)',
    burn: 'hsl(0 84% 56%)',   stake: 'hsl(271 81% 56%)',
  };

  const totalMinted   = allTransfers.filter(t => t.type === 'mint').reduce((s, t) => s + t.amount, 0);
  const totalBurned   = allTransfers.filter(t => t.type === 'burn').reduce((s, t) => s + t.amount, 0);
  const totalStaked   = allTransfers.filter(t => t.type === 'stake').reduce((s, t) => s + t.amount, 0);
  const totalSupply   = 1_000_000;

  const base     = showMine && address ? tokenTransfers : allTransfers;
  const filtered = logTab === 'all' ? base : base.filter(t => t.type === logTab);

  const timelineBuckets: Record<string, number> = {};
  filtered.slice(0, 30).forEach(t => {
    const key = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    timelineBuckets[key] = (timelineBuckets[key] || 0) + t.amount;
  });
  const timelineData = Object.entries(timelineBuckets).reverse().map(([time, amount]) => ({ time, amount }));

  /* ── Action helpers ── */
  function showToast(ok: boolean, text: string, txHash?: string) {
    setToast({ ok, text, txHash });
    setTimeout(() => setToast(null), 6000);
  }

  async function handleAction() {
    if (!address || busy) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { showToast(false, 'Enter a valid amount greater than 0'); return; }

    setBusy(true);
    await new Promise(r => setTimeout(r, 900)); // simulate tx signing delay

    let res: { success: boolean; message: string; newEcowBalance?: number };

    if (actionTab === 'mint') {
      res = mintTokens(address, amt);
    } else if (actionTab === 'burn') {
      res = burnTokens(address, amt);
    } else if (actionTab === 'stake') {
      res = stakeTokens(address, amt);
    } else {
      if (!toAddr || toAddr.length < 10) { showToast(false, 'Enter a valid recipient address'); setBusy(false); return; }
      res = transferTokens(address, toAddr, amt);
    }

    setBusy(false);
    if (res.success) {
      const last = getTokenTransfers()[0];
      showToast(true, res.message, last?.txHash);
      setAmount('');
      if (actionTab === 'transfer') setToAddr('');
      refresh();
    } else {
      showToast(false, res.message);
    }
  }

  /* ── Action tab config ── */
  const ACTION_CONFIG: Record<ActionTab, {
    label: string; icon: React.FC<{ className?: string }>;
    accent: string; accentText: string; accentBg: string;
    btnClass: string; description: string; hint: string;
    presets: number[];
  }> = {
    mint: {
      label: 'Mint', icon: Zap,
      accent: 'border-green-300', accentText: 'text-green-700', accentBg: 'bg-green-50',
      btnClass: 'bg-green-500 hover:bg-green-600',
      description: 'Mint new ECOW tokens by consuming your kWh energy balance.',
      hint: `Costs 0.1 kWh per ECOW · Your energy: ${user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'} kWh`,
      presets: [500, 1000, 5000, 10000],
    },
    burn: {
      label: 'Burn', icon: Flame,
      accent: 'border-red-300', accentText: 'text-red-700', accentBg: 'bg-red-50',
      btnClass: 'bg-red-500 hover:bg-red-600',
      description: 'Permanently destroy ECOW tokens and receive a kWh energy refund.',
      hint: `Refunds 0.08 kWh per ECOW · Your ECOW: ${user?.ecowBalance.toLocaleString() ?? '0'}`,
      presets: [100, 500, 1000, 5000],
    },
    stake: {
      label: 'Stake', icon: Layers,
      accent: 'border-purple-300', accentText: 'text-purple-700', accentBg: 'bg-purple-50',
      btnClass: 'bg-purple-600 hover:bg-purple-700',
      description: 'Lock ECOW in the staking pool and earn ~12% APY in energy rewards.',
      hint: `Locked in pool for 30 days · Your ECOW: ${user?.ecowBalance.toLocaleString() ?? '0'}`,
      presets: [500, 1000, 5000, 25000],
    },
    transfer: {
      label: 'Transfer', icon: Send,
      accent: 'border-blue-300', accentText: 'text-blue-700', accentBg: 'bg-blue-50',
      btnClass: 'bg-blue-600 hover:bg-blue-700',
      description: 'Send ECOW tokens to any Ethereum wallet address.',
      hint: `Gas: ~21,000 Gwei · Your ECOW: ${user?.ecowBalance.toLocaleString() ?? '0'}`,
      presets: [100, 500, 1000, 2000],
    },
  };

  const cfg = ACTION_CONFIG[actionTab];
  const Icon = cfg.icon;
  const ecowAfter = parseFloat(amount) > 0 && user ? (() => {
    const a = parseFloat(amount);
    if (actionTab === 'mint')     return user.ecowBalance + a;
    if (actionTab === 'burn')     return user.ecowBalance - a;
    if (actionTab === 'stake')    return user.ecowBalance - a;
    if (actionTab === 'transfer') return user.ecowBalance - a;
    return user.ecowBalance;
  })() : null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">ECOW Token</h1>
        <p className="text-sm text-muted-foreground mt-0.5">EcoWatt energy token — 1 ECOW = 0.1 kWh of renewable energy</p>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-sm animate-slide-in ${toast.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.ok
            ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            : <XCircle    className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{toast.ok ? 'Transaction Confirmed' : 'Transaction Failed'}</p>
            <p className="text-xs mt-0.5">{toast.text}</p>
            {toast.txHash && (
              <p className="text-[11px] font-mono mt-1 text-muted-foreground truncate">TX: {toast.txHash.slice(0, 28)}…</p>
            )}
          </div>
          <button onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground shrink-0 text-xs">✕</button>
        </div>
      )}

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
              <p className="text-xs text-muted-foreground">Your ECOW</p>
              <p className="text-lg font-bold font-mono text-amber-600">{user?.ecowBalance.toLocaleString() ?? '0'}</p>
              <p className="text-xs text-muted-foreground">ECOW</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Energy</p>
              <p className="text-lg font-bold font-mono text-green-600">{user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}</p>
              <p className="text-xs text-muted-foreground">kWh</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { tab: 'mint'     as ActionTab, label: 'Total Minted',   value: totalMinted,   icon: Zap,         color: 'card-green',  unit: 'ECOW' },
          { tab: 'burn'     as ActionTab, label: 'Total Burned',   value: totalBurned,   icon: Flame,       color: 'card-rose',   unit: 'ECOW' },
          { tab: 'stake'    as ActionTab, label: 'Total Staked',   value: totalStaked,   icon: Layers,      color: 'card-purple', unit: 'ECOW' },
          { tab: 'transfer' as ActionTab, label: 'Transfers',      value: allTransfers.filter(t => t.type === 'transfer').length, icon: TrendingUp, color: 'card-blue', unit: 'events' },
        ] as { tab: ActionTab; label: string; value: number; icon: React.FC<{ className?: string }>; color: string; unit: string }[]).map(({ tab, label, value, icon: CardIcon, color, unit }) => (
          <button key={tab}
            onClick={() => { setActionTab(tab); document.getElementById('action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}
            className={`rounded-xl ${color} p-4 text-white shadow-md text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}>
            <CardIcon className="w-5 h-5 opacity-70 mb-2" />
            <p className="text-2xl font-bold font-mono">{value > 1000 ? value.toLocaleString() : value}</p>
            <p className="text-xs opacity-80 mt-0.5">{unit} — {label}</p>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ACTION PANEL                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      <div id="action-panel" className="card-blockchain rounded-xl overflow-hidden">
        {/* Tab header */}
        <div className="grid grid-cols-4 border-b border-border">
          {(['mint', 'burn', 'stake', 'transfer'] as ActionTab[]).map(tab => {
            const c = ACTION_CONFIG[tab];
            const TabIcon = c.icon;
            const active = actionTab === tab;
            return (
              <button key={tab} onClick={() => setActionTab(tab)}
                className={`flex flex-col items-center gap-1 py-3 px-2 transition-all border-b-2 ${active ? `border-current ${c.accentText} ${c.accentBg}` : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                <TabIcon className="w-4 h-4" />
                <span className="text-xs font-semibold capitalize">{tab}</span>
              </button>
            );
          })}
        </div>

        {/* Form body */}
        <div className={`p-5 ${cfg.accentBg} border-l-4 ${cfg.accent}`}>
          <div className="flex items-start gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.btnClass} shadow-sm`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${cfg.accentText}`}>{cfg.label} ECOW Tokens</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: inputs */}
            <div className="space-y-3">
              {/* Transfer recipient */}
              {actionTab === 'transfer' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Recipient Address</label>
                  <input
                    value={toAddr} onChange={e => setToAddr(e.target.value)}
                    placeholder="0x… Ethereum address"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Amount (ECOW)</label>
                <div className="relative">
                  <input
                    type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 pr-16 rounded-xl border border-border bg-white text-sm font-mono focus:outline-none focus:border-current focus:ring-1 focus:ring-current/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">ECOW</span>
                </div>
              </div>

              {/* Quick-preset buttons */}
              <div className="flex gap-2 flex-wrap">
                {cfg.presets.map(p => (
                  <button key={p} onClick={() => setAmount(String(p))}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-mono font-semibold transition-all ${amount === String(p) ? `${cfg.accentBg} ${cfg.accent} ${cfg.accentText}` : 'bg-white border-border text-muted-foreground hover:text-foreground'}`}>
                    {p.toLocaleString()}
                  </button>
                ))}
                {actionTab !== 'transfer' && user && (
                  <button onClick={() => setAmount(String(Math.floor(
                    actionTab === 'mint'
                      ? Math.min(100000, Math.floor(user.balance / 0.1))
                      : user.ecowBalance
                  )))}
                    className="text-xs px-3 py-1.5 rounded-lg border bg-white border-border text-muted-foreground hover:text-foreground font-semibold transition-all">
                    MAX
                  </button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{cfg.hint}</p>

              {/* Submit button */}
              <button onClick={handleAction} disabled={busy || !amount}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold transition-all shadow-sm ${cfg.btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}>
                {busy
                  ? <><Loader className="w-4 h-4 animate-spin" /> Confirming…</>
                  : <><Icon className="w-4 h-4" /> {cfg.label} {amount ? `${parseFloat(amount).toLocaleString()} ECOW` : 'Tokens'}</>
                }
              </button>
            </div>

            {/* Right: preview / info panel */}
            <div className="bg-white/70 rounded-xl border border-border/60 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transaction Preview</p>

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Action</span>
                  <span className={`font-bold capitalize ${cfg.accentText}`}>{actionTab}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-mono font-bold">
                    {amount && parseFloat(amount) > 0 ? `${parseFloat(amount).toLocaleString()} ECOW` : '—'}
                  </span>
                </div>

                {actionTab === 'mint' && amount && parseFloat(amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Energy Cost</span>
                    <span className="font-mono text-amber-600 font-bold">−{(parseFloat(amount) * 0.1).toFixed(1)} kWh</span>
                  </div>
                )}
                {actionTab === 'burn' && amount && parseFloat(amount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">kWh Refund</span>
                    <span className="font-mono text-green-600 font-bold">+{(parseFloat(amount) * 0.08).toFixed(1)} kWh</span>
                  </div>
                )}
                {actionTab === 'stake' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Staking Pool</span>
                      <span className="font-mono text-xs text-purple-600">{STAKING_POOL.slice(0, 12)}…</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Est. APY</span>
                      <span className="font-bold text-purple-600">12.0%</span>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Est. Yearly Reward</span>
                        <span className="font-mono font-bold text-purple-600">+{Math.round(parseFloat(amount) * 0.12).toLocaleString()} ECOW</span>
                      </div>
                    )}
                  </>
                )}
                {actionTab === 'transfer' && toAddr && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-mono text-xs text-blue-600">{toAddr.length > 12 ? `${toAddr.slice(0, 10)}…` : toAddr}</span>
                  </div>
                )}

                <div className="border-t border-border/50 pt-2.5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-mono font-bold">{user?.ecowBalance.toLocaleString() ?? '0'} ECOW</span>
                  </div>
                  {ecowAfter !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Balance After</span>
                      <span className={`font-mono font-bold ${ecowAfter >= (user?.ecowBalance ?? 0) ? 'text-green-600' : 'text-red-500'}`}>
                        {ecowAfter.toLocaleString()} ECOW
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. Gas Fee</span>
                    <span className="font-mono text-muted-foreground">~0.00012 ETH</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Ethereum Mainnet
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning for destructive actions */}
              {(actionTab === 'burn' || actionTab === 'stake') && amount && parseFloat(amount) > 0 && (
                <div className={`text-xs px-3 py-2 rounded-lg border mt-2 ${actionTab === 'burn' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                  {actionTab === 'burn'
                    ? '⚠️ Burned tokens are permanently destroyed and cannot be recovered.'
                    : '🔒 Staked tokens are locked for 30 days in the energy pool.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-blockchain rounded-xl p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">ECOW Price Index (mETH)</h2>
          <ResponsiveContainer width="100%" height={180}>
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
                formatter={(v: number) => [`${v.toFixed(4)} mETH`, 'Price']} />
              <Area type="monotone" dataKey="price" stroke="hsl(38 92% 50%)" strokeWidth={2.5} fill="url(#eg)" dot={false} name="price" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Token Distribution</h2>
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={pieColors[d.name] || 'hsl(215 16% 47%)'} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px' }} formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pieColors[d.name] }} />
                <span className="text-xs font-medium capitalize flex-1 text-foreground">{d.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supply metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Mint Rate',     value: `+${Math.floor(Math.random() * 200 + 50)}/hr`,  color: 'text-green-600'  },
          { label: 'Burn Rate',     value: `-${Math.floor(Math.random() * 80  + 20)}/hr`,  color: 'text-red-500'    },
          { label: 'Staked %',      value: `${((totalStaked / totalSupply) * 100).toFixed(1)}%`, color: 'text-purple-600' },
          { label: 'Energy Backed', value: `${((totalMinted - totalBurned) * 0.1 / 1000).toFixed(1)} MWh`, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-stat rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Transfer Log ── */}
      <div className="card-blockchain rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" /> Token Event Log
          </h2>
          <button onClick={() => setShowMine(!showMine)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${showMine ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'}`}>
            {showMine ? 'My events' : 'All events'}
          </button>
        </div>

        {/* Log filter tabs */}
        <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4 flex-wrap">
          {(Object.keys(LOG_TABS) as LogTab[]).map(tab => {
            const c = LOG_TABS[tab];
            const count = tab === 'all' ? base.length : base.filter(t => t.type === tab).length;
            return (
              <button key={tab} onClick={() => setLogTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${logTab === tab ? `${c.bg} ${c.color} border ${c.border} shadow-sm` : 'text-muted-foreground hover:text-foreground'}`}>
                {c.icon}
                <span>{c.label}</span>
                <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-white/60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Mini bar chart */}
        {timelineData.length > 1 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={56}>
              <BarChart data={timelineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="amount"
                  fill={logTab === 'mint' ? 'hsl(158 64% 40% / 0.7)' : logTab === 'burn' ? 'hsl(0 84% 56% / 0.7)' : logTab === 'stake' ? 'hsl(271 81% 56% / 0.7)' : 'hsl(217 91% 52% / 0.7)'}
                  radius={[2,2,0,0]} />
                <Tooltip contentStyle={{ fontSize: '10px', padding: '4px 8px' }}
                  formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No {logTab === 'all' ? '' : logTab} events yet. Use the action panel above!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border">
                  {['Type', 'From', 'To', 'Amount', 'Energy', 'Block', 'TX Hash', 'Time'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 25).map(t => {
                  const c = LOG_TABS[t.type as LogTab] ?? LOG_TABS.transfer;
                  const isMe = address && (t.from === address.toLowerCase() || t.to === address.toLowerCase());
                  return (
                    <tr key={t.id} className={`border-b border-border/40 hover:bg-secondary/30 ${isMe ? 'bg-primary/[0.02]' : ''}`}>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${c.bg} ${c.border} ${c.color}`}>
                          {c.icon}
                          <span className="capitalize">{t.type}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.from === '0x0000000000000000000000000000000000000000'
                          ? <span className="text-xs font-mono text-green-600 italic">⚡ Protocol</span>
                          : <AddressDisplay address={t.from} showLink={false} />}
                      </td>
                      <td className="py-2.5 pr-3">
                        {t.to === '0x0000000000000000000000000000000000000000'
                          ? <span className="text-xs font-mono text-red-600 italic">🔥 Burned</span>
                          : t.to === STAKING_POOL
                          ? <span className="text-xs font-mono text-purple-600 italic">🔒 Pool</span>
                          : <AddressDisplay address={t.to} showLink={false} />}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-sm font-bold text-amber-600">{t.amount.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-green-600">{(t.amount * 0.1).toFixed(1)} kWh</td>
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

      {/* Flow summary */}
      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" /> Token Flow Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Net Supply',        value: totalMinted - totalBurned, suffix: 'ECOW', plus: true  },
            { label: 'Staked / Supply',   value: parseFloat(((totalStaked / totalSupply) * 100).toFixed(2)), suffix: '%', plus: false },
            { label: 'Energy Equivalent', value: parseFloat(((totalMinted - totalBurned) * 0.1 / 1000).toFixed(1)), suffix: 'MWh', plus: false },
            { label: 'CO₂ Saved',         value: parseFloat(((totalMinted - totalBurned) * 0.1 * 0.23).toFixed(0)), suffix: 'kg CO₂', plus: false },
          ].map(({ label, value, suffix, plus }) => (
            <div key={label} className="p-4 bg-secondary rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${plus && value > 0 ? 'text-green-600' : 'text-foreground'}`}>
                {plus && value > 0 ? '+' : ''}{typeof value === 'number' ? value.toLocaleString() : value} {suffix}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

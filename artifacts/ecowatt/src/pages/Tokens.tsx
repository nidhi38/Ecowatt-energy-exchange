import { useAccount } from 'wagmi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Coins, Zap, TrendingUp, ArrowUpRight, ArrowDownLeft, Flame, Layers, Sun, Droplets } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, getTokenTransfers } from '../lib/store';

const TOKEN_CONTRACT = '0x7f268357A8c2552623316e2562D90e642BB538E5';

const typeMeta: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  mint:     { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <Zap className="w-3 h-3" /> },
  transfer: { color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',  icon: <ArrowUpRight className="w-3 h-3" /> },
  burn:     { color: 'text-red-700',   bg: 'bg-red-50 border-red-200',    icon: <Flame className="w-3 h-3" /> },
  stake:    { color: 'text-purple-700',bg: 'bg-purple-50 border-purple-200',icon: <Layers className="w-3 h-3" /> },
};

export function Tokens() {
  const { address, isConnected } = useAccount();
  const { tokenTransfers, priceHistory, user } = useStore(address);
  const allTransfers = getTokenTransfers();

  if (!isConnected) return <WalletConnect />;

  const priceChart = priceHistory.slice(-20).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat((p.price * 1000).toFixed(4)),
  }));

  const typeCounts: Record<string, number> = {};
  allTransfers.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + t.amount; });
  const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
  const pieColors: Record<string, string> = { mint: 'hsl(158 64% 40%)', transfer: 'hsl(217 91% 52%)', burn: 'hsl(0 84% 56%)', stake: 'hsl(271 81% 56%)' };

  const totalMinted = allTransfers.filter(t => t.type === 'mint').reduce((s, t) => s + t.amount, 0);
  const totalBurned = allTransfers.filter(t => t.type === 'burn').reduce((s, t) => s + t.amount, 0);
  const totalStaked = allTransfers.filter(t => t.type === 'stake').reduce((s, t) => s + t.amount, 0);
  const totalSupply = 1000000;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ECOW Token</h1>
        <p className="text-sm text-muted-foreground mt-0.5">EcoWatt energy token — 1 ECOW = 0.1 kWh of renewable energy</p>
      </div>

      {/* Token Contract Card */}
      <div className="card-blockchain rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl card-amber flex items-center justify-center shadow-lg shrink-0">
            <Coins className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-foreground">EcoWatt Energy Token</h2>
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold">ECOW</span>
            </div>
            <AddressDisplay address={TOKEN_CONTRACT} short={false} label="Contract" className="flex-wrap" />
            <p className="text-xs text-muted-foreground mt-1.5">ERC-20 · Ethereum Mainnet · Renewable Energy Backed</p>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            {[
              { label: 'Your Balance', value: `${user?.ecowBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, unit: 'ECOW', color: 'text-amber-600' },
              { label: 'Total Supply', value: totalSupply.toLocaleString(), unit: 'ECOW', color: 'text-foreground' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-secondary rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Minted', value: totalMinted.toLocaleString(), icon: Zap, color: 'card-green', unit: 'ECOW' },
          { label: 'Total Burned', value: totalBurned.toLocaleString(), icon: Flame, color: 'card-rose', unit: 'ECOW' },
          { label: 'Total Staked', value: totalStaked.toLocaleString(), icon: Layers, color: 'card-purple', unit: 'ECOW' },
          { label: 'Transfers', value: allTransfers.length.toString(), icon: TrendingUp, color: 'card-blue', unit: 'events' },
        ].map(({ label, value, icon: Icon, color, unit }) => (
          <div key={label} className={`rounded-xl ${color} p-4 text-white shadow-md`}>
            <Icon className="w-5 h-5 opacity-70 mb-2" />
            <p className="text-2xl font-bold font-mono">{value}</p>
            <p className="text-xs opacity-80 mt-0.5">{unit} — {label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-blockchain rounded-xl p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">ECOW Price Index (mETH)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={priceChart}>
              <defs>
                <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="price" stroke="hsl(38 92% 50%)" strokeWidth={2.5} fill="url(#eg)" dot={false} name="Price (mETH)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Transfer Types</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={pieColors[d.name] || 'hsl(215 16% 47%)'} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '11px' }} formatter={(v: number) => [`${v.toLocaleString()} ECOW`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          <div className="space-y-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pieColors[d.name] }} />
                <span className="text-xs font-medium text-foreground capitalize flex-1">{d.name}</span>
                <span className="text-xs font-mono text-muted-foreground">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transfer History */}
      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Token Transfer Log</h2>
        {allTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No token transfers yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border">
                  {['Type', 'From', 'To', 'Amount', 'Block', 'TX', 'Time'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTransfers.slice(0, 20).map(t => {
                  const meta = typeMeta[t.type] || { color: 'text-foreground', bg: 'bg-secondary border-border', icon: null };
                  return (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-secondary/30">
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
                          {meta.icon}
                          <span className="capitalize">{t.type}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3"><AddressDisplay address={t.from} showLink={false} /></td>
                      <td className="py-2.5 pr-3"><AddressDisplay address={t.to} showLink={false} /></td>
                      <td className="py-2.5 pr-3 font-mono text-sm font-bold text-amber-600">{t.amount.toLocaleString()} ECOW</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">#{t.blockNumber}</td>
                      <td className="py-2.5 pr-3"><TxHashDisplay hash={t.txHash} /></td>
                      <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useAccount } from 'wagmi';
import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Zap, Coins, Sun, Droplets } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, getAllTrades, getStore } from '../lib/store';

export function Portfolio() {
  const { address, isConnected } = useAccount();
  const { user, trades } = useStore(address);
  const [leaderboardView, setLeaderboardView] = useState<'traded' | 'ecow'>('traded');

  if (!isConnected) return <WalletConnect />;

  const allTrades = getAllTrades();
  const myTrades = address ? trades : [];

  const monthlyBuckets: Record<string, { bought: number; sold: number; profit: number }> = {};
  myTrades.forEach(t => {
    const key = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!monthlyBuckets[key]) monthlyBuckets[key] = { bought: 0, sold: 0, profit: 0 };
    if (t.type === 'buy') { monthlyBuckets[key].bought += t.quantity; monthlyBuckets[key].profit -= t.totalPrice; }
    else { monthlyBuckets[key].sold += t.quantity; monthlyBuckets[key].profit += t.totalPrice; }
  });
  const monthlyData = Object.entries(monthlyBuckets).map(([month, d]) => ({ month, ...d }));

  const cost = myTrades.filter(t => t.type === 'buy').reduce((s, t) => s + t.totalPrice, 0);
  const revenue = myTrades.filter(t => t.type === 'sell').reduce((s, t) => s + t.totalPrice, 0);
  const solarTraded = myTrades.filter(t => t.energySource === 'solar').reduce((s, t) => s + t.quantity, 0);
  const hydroTraded = myTrades.filter(t => t.energySource === 'hydro').reduce((s, t) => s + t.quantity, 0);
  const totalEnergyTraded = solarTraded + hydroTraded || 1;

  const store = getStore();
  const leaderboard = Object.values(store.users).map(u => ({
    address: u.address,
    totalTraded: u.totalTraded,
    ecowBalance: u.ecowBalance,
  }));
  const sortedLeaderboard = [...leaderboard].sort((a, b) =>
    leaderboardView === 'traded' ? b.totalTraded - a.totalTraded : b.ecowBalance - a.ecowBalance
  ).slice(0, 10);
  const myRank = sortedLeaderboard.findIndex(e => address && e.address === address.toLowerCase()) + 1;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your energy trading performance and rankings</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl card-blue p-4 text-white shadow-md">
          <Zap className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}</p>
          <p className="text-xs opacity-80">kWh Balance</p>
        </div>
        <div className="rounded-xl card-amber p-4 text-white shadow-md">
          <Coins className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{user?.ecowBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}</p>
          <p className="text-xs opacity-80">ECOW Balance</p>
        </div>
        <div className="rounded-xl card-green p-4 text-white shadow-md">
          <TrendingUp className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{(revenue - cost).toFixed(4)}</p>
          <p className="text-xs opacity-80">ETH Net P&L</p>
        </div>
        <div className="rounded-xl card-purple p-4 text-white shadow-md">
          <Trophy className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">#{myRank > 0 ? myRank : '—'}</p>
          <p className="text-xs opacity-80">of {leaderboard.length} traders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-stat rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Energy Portfolio Mix</p>
          <div className="space-y-4">
            {[
              { label: 'Solar Energy', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200', value: solarTraded, pct: Math.round(solarTraded/totalEnergyTraded*100), barColor: 'hsl(38 92% 50%)' },
              { label: 'Hydro Energy', icon: Droplets, color: 'text-cyan-500', bg: 'bg-cyan-50 border-cyan-200', value: hydroTraded, pct: Math.round(hydroTraded/totalEnergyTraded*100), barColor: 'hsl(199 89% 52%)' },
            ].map(({ label, icon: Icon, color, bg, value, pct, barColor }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${bg} shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-sm font-bold font-mono">{value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh · {pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-stat rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Trading Statistics</p>
          <div className="space-y-3">
            {[
              { label: 'Total Trades', value: myTrades.length },
              { label: 'Buy Orders', value: myTrades.filter(t => t.type === 'buy').length },
              { label: 'Sell Orders', value: myTrades.filter(t => t.type === 'sell').length },
              { label: 'Total Cost', value: `${cost.toFixed(4)} ETH` },
              { label: 'Total Revenue', value: `${revenue.toFixed(4)} ETH` },
              { label: 'Avg Trade Size', value: myTrades.length > 0 ? `${(myTrades.reduce((s, t) => s + t.quantity, 0) / myTrades.length).toFixed(0)} kWh` : 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-bold font-mono text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Monthly Performance
          </h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="bought" fill="hsl(217 91% 52% / 0.7)" name="Bought (kWh)" radius={[3,3,0,0]} />
                <Bar dataKey="sold" fill="hsl(158 64% 40% / 0.7)" name="Sold (kWh)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No trade history yet</div>
          )}
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" /> Profit Trend (ETH)
          </h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(6)} ETH`, 'Profit']} />
                <Line type="monotone" dataKey="profit" stroke="hsl(158 64% 40%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(158 64% 40%)' }} name="Profit (ETH)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No trade history yet</div>
          )}
        </div>
      </div>

      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h2>
        {myTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No trades yet. Head to the marketplace!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border">
                  {['Date', 'Type', 'Source', 'Quantity', 'Price', 'Total', 'ECOW', 'TX', 'Status'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myTrades.slice(0, 15).map(trade => (
                  <tr key={trade.id} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(trade.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${trade.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1">
                        {trade.energySource === 'solar' ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Droplets className="w-3.5 h-3.5 text-cyan-500" />}
                        <span className="text-xs capitalize">{trade.energySource}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-sm font-semibold">{trade.quantity.toFixed(2)} kWh</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-primary">{trade.pricePerUnit.toFixed(6)} ETH</td>
                    <td className="py-2.5 pr-3 font-mono text-sm font-bold">{trade.totalPrice.toFixed(4)} ETH</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-amber-600">{trade.ecowAmount.toLocaleString()}</td>
                    <td className="py-2.5 pr-3"><TxHashDisplay hash={trade.txHash} /></td>
                    <td className="py-2.5">
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-blockchain rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Global Leaderboard
          </h2>
          <div className="flex gap-1">
            {(['traded', 'ecow'] as const).map(v => (
              <button key={v} onClick={() => setLeaderboardView(v)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${leaderboardView === v ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                {v === 'traded' ? 'By kWh' : 'By ECOW'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {sortedLeaderboard.map((entry, i) => {
            const isMe = address && entry.address === address.toLowerCase();
            const rank = i + 1;
            return (
              <div key={entry.address} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-secondary/20 hover:bg-secondary/40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${rank <= 3 ? 'text-white shadow-sm' : 'bg-secondary text-muted-foreground'}`}
                  style={rank === 1 ? { background: 'linear-gradient(135deg, hsl(38 92% 50%), hsl(25 90% 55%))' } : rank === 2 ? { background: 'linear-gradient(135deg, #9ca3af, #6b7280)' } : rank === 3 ? { background: 'linear-gradient(135deg, hsl(38 70% 45%), hsl(25 60% 40%))' } : {}}>
                  {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AddressDisplay address={entry.address} showLink={false} />
                    {isMe && <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">You</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono text-foreground">
                    {leaderboardView === 'traded'
                      ? `${entry.totalTraded.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`
                      : `${entry.ecowBalance.toLocaleString()} ECOW`}
                  </p>
                  <p className="text-xs text-muted-foreground">{leaderboardView === 'traded' ? 'Total Traded' : 'ECOW Balance'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

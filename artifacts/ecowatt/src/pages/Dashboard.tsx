import { useAccount, useDisconnect } from 'wagmi';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Wallet, TrendingUp, Activity, Zap, Coins, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { LiveBlockFeed } from '../components/LiveBlockFeed';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore } from '../lib/store';
import { getEthBalance } from '../lib/alchemy';

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user, trades, priceHistory, tokenTransfers } = useStore(address);
  const [ethBal, setEthBal] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    getEthBalance(address).then(setEthBal);
  }, [address]);

  if (!isConnected) return <WalletConnect />;

  const chartData = priceHistory.slice(-24).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat(p.price.toFixed(6)),
    volume: p.volume,
  }));

  const volumeData = priceHistory.slice(-12).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    volume: p.volume,
  }));

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Wallet Identity Card */}
      <div className="card-blockchain rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl card-blue flex items-center justify-center shadow">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Connected Wallet</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">{address}</span>
                <button onClick={copyAddress} className="p-1 rounded hover:bg-secondary transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-secondary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ethereum Mainnet · Joined {user ? new Date(user.joinedAt).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          <button onClick={() => disconnect()}
            className="text-xs text-muted-foreground hover:text-destructive border border-border px-3 py-1.5 rounded-lg transition-colors self-start md:self-auto">
            Disconnect
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl card-blue p-4 text-white shadow-lg glow-blue">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs opacity-80 uppercase tracking-wider">Energy Balance</p>
            <Zap className="w-4 h-4 opacity-60" />
          </div>
          <p className="text-2xl font-bold font-mono">{user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</p>
          <p className="text-xs opacity-70 mt-1">kWh available</p>
        </div>
        <div className="rounded-xl card-amber p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs opacity-80 uppercase tracking-wider">ECOW Tokens</p>
            <Coins className="w-4 h-4 opacity-60" />
          </div>
          <p className="text-2xl font-bold font-mono">{user?.ecowBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</p>
          <p className="text-xs opacity-70 mt-1">1 ECOW = 0.1 kWh</p>
        </div>
        <div className="rounded-xl card-green p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs opacity-80 uppercase tracking-wider">Total Traded</p>
            <TrendingUp className="w-4 h-4 opacity-60" />
          </div>
          <p className="text-2xl font-bold font-mono">{user?.totalTraded.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}</p>
          <p className="text-xs opacity-70 mt-1">kWh lifetime</p>
        </div>
        <div className="rounded-xl card-purple p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs opacity-80 uppercase tracking-wider">Transactions</p>
            <Activity className="w-4 h-4 opacity-60" />
          </div>
          <p className="text-2xl font-bold font-mono">{trades.length}</p>
          <p className="text-xs opacity-70 mt-1">on-chain trades</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> ECOW/ETH Price (24h)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217 91% 52%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(217 91% 52%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} domain={['auto','auto']} tickFormatter={v => v.toFixed(4)} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} formatter={(v: number) => [v.toFixed(6), 'ETH']} />
              <Area type="monotone" dataKey="price" stroke="hsl(217 91% 52%)" strokeWidth={2} fill="url(#pg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" /> Trading Volume (kWh)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
              <Bar dataKey="volume" fill="hsl(158 64% 40% / 0.7)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Block Feed + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveBlockFeed />
        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Trades</h2>
          {trades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No trades yet. Visit the Marketplace to start!
            </div>
          ) : (
            <div className="space-y-2">
              {trades.slice(0, 6).map(trade => (
                <div key={trade.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${trade.type === 'buy' ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Zap className={`w-4 h-4 ${trade.type === 'buy' ? 'text-green-600' : 'text-red-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {trade.type === 'buy' ? 'Purchased' : 'Sold'} {trade.quantity.toFixed(2)} kWh
                    </p>
                    <TxHashDisplay hash={trade.txHash} className="mt-0.5" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold font-mono ${trade.type === 'buy' ? 'text-red-500' : 'text-green-600'}`}>
                      {trade.type === 'buy' ? '-' : '+'}{trade.totalPrice.toFixed(4)} ETH
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(trade.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open Marketplace', href: '/marketplace', color: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' },
          { label: 'Trade Now', href: '/trading', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
          { label: 'Block Explorer', href: '/blockchain', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
          { label: 'View Analytics', href: '/analytics', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
        ].map(({ label, href, color }) => (
          <Link key={href} href={href}>
            <div className={`p-3 rounded-xl border text-center text-sm font-semibold cursor-pointer transition-all ${color}`}>
              {label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

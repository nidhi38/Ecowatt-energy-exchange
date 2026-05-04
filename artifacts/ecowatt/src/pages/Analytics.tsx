import { useAccount } from 'wagmi';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Zap, Coins, Sun, Droplets } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { useStore, getAllTrades } from '../lib/store';

const COLORS = ['hsl(217 91% 52%)', 'hsl(158 64% 40%)', 'hsl(38 92% 50%)', 'hsl(271 81% 56%)', 'hsl(340 82% 52%)'];

export function Analytics() {
  const { address, isConnected } = useAccount();
  const { priceHistory } = useStore(address);
  const allTrades = getAllTrades();

  if (!isConnected) return <WalletConnect />;

  const priceChart = priceHistory.slice(-30).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat(p.price.toFixed(6)),
    volume: p.volume,
  }));

  const hourlyVol: Record<number, number> = {};
  allTrades.forEach(t => { const h = new Date(t.createdAt).getHours(); hourlyVol[h] = (hourlyVol[h] || 0) + t.quantity; });
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, volume: hourlyVol[h] || 0 }));

  const sourceTotals: Record<string, number> = {};
  allTrades.forEach(t => { sourceTotals[t.energySource] = (sourceTotals[t.energySource] || 0) + t.quantity; });
  const sourceData = Object.entries(sourceTotals).map(([name, value]) => ({ name, value }));

  const buyCount = allTrades.filter(t => t.type === 'buy').length;
  const sellCount = allTrades.filter(t => t.type === 'sell').length;
  const typePie = [
    { name: 'Buy Orders', value: buyCount || 1 },
    { name: 'Sell Orders', value: sellCount || 1 },
  ];

  const totalVolume = allTrades.reduce((s, t) => s + t.quantity, 0);
  const avgPrice = allTrades.length > 0 ? allTrades.reduce((s, t) => s + t.pricePerUnit, 0) / allTrades.length : 0;
  const totalValue = allTrades.reduce((s, t) => s + t.totalPrice, 0);
  const totalEcow = allTrades.reduce((s, t) => s + t.ecowAmount, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Market Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Deep market insights for the EcoWatt energy trading ecosystem</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl card-blue p-4 text-white shadow-md">
          <Zap className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-80">kWh Traded</p>
        </div>
        <div className="rounded-xl card-green p-4 text-white shadow-md">
          <TrendingUp className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{avgPrice > 0 ? avgPrice.toFixed(5) : 'N/A'}</p>
          <p className="text-xs opacity-80">ETH Avg Price</p>
        </div>
        <div className="rounded-xl card-amber p-4 text-white shadow-md">
          <Coins className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{totalEcow.toLocaleString()}</p>
          <p className="text-xs opacity-80">ECOW Transferred</p>
        </div>
        <div className="rounded-xl card-purple p-4 text-white shadow-md">
          <BarChart3 className="w-5 h-5 opacity-70 mb-2" />
          <p className="text-2xl font-bold font-mono">{allTrades.length}</p>
          <p className="text-xs opacity-80">Total Trades</p>
        </div>
      </div>

      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Price & Volume History
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={priceChart}>
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217 91% 52%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(217 91% 52%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="price" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} domain={['auto','auto']} tickFormatter={v => v.toFixed(4)} />
            <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 10, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area yAxisId="price" type="monotone" dataKey="price" stroke="hsl(217 91% 52%)" strokeWidth={2.5} fill="url(#ag)" dot={false} name="Price (ETH)" />
            <Bar yAxisId="volume" dataKey="volume" fill="hsl(158 64% 40% / 0.3)" name="Volume (kWh)" radius={[2,2,0,0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-blockchain rounded-xl p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">Hourly Trading Volume</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
              <Bar dataKey="volume" fill="hsl(38 92% 50% / 0.7)" name="kWh" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-blockchain rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Energy Source Mix</h2>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" nameKey="name" paddingAngle={3}>
                  {sourceData.map((_, i) => <Cell key={i} fill={[`hsl(38 92% 50%)`, `hsl(199 89% 52%)`][i % 2]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(0)} kWh`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          <div className="space-y-2">
            {sourceData.map(({ name, value }, i) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: [`hsl(38 92% 50%)`, `hsl(199 89% 52%)`][i % 2] }} />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize font-medium text-foreground">{name === 'solar' ? '☀️ Solar' : '💧 Hydro'}</span>
                    <span className="font-mono text-muted-foreground">{value.toFixed(0)} kWh</span>
                  </div>
                  <div className="progress-bar mt-1">
                    <div className="progress-fill" style={{ width: `${(value / totalVolume) * 100}%`, background: [`hsl(38 92% 50%)`, `hsl(199 89% 52%)`][i % 2] }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-2 text-center">
              {typePie.map(({ name, value }, i) => (
                <div key={name}>
                  <p className="text-lg font-bold font-mono text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

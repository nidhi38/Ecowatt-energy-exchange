import { useAccount } from 'wagmi';
import { useState } from 'react';
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, CheckCircle, XCircle, Loader, Activity } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay } from '../components/AddressDisplay';
import { useStore, executeTradingOrder } from '../lib/store';
import { generateSimulatedTxHash } from '../lib/alchemy';

type OrderStatus = { type: 'success' | 'error' | 'pending'; message: string } | null;

const PRICE_LEVELS = [0.0260, 0.0265, 0.0270, 0.0275, 0.0280, 0.0285, 0.0290, 0.0295, 0.0300, 0.0305];

export function Trading() {
  const { address, isConnected } = useAccount();
  const { user, priceHistory, refresh } = useStore(address);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [status, setStatus] = useState<OrderStatus>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const chartData = priceHistory.slice(-30).map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: parseFloat(p.price.toFixed(6)),
    volume: p.volume,
  }));

  const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0.0285;
  const prevPrice = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2].price : currentPrice;
  const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100;

  const orderBookBids = PRICE_LEVELS.slice(0, 5).reverse().map((p, i) => ({ price: p.toFixed(5), size: Math.floor(Math.random() * 800) + 100, total: 0 }));
  const orderBookAsks = PRICE_LEVELS.slice(5).map((p, i) => ({ price: p.toFixed(5), size: Math.floor(Math.random() * 800) + 100, total: 0 }));

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !qty || isProcessing) return;
    const quantity = parseFloat(qty);
    const price = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice;
    if (isNaN(quantity) || quantity <= 0) return;

    setIsProcessing(true);
    setStatus({ type: 'pending', message: `Submitting ${side.toUpperCase()} order…` });
    await new Promise(r => setTimeout(r, 800));
    setStatus({ type: 'pending', message: 'Awaiting block confirmation…' });
    await new Promise(r => setTimeout(r, 600));

    const txHash = generateSimulatedTxHash();
    const result = executeTradingOrder(address, quantity, price, side, txHash);
    refresh();
    setIsProcessing(false);
    setStatus(result.success
      ? { type: 'success', message: `✓ ${side.toUpperCase()} ${quantity} kWh @ ${price.toFixed(6)} ETH\nNew balance: ${result.newBalance?.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh · ${result.newEcowBalance?.toLocaleString()} ECOW` }
      : { type: 'error', message: result.message }
    );
    if (result.success) setQty('');
    setTimeout(() => setStatus(null), 6000);
  }

  if (!isConnected) return <WalletConnect />;

  const totalValue = qty && !isNaN(parseFloat(qty)) ? (parseFloat(qty) * currentPrice).toFixed(4) : '—';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Energy Trading</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time ECOW market — blockchain execution</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className="text-xl font-bold font-mono text-foreground">{currentPrice.toFixed(5)} ETH</p>
          </div>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${priceChange >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(3)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chart - 3 cols */}
        <div className="lg:col-span-3 card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> ECOW Price Chart
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
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
              <Area yAxisId="price" type="monotone" dataKey="price" stroke="hsl(217 91% 52%)" strokeWidth={2.5} fill="url(#tg)" dot={false} name="Price (ETH)" />
              <Bar yAxisId="volume" dataKey="volume" fill="hsl(158 64% 40% / 0.25)" name="Volume (kWh)" radius={[2,2,0,0]} />
              <ReferenceLine yAxisId="price" y={currentPrice} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Order Book */}
        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Order Book</h2>
          <div className="space-y-0.5">
            {orderBookAsks.map(o => (
              <div key={o.price} className="flex justify-between text-xs py-0.5 hover:bg-red-50 rounded px-1">
                <span className="font-mono text-red-500 font-medium">{o.price}</span>
                <span className="font-mono text-muted-foreground">{o.size}</span>
              </div>
            ))}
          </div>
          <div className="my-2 py-1.5 px-2 bg-secondary rounded text-center">
            <span className={`text-sm font-bold font-mono ${priceChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {currentPrice.toFixed(5)}
            </span>
          </div>
          <div className="space-y-0.5">
            {orderBookBids.map(o => (
              <div key={o.price} className="flex justify-between text-xs py-0.5 hover:bg-green-50 rounded px-1">
                <span className="font-mono text-green-600 font-medium">{o.price}</span>
                <span className="font-mono text-muted-foreground">{o.size}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Place Order</h2>
          <form onSubmit={handleOrder} className="space-y-4">
            <div className="flex gap-1 p-1 bg-secondary rounded-xl">
              <button type="button" onClick={() => setSide('buy')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${side === 'buy' ? 'bg-green-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <TrendingUp className="w-4 h-4" /> Buy
              </button>
              <button type="button" onClick={() => setSide('sell')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${side === 'sell' ? 'bg-red-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <TrendingDown className="w-4 h-4" /> Sell
              </button>
            </div>

            <div className="flex gap-2">
              {(['market', 'limit'] as const).map(t => (
                <button key={t} type="button" onClick={() => setOrderType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${orderType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)} Order
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Quantity (kWh)</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="100"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-primary/50" />
            </div>

            {orderType === 'limit' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Limit Price (ETH/kWh)</label>
                <input type="number" step="0.00001" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={currentPrice.toFixed(5)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-primary/50" />
              </div>
            )}

            <div className="p-3 rounded-xl bg-secondary border border-border space-y-1.5">
              {[
                { label: 'Price', value: `${(orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice).toFixed(6)} ETH/kWh` },
                { label: 'Est. Total', value: `${totalValue} ETH` },
                { label: 'ECOW Earned', value: qty && !isNaN(parseFloat(qty)) ? `${(parseFloat(qty) * 10).toLocaleString()} ECOW` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <button type="submit" disabled={isProcessing || !qty}
              className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                isProcessing || !qty ? 'opacity-60 cursor-not-allowed bg-gray-400' :
                side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}>
              {isProcessing && <Loader className="w-4 h-4 animate-spin" />}
              {isProcessing ? 'Processing…' : `${side === 'buy' ? 'Buy' : 'Sell'} Energy`}
            </button>
          </form>

          {status && (
            <div className={`mt-4 p-3 rounded-xl text-xs whitespace-pre-line border ${
              status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
              status.type === 'error'   ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-primary/5 border-primary/20 text-primary'
            }`}>
              <div className="flex items-start gap-2">
                {status.type === 'success' && <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                {status.type === 'error'   && <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                {status.type === 'pending' && <Loader className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin" />}
                <span>{status.message}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card-blockchain rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Account Summary</h2>
          <div className="space-y-3">
            {[
              { label: 'Energy Balance', value: `${user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`, color: 'text-primary' },
              { label: 'ECOW Balance', value: `${user?.ecowBalance.toLocaleString()} ECOW`, color: 'text-amber-600' },
              { label: 'Total Bought', value: `${user?.totalBought.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`, color: 'text-green-600' },
              { label: 'Total Sold', value: `${user?.totalSold.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold font-mono ${color}`}>{value}</span>
              </div>
            ))}
            {address && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Wallet</p>
                <AddressDisplay address={address} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

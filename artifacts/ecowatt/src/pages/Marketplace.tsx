import { useAccount } from 'wagmi';
import { useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Plus, CheckCircle, XCircle, Loader, Wallet, Zap, Coins, Sun, Droplets } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { useStore, createListing, executeMarketplaceTrade, getActiveListings, EnergyListing } from '../lib/store';
import { generateSimulatedTxHash } from '../lib/alchemy';

type OrderStatus = { type: 'success' | 'error' | 'pending'; message: string } | null;

const sourceIcons: Record<string, React.ReactNode> = {
  solar: <Sun className="w-3.5 h-3.5 text-amber-500" />,
  hydro: <Droplets className="w-3.5 h-3.5 text-cyan-500" />,
};
const sourceBg: Record<string, string> = {
  solar: 'bg-amber-50 border-amber-200',
  hydro: 'bg-cyan-50 border-cyan-200',
};

export function Marketplace() {
  const { address, isConnected } = useAccount();
  const { user, listings, refresh } = useStore(address);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [createQty, setCreateQty] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createType, setCreateType] = useState<'buy' | 'sell'>('sell');
  const [createSource, setCreateSource] = useState<EnergyListing['energySource']>('solar');
  const [status, setStatus] = useState<OrderStatus>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  const orderBookData = [
    { price: '0.0265', buy: 300, sell: 150 },
    { price: '0.0275', buy: 450, sell: 250 },
    { price: '0.0285', buy: 600, sell: 400 },
    { price: '0.0295', buy: 350, sell: 500 },
    { price: '0.0310', buy: 200, sell: 750 },
  ];

  async function processNext(ids: string[]) {
    if (isProcessingRef.current || ids.length === 0 || !address) return;
    const nextId = ids[0];
    const all = getActiveListings();
    const listing = [...all.buy, ...all.sell].find(l => l.id === nextId);
    if (!listing) { queueRef.current = queueRef.current.slice(1); if (queueRef.current.length > 0) processNext(queueRef.current); return; }
    isProcessingRef.current = true;
    setProcessingId(nextId);
    setStatus({ type: 'pending', message: `Verifying listing ${nextId.slice(0, 8)}…` });
    await new Promise(r => setTimeout(r, 700));
    const txHash = generateSimulatedTxHash();
    setStatus({ type: 'pending', message: `Broadcasting TX ${txHash.slice(0, 16)}…` });
    await new Promise(r => setTimeout(r, 600));
    const result = executeMarketplaceTrade(address, listing, txHash);
    refresh();
    setStatus(result.success
      ? { type: 'success', message: `✓ ${result.message}\nBalance: ${result.newBuyerBalance?.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh · ${result.newEcowBalance?.toLocaleString()} ECOW` }
      : { type: 'error', message: result.message }
    );
    setTimeout(() => setStatus(null), 6000);
    queueRef.current = queueRef.current.slice(1);
    isProcessingRef.current = false;
    setProcessingId(null);
    if (queueRef.current.length > 0) {
      await new Promise(r => setTimeout(r, 400));
      processNext(queueRef.current);
    }
  }

  function handleTrade(listing: EnergyListing) {
    if (!address || listing.address === address.toLowerCase()) return;
    queueRef.current = [...queueRef.current, listing.id];
    if (!isProcessingRef.current) processNext(queueRef.current);
    else setStatus({ type: 'pending', message: `Queued (position ${queueRef.current.length})` });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !createQty || !createPrice) return;
    const txHash = generateSimulatedTxHash();
    createListing(address, parseFloat(createQty), parseFloat(createPrice), createType, txHash);
    refresh();
    setStatus({ type: 'success', message: `✓ ${createType.toUpperCase()} listing: ${createQty} kWh @ ${parseFloat(createPrice).toFixed(6)} ETH` });
    setCreateQty(''); setCreatePrice('');
    setTimeout(() => setStatus(null), 4000);
  }

  if (!isConnected) return <WalletConnect />;
  const displayListings = tab === 'buy' ? listings.sell : listings.buy;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Energy Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-0.5">P2P energy trading — blockchain-verified, sequentially processed</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-stat rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl card-blue flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Energy Balance</p>
              <p className="text-xl font-bold font-mono text-primary">{user?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'} kWh</p>
            </div>
          </div>
        </div>
        <div className="card-stat rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl card-amber flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ECOW Balance</p>
              <p className="text-xl font-bold font-mono text-amber-600">{user?.ecowBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="card-stat rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
          {address && <AddressDisplay address={address} short={false} className="flex-wrap" />}
        </div>
      </div>

      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Order Book Depth</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={orderBookData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 90%)" />
            <XAxis dataKey="price" tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(215 16% 47%)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid hsl(214 20% 88%)', borderRadius: '10px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="buy" fill="hsl(158 64% 40% / 0.7)" name="Buy Orders" radius={[3,3,0,0]} />
            <Bar dataKey="sell" fill="hsl(217 91% 52% / 0.65)" name="Sell Orders" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-blockchain rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Create Listing
        </h2>
        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Type</label>
              <select value={createType} onChange={e => setCreateType(e.target.value as 'buy' | 'sell')}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-primary/50">
                <option value="sell">Sell Energy</option>
                <option value="buy">Buy Energy</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Source</label>
              <select value={createSource} onChange={e => setCreateSource(e.target.value as EnergyListing['energySource'])}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-primary/50">
                <option value="solar">Solar</option>
                <option value="hydro">Hydro</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Quantity (kWh)</label>
              <input type="number" min="1" value={createQty} onChange={e => setCreateQty(e.target.value)} placeholder="100"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Price (ETH/kWh)</label>
              <input type="number" min="0.00001" step="0.00001" value={createPrice} onChange={e => setCreatePrice(e.target.value)} placeholder="0.0285"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-primary/50" />
            </div>
            <button type="submit" className="py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> List
            </button>
          </div>
        </form>
      </div>

      {status && (
        <div className={`p-4 rounded-xl text-sm whitespace-pre-line border ${
          status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
          status.type === 'error'   ? 'bg-red-50 border-red-200 text-red-700' :
          'bg-primary/5 border-primary/20 text-primary'
        }`}>
          <div className="flex items-start gap-2">
            {status.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {status.type === 'error'   && <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {status.type === 'pending' && <Loader className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />}
            <span>{status.message}</span>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('buy')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab === 'buy' ? 'border-green-500 text-green-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <TrendingDown className="w-4 h-4" /> Buy Energy ({listings.sell.length} offers)
        </button>
        <button onClick={() => setTab('sell')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab === 'sell' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <TrendingUp className="w-4 h-4" /> Sell Energy ({listings.buy.length} offers)
        </button>
      </div>

      <div className="card-blockchain rounded-xl p-5">
        {displayListings.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-border mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No listings available. Create one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayListings.slice(0, 12).map(listing => {
              const isOwn = listing.address === address?.toLowerCase();
              const isProc = processingId === listing.id;
              const inQueue = queueRef.current.includes(listing.id);
              return (
                <div key={listing.id}
                  className={`p-4 rounded-xl border transition-all ${isOwn ? 'bg-secondary/50 border-border opacity-70' : 'bg-white border-border hover:border-primary/30 hover:shadow-md'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-lg border flex items-center gap-1 text-xs font-medium ${sourceBg[listing.energySource] || 'bg-secondary border-border'}`}>
                        {sourceIcons[listing.energySource]}
                        <span className="capitalize">{listing.energySource}</span>
                      </div>
                      {listing.tokenized && <span className="token-badge"><Coins className="w-3 h-3" />Tokenized</span>}
                    </div>
                    {isOwn && <span className="text-xs text-muted-foreground border border-border px-2 py-0.5 rounded-lg">Your listing</span>}
                  </div>
                  <div className="mb-3">
                    <p className="text-xl font-bold font-mono text-foreground">{listing.quantity.toFixed(0)} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="font-mono font-semibold text-primary">{listing.pricePerUnit.toFixed(6)}</span> ETH/kWh
                      <span className="ml-2 text-xs">= {(listing.quantity * listing.pricePerUnit).toFixed(4)} ETH total</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">📍 {listing.location}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <AddressDisplay address={listing.address} showLink={false} />
                    {!isOwn && (
                      <button onClick={() => handleTrade(listing)} disabled={isProc || inQueue}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${
                          isProc || inQueue ? 'bg-secondary text-muted-foreground cursor-not-allowed' :
                          tab === 'buy' ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm' : 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                        }`}>
                        {isProc && <Loader className="w-3.5 h-3.5 animate-spin" />}
                        {isProc ? 'Processing…' : inQueue ? 'Queued' : tab === 'buy' ? 'Buy' : 'Sell'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

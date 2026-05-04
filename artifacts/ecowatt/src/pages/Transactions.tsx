import { useAccount } from 'wagmi';
import { useState } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Sun, Droplets } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { AddressDisplay, TxHashDisplay } from '../components/AddressDisplay';
import { getAllTrades, Trade } from '../lib/store';

type FilterType = 'all' | 'buy' | 'sell';
type SortKey = 'date' | 'value' | 'qty';

export function Transactions() {
  const { isConnected } = useAccount();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortKey>('date');

  if (!isConnected) return <WalletConnect />;

  const allTrades = getAllTrades();

  let filtered = allTrades.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.txHash.includes(q) || t.buyerAddress.includes(q) || t.sellerAddress.includes(q) || t.energySource.includes(q);
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === 'date')  return b.createdAt - a.createdAt;
    if (sort === 'value') return b.totalPrice - a.totalPrice;
    return b.quantity - a.quantity;
  });

  const totalVolume = filtered.reduce((s, t) => s + t.quantity, 0);
  const totalValue  = filtered.reduce((s, t) => s + t.totalPrice, 0);
  const avgGas      = filtered.length > 0 ? filtered.reduce((s, t) => s + t.gasUsed, 0) / filtered.length : 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transaction History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All on-chain energy trades across the EcoWatt network</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card-stat rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Txns</p>
          <p className="text-2xl font-bold font-mono text-primary">{filtered.length}</p>
        </div>
        <div className="card-stat rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Volume</p>
          <p className="text-2xl font-bold font-mono text-foreground">{totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</p>
        </div>
        <div className="card-stat rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Value</p>
          <p className="text-2xl font-bold font-mono text-foreground">{totalValue.toFixed(4)} ETH</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-blockchain rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by TX hash, address, or energy source…"
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 p-1 bg-secondary rounded-lg">
              {(['all', 'buy', 'sell'] as FilterType[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {f}
                </button>
              ))}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs focus:outline-none focus:border-primary/50">
              <option value="date">Sort: Date</option>
              <option value="value">Sort: Value</option>
              <option value="qty">Sort: Volume</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-blockchain rounded-xl p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-20" />
            No transactions match your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-border">
                  {['Date', 'Type', 'Source', 'From', 'To', 'Quantity', 'Price', 'Total', 'Gas', 'Block', 'TX'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(trade => (
                  <tr key={trade.id} className="border-b border-border/40 hover:bg-secondary/30">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(trade.createdAt).toLocaleString()}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${trade.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {trade.type === 'buy' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${trade.energySource === 'solar' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-cyan-50 border-cyan-200 text-cyan-700'}`}>
                        {trade.energySource === 'solar' ? <Sun className="w-3 h-3" /> : <Droplets className="w-3 h-3" />}
                        <span className="capitalize">{trade.energySource}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3"><AddressDisplay address={trade.buyerAddress} showLink={false} /></td>
                    <td className="py-2.5 pr-3"><AddressDisplay address={trade.sellerAddress} showLink={false} /></td>
                    <td className="py-2.5 pr-3 font-mono text-sm font-semibold">{trade.quantity.toFixed(2)} kWh</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-primary">{trade.pricePerUnit.toFixed(6)}</td>
                    <td className="py-2.5 pr-3 font-mono text-sm font-bold">{trade.totalPrice.toFixed(4)} ETH</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{trade.gasUsed.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">#{trade.blockNumber}</td>
                    <td className="py-2.5"><TxHashDisplay hash={trade.txHash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="text-xs text-muted-foreground text-center py-3">Showing 50 of {filtered.length} transactions</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

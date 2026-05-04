import { useEffect, useState } from 'react';
import { getNetworkStatus, getRecentBlocks, AlchemyBlock } from '../lib/alchemy';
import { Activity, Cpu, Zap, Clock, Hash, Flame } from 'lucide-react';

interface NetworkStatus {
  connected: boolean;
  gasPrice: number;
  blockNumber: number;
  sepoliaBlock: number;
  pendingTx: number;
  tps: number;
  timestamp: number;
}

export function LiveBlockFeed() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [blocks, setBlocks] = useState<AlchemyBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBlock, setNewBlock] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [ns, recentBlocks] = await Promise.all([getNetworkStatus(), getRecentBlocks(6)]);
        if (!mounted) return;
        setStatus(ns);
        if (recentBlocks.length > 0) {
          const topHash = recentBlocks[0]?.hash;
          setBlocks(prev => {
            if (prev.length > 0 && prev[0].hash !== topHash) {
              setNewBlock(topHash || null);
              setTimeout(() => setNewBlock(null), 2000);
            }
            return recentBlocks;
          });
        }
        setLoading(false);
      } catch { if (mounted) setLoading(false); }
    }
    fetchData();
    const iv = setInterval(fetchData, 12000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (loading) {
    return (
      <div className="card-blockchain rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="status-dot-live" />
          <span className="text-xs font-medium text-muted-foreground">Connecting to Ethereum Mainnet…</span>
        </div>
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="card-blockchain rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`status-dot-live ${status?.connected ? '' : '!bg-red-500'}`} />
          <span className="text-sm font-semibold text-foreground">
            {status?.connected ? 'Ethereum Mainnet' : 'Disconnected'}
          </span>
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            #{status?.blockNumber.toLocaleString()}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {status ? new Date(status.timestamp).toLocaleTimeString() : '—'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Flame, label: 'Gas', value: status ? `${status.gasPrice.toFixed(1)} Gwei` : '—', color: 'text-orange-500', bg: 'bg-orange-50' },
          { icon: Activity, label: 'Pending', value: status ? status.pendingTx.toLocaleString() : '—', color: 'text-blue-500', bg: 'bg-blue-50' },
          { icon: Zap, label: 'TPS', value: status ? status.tps.toFixed(1) : '—', color: 'text-green-500', bg: 'bg-green-50' },
          { icon: Cpu, label: 'Sepolia', value: status ? `#${(status.sepoliaBlock % 100000).toLocaleString()}` : '—', color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`p-2.5 rounded-xl ${bg} text-center`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className="text-xs font-bold font-mono text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {blocks.slice(0, 5).map((block, i) => {
          const num = parseInt(block.number, 16);
          const gasUsed = parseInt(block.gasUsed, 16);
          const gasLimit = parseInt(block.gasLimit, 16);
          const gasUtilPct = Math.round((gasUsed / gasLimit) * 100);
          const baseFee = block.baseFeePerGas ? parseFloat((parseInt(block.baseFeePerGas, 16) / 1e9).toFixed(2)) : 0;
          const isNew = block.hash === newBlock;

          return (
            <div key={block.hash}
              className={`p-3 rounded-xl border transition-all ${isNew ? 'border-primary/40 bg-primary/5 animate-block-appear' : 'border-border bg-secondary/30 hover:bg-secondary/50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {isNew && <div className="status-dot-live" />}
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-sm font-bold text-foreground">#{num.toLocaleString()}</span>
                  {isNew && <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-bold">NEW</span>}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{baseFee > 0 ? `${baseFee} Gwei` : '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {block.transactions.length} txs
                </span>
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  {gasUtilPct}% gas
                </span>
                <div className="flex-1">
                  <div className="progress-bar" style={{ height: '3px' }}>
                    <div className="progress-fill" style={{ width: `${gasUtilPct}%`, background: gasUtilPct > 80 ? 'hsl(0 84% 56%)' : gasUtilPct > 50 ? 'hsl(38 92% 50%)' : 'hsl(158 64% 40%)' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

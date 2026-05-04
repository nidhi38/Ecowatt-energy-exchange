import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Zap, Wallet, Shield, Activity, TrendingUp, Coins } from 'lucide-react';

export function WalletConnect() {
  const { connect } = useConnect();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-border shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-purple-500" />

          <div className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl card-blue flex items-center justify-center shadow-lg">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center shadow">
                  <div className="status-dot-live" />
                </div>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">EcoWatt</h1>
              <p className="text-base text-muted-foreground mt-1">Decentralized P2P Energy Trading</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono bg-secondary inline-block px-2 py-0.5 rounded">
                Ethereum Blockchain · ECOW Token
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { icon: Shield, label: 'Smart Contracts', desc: 'Audited & verified on-chain', color: 'text-primary', bg: 'bg-primary/8' },
                { icon: Activity, label: 'Live Network', desc: 'Real-time blockchain data', color: 'text-green-600', bg: 'bg-green-50' },
                { icon: Coins, label: 'ECOW Tokens', desc: 'Tokenized energy assets', color: 'text-amber-600', bg: 'bg-amber-50' },
                { icon: TrendingUp, label: 'P2P Trading', desc: 'Direct peer-to-peer', color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className={`p-3 rounded-xl ${bg} border border-transparent`}>
                  <Icon className={`w-4 h-4 ${color} mb-1.5`} />
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-secondary border border-border text-left">
              <p className="text-xs text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Contract Addresses</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">ECOW Token</span>
                  <span className="text-xs font-mono text-primary">0x7f26…38E5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Marketplace</span>
                  <span className="text-xs font-mono text-primary">0x3f90…4d2</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => connect({ connector: injected() })}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>

            <p className="text-xs text-muted-foreground">
              Connect MetaMask or any injected wallet to start trading green energy on the blockchain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

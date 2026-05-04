import { Link, useLocation } from 'wouter';
import { Zap, LayoutDashboard, ShoppingCart, TrendingUp, Network, History, BarChart3, Coins, Copy, Check, Trophy } from 'lucide-react';
import { useAccount } from 'wagmi';
import { getOrCreateUser } from '../lib/store';
import { useEffect, useState } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
  { path: '/trading', label: 'Trading', icon: TrendingUp },
  { path: '/tokens', label: 'Tokens', icon: Coins },
  { path: '/portfolio', label: 'Portfolio', icon: Trophy },
  { path: '/blockchain', label: 'Explorer', icon: Network },
  { path: '/transactions', label: 'History', icon: History },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Navigation() {
  const [location] = useLocation();
  const { address } = useAccount();
  const [balance, setBalance] = useState<number | null>(null);
  const [ecow, setEcow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) { setBalance(null); setEcow(null); return; }
    const u = getOrCreateUser(address);
    setBalance(u.balance);
    setEcow(u.ecowBalance);
    const iv = setInterval(() => {
      const u2 = getOrCreateUser(address);
      setBalance(u2.balance);
      setEcow(u2.ecowBalance);
    }, 3000);
    return () => clearInterval(iv);
  }, [address]);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer select-none shrink-0">
              <div className="w-8 h-8 rounded-lg card-blue flex items-center justify-center shadow-sm">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-base text-foreground tracking-tight">EcoWatt</span>
                <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">v2</span>
              </div>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-0.5">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = path === '/' ? location === '/' : location.startsWith(path);
              return (
                <Link key={path} href={path}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {address && (
              <div className="flex items-center gap-2">
                {balance !== null && (
                  <span className="text-xs font-mono text-primary font-semibold bg-primary/8 px-2 py-1 rounded-lg">
                    {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh
                  </span>
                )}
                {ecow !== null && (
                  <span className="text-xs font-mono text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-lg">
                    {ecow.toLocaleString()} ECOW
                  </span>
                )}
                <button onClick={copyAddress}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-lg hover:bg-secondary/80 transition-colors">
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {address.slice(0, 6)}…{address.slice(-4)}
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="status-dot-live" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex xl:hidden overflow-x-auto gap-1 pb-1 -mx-2 px-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/' ? location === '/' : location.startsWith(path);
            return (
              <Link key={path} href={path}>
                <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

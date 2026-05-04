import { Switch, Route, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './lib/wagmi';
import { Navigation } from './components/Navigation';
import { Dashboard } from './pages/Dashboard';
import { Marketplace } from './pages/Marketplace';
import { Trading } from './pages/Trading';
import { Tokens } from './pages/Tokens';
import { Portfolio } from './pages/Portfolio';
import { Blockchain } from './pages/Blockchain';
import { Transactions } from './pages/Transactions';
import { Analytics } from './pages/Analytics';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/trading" component={Trading} />
      <Route path="/tokens" component={Tokens} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/blockchain" component={Blockchain} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/analytics" component={Analytics} />
      <Route>
        <div className="p-8 text-center text-muted-foreground">Page not found</div>
      </Route>
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={base}>
          <div className="min-h-screen flex flex-col bg-background">
            <Navigation />
            <main className="flex-1">
              <Router />
            </main>
            <footer className="border-t border-border bg-white px-6 py-3">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-mono">
                  EcoWatt v2.0 · Ethereum Mainnet · Alchemy RPC · ECOW Token
                </p>
                <div className="flex items-center gap-2">
                  <div className="status-dot-live" />
                  <p className="text-xs text-muted-foreground">Live Network</p>
                </div>
              </div>
            </footer>
          </div>
        </WouterRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

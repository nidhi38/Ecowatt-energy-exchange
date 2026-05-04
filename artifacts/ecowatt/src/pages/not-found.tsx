import { Link } from 'wouter';
import { Zap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl card-blue flex items-center justify-center mx-auto shadow">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">Page not found</p>
        <Link href="/">
          <button className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
            Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}

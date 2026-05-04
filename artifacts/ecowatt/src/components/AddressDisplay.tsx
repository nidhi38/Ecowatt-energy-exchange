import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface AddressDisplayProps {
  address: string;
  short?: boolean;
  showLink?: boolean;
  className?: string;
  label?: string;
}

export function AddressDisplay({ address, short = true, showLink = true, className = '', label }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const display = short
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;

  const etherscanUrl = `https://etherscan.io/address/${address}`;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-xs text-muted-foreground">{label}:</span>}
      <span className="address-chip">{display}</span>
      <button onClick={copy} className="p-0.5 rounded hover:bg-secondary transition-colors" title="Copy address">
        {copied
          ? <Check className="w-3 h-3 text-green-500" />
          : <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        }
      </button>
      {showLink && (
        <a href={etherscanUrl} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-0.5 rounded hover:bg-secondary transition-colors" title="View on Etherscan">
          <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
        </a>
      )}
    </div>
  );
}

interface TxHashProps {
  hash: string;
  className?: string;
}

export function TxHashDisplay({ hash, className = '' }: TxHashProps) {
  const [copied, setCopied] = useState(false);
  const url = `https://etherscan.io/tx/${hash}`;

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <span className="tx-hash">{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="p-0.5 hover:bg-secondary rounded">
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className="p-0.5 hover:bg-secondary rounded">
        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
      </a>
    </div>
  );
}

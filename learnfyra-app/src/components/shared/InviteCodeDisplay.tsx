/**
 * @file src/components/shared/InviteCodeDisplay.tsx
 * @description Displays an invite code with a copy-to-clipboard button
 * and an optional expiry time. Used for class join codes and parent link codes.
 */

import * as React from 'react';
import { Copy, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteCodeDisplayProps {
  /** The invite code to display (typically 6 uppercase alphanumeric chars). */
  code: string;
  /** Optional ISO-8601 expiry timestamp. */
  expiresAt?: string | null;
  /** Optional descriptive label shown above the code. */
  label?: string;
  className?: string;
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Expires in ${diffMins} min`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `Expires in ${diffHrs} hr`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}

const InviteCodeDisplay: React.FC<InviteCodeDisplayProps> = ({
  code,
  expiresAt,
  label,
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const expiryLabel = expiresAt ? formatExpiry(expiresAt) : null;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
      )}

      <div className="flex items-center gap-3 bg-primary-light rounded-xl border border-primary/20 px-4 py-3">
        {/* Code display */}
        <span
          className="flex-1 font-mono text-2xl font-extrabold text-primary tracking-[0.2em] select-all"
          aria-label={`Invite code: ${code.split('').join(' ')}`}
        >
          {code}
        </span>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy invite code'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
            copied
              ? 'bg-secondary text-white'
              : 'bg-primary text-white hover:bg-primary-hover',
          )}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Expiry */}
      {expiryLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>{expiryLabel}</span>
        </div>
      )}
    </div>
  );
};

export { InviteCodeDisplay };

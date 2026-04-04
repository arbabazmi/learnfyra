/**
 * @file src/pages/ConsentPendingPage.tsx
 * @description Child-facing page shown after under-13 registration.
 *
 * Route: /auth/consent-pending
 *
 * Shown after the child registers but parental consent has not yet been given.
 * Displays:
 *   - Masked parent email (from URL query param ?parentEmail=p****@email.com)
 *   - 48-hour expiry countdown
 *   - Resend email button → POST /api/auth/request-consent
 *   - No access to dashboard content
 */

import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Mail, RefreshCw, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0h 0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ConsentPendingPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Backend may pass masked parent email in query or session — read from query param for now
  const maskedParentEmail = searchParams.get('parentEmail') ?? null;

  // Countdown: 48 hours from page load (approximation — exact expiry is on the server)
  const [secondsLeft, setSecondsLeft] = React.useState(48 * 3600);
  React.useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const [isResending, setIsResending] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  const [resendError, setResendError] = React.useState('');

  const handleResend = async () => {
    setIsResending(true);
    setResendError('');
    setResendSuccess(false);

    const token = getAuthToken();

    try {
      const res = await fetch(`${apiUrl}/api/auth/request-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        setResendSuccess(true);
        // Reset success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setResendError((data as { error?: string }).error || 'Could not resend email. Please try again.');
      }
    } catch {
      setResendError('Network error. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const isExpired = secondsLeft <= 0;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 space-y-6">

          {/* Branding */}
          <div className="text-center">
            <Logo size="sm" className="mx-auto mb-4" />
          </div>

          {/* Icon + headline */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto">
              <Mail className="size-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-extrabold text-foreground">Almost there!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent an email to your parent
              {maskedParentEmail && (
                <> at <span className="font-bold text-foreground">{maskedParentEmail}</span></>
              )}
              .
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask them to check their email and click{' '}
              <span className="font-semibold text-foreground">"I Consent"</span>{' '}
              so you can start learning!
            </p>
          </div>

          {/* Countdown */}
          <div
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface border border-border"
            role="status"
            aria-live="polite"
          >
            <Clock className={`size-4 shrink-0 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
            {isExpired ? (
              <p className="text-sm font-semibold text-destructive">
                This link has expired. Please resend the email.
              </p>
            ) : (
              <p className="text-sm font-semibold text-foreground">
                Link expires in{' '}
                <span className="text-primary">{formatCountdown(secondsLeft)}</span>
              </p>
            )}
          </div>

          {/* Resend feedback */}
          {resendSuccess && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success-light border border-secondary/20">
              <CheckCircle className="size-4 text-secondary shrink-0" />
              <p className="text-sm font-semibold text-secondary">Email resent successfully!</p>
            </div>
          )}
          {resendError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-semibold">{resendError}</p>
            </div>
          )}

          {/* Resend button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Resending...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Resend Email
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
            Can't find the email? Ask your parent to check their spam folder.
            The email comes from <span className="font-semibold">noreply@learnfyra.com</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConsentPendingPage;

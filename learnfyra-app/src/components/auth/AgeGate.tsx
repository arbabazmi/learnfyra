/**
 * @file src/components/auth/AgeGate.tsx
 * @description COPPA age gate — first step of registration.
 *
 * Under-13: collects parent email + optional nickname, POSTs to
 *   /api/auth/request-consent, then navigates to /auth/consent-pending.
 * 13+: calls onAgeConfirmed('13plus') so AuthModal can show standard form.
 *
 * Choice is stored in sessionStorage key `learnfyra_age_gate`.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import { Shield, Mail, User, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiUrl } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────

export type AgeGroup = 'under13' | '13plus';

export interface AgeGateProps {
  onAgeConfirmed: (group: AgeGroup) => void;
  onBack?: () => void;
}

// ── Shared input style (matches AuthModal / AgeVerificationPage) ──────────

const inputCls =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
const inputErrorCls = 'border-destructive focus:border-destructive focus:ring-destructive/20';

// ── Sub-views ──────────────────────────────────────────────────────────────

type View = 'choice' | 'under13-form';

// ── Component ──────────────────────────────────────────────────────────────

export const AgeGate: React.FC<AgeGateProps> = ({ onAgeConfirmed, onBack }) => {
  const navigate = useNavigate();

  const [view, setView] = React.useState<View>('choice');
  const [parentEmail, setParentEmail] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [emailTouched, setEmailTouched] = React.useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail);
  const emailError = emailTouched && !emailValid ? 'Enter a valid parent email address' : '';

  const handleSelectUnder13 = () => {
    sessionStorage.setItem('learnfyra_age_gate', 'under13');
    setView('under13-form');
  };

  const handleSelect13Plus = () => {
    sessionStorage.setItem('learnfyra_age_gate', '13plus');
    onAgeConfirmed('13plus');
  };

  const handleConsentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid) return;

    setIsLoading(true);
    setApiError('');

    try {
      const res = await fetch(`${apiUrl}/api/auth/request-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail,
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        }),
      });

      if (res.status === 429) {
        setApiError('Too many requests. Try again tomorrow.');
        return;
      }

      if (res.status === 202 || res.ok) {
        navigate('/auth/consent-pending', { replace: true });
        return;
      }

      const data = await res.json().catch(() => ({}));
      setApiError((data as { error?: string }).error || 'Something went wrong. Please try again.');
    } catch {
      setApiError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Under-13 consent request form ─────────────────────────────────────

  if (view === 'under13-form') {
    return (
      <div className="p-6 pt-8 space-y-5">
        <button
          onClick={() => { setApiError(''); setView('choice'); }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
            <Shield className="size-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Parent approval needed</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
              Because you're under 13, we need a parent or guardian to approve your account.
              We'll send them an email — it only takes a minute.
            </p>
          </div>
        </div>

        {apiError && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-semibold">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleConsentRequest} className="space-y-4">
          {/* Parent email — required */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Parent or guardian email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="parent@example.com"
                autoFocus
                autoComplete="email"
                className={`${inputCls} pl-10 ${emailError ? inputErrorCls : ''}`}
              />
            </div>
            {emailError && (
              <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                <AlertCircle className="size-3 shrink-0" />
                {emailError}
              </p>
            )}
          </div>

          {/* Nickname — optional */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Nickname{' '}
              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What should we call you?"
                autoComplete="nickname"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            type="submit"
            className="w-full gap-2"
            disabled={!emailValid || isLoading}
            loading={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Parent Approval Email'
            )}
          </Button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground">
          Your parent will receive an email to approve your account. We never share their email.
        </p>
      </div>
    );
  }

  // ── Choice screen ──────────────────────────────────────────────────────

  return (
    <div className="p-6 pt-8 space-y-6">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      )}

      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
          <Shield className="size-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-foreground">How old are you?</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            We ask this to keep younger users safe online.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleSelectUnder13}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-border bg-white text-left transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center shrink-0">
            <Shield className="size-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-foreground">I'm under 13</p>
            <p className="text-xs text-muted-foreground mt-0.5">We'll get parent permission first</p>
          </div>
        </button>

        <button
          onClick={handleSelect13Plus}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 border-border bg-white text-left transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
            <User className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-foreground">I'm 13 or older</p>
            <p className="text-xs text-muted-foreground mt-0.5">Continue to create your account</p>
          </div>
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        We use this only to protect younger users. Your choice is private.
      </p>
    </div>
  );
};

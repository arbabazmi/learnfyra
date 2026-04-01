/**
 * @file src/components/ConversionPrompt.tsx
 * @description Inline card prompting a guest user to create an account.
 * Shown after worksheet completion or when the guest clicks "Save Progress".
 * This is NOT a modal — it renders as a card within the page layout.
 */

import * as React from 'react';
import { Trophy, CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConversionPromptProps {
  context?: 'worksheet-complete' | 'save-progress' | 'view-history';
  score?: number;
  totalPoints?: number;
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
  onDismiss: () => void;
}

// ── Google icon (4-colour, same paths as AuthModal) ────────────────────────

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// ── Benefits list ──────────────────────────────────────────────────────────

const BENEFITS = [
  'Save your scores and progress',
  'Pick up where you left off',
  'Track your weak areas over time',
] as const;

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Inline guest-to-account conversion card.
 *
 * @param props.context         Controls the heading and icon shown at the top.
 * @param props.score           Points earned (worksheet-complete context only).
 * @param props.totalPoints     Max points possible (worksheet-complete only).
 * @param props.onGoogleSignIn  Called when the user clicks "Continue with Google".
 * @param props.onEmailSignIn   Called when the user clicks "Continue with Email".
 * @param props.onDismiss       Called when the user clicks "Maybe later".
 */
const ConversionPrompt: React.FC<ConversionPromptProps> = ({
  context = 'save-progress',
  score,
  totalPoints,
  onGoogleSignIn,
  onEmailSignIn,
  onDismiss,
}) => {
  // ── Heading copy per context ─────────────────────────────────────────────

  const heading = React.useMemo(() => {
    if (context === 'worksheet-complete') {
      const hasScore =
        typeof score === 'number' && typeof totalPoints === 'number';
      return hasScore
        ? `Great job! You scored ${score}/${totalPoints}`
        : 'Great job finishing the worksheet!';
    }
    if (context === 'view-history') return 'Sign in to see your history';
    return 'Save your progress';
  }, [context, score, totalPoints]);

  const showTrophy =
    context === 'worksheet-complete' ||
    context === 'view-history' ||
    context === 'save-progress';

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-border shadow-card',
        'p-6 max-w-md mx-auto w-full',
      )}
      role="region"
      aria-label="Create a free account"
    >
      {/* ── Heading ── */}
      <div className="flex items-start gap-3 mb-5">
        {showTrophy && context === 'worksheet-complete' && (
          <span className="mt-0.5 shrink-0 flex items-center justify-center size-10 rounded-full bg-amber-50">
            <Trophy className="size-5 text-amber-500" aria-hidden="true" />
          </span>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {heading}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create a free account to unlock everything.
          </p>
        </div>
      </div>

      {/* ── Benefits list ── */}
      <ul className="space-y-2.5 mb-6" aria-label="Account benefits">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5">
            <CheckCircle
              className="size-4 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
            <span className="text-sm text-foreground">{benefit}</span>
          </li>
        ))}
      </ul>

      {/* ── Auth buttons ── */}
      <div className="space-y-3">
        {/* Google */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl border-2 border-border bg-white text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary-light/30 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GoogleIcon className="size-5 shrink-0" />
          <span>Continue with Google</span>
        </button>

        {/* Email */}
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onEmailSignIn}
        >
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          Continue with Email
        </Button>
      </div>

      {/* ── Dismiss ── */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

export { ConversionPrompt };

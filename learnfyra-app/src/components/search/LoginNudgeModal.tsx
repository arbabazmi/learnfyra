/**
 * @file src/components/search/LoginNudgeModal.tsx
 * @description Soft, dismissible login nudge — centered modal on desktop,
 * bottom sheet on mobile. "Continue as Guest" is equally prominent.
 * Shows only once per session. Skipped entirely if user is signed in.
 */

import * as React from 'react';
import { X, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const NUDGE_KEY = 'learnfyra_nudge_shown';

interface LoginNudgeModalProps {
  isOpen: boolean;
  onContinueAsGuest: () => void;
  onGoogleSignIn: () => void;
  onEmailSignIn: () => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/** Mark the nudge as shown for this session. */
export function markNudgeShown(): void {
  sessionStorage.setItem(NUDGE_KEY, '1');
}

/** Check if the nudge has already been shown this session. */
export function wasNudgeShown(): boolean {
  return sessionStorage.getItem(NUDGE_KEY) === '1';
}

const LoginNudgeModal: React.FC<LoginNudgeModalProps> = ({
  isOpen, onContinueAsGuest, onGoogleSignIn, onEmailSignIn,
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      markNudgeShown();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop — clicking = continue as guest */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={onContinueAsGuest}
        aria-hidden="true"
      />

      {/* Card — bottom sheet on mobile, centered on desktop */}
      <div
        className="relative z-10 bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-border shadow-xl p-6 sm:p-8 animate-[slideUp_250ms_ease-out] sm:animate-[scaleIn_250ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in prompt"
      >
        {/* Handle bar on mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mb-4" />

        {/* Close */}
        <button
          onClick={onContinueAsGuest}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center mb-4">
          <ClipboardList className="size-6 text-primary" />
        </div>

        <h2 className="text-xl font-extrabold text-foreground">Ready to start your worksheet?</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Sign in to save your score and track your progress over time.
        </p>

        {/* Auth options */}
        <div className="space-y-3">
          <button
            onClick={onGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 border-border bg-white text-sm font-bold text-foreground hover:border-primary/40 hover:bg-primary-light/30 hover:shadow-sm active:scale-[0.98] transition-all"
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </button>

          <Button variant="outline" size="lg" className="w-full" onClick={onEmailSignIn}>
            Continue with Email
          </Button>
        </div>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-muted-foreground">or</span></div>
        </div>

        {/* Continue as guest — EQUALLY PROMINENT */}
        <Button variant="primary" size="lg" className="w-full gap-2" onClick={onContinueAsGuest}>
          Continue as Guest
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          You can always sign in later
        </p>
      </div>
    </div>
  );
};

export { LoginNudgeModal };

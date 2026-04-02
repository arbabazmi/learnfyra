/**
 * @file src/components/auth/LimitReachedModal.tsx
 * @description Modal shown when a guest user reaches the 10-worksheet limit.
 * Prompts them to create a free account to continue.
 */

import * as React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GUEST_STORAGE_KEYS } from '@/lib/auth';
import { googleOAuth } from '@/lib/env';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LimitReachedModal: React.FC<LimitReachedModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    // Save current URL for post-login redirect
    sessionStorage.setItem(
      GUEST_STORAGE_KEYS.preLoginUrl,
      window.location.pathname + window.location.search,
    );

    try {
      const res = await fetch(googleOAuth.initiateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      const data = await res.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
    } catch { /* fall through to landing */ }

    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        aria-hidden="true"
      />
      <div
        className="relative z-10 bg-white w-full max-w-sm rounded-2xl border border-border shadow-xl p-6 sm:p-8 animate-[scaleIn_250ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label="Worksheet limit reached"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
          <AlertTriangle className="size-6 text-amber-600" />
        </div>

        <h2 className="text-xl font-extrabold text-foreground">
          You've used all 10 free worksheets
        </h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Create a free account to keep generating worksheets and save your progress.
        </p>

        <Button variant="primary" size="lg" className="w-full" onClick={handleLogin}>
          Create Account
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          It's free — sign up with Google or email
        </p>
      </div>
    </div>
  );
};

export { LimitReachedModal };

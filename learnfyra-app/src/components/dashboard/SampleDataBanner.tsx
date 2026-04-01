/**
 * @file src/components/dashboard/SampleDataBanner.tsx
 * @description Prominent banner for guest mode — amber background with
 * watermark text, sign-in message, and a visible login button.
 */

import * as React from 'react';
import { Sparkles, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface SampleDataBannerProps {
  isGuest: boolean;
  onSignIn: () => void;
}

const SampleDataBanner: React.FC<SampleDataBannerProps> = ({ isGuest, onSignIn }) => {
  if (!isGuest) return null;

  return (
    <div
      className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-accent-light border border-accent/30"
      role="banner"
      aria-label="Guest mode notice"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <Sparkles className="size-4.5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-accent-foreground">
            You're viewing sample data
          </p>
          <p className="text-xs text-accent-foreground/70 mt-0.5">
            Sign in to track your real progress and save your scores.
          </p>
        </div>
      </div>

      <Button
        variant="accent"
        size="sm"
        className="gap-2 shrink-0"
        onClick={onSignIn}
      >
        <LogIn className="size-3.5" />
        Sign In
      </Button>
    </div>
  );
};

SampleDataBanner.displayName = 'SampleDataBanner';

export { SampleDataBanner };

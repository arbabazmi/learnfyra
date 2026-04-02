/**
 * @file src/components/auth/GuestBanner.tsx
 * @description Persistent banner for guest users showing worksheet usage
 * and prompting login. Not dismissible when usage >= 8.
 */

import * as React from 'react';
import { X, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { GUEST_STORAGE_KEYS } from '@/lib/auth';
import { googleOAuth } from '@/lib/env';

const GuestBanner: React.FC = () => {
  const auth = useAuth();
  const [visible, setVisible] = React.useState(false);

  const used = auth.worksheetCount;
  const limit = auth.worksheetLimit;
  const atThreshold = used >= 8;

  React.useEffect(() => {
    if (auth.tokenState !== 'guest') {
      setVisible(false);
      return;
    }

    const dismissed = sessionStorage.getItem(GUEST_STORAGE_KEYS.bannerDismissed);
    // Show if not dismissed, OR if at threshold (can't dismiss anymore)
    setVisible(!dismissed || atThreshold);
  }, [auth.tokenState, atThreshold]);

  const handleDismiss = () => {
    if (!atThreshold) {
      sessionStorage.setItem(GUEST_STORAGE_KEYS.bannerDismissed, '1');
      setVisible(false);
    }
  };

  const handleLogin = async () => {
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
    } catch { /* fall through */ }

    window.location.href = '/';
  };

  if (!visible) return null;

  const message = used === 0
    ? 'Login to save your progress and unlock unlimited worksheets'
    : atThreshold
      ? `You've used ${used}/${limit} free worksheets. Login to keep going`
      : `You've used ${used}/${limit} free worksheets. Login to unlock more`;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] bg-primary text-white">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">
          {message}
        </p>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-bold transition-colors"
          >
            <LogIn className="size-3.5" />
            Login
          </button>

          {!atThreshold && (
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { GuestBanner };

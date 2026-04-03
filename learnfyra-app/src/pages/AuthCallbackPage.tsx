/**
 * @file src/pages/AuthCallbackPage.tsx
 * @description Handles the OAuth redirect from the backend.
 * Reads token + user from URL params, stores in localStorage,
 * clears guest state, and redirects to pre-login URL or dashboard.
 */

import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { GUEST_STORAGE_KEYS } from '@/lib/auth';
import { Logo } from '@/components/ui/Logo';

const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const processed = React.useRef(false);

  React.useEffect(() => {
    // Prevent double-processing in StrictMode
    if (processed.current) return;

    const token = searchParams.get('token');
    const userRaw = searchParams.get('user');
    const errorMsg = searchParams.get('error');

    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      setTimeout(() => navigate('/', { replace: true }), 3000);
      return;
    }

    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(userRaw || '{}');

      // signIn clears guest cookie + guest sessionStorage keys
      auth.signIn(token, user);
      processed.current = true;

      // Redirect to pre-login URL if set, otherwise dashboard
      const returnUrl = sessionStorage.getItem(GUEST_STORAGE_KEYS.preLoginUrl);
      sessionStorage.removeItem(GUEST_STORAGE_KEYS.preLoginUrl);
      navigate(returnUrl ?? '/dashboard', { replace: true });
    } catch {
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, auth]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-[90%] text-center space-y-4">
        <Logo size="sm" className="mx-auto" />
        {error ? (
          <>
            <h1 className="text-lg font-extrabold text-foreground">Sign-in failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">Redirecting back...</p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-surface-2 border-t-primary rounded-full animate-spin mx-auto" />
            <h1 className="text-lg font-extrabold text-foreground">Signing you in...</h1>
            <p className="text-sm text-muted-foreground">Please wait while we set up your account.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;

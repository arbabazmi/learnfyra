/**
 * @file src/contexts/AuthContext.tsx
 * @description Auth context — provides user state to the whole app.
 *
 * This context is for PERSONALIZATION, not gatekeeping.
 * Guest users (isGuest=true) can access all features.
 * Signed-in users get persistent progress, history, and personalization.
 */

import * as React from 'react';
import {
  getToken,
  getUser,
  setAuth,
  clearAuth,
  getSelectedRole,
  type AuthUser,
  type UserRole,
} from '@/lib/auth';
import { hasGuestData, clearGuestData, exportGuestData } from '@/lib/guestSession';

interface AuthState {
  /** Signed-in user object, or null for guests. */
  user: AuthUser | null;
  /** True if the user has a valid auth token. */
  isAuthenticated: boolean;
  /** True if the user is NOT authenticated (browsing as guest). */
  isGuest: boolean;
  /** The selected role from onboarding (persists for guests too). */
  selectedRole: UserRole | null;
  /** Whether the guest has data worth saving (completed worksheets). */
  guestHasData: boolean;
  /** Sign in — stores token and user, clears guest data if migrated. */
  signIn: (token: string, user: AuthUser) => void;
  /** Sign out — clears auth, returns to guest state. */
  signOut: () => void;
  /** Force a re-read of auth state (e.g. after OAuth callback). */
  refresh: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<AuthUser | null>(getUser);
  const [guestHasData, setGuestHasData] = React.useState(hasGuestData);

  const isAuthenticated = !!user && !!getToken();
  const isGuest = !isAuthenticated;
  const selectedRole = getSelectedRole();

  const refresh = React.useCallback(() => {
    setUser(getUser());
    setGuestHasData(hasGuestData());
  }, []);

  const signIn = React.useCallback((token: string, newUser: AuthUser) => {
    setAuth(token, newUser);
    setUser(newUser);

    // TODO: migrate guest data to backend when API supports it
    if (hasGuestData()) {
      const _guestData = exportGuestData();
      // Future: POST /api/migrate-guest-data with guestData
      clearGuestData();
      setGuestHasData(false);
    }
  }, []);

  const signOut = React.useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({ user, isAuthenticated, isGuest, selectedRole, guestHasData, signIn, signOut, refresh }),
    [user, isAuthenticated, isGuest, selectedRole, guestHasData, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { AuthProvider, useAuth };

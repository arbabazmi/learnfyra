/**
 * @file src/contexts/AuthContext.tsx
 * @description Auth context — provides user state to the whole app.
 *
 * Supports three token states:
 *   'none'          — no token (first-time visitor)
 *   'guest'         — guest JWT from cookie (limited access, 10 worksheets)
 *   'authenticated' — Cognito JWT from localStorage (full access)
 *
 * Guest users can access features with limits.
 * Authenticated users get persistent progress, history, and personalization.
 */

import * as React from 'react';
import {
  getToken,
  getUser,
  setAuth,
  clearAuth,
  getSelectedRole,
  getCookie,
  parseJwt,
  isTokenValid,
  clearCookie,
  getCookieDomain,
  clearGuestSessionKeys,
  GUEST_STORAGE_KEYS,
  type AuthUser,
  type UserRole,
  type TokenState,
} from '@/lib/auth';
import { hasGuestData, clearGuestData, exportGuestData } from '@/lib/guestSession';
import { apiUrl } from '@/lib/env';

interface AuthState {
  /** Three-way token state — replaces boolean isAuthenticated. */
  tokenState: TokenState;
  /** Signed-in user object, or null for guests. */
  user: AuthUser | null;
  /** Combined role: guest-student, guest-teacher, student, teacher, etc. */
  role: string | null;
  /** Cognito user ID (authenticated only). */
  userId: string | null;
  /** Guest ID — "guest_<uuid>" (guest only). */
  guestId: string | null;
  /** Display name for authenticated users. */
  displayName: string | null;
  /** Email for authenticated users. */
  email: string | null;
  /** Guest worksheets used so far. */
  worksheetCount: number;
  /** Guest worksheet limit (default 10). */
  worksheetLimit: number;
  /** True when tokenState !== 'authenticated' — convenience for existing code. */
  isGuest: boolean;
  /** The selected role from onboarding (persists for guests too). */
  selectedRole: UserRole | null;
  /** Whether the guest has data worth saving (completed worksheets). */
  guestHasData: boolean;
  /** Whether the role-picker modal should be visible. */
  showRoleModal: boolean;
  /** Open the role-picker modal. */
  openRoleModal: () => void;
  /** Close the role-picker modal. */
  closeRoleModal: () => void;
  /** Sign in — stores token and user, clears guest data if migrated. */
  signIn: (token: string, user: AuthUser) => void;
  /** Sign out — clears auth, returns to guest state. */
  signOut: () => void;
  /** Force a re-read of auth state (e.g. after OAuth callback or guest token set). */
  refresh: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

function deriveState(): { tokenState: TokenState; guestClaims: Record<string, unknown> | null } {
  // Priority: Cognito JWT (localStorage) > guest cookie > nothing
  const cognitoToken = getToken();
  if (cognitoToken && isTokenValid(cognitoToken)) {
    return { tokenState: 'authenticated', guestClaims: null };
  }

  const guestToken = getCookie('guestToken');
  if (guestToken && isTokenValid(guestToken)) {
    const claims = parseJwt(guestToken);
    return { tokenState: 'guest', guestClaims: claims };
  }

  return { tokenState: 'none', guestClaims: null };
}

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<AuthUser | null>(getUser);
  const [guestHasData, setGuestHasData] = React.useState(hasGuestData);
  const [showRoleModal, setShowRoleModal] = React.useState(false);
  const [tokenState, setTokenState] = React.useState<TokenState>('none');
  const [guestClaims, setGuestClaims] = React.useState<Record<string, unknown> | null>(null);

  // Derive initial state on mount
  React.useEffect(() => {
    const state = deriveState();
    setTokenState(state.tokenState);
    setGuestClaims(state.guestClaims);

    // Auto-refresh expired guest token
    const guestToken = getCookie('guestToken');
    if (guestToken && !isTokenValid(guestToken)) {
      const expiredClaims = parseJwt(guestToken);
      const role = (expiredClaims?.role as string)?.replace('guest-', '');
      if (role) {
        fetch(`${apiUrl}/api/auth/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }).then(() => {
          // Backend sets new cookie via Set-Cookie header
          const refreshed = deriveState();
          setTokenState(refreshed.tokenState);
          setGuestClaims(refreshed.guestClaims);
        }).catch(() => {
          // Silent fail — user stays in 'none' state
        });
      }
    }
  }, []);

  const isGuest = tokenState !== 'authenticated';
  const selectedRole = getSelectedRole();

  // Derived guest fields
  const guestId = tokenState === 'guest' ? (guestClaims?.guestId as string ?? null) : null;
  const role = tokenState === 'authenticated'
    ? (user?.role ?? null)
    : tokenState === 'guest'
      ? (guestClaims?.role as string ?? null)
      : null;
  const userId = tokenState === 'authenticated' ? (user?.userId ?? null) : null;
  const displayName = tokenState === 'authenticated' ? (user?.displayName ?? null) : null;
  const email = tokenState === 'authenticated' ? (user?.email ?? null) : null;
  const worksheetCount = parseInt(sessionStorage.getItem(GUEST_STORAGE_KEYS.used) ?? '0', 10);
  const worksheetLimit = parseInt(sessionStorage.getItem(GUEST_STORAGE_KEYS.limit) ?? '10', 10);

  const openRoleModal = React.useCallback(() => setShowRoleModal(true), []);
  const closeRoleModal = React.useCallback(() => setShowRoleModal(false), []);

  const refresh = React.useCallback(() => {
    setUser(getUser());
    setGuestHasData(hasGuestData());
    const state = deriveState();
    setTokenState(state.tokenState);
    setGuestClaims(state.guestClaims);
  }, []);

  const signIn = React.useCallback((token: string, newUser: AuthUser) => {
    setAuth(token, newUser);
    setUser(newUser);
    setTokenState('authenticated');
    setGuestClaims(null);

    // Clear guest cookie and session keys
    clearCookie('guestToken', getCookieDomain());
    clearGuestSessionKeys();

    // Migrate guest data if present
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
    setTokenState('none');
    setGuestClaims(null);
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({
      tokenState,
      user,
      role,
      userId,
      guestId,
      displayName,
      email,
      worksheetCount,
      worksheetLimit,
      isGuest,
      selectedRole,
      guestHasData,
      showRoleModal,
      openRoleModal,
      closeRoleModal,
      signIn,
      signOut,
      refresh,
    }),
    [
      tokenState, user, role, userId, guestId, displayName, email,
      worksheetCount, worksheetLimit, isGuest, selectedRole, guestHasData,
      showRoleModal, openRoleModal, closeRoleModal,
      signIn, signOut, refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export { AuthProvider, useAuth };

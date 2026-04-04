/**
 * @file src/contexts/AuthContext.tsx
 * @description React context providing authentication state and RBAC helpers
 * for the admin console. Persists the JWT token and user record in localStorage.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginRequest, AdminRole } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  /** True when the user holds the 'admin' or 'super_admin' role. */
  isPlatformAdmin: boolean;
  /** True when the user holds the 'school_admin' role. */
  isSchoolAdmin: boolean;
  /**
   * Returns true when the authenticated user's role matches at least one of
   * the provided AdminRole values.
   */
  hasRole: (...roles: AdminRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Provides authentication state to the component tree.
 * Place this at the top of the React tree, wrapping all routes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount — runs once.
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        // Corrupt stored data — clear it and force re-login.
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
    setIsLoading(false);
  }, []);

  /**
   * Authenticates the user against the API.
   * Rejects with an ApiError if the credential is invalid or if the
   * returned role is not one of the three admin roles.
   *
   * @param data - Email and password credentials
   */
  const login = useCallback(async (data: LoginRequest) => {
    const res = await api.login(data);
    const adminRoles: AdminRole[] = ['super_admin', 'admin', 'school_admin'];
    if (!adminRoles.includes(res.user.role as AdminRole)) {
      throw { error: 'Admin access required', code: 'INSUFFICIENT_ROLE' };
    }
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('admin_token', res.token);
    localStorage.setItem('admin_user', JSON.stringify(res.user));
  }, []);

  /**
   * Clears the in-memory and persisted auth state.
   * Does NOT call a server-side logout endpoint — the token simply
   * stops being sent, and the server will eventually expire it.
   */
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }, []);

  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isSchoolAdmin = user?.role === 'school_admin';

  const hasRole = useCallback(
    (...roles: AdminRole[]) => {
      if (!user) return false;
      return roles.includes(user.role as AdminRole);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, isPlatformAdmin, isSchoolAdmin, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Consumes the AuthContext.
 * Must be called from a component that is a descendant of AuthProvider.
 *
 * @throws {Error} if called outside of AuthProvider
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * @file src/lib/auth.ts
 * @description Lightweight auth helpers — localStorage token/user/role management.
 */

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  displayName: string;
}

export type UserRole = 'student' | 'teacher' | 'parent';

const KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  role: 'selected_role',
} as const;

/** Store auth credentials from OAuth callback. */
export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(KEYS.token, token);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

/** Get the stored auth token, or null. */
export function getToken(): string | null {
  return localStorage.getItem(KEYS.token);
}

/** Get the stored user, or null. */
export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Check if user is authenticated. */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Clear all auth data. */
export function clearAuth(): void {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.user);
}

/** Store the role selected during onboarding. */
export function setSelectedRole(role: UserRole): void {
  localStorage.setItem(KEYS.role, role);
}

/** Get the selected role. */
export function getSelectedRole(): UserRole | null {
  return localStorage.getItem(KEYS.role) as UserRole | null;
}

/**
 * @file src/lib/auth.ts
 * @description Auth helpers — localStorage token/user/role + cookie-based guest token.
 */

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  displayName: string;
}

export type UserRole = 'student' | 'teacher' | 'parent';
export type TokenState = 'none' | 'guest' | 'authenticated';

const KEYS = {
  token: 'auth_token',
  user: 'auth_user',
  role: 'selected_role',
} as const;

// ── Cookie utilities ──────────────────────────────────────────────────────

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function clearCookie(name: string, domain?: string): void {
  const domainPart = domain ? `; Domain=${domain}` : '';
  document.cookie = `${name}=; Max-Age=0; Path=/${domainPart}; SameSite=Strict; Secure`;
}

export function getCookieDomain(): string {
  const host = window.location.hostname;
  if (host === 'localhost') return 'localhost';
  const parts = host.split('.');
  return '.' + parts.slice(1).join('.');
}

// ── JWT utilities (decode only — frontend never verifies signatures) ──────

export function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenValid(token: string): boolean {
  const decoded = parseJwt(token);
  if (!decoded || typeof decoded.exp !== 'number') return false;
  return decoded.exp > Math.floor(Date.now() / 1000);
}

// ── Cognito token (localStorage) ──────────────────────────────────────────

/** Store auth credentials from OAuth callback. */
export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(KEYS.token, token);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
}

/** Get the stored Cognito auth token, or null. */
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

/** Clear all auth data (Cognito). */
export function clearAuth(): void {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.user);
}

// ── Unified token retrieval (Cognito > guest cookie > null) ───────────────

/** Get the best available auth token — Cognito wins over guest. */
export function getAuthToken(): string | null {
  const cognitoToken = getToken();
  if (cognitoToken && isTokenValid(cognitoToken)) return cognitoToken;

  const guestToken = getCookie('guestToken');
  if (guestToken && isTokenValid(guestToken)) return guestToken;

  return null;
}

// ── Guest session storage keys ────────────────────────────────────────────

export const GUEST_STORAGE_KEYS = {
  used: 'lf_guest_used',
  limit: 'lf_guest_limit',
  modalShown: 'lf_modal_shown',
  bannerDismissed: 'lf_banner_dismissed',
  preLoginUrl: 'lf_pre_login_url',
} as const;

/** Clear all guest-related sessionStorage keys (called after login). */
export function clearGuestSessionKeys(): void {
  Object.values(GUEST_STORAGE_KEYS).forEach((key) => sessionStorage.removeItem(key));
}

// ── Role management ───────────────────────────────────────────────────────

/** Store the role selected during onboarding. */
export function setSelectedRole(role: UserRole): void {
  localStorage.setItem(KEYS.role, role);
}

/** Get the selected role. */
export function getSelectedRole(): UserRole | null {
  return localStorage.getItem(KEYS.role) as UserRole | null;
}

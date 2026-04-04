/**
 * @file src/lib/emailAuth.ts
 * @description Email/password auth API client.
 *
 * Backend endpoints:
 *   POST /api/auth/login    → { email, password }          → { userId, email, role, displayName, token }
 *   POST /api/auth/register → { email, password, role, displayName } → { userId, email, role, displayName, token }
 */

import { apiUrl } from '@/lib/env';
import { setAuth, type AuthUser } from '@/lib/auth';

export interface AuthResponse {
  userId: string;
  email: string;
  role: string;
  displayName: string;
  token: string;
}

export interface AuthError {
  error: string;
  status: number;
}

// ── Password validation ────────────────────────────────────────────────────

export interface PasswordStrength {
  score: number;       // 0–4
  label: string;       // Weak / Fair / Good / Strong
  checks: {
    length: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function validatePassword(password: string): PasswordStrength {
  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return { score, label: labels[score], checks };
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password).score === 4;
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ── API calls ──────────────────────────────────────────────────────────────

async function authFetch(path: string, body: Record<string, string>): Promise<AuthResponse> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err: AuthError = { error: data.error || 'Something went wrong.', status: res.status };
    throw err;
  }

  return data as AuthResponse;
}

/** Sign in with email + password. Stores token on success. */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const data = await authFetch('/api/auth/login', { email, password });
  setAuth(data.token, {
    userId: data.userId,
    email: data.email,
    role: data.role,
    displayName: data.displayName,
  });
  return data;
}

/** Request a password reset email. Never throws — always "succeeds" to avoid email enumeration. */
export async function forgotPassword(email: string): Promise<void> {
  await fetch(`${apiUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Reset password using a token from the reset email (local env). */
export async function resetPasswordWithToken(token: string, email: string, newPassword: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email, newPassword }),
  });

  if (!res.ok) {
    const data = await res.json();
    const err: AuthError = { error: data.error || 'Reset failed.', status: res.status };
    throw err;
  }
}

/** Reset password using a 6-digit Cognito verification code (dev/qa/prod). */
export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });

  if (!res.ok) {
    const data = await res.json();
    const err: AuthError = { error: data.error || 'Reset failed.', status: res.status };
    throw err;
  }
}

/** Resend the forgot-password code (dev/qa/prod — triggers Cognito again). */
export async function resendResetCode(email: string): Promise<void> {
  await forgotPassword(email);
}

/** @deprecated Use resetPasswordWithToken instead */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  return resetPasswordWithToken(token, '', newPassword);
}

/** Extended registration response that may include COPPA consent flag. */
export interface RegisterResponse extends AuthResponse {
  requiresConsent?: boolean;
  maskedParentEmail?: string;
}

/** Register a new account. Stores token on success.
 *  If the server returns requiresConsent=true (under-13 COPPA), the token is NOT
 *  stored — the caller must redirect to /auth/consent-pending.
 */
export async function signUp(
  displayName: string,
  email: string,
  password: string,
  role: string,
  dateOfBirth?: string,
): Promise<RegisterResponse> {
  const body: Record<string, string> = { email, password, role, displayName };
  if (dateOfBirth) body.dateOfBirth = dateOfBirth;

  const res = await fetch(`${apiUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const err: AuthError = { error: data.error || 'Something went wrong.', status: res.status };
    throw err;
  }

  const result = data as RegisterResponse;

  // Under-13: consent required — do NOT store the token yet
  if (result.requiresConsent) {
    return result;
  }

  setAuth(result.token, {
    userId: result.userId,
    email: result.email,
    role: result.role,
    displayName: result.displayName,
  });
  return result;
}

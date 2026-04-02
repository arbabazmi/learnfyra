import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCookie,
  clearCookie,
  parseJwt,
  isTokenValid,
  getToken,
  setAuth,
  clearAuth,
  getAuthToken,
  getSelectedRole,
  setSelectedRole,
  clearGuestSessionKeys,
  GUEST_STORAGE_KEYS,
} from './auth';

// Helper: create a fake JWT with given payload
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
}

function pastExp(): number {
  return Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
}

describe('auth.ts', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; Max-Age=0; Path=/';
    });
  });

  // ── Cookie utilities ──────────────────────────────────────────────────

  describe('getCookie', () => {
    it('returns null when cookie does not exist', () => {
      expect(getCookie('missing')).toBeNull();
    });

    it('reads an existing cookie', () => {
      document.cookie = 'guestToken=abc123; Path=/';
      expect(getCookie('guestToken')).toBe('abc123');
    });

    it('decodes URI-encoded cookie values', () => {
      document.cookie = 'test=' + encodeURIComponent('hello world') + '; Path=/';
      expect(getCookie('test')).toBe('hello world');
    });
  });

  describe('clearCookie', () => {
    it('clears an existing cookie', () => {
      document.cookie = 'guestToken=abc123; Path=/';
      expect(getCookie('guestToken')).toBe('abc123');
      clearCookie('guestToken');
      expect(getCookie('guestToken')).toBeNull();
    });
  });

  // ── JWT utilities ─────────────────────────────────────────────────────

  describe('parseJwt', () => {
    it('decodes a valid JWT payload', () => {
      const token = fakeJwt({ sub: 'user-1', role: 'student', exp: 12345 });
      const parsed = parseJwt(token);
      expect(parsed).toEqual({ sub: 'user-1', role: 'student', exp: 12345 });
    });

    it('returns null for malformed input', () => {
      expect(parseJwt('not-a-jwt')).toBeNull();
      expect(parseJwt('')).toBeNull();
    });
  });

  describe('isTokenValid', () => {
    it('returns true for a token with future expiry', () => {
      const token = fakeJwt({ exp: futureExp() });
      expect(isTokenValid(token)).toBe(true);
    });

    it('returns false for an expired token', () => {
      const token = fakeJwt({ exp: pastExp() });
      expect(isTokenValid(token)).toBe(false);
    });

    it('returns false for a token without exp claim', () => {
      const token = fakeJwt({ sub: 'user-1' });
      expect(isTokenValid(token)).toBe(false);
    });

    it('returns false for malformed token', () => {
      expect(isTokenValid('garbage')).toBe(false);
    });
  });

  // ── Cognito token (localStorage) ──────────────────────────────────────

  describe('setAuth / getToken / clearAuth', () => {
    it('stores and retrieves a Cognito token', () => {
      setAuth('my-token', { userId: 'u1', email: 'a@b.com', role: 'student', displayName: 'Alice' });
      expect(getToken()).toBe('my-token');
    });

    it('clearAuth removes token and user', () => {
      setAuth('my-token', { userId: 'u1', email: 'a@b.com', role: 'student', displayName: 'Alice' });
      clearAuth();
      expect(getToken()).toBeNull();
    });
  });

  // ── getAuthToken (unified) ────────────────────────────────────────────

  describe('getAuthToken', () => {
    it('returns Cognito token when valid Cognito token in localStorage', () => {
      const cognitoToken = fakeJwt({ exp: futureExp(), sub: 'cognito-user' });
      localStorage.setItem('auth_token', cognitoToken);
      expect(getAuthToken()).toBe(cognitoToken);
    });

    it('returns guest token when only guest cookie present', () => {
      const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123' });
      document.cookie = `guestToken=${guestToken}; Path=/`;
      expect(getAuthToken()).toBe(guestToken);
    });

    it('returns Cognito token when both present (Cognito wins)', () => {
      const cognitoToken = fakeJwt({ exp: futureExp(), sub: 'cognito-user' });
      const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123' });
      localStorage.setItem('auth_token', cognitoToken);
      document.cookie = `guestToken=${guestToken}; Path=/`;
      expect(getAuthToken()).toBe(cognitoToken);
    });

    it('returns null when neither present', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('returns guest token when Cognito token is expired', () => {
      const expiredCognito = fakeJwt({ exp: pastExp(), sub: 'cognito-user' });
      const validGuest = fakeJwt({ exp: futureExp(), guestId: 'guest_123' });
      localStorage.setItem('auth_token', expiredCognito);
      document.cookie = `guestToken=${validGuest}; Path=/`;
      expect(getAuthToken()).toBe(validGuest);
    });

    it('returns null when both tokens are expired', () => {
      const expiredCognito = fakeJwt({ exp: pastExp() });
      const expiredGuest = fakeJwt({ exp: pastExp() });
      localStorage.setItem('auth_token', expiredCognito);
      document.cookie = `guestToken=${expiredGuest}; Path=/`;
      expect(getAuthToken()).toBeNull();
    });
  });

  // ── Guest session keys ────────────────────────────────────────────────

  describe('clearGuestSessionKeys', () => {
    it('removes all lf_ prefixed keys from sessionStorage', () => {
      Object.values(GUEST_STORAGE_KEYS).forEach((key) => {
        sessionStorage.setItem(key, 'test-value');
      });
      clearGuestSessionKeys();
      Object.values(GUEST_STORAGE_KEYS).forEach((key) => {
        expect(sessionStorage.getItem(key)).toBeNull();
      });
    });
  });

  // ── Role management ───────────────────────────────────────────────────

  describe('setSelectedRole / getSelectedRole', () => {
    it('stores and retrieves a role', () => {
      setSelectedRole('teacher');
      expect(getSelectedRole()).toBe('teacher');
    });

    it('returns null when no role set', () => {
      expect(getSelectedRole()).toBeNull();
    });
  });
});

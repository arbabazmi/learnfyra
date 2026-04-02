import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AuthProvider, useAuth } from './AuthContext';

// Helper: create a fake JWT with given payload
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function pastExp(): number {
  return Math.floor(Date.now() / 1000) - 3600;
}

// Mock fetch for guest token auto-refresh
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; Max-Age=0; Path=/';
    });
    mockFetch.mockReset();
  });

  it('returns tokenState="none" when neither token exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Wait for effect
    await act(() => Promise.resolve());
    expect(result.current.tokenState).toBe('none');
    expect(result.current.isGuest).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('returns tokenState="authenticated" when valid Cognito token in localStorage', async () => {
    const token = fakeJwt({ exp: futureExp(), sub: 'user-1' });
    const user = { userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice' };
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('authenticated');
    expect(result.current.isGuest).toBe(false);
    expect(result.current.user).toEqual(user);
    expect(result.current.userId).toBe('user-1');
  });

  it('returns tokenState="guest" when valid guest cookie exists and no Cognito token', async () => {
    const guestToken = fakeJwt({
      exp: futureExp(),
      guestId: 'guest_abc',
      role: 'guest-student',
    });
    document.cookie = `guestToken=${guestToken}; Path=/`;

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('guest');
    expect(result.current.isGuest).toBe(true);
    expect(result.current.guestId).toBe('guest_abc');
    expect(result.current.role).toBe('guest-student');
  });

  it('Cognito wins when both tokens present', async () => {
    const cognitoToken = fakeJwt({ exp: futureExp(), sub: 'user-1' });
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_abc', role: 'guest-student' });
    const user = { userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice' };

    localStorage.setItem('auth_token', cognitoToken);
    localStorage.setItem('auth_user', JSON.stringify(user));
    document.cookie = `guestToken=${guestToken}; Path=/`;

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('authenticated');
    expect(result.current.userId).toBe('user-1');
  });

  it('falls through to guest when Cognito token is expired', async () => {
    const expiredCognito = fakeJwt({ exp: pastExp(), sub: 'user-1' });
    const validGuest = fakeJwt({ exp: futureExp(), guestId: 'guest_abc', role: 'guest-teacher' });
    const user = { userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice' };

    localStorage.setItem('auth_token', expiredCognito);
    localStorage.setItem('auth_user', JSON.stringify(user));
    document.cookie = `guestToken=${validGuest}; Path=/`;

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('guest');
    expect(result.current.role).toBe('guest-teacher');
  });

  it('reads worksheetCount from sessionStorage', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_abc', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;
    sessionStorage.setItem('lf_guest_used', '5');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.worksheetCount).toBe(5);
    expect(result.current.worksheetLimit).toBe(10);
  });

  it('signIn updates tokenState to authenticated and clears guest data', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_abc', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;
    sessionStorage.setItem('lf_guest_used', '3');
    sessionStorage.setItem('lf_modal_shown', '1');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('guest');

    const newToken = fakeJwt({ exp: futureExp(), sub: 'user-2' });
    const newUser = { userId: 'user-2', email: 'b@c.com', role: 'student', displayName: 'Bob' };

    act(() => {
      result.current.signIn(newToken, newUser);
    });

    expect(result.current.tokenState).toBe('authenticated');
    expect(result.current.user).toEqual(newUser);
    // Guest session keys should be cleared
    expect(sessionStorage.getItem('lf_guest_used')).toBeNull();
    expect(sessionStorage.getItem('lf_modal_shown')).toBeNull();
  });

  it('signOut returns to none state', async () => {
    const token = fakeJwt({ exp: futureExp(), sub: 'user-1' });
    const user = { userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice' };
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());

    expect(result.current.tokenState).toBe('authenticated');

    act(() => {
      result.current.signOut();
    });

    expect(result.current.tokenState).toBe('none');
    expect(result.current.user).toBeNull();
  });

  it('auto-refreshes expired guest cookie with correct role', async () => {
    const expiredGuest = fakeJwt({ exp: pastExp(), role: 'guest-teacher' });
    document.cookie = `guestToken=${expiredGuest}; Path=/`;

    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());
    // Allow the async auto-refresh to complete
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/guest'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ role: 'teacher' }),
      }),
    );
  });
});

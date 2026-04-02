import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { GuestBanner } from './GuestBanner';
import { AuthProvider } from '@/contexts/AuthContext';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function renderWithProviders() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <GuestBanner />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('GuestBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; Max-Age=0; Path=/';
    });
    mockFetch.mockReset();
  });

  it('shows when tokenState is guest', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/login to save your progress/i)).toBeInTheDocument();
    });
  });

  it('hidden when tokenState is authenticated', async () => {
    const token = fakeJwt({ exp: futureExp(), sub: 'user-1' });
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify({
      userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice',
    }));

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText(/login/i)).not.toBeInTheDocument();
    });
  });

  it('hidden when tokenState is none', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText(/login to save/i)).not.toBeInTheDocument();
    });
  });

  it('hidden when lf_banner_dismissed is set and used < 8', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;
    sessionStorage.setItem('lf_banner_dismissed', '1');
    sessionStorage.setItem('lf_guest_used', '3');

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText(/login/i)).not.toBeInTheDocument();
    });
  });

  it('visible and not dismissible when used >= 8', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;
    sessionStorage.setItem('lf_banner_dismissed', '1'); // Even if dismissed before
    sessionStorage.setItem('lf_guest_used', '9');
    sessionStorage.setItem('lf_guest_limit', '10');

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/9\/10 free worksheets/i)).toBeInTheDocument();
    });
    // Dismiss button should NOT exist
    expect(screen.queryByLabelText('Dismiss banner')).not.toBeInTheDocument();
  });

  it('shows generic message when used === 0', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/login to save your progress/i)).toBeInTheDocument();
    });
  });

  it('shows count message when used > 0 and < 8', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;
    sessionStorage.setItem('lf_guest_used', '5');
    sessionStorage.setItem('lf_guest_limit', '10');

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/5\/10 free worksheets.*unlock more/i)).toBeInTheDocument();
    });
  });
});

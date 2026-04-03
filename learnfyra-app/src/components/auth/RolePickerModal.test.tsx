import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { RolePickerModal } from './RolePickerModal';
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
        <RolePickerModal />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('RolePickerModal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; Max-Age=0; Path=/';
    });
    mockFetch.mockReset();
  });

  it('renders when tokenState is none and lf_modal_shown is absent', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });
  });

  it('does NOT render when tokenState is guest', async () => {
    const guestToken = fakeJwt({ exp: futureExp(), guestId: 'guest_123', role: 'guest-student' });
    document.cookie = `guestToken=${guestToken}; Path=/`;

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText('Who is learning today?')).not.toBeInTheDocument();
    });
  });

  it('does NOT render when tokenState is authenticated', async () => {
    const token = fakeJwt({ exp: futureExp(), sub: 'user-1' });
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify({
      userId: 'user-1', email: 'a@b.com', role: 'student', displayName: 'Alice',
    }));

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText('Who is learning today?')).not.toBeInTheDocument();
    });
  });

  it('does NOT render when lf_modal_shown is set', async () => {
    sessionStorage.setItem('lf_modal_shown', '1');

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText('Who is learning today?')).not.toBeInTheDocument();
    });
  });

  it('"Continue as Guest" button is disabled until role selected', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /continue as guest/i });
    expect(continueBtn).toBeDisabled();

    // Select a role
    fireEvent.click(screen.getByText('Student'));
    expect(continueBtn).not.toBeDisabled();
  });

  it('"Continue as Guest" calls POST /auth/guest with correct role', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Teacher'));
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/guest'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ role: 'teacher' }),
        }),
      );
    });
  });

  it('sets lf_modal_shown on successful guest continue', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Student'));
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('lf_modal_shown')).toBe('1');
    });
  });

  it('shows inline error on API failure and keeps modal open', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Student'));
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
    // Modal should still be visible
    expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
  });

  it('"Login / Sign Up" saves lf_pre_login_url', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ authorizationUrl: 'https://google.com/oauth' }),
    });

    // Mock window.location.href setter
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/worksheet/new',
      search: '?grade=5',
    } as Location);

    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Who is learning today?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('lf_pre_login_url')).toBe('/worksheet/new?grade=5');
    });

    locationSpy.mockRestore();
  });
});

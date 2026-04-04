/**
 * @file src/pages/LoginPage.tsx
 * @description Unauthenticated login page for the admin console.
 * Calls AuthContext.login, then redirects to the role-appropriate home route.
 * Surfaces API errors with clear messaging and handles the INSUFFICIENT_ROLE
 * case where a non-admin user attempts access.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Mail, AlertCircle } from 'lucide-react';

/**
 * Renders the full-screen login form.
 * Redirects immediately when the user is already authenticated.
 */
export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Already authenticated — redirect without rendering the form.
  if (user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (user.role === 'school_admin') {
      navigate(from ?? '/school', { replace: true });
    } else {
      navigate(from ?? '/dashboard', { replace: true });
    }
    return null;
  }

  /**
   * Handles form submission. Delegates credential validation to
   * AuthContext.login and maps known error codes to user-friendly messages.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      const from =
        (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { error?: string; code?: string };
      if (apiErr.code === 'INSUFFICIENT_ROLE') {
        setError('Admin access required. Contact your administrator.');
      } else {
        setError(apiErr.error ?? 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <img
            src="/admin-console/images/Logos/colored-logo.png"
            alt="Learnfyra"
            className="h-14 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Learnfyra Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to access the admin console
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Inline error banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@learnfyra.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Only authorized administrators can access this console.
        </p>
      </div>
    </div>
  );
}

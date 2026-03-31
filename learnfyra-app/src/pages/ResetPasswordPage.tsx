/**
 * @file src/pages/ResetPasswordPage.tsx
 * @description Password reset page — reached via email link with ?token= param.
 * User enters new password, submits, then redirects to landing page to sign in.
 */

import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { resetPasswordWithToken, isPasswordValid, type AuthError } from '@/lib/emailAuth';
import { PasswordStrengthBar } from '@/components/ui/PasswordStrengthBar';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  const mismatch = confirmPassword && password !== confirmPassword;
  const canSubmit = isPasswordValid(password) && password === confirmPassword && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError('');
    try {
      await resetPasswordWithToken(token, emailParam, password);
      setSuccess(true);
    } catch (err) {
      setError((err as AuthError).error || 'Reset failed. The link may be expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-full text-center space-y-4">
          <Logo size="sm" className="mx-auto" />
          <h1 className="text-lg font-extrabold text-foreground">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">This password reset link is invalid or has expired.</p>
          <Button variant="primary" size="md" onClick={() => navigate('/', { replace: true })}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <Logo size="sm" className="mx-auto mb-4" />
          {!success ? (
            <>
              <h1 className="text-xl font-extrabold text-foreground">Set new password</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Choose a strong password for your account.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-secondary" />
              </div>
              <h1 className="text-xl font-extrabold text-foreground">Password reset!</h1>
              <p className="text-sm text-muted-foreground mt-1.5">You can now sign in with your new password.</p>
              <Button variant="primary" size="lg" className="w-full mt-6" onClick={() => navigate('/', { replace: true })}>
                Go to Sign In
              </Button>
            </>
          )}
        </div>

        {!success && (
          <>
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    autoFocus
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5" aria-label={showPw ? 'Hide' : 'Show'}>
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <PasswordStrengthBar password={password} />
              </div>

              {/* Confirm */}
              <div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={`${inputCls} pl-10 pr-10 ${mismatch ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5">
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {mismatch && (
                  <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                    <AlertCircle className="size-3" /> Passwords do not match
                  </p>
                )}
              </div>

              <Button variant="primary" size="lg" className="w-full" type="submit" disabled={!canSubmit} loading={isLoading}>
                Reset Password
              </Button>
            </form>

            <button
              onClick={() => navigate('/', { replace: true })}
              className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;

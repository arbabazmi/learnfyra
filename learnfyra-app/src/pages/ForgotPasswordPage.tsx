/**
 * @file src/pages/ForgotPasswordPage.tsx
 * @description Standalone forgot-password page at /auth/forgot-password.
 * Environment-aware success message:
 *   local  → "Check Mailhog at http://localhost:8025"
 *   others → "We've sent a reset email to {email}"
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, KeyRound, CheckCircle, ArrowLeft, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { forgotPassword, isEmailValid } from '@/lib/emailAuth';
import { isLocal, mailhogUrl } from '@/lib/env';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const emailError = touched && email && !isEmailValid(email) ? 'Enter a valid email address' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid(email)) return;
    setIsLoading(true);
    await forgotPassword(email);
    setIsLoading(false);
    setSent(true);

    // In non-local envs, redirect to code entry after a brief delay
    if (!isLocal) {
      setTimeout(() => navigate('/auth/verify-reset-code', { state: { email } }), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <Logo size="sm" className="mx-auto mb-5" />

          {!sent ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
                <KeyRound className="size-7 text-accent-foreground" />
              </div>
              <h1 className="text-xl font-extrabold text-foreground">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {isLocal
                  ? "Enter your email and we'll send a reset link to Mailhog."
                  : "Enter your email and we'll send you a verification code."
                }
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-secondary" />
              </div>
              <h1 className="text-xl font-extrabold text-foreground">Check your email</h1>

              {isLocal ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    A reset link has been sent to <span className="font-bold text-foreground">{email}</span>.
                  </p>
                  <a
                    href={mailhogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                  >
                    Open Mailhog ({mailhogUrl})
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  We've sent a 6-digit verification code to <span className="font-bold text-foreground">{email}</span>.
                  <br />Redirecting...
                </p>
              )}
            </>
          )}
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="email"
                  className={`${inputCls} pl-10 ${emailError ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                />
              </div>
              {emailError && (
                <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertCircle className="size-3" /> {emailError}
                </p>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2"
              type="submit"
              disabled={!isEmailValid(email) || isLoading}
              loading={isLoading}
            >
              {isLocal ? 'Send Reset Link' : 'Send Verification Code'}
            </Button>
          </form>
        )}

        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

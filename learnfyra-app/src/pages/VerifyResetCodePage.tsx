/**
 * @file src/pages/VerifyResetCodePage.tsx
 * @description Cognito 6-digit code + new password flow (dev/qa/prod only).
 * Reached after forgot-password sends the code via SES.
 */

import * as React from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { OtpInput } from '@/components/ui/OtpInput';
import { PasswordStrengthBar } from '@/components/ui/PasswordStrengthBar';
import { resetPasswordWithCode, resendResetCode, isPasswordValid, type AuthError } from '@/lib/emailAuth';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const VerifyResetCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || '';

  const [email] = React.useState(emailFromState);
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  // Resend cooldown
  const [cooldown, setCooldown] = React.useState(0);
  const [resending, setResending] = React.useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Redirect to forgot-password if no email in state
  if (!email) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-full text-center space-y-4">
          <Logo size="sm" className="mx-auto" />
          <h1 className="text-lg font-extrabold text-foreground">No email provided</h1>
          <p className="text-sm text-muted-foreground">Please start the password reset flow again.</p>
          <Button variant="primary" size="md" onClick={() => navigate('/auth/forgot-password', { replace: true })}>
            Forgot Password
          </Button>
        </div>
      </div>
    );
  }

  const cleanCode = code.replace(/\s/g, '');
  const mismatch = confirmPassword && password !== confirmPassword;
  const canSubmit = cleanCode.length === 6 && isPasswordValid(password) && password === confirmPassword && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError('');
    try {
      await resetPasswordWithCode(email, cleanCode, password);
      setSuccess(true);
    } catch (err) {
      const authErr = err as AuthError;
      setError(authErr.error || 'Reset failed. Code may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    await resendResetCode(email);
    setResending(false);
    setCooldown(60);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 max-w-sm w-full text-center space-y-5">
          <Logo size="sm" className="mx-auto" />
          <div className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto">
            <CheckCircle className="size-8 text-secondary" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Password reset!</h1>
          <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
          <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/', { replace: true })}>
            Go to Sign In
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
          <h1 className="text-xl font-extrabold text-foreground">Enter verification code</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            We sent a 6-digit code to <span className="font-bold text-foreground">{email}</span>
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* OTP code */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
              Verification Code
            </label>
            <OtpInput value={code} onChange={setCode} disabled={isLoading} />
          </div>

          {/* Resend */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs text-muted-foreground">
                Resend code in <span className="font-bold text-foreground">{cooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${resending ? 'animate-spin' : ''}`} />
                Resend Code
              </button>
            )}
          </div>

          {/* New password */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className={`${inputCls} pl-10 pr-10`}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5">
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

        <Link
          to="/auth/forgot-password"
          className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Start Over
        </Link>
      </div>
    </div>
  );
};

export default VerifyResetCodePage;

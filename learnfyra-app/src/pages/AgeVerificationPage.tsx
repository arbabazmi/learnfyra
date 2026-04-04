/**
 * @file src/pages/AgeVerificationPage.tsx
 * @description Age verification page for OAuth users who sign in without a DOB on file.
 *
 * Route: /auth/age-verification
 *
 * Flow:
 *   1. User picks Month / Day / Year from dropdowns
 *   2. Submits → PATCH /api/auth/verify-age { dateOfBirth }
 *   3. On 13+: redirect to /dashboard
 *   4. On under-13 (requiresConsent): redirect to /auth/consent-pending
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import { Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 116 }, (_, i) => currentYear - 5 - i);

// ── Shared input class (mirrors AuthModal) ────────────────────────────────────

const inputCls =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const inputErrorCls = 'border-destructive focus:border-destructive focus:ring-destructive/20';

// ── Component ─────────────────────────────────────────────────────────────────

const AgeVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [dobMonth, setDobMonth] = React.useState('');
  const [dobDay, setDobDay] = React.useState('');
  const [dobYear, setDobYear] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');

  const isComplete = dobMonth !== '' && dobDay !== '' && dobYear !== '';
  const fieldError = touched && !isComplete ? 'Please select a complete date of birth.' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isComplete) return;

    const dateOfBirth = `${dobYear}-${String(dobMonth).padStart(2, '0')}-${String(dobDay).padStart(2, '0')}`;
    const token = getAuthToken();
    if (!token) {
      setApiError('You must be signed in to verify your age.');
      return;
    }

    setIsLoading(true);
    setApiError('');

    try {
      const res = await fetch(`${apiUrl}/api/auth/verify-age`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dateOfBirth }),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || 'Age verification failed. Please try again.');
        return;
      }

      if (data.requiresConsent) {
        navigate('/auth/consent-pending', { replace: true });
        return;
      }

      // 13+ — refresh auth and go to dashboard
      auth.refresh();
      navigate('/dashboard', { replace: true });
    } catch {
      setApiError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-8 space-y-6">

          {/* Branding */}
          <div className="text-center space-y-3">
            <Logo size="sm" className="mx-auto" />
            <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
              <Calendar className="size-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">One more step!</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Please enter your date of birth to continue.
              </p>
            </div>
          </div>

          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-semibold">{apiError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Date of Birth
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">Required for age verification</p>

              <div className="grid grid-cols-3 gap-2">
                {/* Month */}
                <select
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className={`${inputCls} px-2 text-xs ${fieldError ? inputErrorCls : ''}`}
                  aria-label="Birth month"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>

                {/* Day */}
                <select
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className={`${inputCls} px-2 text-xs ${fieldError ? inputErrorCls : ''}`}
                  aria-label="Birth day"
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>

                {/* Year */}
                <select
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value)}
                  onBlur={() => setTouched(true)}
                  className={`${inputCls} px-2 text-xs ${fieldError ? inputErrorCls : ''}`}
                  aria-label="Birth year"
                >
                  <option value="">Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>

              {fieldError && (
                <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {fieldError}
                </p>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full gap-2"
              disabled={!isComplete || isLoading}
              loading={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground">
            We use your date of birth only for age verification. It is never shared or sold.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgeVerificationPage;

/**
 * @file src/pages/ParentalConsentPage.tsx
 * @description Parent-facing consent form served via email magic link.
 *
 * Route: /auth/parental-consent?token={consentToken}
 *
 * Allows a parent to:
 *   - Review what data is collected and what Learnfyra does NOT do
 *   - Understand parent rights under COPPA
 *   - Provide name + relationship
 *   - Click [I Consent] → POST /api/auth/verify-consent
 *   - Click [I Do Not Consent] → POST /api/auth/deny-consent
 */

import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Eye,
  User,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { apiUrl } from '@/lib/env';
import { cn } from '@/lib/utils';

// ── Input styling (mirrors AuthModal) ─────────────────────────────────────────

const inputCls =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const selectCls = inputCls + ' cursor-pointer appearance-none pr-10';

// ── Sub-components ────────────────────────────────────────────────────────────

const DisclosureItem: React.FC<{ icon: React.ElementType; color: string; bg: string; text: string }> = ({
  icon: Icon,
  color,
  bg,
  text,
}) => (
  <div className="flex items-start gap-3">
    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', bg)}>
      <Icon className={cn('size-3.5', color)} />
    </div>
    <p className="text-sm text-foreground leading-relaxed">{text}</p>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

type PageState = 'form' | 'consent-success' | 'deny-success' | 'error';

const ParentalConsentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const consentToken = searchParams.get('token') ?? '';

  const [parentName, setParentName] = React.useState('');
  const [relationship, setRelationship] = React.useState('');
  const [hasReadPolicy, setHasReadPolicy] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const [pageState, setPageState] = React.useState<PageState>('form');
  const [isConsenting, setIsConsenting] = React.useState(false);
  const isDenying = React.useRef(false);
  const [apiError, setApiError] = React.useState('');

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const nameError = touched.name && !parentName.trim() ? 'Your name is required' : '';
  const relError = touched.relationship && !relationship ? 'Please select your relationship' : '';

  const canConsent = parentName.trim() && relationship && hasReadPolicy;

  const handleConsent = async () => {
    touch('name');
    touch('relationship');
    if (!canConsent) return;
    setIsConsenting(true);
    setApiError('');
    try {
      const res = await fetch(`${apiUrl}/api/auth/verify-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentToken, parentName, parentRelationship: relationship }),
      });
      if (res.ok) {
        setPageState('consent-success');
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError((data as { error?: string }).error || 'Consent submission failed. Please try again.');
      }
    } catch {
      setApiError('Network error. Please try again.');
    } finally {
      setIsConsenting(false);
    }
  };

  const handleDeny = async () => {
    if (isDenying.current) return;
    isDenying.current = true;
    setApiError('');
    try {
      const res = await fetch(`${apiUrl}/api/auth/deny-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentToken }),
      });
      if (res.ok) {
        setPageState('deny-success');
      } else {
        const data = await res.json().catch(() => ({}));
        setApiError((data as { error?: string }).error || 'Request failed. Please try again.');
        isDenying.current = false;
      }
    } catch {
      setApiError('Network error. Please try again.');
      isDenying.current = false;
    }
  };

  // ── Success: consent given ──────────────────────────────────────────────

  if (pageState === 'consent-success') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-border shadow-card p-8 space-y-5 text-center">
          <Logo size="sm" className="mx-auto" />
          <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
            <CheckCircle className="size-8 text-secondary" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Consent given!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your child can now use Learnfyra. They can log in and start learning right away.
          </p>
          <p className="text-xs text-muted-foreground">
            You can manage your child's data and revoke consent at any time from the{' '}
            <Link to="/parent/dashboard" className="text-primary font-bold hover:underline">
              Parent Dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  // ── Success: consent denied ─────────────────────────────────────────────

  if (pageState === 'deny-success') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-border shadow-card p-8 space-y-5 text-center">
          <Logo size="sm" className="mx-auto" />
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <XCircle className="size-8 text-destructive" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Consent declined</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The account will be deleted within 24 hours. No data will be retained.
          </p>
        </div>
      </div>
    );
  }

  // ── Main consent form ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface py-8 px-4">
      <div className="w-full max-w-lg mx-auto space-y-5">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 text-center space-y-3">
          <Logo size="sm" className="mx-auto" />
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
            <ShieldCheck className="size-7 text-primary" />
          </div>
          <h1 className="text-xl font-extrabold text-foreground">Parental Consent for Learnfyra</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Your child has signed up for Learnfyra, an AI-powered worksheet practice tool.
            Because they are under 13, we need your consent under the{' '}
            <span className="font-semibold text-foreground">Children's Online Privacy Protection Act (COPPA)</span>
            {' '}before they can access the service.
          </p>
        </div>

        {/* What we collect */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            What we collect
          </h2>
          <div className="space-y-3">
            <DisclosureItem
              icon={User}
              bg="bg-primary-light"
              color="text-primary"
              text="Email address and display name — used only for account login and to address your child."
            />
            <DisclosureItem
              icon={Eye}
              bg="bg-accent-light"
              color="text-amber-600"
              text="Grade level — used to select age-appropriate content."
            />
            <DisclosureItem
              icon={CheckCircle}
              bg="bg-success-light"
              color="text-secondary"
              text="Worksheet answers and scores — stored to track progress and display results."
            />
          </div>
        </div>

        {/* What we don't do */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            What we never do
          </h2>
          <div className="space-y-3">
            {[
              'Sell or share your child\'s data with third parties for advertising.',
              'Show ads to your child.',
              'Send personally identifiable information to AI models — only anonymized, grade-level content.',
              'Store sensitive personal information beyond what is listed above.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Parent rights */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            Your rights as a parent
          </h2>
          <div className="space-y-3">
            {[
              'View all data collected about your child at any time from the Parent Dashboard.',
              'Download a full export of your child\'s data as a JSON file.',
              'Request deletion of your child\'s account and all associated data.',
              'Revoke consent at any time — this will suspend your child\'s account.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Shield className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Consent form */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            Your information
          </h2>

          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-semibold">{apiError}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Parent name */}
            <div>
              <label
                htmlFor="parentName"
                className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
              >
                Your Full Name
              </label>
              <input
                id="parentName"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                onBlur={() => touch('name')}
                placeholder="e.g. Jane Smith"
                autoComplete="name"
                className={`${inputCls} ${nameError ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
              />
              {nameError && (
                <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {nameError}
                </p>
              )}
            </div>

            {/* Relationship */}
            <div>
              <label
                htmlFor="relationship"
                className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
              >
                Relationship to Child
              </label>
              <div className="relative">
                <select
                  id="relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  onBlur={() => touch('relationship')}
                  className={`${selectCls} ${relError ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                >
                  <option value="">Select relationship</option>
                  <option value="parent">Parent</option>
                  <option value="legal-guardian">Legal Guardian</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              </div>
              {relError && (
                <p className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {relError}
                </p>
              )}
            </div>

            {/* Privacy policy checkbox */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasReadPolicy}
                onChange={(e) => setHasReadPolicy(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <span className="text-sm text-foreground leading-relaxed">
                I have read the{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-bold hover:underline"
                >
                  Privacy Policy
                </Link>{' '}
                and consent to Learnfyra collecting and processing the data described above for my child's educational use.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2"
              onClick={handleConsent}
              disabled={!canConsent || isConsenting}
              loading={isConsenting}
            >
              {isConsenting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" />
                  I Consent
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleDeny}
            >
              <XCircle className="size-4" />
              I Do Not Consent
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            If you do not consent, the account will be deleted and all data removed.
          </p>
        </div>

      </div>
    </div>
  );
};

export default ParentalConsentPage;

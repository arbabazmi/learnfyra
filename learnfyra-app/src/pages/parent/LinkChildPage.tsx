/**
 * @file src/pages/parent/LinkChildPage.tsx
 * @description Parent links to a child using a 6-char invite code.
 * Handles error states: 404 invalid code, 409 already used, 410 expired.
 * On success, redirects to parent dashboard.
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { usePageMeta } from '@/lib/pageMeta';
import * as parentService from '@/services/api/parentService';
import type { ChildSummary } from '@/types/parent';

// ── Error message mapping ──────────────────────────────────────────────────

function mapError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid') || lower.includes('not found') || lower.includes('404')) {
    return 'Invalid invite code. Please check and try again.';
  }
  if (lower.includes('already used') || lower.includes('409') || lower.includes('conflict')) {
    return 'This code has already been used. Ask for a new one.';
  }
  if (lower.includes('expired') || lower.includes('410')) {
    return 'This code has expired. Ask for a new one.';
  }
  return message;
}

// ── Component ──────────────────────────────────────────────────────────────

const LinkChildPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [linked, setLinked] = React.useState<ChildSummary | null>(null);

  usePageMeta({
    title: 'Link Child Account',
    description: 'Link your child\'s Learnfyra account using their invite code.',
    keywords: 'parent link child, invite code, parent account',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase, trim to 6 chars
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(val);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setError('Invite code must be 6 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const child = await parentService.linkToChild(code);
      setLinked(child);
    } catch (err) {
      setError(mapError(err instanceof Error ? err.message : 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────

  if (linked) {
    return (
      <AppLayout pageTitle="Child Linked">
        <div className="p-4 sm:p-6 max-w-sm mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
              <CheckCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-foreground">
                Account Linked!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                You are now linked to{' '}
                <strong>{linked.displayName}</strong>
                {linked.gradeLevel
                  ? ` (Grade ${linked.gradeLevel})`
                  : ''}
                .
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/parent/dashboard')}
            >
              View Dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────

  return (
    <AppLayout pageTitle="Link Child">
      <div className="p-4 sm:p-6 max-w-sm mx-auto space-y-6">

        {/* Back link */}
        <Link
          to="/parent/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>

        {/* Hero */}
        <section
          aria-label="Link child introduction"
          className="relative rounded-2xl bg-primary overflow-hidden p-6"
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden="true"
          />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <LinkIcon className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Link Your Child
              </h2>
              <p className="text-white/75 text-sm mt-1">
                Enter the 6-character invite code from your child's teacher or
                from your child's Learnfyra account.
              </p>
            </div>
          </div>
        </section>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5"
          noValidate
        >
          <div className="space-y-2">
            <label
              htmlFor="invite-code"
              className="text-xs font-bold text-foreground"
            >
              Invite Code <span className="text-destructive">*</span>
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              onChange={handleChange}
              placeholder="e.g. AB3C7F"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              required
              aria-describedby={error ? 'code-error' : undefined}
              className={[
                'w-full h-14 px-4 rounded-xl border text-center text-2xl font-extrabold tracking-[0.25em] font-mono',
                'bg-surface text-foreground focus:outline-none transition-all',
                error
                  ? 'border-destructive ring-2 ring-destructive/20'
                  : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
              ].join(' ')}
            />
            <p className="text-xs text-muted-foreground">
              6 characters, uppercase letters and numbers only.
            </p>

            {error && (
              <p
                id="code-error"
                role="alert"
                className="text-sm text-destructive font-semibold"
              >
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={code.length < 6}
          >
            <LinkIcon className="size-5" />
            Link Account
          </Button>
        </form>

      </div>
    </AppLayout>
  );
};

export default LinkChildPage;

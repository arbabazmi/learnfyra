/**
 * @file src/pages/student/InviteParentPage.tsx
 * @description Student generates a one-time parent invite code.
 * The code expires after 48 hours and can be shared with a parent
 * to link their accounts.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Heart, Copy, Check, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { usePageMeta } from '@/lib/pageMeta';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';

interface InviteResponse {
  inviteCode: string;
  expiresAt: string;
  linkMethod: string;
}

const InviteParentPage: React.FC = () => {
  const [invite, setInvite] = React.useState<InviteResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  usePageMeta({
    title: 'Invite Parent',
    description: 'Generate a code to link your parent to your account.',
    keywords: 'parent invite, student, link parent',
  });

  const generateCode = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/student/parent-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? `Failed (${res.status})`);
      }
      setInvite(data as InviteResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = invite.inviteCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout pageTitle="Invite Parent">
      <div className="p-4 sm:p-6 max-w-sm mx-auto space-y-6">

        {/* Back link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>

        {/* Hero */}
        <section
          aria-label="Invite parent introduction"
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
              <Heart className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Invite a Parent
              </h2>
              <p className="text-white/75 text-sm mt-1">
                Generate a code and share it with your parent or guardian.
                They can use it to link to your account and track your progress.
              </p>
            </div>
          </div>
        </section>

        {/* Code display or generate button */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">

          {!invite ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your parent will use this code when they sign in to Learnfyra
                to link to your account. The code expires after <strong>48 hours</strong>.
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive font-semibold">
                  {error}
                </p>
              )}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={generateCode}
                loading={loading}
              >
                <Heart className="size-5" />
                Generate Invite Code
              </Button>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Parent Invite Code
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="text-3xl font-extrabold tracking-[0.3em] font-mono text-foreground select-all"
                    aria-label={`Invite code: ${invite.inviteCode.split('').join(' ')}`}
                  >
                    {invite.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    aria-label={copied ? 'Copied' : 'Copy code'}
                  >
                    {copied ? (
                      <Check className="size-5 text-secondary" />
                    ) : (
                      <Copy className="size-5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-secondary font-semibold mt-1">
                    Copied to clipboard!
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-surface p-4 space-y-1">
                <p className="text-xs font-bold text-muted-foreground">
                  Expires
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatExpiry(invite.expiresAt)}
                </p>
              </div>

              <div className="rounded-xl bg-primary-light p-4">
                <p className="text-sm text-primary font-semibold">
                  Share this code with your parent. They should go to{' '}
                  <strong>"Link a Child"</strong> in their Learnfyra account
                  and enter this code.
                </p>
              </div>

              <Button
                variant="ghost"
                size="md"
                className="w-full"
                onClick={() => {
                  setInvite(null);
                  setCopied(false);
                  generateCode();
                }}
              >
                <RefreshCw className="size-4" />
                Generate New Code
              </Button>
              <p className="text-xs text-muted-foreground">
                Generating a new code will invalidate the previous one.
              </p>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
};

export default InviteParentPage;

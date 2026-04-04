/**
 * @file src/pages/student/JoinClassPage.tsx
 * @description Student joins a class by entering the 6-char invite code.
 * On success, shows the class name and teacher name.
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Users, CheckCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { usePageMeta } from '@/lib/pageMeta';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';

// ── Response types ─────────────────────────────────────────────────────────

interface JoinClassResponse {
  classId: string;
  className: string;
  teacherName?: string;
  gradeLevel?: number | null;
}

// ── Error mapping ──────────────────────────────────────────────────────────

function mapError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not found') || lower.includes('invalid') || lower.includes('404')) {
    return 'Invalid invite code. Please check and try again.';
  }
  if (lower.includes('already') || lower.includes('409')) {
    return 'You are already a member of this class.';
  }
  if (lower.includes('full') || lower.includes('capacity')) {
    return 'This class is full. Contact your teacher for help.';
  }
  return message;
}

// ── Component ──────────────────────────────────────────────────────────────

const JoinClassPage: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [joinedClass, setJoinedClass] =
    React.useState<JoinClassResponse | null>(null);

  usePageMeta({
    title: 'Join Class',
    description: 'Join your teacher\'s class using a 6-character invite code.',
    keywords: 'join class, student, invite code',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/student/classes/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ inviteCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data as { error?: string; message?: string }).error ??
          (data as { error?: string; message?: string }).message ??
          `Failed to join class (${res.status})`,
        );
      }
      setJoinedClass(data as JoinClassResponse);
    } catch (err) {
      setError(mapError(err instanceof Error ? err.message : 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────

  if (joinedClass) {
    return (
      <AppLayout pageTitle="Joined Class">
        <div className="p-4 sm:p-6 max-w-sm mx-auto space-y-6">
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
              <CheckCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-foreground">
                Joined!
              </h2>
              <p className="text-lg font-bold text-primary mt-2">
                {joinedClass.className}
              </p>
              {joinedClass.teacherName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Teacher: {joinedClass.teacherName}
                </p>
              )}
              {joinedClass.gradeLevel && (
                <p className="text-sm text-muted-foreground">
                  Grade {joinedClass.gradeLevel}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setJoinedClass(null);
                  setCode('');
                }}
              >
                Join Another Class
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────

  return (
    <AppLayout pageTitle="Join Class">
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
          aria-label="Join class introduction"
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
              <Users className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Join a Class
              </h2>
              <p className="text-white/75 text-sm mt-1">
                Enter the 6-character code your teacher shared with you.
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
              htmlFor="join-code"
              className="text-xs font-bold text-foreground"
            >
              Class Code <span className="text-destructive">*</span>
            </label>
            <input
              id="join-code"
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
              aria-describedby={error ? 'join-error' : undefined}
              className={[
                'w-full h-14 px-4 rounded-xl border text-center text-2xl font-extrabold tracking-[0.25em] font-mono',
                'bg-surface text-foreground focus:outline-none transition-all',
                error
                  ? 'border-destructive ring-2 ring-destructive/20'
                  : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20',
              ].join(' ')}
            />
            <p className="text-xs text-muted-foreground">
              6 characters — uppercase letters and numbers.
            </p>
            {error && (
              <p
                id="join-error"
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
            <Users className="size-5" />
            Join Class
          </Button>
        </form>

      </div>
    </AppLayout>
  );
};

export default JoinClassPage;

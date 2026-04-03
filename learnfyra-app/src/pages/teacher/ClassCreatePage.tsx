/**
 * @file src/pages/teacher/ClassCreatePage.tsx
 * @description Class creation page — form with className (required),
 * gradeLevel (1–10 dropdown), and subjects (multi-select checkboxes).
 * On success, shows the class invite code with copy button.
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ChevronDown, BookOpen, CheckCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { InviteCodeDisplay } from '@/components/shared/InviteCodeDisplay';
import { usePageMeta } from '@/lib/pageMeta';
import * as teacherService from '@/services/api/teacherService';
import type { Class } from '@/types/teacher';

const SUBJECTS = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'] as const;

const selectClass =
  'w-full h-11 pl-4 pr-9 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer';

const inputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

// ── Component ──────────────────────────────────────────────────────────────

const ClassCreatePage: React.FC = () => {
  const navigate = useNavigate();

  const [className, setClassName] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState<string>('');
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createdClass, setCreatedClass] = React.useState<Class | null>(null);

  usePageMeta({
    title: 'Create Class',
    description: 'Create a new class and invite your students to join.',
    keywords: 'create class, class management, teacher tools',
  });

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      setError('Class name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const cls = await teacherService.createClass({
        className: className.trim(),
        ...(gradeLevel ? { gradeLevel: parseInt(gradeLevel, 10) } : {}),
        ...(selectedSubjects.length > 0
          ? { subjects: selectedSubjects }
          : {}),
      });
      setCreatedClass(cls);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create class.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────

  if (createdClass) {
    return (
      <AppLayout pageTitle="Class Created">
        <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">

          {/* Success card */}
          <section
            className="bg-white rounded-2xl border border-border shadow-card p-8 space-y-6 text-center"
            aria-label="Class created successfully"
          >
            <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
              <CheckCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-foreground">
                Class Created!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Share the invite code below with your students so they can join{' '}
                <strong>{createdClass.className}</strong>.
              </p>
            </div>

            <InviteCodeDisplay
              code={createdClass.inviteCode}
              label="Class Invite Code"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => navigate('/teacher/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setCreatedClass(null);
                  setClassName('');
                  setGradeLevel('');
                  setSelectedSubjects([]);
                }}
              >
                Create Another
              </Button>
            </div>
          </section>

        </div>
      </AppLayout>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────

  return (
    <AppLayout pageTitle="Create Class">
      <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-6">

        {/* Back link */}
        <Link
          to="/teacher/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>

        {/* Hero */}
        <section
          aria-label="Page introduction"
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
              <BookOpen className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Create a New Class
              </h2>
              <p className="text-white/75 text-sm mt-1">
                Set up a class, then share the invite code with students.
              </p>
            </div>
          </div>
        </section>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-6"
          noValidate
        >
          {/* Class name */}
          <div className="space-y-1.5">
            <label
              htmlFor="class-name"
              className="text-xs font-bold text-foreground"
            >
              Class Name <span className="text-destructive">*</span>
            </label>
            <input
              id="class-name"
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Period 3 Math"
              required
              maxLength={100}
              autoFocus
              className={inputClass}
            />
          </div>

          {/* Grade level */}
          <div className="space-y-1.5">
            <label
              htmlFor="grade-level"
              className="text-xs font-bold text-foreground"
            >
              Grade Level{' '}
              <span className="text-muted-foreground font-normal">
                — optional
              </span>
            </label>
            <div className="relative">
              <select
                id="grade-level"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className={selectClass}
              >
                <option value="">Select grade</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            </div>
          </div>

          {/* Subjects */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-foreground">
              Subjects{' '}
              <span className="text-muted-foreground font-normal">
                — optional, select all that apply
              </span>
            </p>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
              role="group"
              aria-label="Subjects"
            >
              {SUBJECTS.map((subject) => {
                const checked = selectedSubjects.includes(subject);
                return (
                  <label
                    key={subject}
                    className={[
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-semibold select-none',
                      checked
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-border bg-surface hover:border-primary/30 hover:bg-primary-light/20 text-foreground',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      value={subject}
                      checked={checked}
                      onChange={() => toggleSubject(subject)}
                      className="sr-only"
                    />
                    <span
                      className={[
                        'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                        checked ? 'bg-primary border-primary' : 'border-border',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {checked && (
                        <svg
                          viewBox="0 0 10 8"
                          className="w-2.5 h-2 fill-none stroke-white stroke-2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 4l2.5 2.5L9 1" />
                        </svg>
                      )}
                    </span>
                    {subject}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-sm text-destructive font-semibold">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={submitting}
          >
            Create Class
          </Button>
        </form>

      </div>
    </AppLayout>
  );
};

export default ClassCreatePage;

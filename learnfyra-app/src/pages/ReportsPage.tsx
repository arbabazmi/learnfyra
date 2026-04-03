/**
 * @file src/pages/ReportsPage.tsx
 * @description Performance reports — score history, subject breakdown, activity.
 * Wired to real API endpoints; guest users see a sign-in prompt.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  BookOpen,
  ArrowRight,
  BarChart3,
  LogIn,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthToken } from '@/lib/auth';
import { apiUrl } from '@/lib/env';

// ── API response types ────────────────────────────────────────────────────────

interface DashboardStats {
  worksheetsDone: number;
  inProgress: number;
  bestScore: number;
  studyTime: string;
}

interface SubjectProgressItem {
  subject: string;
  score: number;
  color: string;
}

interface AttemptItem {
  worksheetId: string;
  subject: string;
  topic: string;
  grade: number;
  difficulty: string;
  totalScore: number;
  totalPoints: number;
  percentage: number;
  timeTaken: number;
  createdAt?: string;
  completedAt?: string;  // alias — API returns createdAt
}

interface ReportsData {
  stats: DashboardStats | null;
  subjectProgress: SubjectProgressItem[];
  attempts: AttemptItem[];
}

// ── Subject color fallback map ────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  Math: '#3D9AE8',
  Science: '#6DB84B',
  ELA: '#8b5cf6',
  'Social Studies': '#f97316',
  Health: '#F5C534',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a timeTaken value (seconds) into a human-readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatTimeTaken(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Formats an ISO timestamp or relative label for Recent Activity table.
 * @param {string | undefined} dateStr
 * @returns {string}
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Derives last-7-days daily average scores from the attempts array.
 * Returns an array of 7 numbers (0 if no data for that day).
 * @param {AttemptItem[]} attempts
 * @returns {{ scores: number[]; labels: string[] }}
 */
function buildWeeklyBars(attempts: AttemptItem[]): { scores: number[]; labels: string[] } {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  // Build an array of the last 7 calendar dates, oldest first
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });

  const scores = days.map((day) => {
    const dayStr = day.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayAttempts = attempts.filter((a) => {
      const ts = a.completedAt || a.createdAt;
      if (!ts) return false;
      return new Date(ts).toISOString().slice(0, 10) === dayStr;
    });
    if (dayAttempts.length === 0) return 0;
    const avg = dayAttempts.reduce((sum, a) => sum + a.percentage, 0) / dayAttempts.length;
    return Math.round(avg);
  });

  const labels = days.map((d) => DAY_LABELS[d.getDay()]);
  return { scores, labels };
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-surface-2 rounded-xl ${className}`} />
);

// ── Guest prompt ──────────────────────────────────────────────────────────────

const GuestPrompt: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <BarChart3 className="size-8 text-primary" />
    </div>
    <h2 className="text-xl font-bold text-foreground">Sign in to view your reports</h2>
    <p className="text-muted-foreground max-w-sm">
      Your performance history, subject scores, and activity are saved when you are signed in.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
    >
      <LogIn className="size-4" />
      Sign In
    </Link>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  usePageMeta({
    title: 'Reports',
    description: 'View your Learnfyra performance reports — subject scores, progress trends, and worksheet history.',
    keywords: 'student reports, academic progress, worksheet scores, learning analytics',
  });

  const auth = useAuth();
  const token = getAuthToken();

  const [data, setData] = React.useState<ReportsData>({
    stats: null,
    subjectProgress: [],
    attempts: [],
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (auth.isGuest) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    Promise.all([
      fetch(`${apiUrl}/api/dashboard/stats`, { headers, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${apiUrl}/api/dashboard/subject-progress`, { headers, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${apiUrl}/api/progress/history`, { headers, signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([statsRes, subjectRes, historyRes]) => {
        if (!isMounted) return;
        if (!statsRes && !subjectRes && !historyRes) {
          setError('Failed to load report data. Please try again.');
          return;
        }
        setData({
          stats: statsRes ?? null,
          subjectProgress: Array.isArray(subjectRes) ? subjectRes : [],
          attempts: Array.isArray(historyRes?.attempts) ? historyRes.attempts : [],
        });
      })
      .catch((err) => {
        if (!isMounted || err.name === 'AbortError') return;
        setError('Failed to load report data. Please try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [auth.isGuest]);

  // ── Derived display values ──────────────────────────────────────────────────

  const overallScore = React.useMemo(() => {
    if (data.attempts.length === 0) return null;
    const avg = data.attempts.reduce((s, a) => s + a.percentage, 0) / data.attempts.length;
    return Math.round(avg);
  }, [data.attempts]);

  const { scores: weeklyScores, labels: weeklyLabels } = React.useMemo(
    () => buildWeeklyBars(data.attempts),
    [data.attempts],
  );

  const overallStats = React.useMemo(() => {
    const s = data.stats;
    return [
      {
        label: 'Overall Score',
        value: overallScore !== null ? `${overallScore}%` : '—',
        icon: BarChart3,
        color: '#3D9AE8',
      },
      {
        label: 'Total Study Time',
        value: s?.studyTime ?? '—',
        icon: Clock,
        color: '#6DB84B',
      },
      {
        label: 'Worksheets Done',
        value: s?.worksheetsDone != null ? String(s.worksheetsDone) : '—',
        icon: BookOpen,
        color: '#f97316',
      },
      {
        label: 'Best Score',
        value: s?.bestScore != null ? `${s.bestScore}%` : '—',
        icon: Award,
        color: '#F5C534',
      },
    ];
  }, [data.stats, overallScore]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const hasWeeklyData = weeklyScores.some((v) => v > 0);
  const maxWeekly = Math.max(...weeklyScores, 1);

  // ── Guest gate ──────────────────────────────────────────────────────────────

  if (auth.isGuest) {
    return (
      <AppLayout pageTitle="Reports">
        <GuestPrompt />
      </AppLayout>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  if (!isLoading && error) {
    return (
      <AppLayout pageTitle="Reports">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <p className="text-destructive font-semibold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      </AppLayout>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout pageTitle="Reports">
        <div className="p-6 space-y-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <div className="grid lg:grid-cols-[3fr_2fr] gap-6">
            <SkeletonBlock className="h-56" />
            <SkeletonBlock className="h-56" />
          </div>
          <SkeletonBlock className="h-48" />
        </div>
      </AppLayout>
    );
  }

  // ── Authenticated, data loaded ──────────────────────────────────────────────

  return (
    <AppLayout pageTitle="Reports">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">

        {/* ── Overall stats ──────────────────────────────────────── */}
        <section aria-label="Overall performance">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Overall Performance
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {overallStats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-border shadow-card p-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${s.color}18` }}
                  >
                    <Icon className="size-5" style={{ color: s.color }} />
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">{s.value}</div>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Two-column: weekly chart + subject breakdown ────────── */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">

          {/* Weekly score chart */}
          <section aria-label="Weekly scores" className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-5">
              Weekly Scores
            </h2>

            {hasWeeklyData ? (
              <div className="flex items-end gap-2 h-40">
                {weeklyScores.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {h > 0 && (
                      <span className="text-[10px] font-semibold text-muted-foreground">{h}%</span>
                    )}
                    <div
                      className="w-full rounded-t-lg bg-primary transition-all duration-500"
                      style={{
                        height: `${(h / maxWeekly) * 120}px`,
                        opacity: h > 0 ? 0.5 + (i / weeklyScores.length) * 0.5 : 0.1,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{weeklyLabels[i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                No activity in the past 7 days.
              </div>
            )}
          </section>

          {/* Subject breakdown */}
          <section aria-label="Subject breakdown" className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-5">
              By Subject
            </h2>

            {data.subjectProgress.length > 0 ? (
              <div className="space-y-4">
                {data.subjectProgress.map((s) => {
                  const color = s.color || SUBJECT_COLORS[s.subject] || '#3D9AE8';
                  return (
                    <div key={s.subject}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-semibold text-foreground">{s.subject}</span>
                        <span className="text-sm font-extrabold" style={{ color }}>
                          {s.score}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.score}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Complete worksheets to see subject scores.
              </div>
            )}
          </section>
        </div>

        {/* ── Recent activity ────────────────────────────────────── */}
        <section aria-label="Recent activity">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Recent Activity
          </h2>

          {data.attempts.length > 0 ? (
            <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              <table className="w-full text-sm" aria-label="Worksheet activity table">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Worksheet</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Subject</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Date</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Time</th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Score</th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts.map((row, i) => (
                    <tr
                      key={`${row.worksheetId}-${i}`}
                      className={`${i < data.attempts.length - 1 ? 'border-b border-border' : ''} hover:bg-surface transition-colors`}
                    >
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        {row.topic}
                        <span className="block text-[11px] font-normal text-muted-foreground">Grade {row.grade} · {row.difficulty}</span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{row.subject}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{formatDate(row.completedAt || row.createdAt)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{formatTimeTaken(row.timeTaken)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge variant={row.percentage >= 80 ? 'success' : row.percentage >= 60 ? 'warning' : 'destructive'}>
                          {row.percentage}%
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/solve/${row.worksheetId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Review <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-card p-10 flex flex-col items-center gap-3 text-center">
              <BookOpen className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No completed worksheets yet. Solve a worksheet to see your history here.
              </p>
              <Link
                to="/generate"
                className="text-sm font-bold text-primary hover:underline"
              >
                Generate a worksheet
              </Link>
            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
};

export default ReportsPage;

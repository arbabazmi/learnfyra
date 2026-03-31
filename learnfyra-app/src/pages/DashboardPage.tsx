/**
 * @file src/pages/DashboardPage.tsx
 * @description Student dashboard — worksheet activity, scores, and quick actions.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  BookOpen,
  BarChart3,
  Plus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';

// ── Mock data — replace with real API calls ────────────────────────────────
const stats = [
  { label: 'Worksheets Done',  value: '24',  icon: CheckCircle, color: '#3D9AE8' },
  { label: 'In Progress',      value: '3',   icon: Clock,       color: '#F5C534' },
  { label: 'Best Score',       value: '92%', icon: TrendingUp,  color: '#6DB84B' },
  { label: 'Total Study Time', value: '15h', icon: BarChart3,   color: '#f97316' },
];

const recentWorksheets = [
  { id: 'ws-001', title: 'Linear Equations',        subject: 'Math',    grade: 7, score: 90, total: 10, status: 'completed' as const },
  { id: 'ws-002', title: 'Cell Biology Basics',     subject: 'Science', grade: 7, score: 80, total: 10, status: 'completed' as const },
  { id: 'ws-003', title: 'The American Revolution', subject: 'History', grade: 7, score: null, total: 10, status: 'new' as const },
  { id: 'ws-004', title: 'Parts of Speech',         subject: 'ELA',     grade: 7, score: null, total: 10, status: 'in-progress' as const },
];

const subjectProgress = [
  { name: 'Algebra',  score: 88, color: '#3D9AE8' },
  { name: 'Reading',  score: 74, color: '#6DB84B' },
  { name: 'Science',  score: 91, color: '#F5C534' },
  { name: 'History',  score: 67, color: '#f97316' },
];

const statusConfig = {
  completed:   { label: 'Done',        variant: 'success' as const },
  new:         { label: 'New',         variant: 'primary' as const },
  'in-progress': { label: 'In Progress', variant: 'warning' as const },
};

const DashboardPage: React.FC = () => {
  usePageMeta({
    title: 'Dashboard',
    description: 'Your Learnfyra dashboard — view completed worksheets, track scores, and start new practice sessions.',
    keywords: 'student dashboard, worksheet progress, learning tracker',
  });

  return (
    <AppLayout pageTitle="Dashboard">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">

        {/* ── Welcome banner ─────────────────────────────────────── */}
        <section
          aria-label="Welcome"
          className="relative rounded-2xl bg-primary overflow-hidden p-6 lg:p-8"
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-white">Good morning, Student!</h2>
              <p className="text-white/75 text-sm mt-1">
                You have <span className="text-white font-bold">3 worksheets</span> ready to solve.
              </p>
            </div>
            <Button variant="white" size="md" className="text-primary font-bold gap-2 shrink-0" asChild>
              <Link to="/worksheet/new">
                <Plus className="size-4" />
                New Worksheet
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <section aria-label="Statistics">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Your Stats
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl border border-border p-5 shadow-card"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${stat.color}18` }}
                  >
                    <Icon className="size-5" style={{ color: stat.color }} />
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Two-column: worksheets + subject progress ──────────── */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-6">

          {/* Recent worksheets */}
          <section aria-label="Recent worksheets">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                Recent Worksheets
              </h2>
              <Link
                to="/worksheet"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              {recentWorksheets.map((ws, i) => {
                const { label, variant } = statusConfig[ws.status];
                return (
                  <div
                    key={ws.id}
                    className={`flex items-center gap-4 px-5 py-4 ${i < recentWorksheets.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    {/* Subject icon */}
                    <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                      <BookOpen className="size-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{ws.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ws.subject} · Grade {ws.grade}
                      </p>
                    </div>

                    {/* Score / Status */}
                    <div className="flex items-center gap-3 shrink-0">
                      {ws.score !== null && (
                        <span className="text-sm font-extrabold text-secondary">
                          {ws.score}%
                        </span>
                      )}
                      <Badge variant={variant}>{label}</Badge>
                      <Link
                        to={`/worksheet/${ws.id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        {ws.status === 'completed' ? 'Review' : 'Start'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Subject progress */}
          <section aria-label="Subject progress">
            <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Subject Progress
            </h2>

            <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
              {subjectProgress.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{s.name}</span>
                    <span className="text-sm font-extrabold" style={{ color: s.color }}>
                      {s.score}%
                    </span>
                  </div>
                  <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.score}%`, background: s.color }}
                    />
                  </div>
                </div>
              ))}

              <Link
                to="/reports"
                className="flex items-center justify-center gap-2 mt-2 text-sm font-bold text-primary hover:underline"
              >
                <BarChart3 className="size-4" />
                View full report
              </Link>
            </div>
          </section>
        </div>

        {/* ── Quick action — generate new worksheet ──────────────── */}
        <section aria-label="Generate worksheet">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-foreground">Generate a New Worksheet</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pick a subject and topic — AI builds a custom worksheet in seconds.
              </p>
            </div>
            <Button variant="primary" size="md" className="gap-2 shrink-0" asChild>
              <Link to="/worksheet/new">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

      </div>
    </AppLayout>
  );
};

export default DashboardPage;

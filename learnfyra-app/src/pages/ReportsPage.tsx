/**
 * @file src/pages/ReportsPage.tsx
 * @description Performance reports — score history, subject breakdown, activity.
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
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';

// ── Mock data — replace with GET /api/reports ──────────────────────────────
const overallStats = [
  { label: 'Overall Score',  value: '82%', icon: BarChart3,  trend: +4,  color: '#3D9AE8' },
  { label: 'Total Time',     value: '15h', icon: Clock,      trend: null, color: '#6DB84B' },
  { label: 'Worksheets Done',value: '24',  icon: BookOpen,   trend: +3,  color: '#f97316' },
  { label: 'Badges Earned',  value: '7',   icon: Award,      trend: +1,  color: '#F5C534' },
];

const subjectBreakdown = [
  { subject: 'Math',          score: 88, worksheets: 10, trend: +5,  color: '#3D9AE8' },
  { subject: 'Science',       score: 91, worksheets: 6,  trend: +3,  color: '#6DB84B' },
  { subject: 'ELA',           score: 74, worksheets: 5,  trend: -2,  color: '#8b5cf6' },
  { subject: 'Social Studies',score: 67, worksheets: 3,  trend: +1,  color: '#f97316' },
];

const recentActivity = [
  { id: 'ws-001', title: 'Linear Equations',      subject: 'Math',    score: 90, date: 'Today',      status: 'completed' as const },
  { id: 'ws-002', title: 'Cell Biology Basics',   subject: 'Science', score: 80, date: 'Yesterday',  status: 'completed' as const },
  { id: 'ws-003', title: 'Figurative Language',   subject: 'ELA',     score: 70, date: '3 days ago', status: 'completed' as const },
  { id: 'ws-004', title: 'The Industrial Revolution',subject:'History',score: 85, date: 'Last week', status: 'completed' as const },
];

const weeklyBars = [65, 72, 85, 78, 90, 88, 92];
const weekDays   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ReportsPage: React.FC = () => {
  usePageMeta({
    title: 'Reports',
    description: 'View your Learnfyra performance reports — subject scores, progress trends, and worksheet history.',
    keywords: 'student reports, academic progress, worksheet scores, learning analytics',
  });

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
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    {s.trend !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                          s.trend >= 0 ? 'text-secondary' : 'text-destructive'
                        }`}
                      >
                        {s.trend >= 0
                          ? <TrendingUp className="size-3" />
                          : <TrendingDown className="size-3" />}
                        {s.trend >= 0 ? '+' : ''}{s.trend}
                      </span>
                    )}
                  </div>
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
            <div className="flex items-end gap-2 h-40">
              {weeklyBars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">{h}%</span>
                  <div
                    className="w-full rounded-t-lg bg-primary transition-all duration-500"
                    style={{ height: `${(h / 100) * 120}px`, opacity: 0.5 + (i / weeklyBars.length) * 0.5 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{weekDays[i]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Subject breakdown */}
          <section aria-label="Subject breakdown" className="bg-white rounded-2xl border border-border shadow-card p-6">
            <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-5">
              By Subject
            </h2>
            <div className="space-y-4">
              {subjectBreakdown.map((s) => (
                <div key={s.subject}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-semibold text-foreground">{s.subject}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold flex items-center gap-0.5 ${
                          s.trend >= 0 ? 'text-secondary' : 'text-destructive'
                        }`}
                      >
                        {s.trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {s.trend >= 0 ? '+' : ''}{s.trend}%
                      </span>
                      <span className="text-sm font-extrabold" style={{ color: s.color }}>
                        {s.score}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.score}%`, background: s.color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.worksheets} worksheets</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Recent activity ────────────────────────────────────── */}
        <section aria-label="Recent activity">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Recent Activity
          </h2>

          <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm" aria-label="Worksheet activity table">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Worksheet</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Subject</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">Date</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Score</th>
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`${i < recentActivity.length - 1 ? 'border-b border-border' : ''} hover:bg-surface transition-colors`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-foreground">{row.title}</td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{row.subject}</td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{row.date}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge variant={row.score >= 80 ? 'success' : row.score >= 60 ? 'warning' : 'destructive'}>
                        {row.score}%
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/worksheet/${row.id}`}
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
        </section>

      </div>
    </AppLayout>
  );
};

export default ReportsPage;

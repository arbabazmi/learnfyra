/**
 * @file src/pages/AchievementsPage.tsx
 * @description Achievements & gamification — badges, streaks, XP, and milestones.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  Flame,
  Zap,
  Award,
  Star,
  BookOpen,
  Timer,
  Target,
  Clock,
  Lock,
  ArrowRight,
  Calculator,
  FlaskConical,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  earned: boolean;
  earnedDate?: string;
  progress?: { current: number; total: number };
}

interface Milestone {
  id: string;
  label: string;
  detail: string;
  proximity: 'next' | 'soon' | 'later';
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const STREAK_DAYS = [
  { label: 'Mon', completed: true },
  { label: 'Tue', completed: true },
  { label: 'Wed', completed: true },
  { label: 'Thu', completed: true },
  { label: 'Fri', completed: true },
  { label: 'Sat', completed: true },
  { label: 'Sun', completed: false, isToday: true },
];

const summaryStats = [
  { label: 'Total XP',       value: '2,450', icon: Zap,   color: '#3D9AE8' },
  { label: 'Badges Earned',  value: '7/15',  icon: Award, color: '#F5C534' },
  { label: 'Longest Streak', value: '12 days',icon: Flame, color: '#f97316' },
  { label: 'Perfect Scores', value: '5',     icon: Star,  color: '#6DB84B' },
];

const badges: BadgeItem[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first worksheet.',
    icon: BookOpen,
    color: '#3D9AE8',
    earned: true,
    earnedDate: 'Mar 15',
  },
  {
    id: 'math-whiz',
    name: 'Math Whiz',
    description: 'Score 90%+ on 5 math worksheets.',
    icon: Calculator,
    color: '#3D9AE8',
    earned: true,
    earnedDate: 'Mar 20',
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete a timed worksheet under the time limit.',
    icon: Timer,
    color: '#F5C534',
    earned: true,
    earnedDate: 'Mar 22',
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Get 100% on any worksheet.',
    icon: Star,
    color: '#6DB84B',
    earned: true,
    earnedDate: 'Mar 25',
  },
  {
    id: 'science-explorer',
    name: 'Science Explorer',
    description: 'Complete 5 science worksheets.',
    icon: FlaskConical,
    color: '#6DB84B',
    earned: false,
    progress: { current: 3, total: 5 },
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    description: 'Complete 10 ELA worksheets.',
    icon: BookOpen,
    color: '#8b5cf6',
    earned: false,
    progress: { current: 2, total: 10 },
  },
  {
    id: 'streak-master',
    name: 'Streak Master',
    description: 'Maintain a 30-day streak.',
    icon: Flame,
    color: '#f97316',
    earned: false,
    progress: { current: 7, total: 30 },
  },
  {
    id: 'all-rounder',
    name: 'All-Rounder',
    description: 'Complete worksheets in all 5 subjects.',
    icon: Target,
    color: '#3D9AE8',
    earned: false,
    progress: { current: 3, total: 5 },
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Complete 100 worksheets.',
    icon: Award,
    color: '#F5C534',
    earned: false,
    progress: { current: 24, total: 100 },
  },
  {
    id: 'study-marathon',
    name: 'Study Marathon',
    description: 'Accumulate 50 hours of study time.',
    icon: Clock,
    color: '#6DB84B',
    earned: false,
    progress: { current: 15, total: 50 },
  },
];

const milestones: Milestone[] = [
  {
    id: 'ms-1',
    label: 'Complete 25 worksheets',
    detail: '1 away!',
    proximity: 'next',
  },
  {
    id: 'ms-2',
    label: 'Reach 3,000 XP',
    detail: '550 XP away',
    proximity: 'soon',
  },
  {
    id: 'ms-3',
    label: 'Earn all Math badges',
    detail: '2 badges remaining',
    proximity: 'later',
  },
];

// ── Proximity config ───────────────────────────────────────────────────────────

const proximityConfig: Record<Milestone['proximity'], { badgeVariant: 'success' | 'warning' | 'muted'; dotColor: string }> = {
  next:  { badgeVariant: 'success',  dotColor: '#6DB84B' },
  soon:  { badgeVariant: 'warning',  dotColor: '#F5C534' },
  later: { badgeVariant: 'muted',    dotColor: '#94a3b8' },
};

// ── Component ──────────────────────────────────────────────────────────────────

const AchievementsPage: React.FC = () => {
  usePageMeta({
    title: 'Achievements',
    description: 'Track your Learnfyra achievements — badges, XP, streaks, and upcoming milestones.',
    keywords: 'student achievements, badges, learning streak, XP, gamification',
  });

  return (
    <AppLayout pageTitle="Achievements">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">

        {/* ── Streak banner ───────────────────────────────────────── */}
        <section
          aria-label="Current streak"
          className="relative rounded-2xl bg-primary overflow-hidden p-6 lg:p-8"
        >
          {/* Dot-grid texture */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

            {/* Left: heading */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <Flame className="size-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">7 Day Streak!</h2>
                <p className="text-white/75 text-sm mt-1">
                  Keep it up! Complete a worksheet today to continue your streak.
                </p>
              </div>
            </div>

            {/* Center: day indicators */}
            <div className="flex items-center gap-2" aria-label="Streak days">
              {STREAK_DAYS.map((day) => (
                <div key={day.label} className="flex flex-col items-center gap-1.5">
                  <div
                    className={[
                      'w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold transition-all',
                      day.completed
                        ? 'bg-white text-primary'
                        : day.isToday
                          ? 'bg-transparent border-2 border-white/60 text-white ring-2 ring-white/30 ring-offset-2 ring-offset-primary'
                          : 'bg-white/15 text-white/50',
                    ].join(' ')}
                    aria-label={`${day.label}${day.completed ? ' — completed' : day.isToday ? ' — today' : ''}`}
                  >
                    {day.completed ? (
                      <Flame className="size-4 text-[#f97316]" />
                    ) : (
                      <span>{day.label.charAt(0)}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-white/60">{day.label}</span>
                </div>
              ))}
            </div>

            {/* Right: CTA */}
            <Button variant="white" size="md" className="text-primary font-bold gap-2 shrink-0" asChild>
              <Link to="/worksheet/new">
                Continue Streak
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Summary stats ────────────────────────────────────────── */}
        <section aria-label="Achievement statistics">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Your Stats
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryStats.map((stat) => {
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

        {/* ── Badges grid ──────────────────────────────────────────── */}
        <section aria-label="Badges">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
              Badges
            </h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {badges.filter((b) => b.earned).length} / {badges.length} earned
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge) => {
              const Icon = badge.icon;
              const progressPct = badge.progress
                ? Math.round((badge.progress.current / badge.progress.total) * 100)
                : 0;

              return (
                <div
                  key={badge.id}
                  className={[
                    'bg-white rounded-2xl border shadow-card p-5 flex items-start gap-4 transition-all duration-200',
                    badge.earned
                      ? 'border-border hover:shadow-md hover:-translate-y-0.5'
                      : 'border-border opacity-75',
                  ].join(' ')}
                >
                  {/* Icon circle */}
                  <div className="relative shrink-0">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{
                        background: badge.earned ? `${badge.color}18` : '#f1f5f9',
                      }}
                    >
                      <Icon
                        className="size-7"
                        style={{ color: badge.earned ? badge.color : '#94a3b8' }}
                      />
                    </div>
                    {/* Lock overlay for unearned */}
                    {!badge.earned && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted border-2 border-white flex items-center justify-center">
                        <Lock className="size-3 text-muted-foreground" />
                      </div>
                    )}
                    {/* Earned star accent */}
                    {badge.earned && (
                      <div
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
                        style={{ background: badge.color }}
                      >
                        <Star className="size-3 text-white fill-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-extrabold text-foreground leading-tight">{badge.name}</p>
                      {badge.earned && (
                        <Badge variant="success" className="shrink-0 text-[10px] px-2">
                          Earned
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {badge.description}
                    </p>

                    {/* Earned date */}
                    {badge.earned && badge.earnedDate && (
                      <p className="text-[11px] font-semibold text-muted-foreground mt-2">
                        {badge.earnedDate}
                      </p>
                    )}

                    {/* Progress bar for unearned */}
                    {!badge.earned && badge.progress && (
                      <div className="mt-2.5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {badge.progress.current} / {badge.progress.total}
                          </span>
                          <span className="text-[11px] font-bold" style={{ color: badge.color }}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${progressPct}%`, background: badge.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Milestones ───────────────────────────────────────────── */}
        <section aria-label="Upcoming milestones">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Upcoming Milestones
          </h2>

          <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
            {milestones.map((ms, i) => {
              const config = proximityConfig[ms.proximity];
              return (
                <div
                  key={ms.id}
                  className={[
                    'flex items-center gap-4 px-5 py-4',
                    i < milestones.length - 1 ? 'border-b border-border' : '',
                  ].join(' ')}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center shrink-0" aria-hidden="true">
                    <div
                      className="w-3 h-3 rounded-full ring-4 ring-offset-0"
                      style={{
                        background: config.dotColor,
                        boxShadow: `0 0 0 4px ${config.dotColor}22`,
                      }}
                    />
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: '100%' }} />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{ms.label}</p>
                  </div>

                  {/* Detail badge */}
                  <Badge variant={config.badgeVariant} className="shrink-0">
                    {ms.detail}
                  </Badge>
                </div>
              );
            })}

            {/* Footer CTA */}
            <div className="px-5 py-4 bg-surface border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Complete more worksheets to unlock milestones faster.
              </p>
              <Button variant="primary" size="sm" className="gap-1.5 shrink-0" asChild>
                <Link to="/worksheet/new">
                  Practice Now
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  );
};

export default AchievementsPage;

/**
 * @file src/pages/AchievementsPage.tsx
 * @description Achievements & gamification — badges, streaks, XP, and certificates.
 *
 * Data sources:
 *   GET /api/rewards/student/:userId  — lifetimePoints, currentStreak, longestStreak, badges[]
 *   GET /api/certificates             — certificates[], total
 *
 * Guests (no token) see a sign-in prompt instead of personal data.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  Flame,
  Zap,
  Award,
  Star,
  BookOpen,
  Lock,
  ArrowRight,
  TrendingUp,
  Rocket,
  Dumbbell,
  LogIn,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { getToken } from '@/lib/auth';
import { apiUrl } from '@/lib/env';

// ── Badge catalog (mirrors src/rewards/badgeDefinitions.js) ───────────────────
// Kept client-side so the UI doesn't need an extra API call for static defs.

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const BADGE_CATALOG: BadgeDef[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first worksheet.',
    icon: BookOpen,
    color: '#3D9AE8',
  },
  {
    id: 'dedicated-learner',
    name: 'Dedicated Learner',
    description: 'Complete 10 worksheets.',
    icon: BookOpen,
    color: '#3D9AE8',
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak.',
    icon: Flame,
    color: '#f97316',
  },
  {
    id: 'silver-star',
    name: 'Silver Star',
    description: 'Score 80%+ on 3 worksheets in the same topic.',
    icon: Star,
    color: '#94a3b8',
  },
  {
    id: 'gold-star',
    name: 'Gold Star',
    description: 'Score 90%+ on 5 worksheets in the same topic.',
    icon: Star,
    color: '#F5C534',
  },
  {
    id: 'platinum-star',
    name: 'Platinum Star',
    description: 'Score 95%+ on 10 worksheets in the same topic.',
    icon: Star,
    color: '#8b5cf6',
  },
  {
    id: 'perfect10',
    name: 'Perfect10',
    description: 'Earn 10 perfect scores (100%) in any subject.',
    icon: Award,
    color: '#6DB84B',
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    description: 'Improve your score by 20%+ on a retake.',
    icon: TrendingUp,
    color: '#3D9AE8',
  },
  {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    description: 'Score 90%+ after a previous score below 70%.',
    icon: Rocket,
    color: '#f97316',
  },
  {
    id: 'persistent-learner',
    name: 'Persistent Learner',
    description: 'Attempt the same worksheet 3 or more times.',
    icon: Dumbbell,
    color: '#6DB84B',
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface RewardsProfile {
  studentId: string;
  lifetimePoints: number;
  monthlyPoints: number;
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  badges: string[];
  topicStats: Record<string, unknown>;
}

interface Certificate {
  certificateId: string;
  subject: string;
  topic: string;
  grade: number;
  score: number;
  totalPoints: number;
  percentage: number;
  issuedAt: string;
}

interface AchievementsData {
  rewards: RewardsProfile | null;
  certificates: Certificate[];
  certificateTotal: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds a 7-element week array where the last `streak` days (capped at 7)
 * are marked completed, with today always being the rightmost day.
 */
function buildStreakWeek(currentStreak: number): { label: string; completed: boolean; isToday: boolean }[] {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayIndex = new Date().getDay(); // 0=Sun…6=Sat

  return Array.from({ length: 7 }, (_, i) => {
    const dayIndex = (todayIndex - 6 + i + 7) % 7;
    const daysAgo = 6 - i; // i=0 is 6 days ago, i=6 is today
    const isToday = i === 6;
    const completed = daysAgo < currentStreak;
    return {
      label: DAY_LABELS[dayIndex],
      completed,
      isToday,
    };
  });
}

/**
 * Formats a date string as "Mar 15" style.
 */
function formatBadgeDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

const StatSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-border p-5 shadow-card animate-pulse">
    <div className="w-10 h-10 rounded-xl bg-surface-2 mb-3" />
    <div className="h-7 w-16 bg-surface-2 rounded mb-1" />
    <div className="h-3 w-20 bg-surface-2 rounded" />
  </div>
);

const BadgeSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-border shadow-card p-5 flex items-start gap-4 animate-pulse">
    <div className="w-16 h-16 rounded-full bg-surface-2 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-28 bg-surface-2 rounded" />
      <div className="h-3 w-40 bg-surface-2 rounded" />
    </div>
  </div>
);

// ── Guest prompt ───────────────────────────────────────────────────────────────

const GuestPrompt: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
      <Award className="size-8 text-primary" />
    </div>
    <h2 className="text-xl font-extrabold text-foreground">Track Your Achievements</h2>
    <p className="text-sm text-muted-foreground max-w-sm">
      Sign in to see your badges, streaks, XP, and certificates earned from completed worksheets.
    </p>
    <Button variant="primary" size="md" className="gap-2 mt-2" asChild>
      <Link to="/">
        <LogIn className="size-4" />
        Sign In to View Achievements
      </Link>
    </Button>
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────────

const AchievementsPage: React.FC = () => {
  usePageMeta({
    title: 'Achievements',
    description: 'Track your Learnfyra achievements — badges, XP, streaks, and upcoming milestones.',
    keywords: 'student achievements, badges, learning streak, XP, gamification',
  });

  const auth = useAuth();
  const token = getToken();

  const [data, setData] = React.useState<AchievementsData>({
    rewards: null,
    certificates: [],
    certificateTotal: 0,
  });
  const [isLoading, setIsLoading] = React.useState(!auth.isGuest);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (auth.isGuest || !auth.user || !token) return;

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    Promise.all([
      fetch(`${apiUrl}/api/rewards/student/${auth.user.userId}`, {
        headers,
        signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiUrl}/api/certificates`, {
        headers,
        signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([rewardsJson, certsJson]) => {
        if (!isMounted) return;
        setData({
          rewards: rewardsJson ?? null,
          certificates: Array.isArray(certsJson?.certificates) ? certsJson.certificates : [],
          certificateTotal: certsJson?.total ?? 0,
        });
      })
      .catch((err: unknown) => {
        if (!isMounted || (err instanceof Error && err.name === 'AbortError')) return;
        setError('Failed to load achievements. Please try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [auth.isGuest, auth.user, token]);

  // ── Guest view ───────────────────────────────────────────────────────────────

  if (auth.isGuest) {
    return (
      <AppLayout pageTitle="Achievements">
        <GuestPrompt />
      </AppLayout>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────────

  const rewards = data.rewards;
  const earnedBadgeIds = new Set(rewards?.badges ?? []);
  const currentStreak = rewards?.currentStreak ?? 0;
  const longestStreak = rewards?.longestStreak ?? 0;
  const lifetimePoints = rewards?.lifetimePoints ?? 0;
  const streakWeek = buildStreakWeek(currentStreak);

  const summaryStats = [
    {
      label: 'Total XP',
      value: isLoading ? '—' : lifetimePoints.toLocaleString(),
      icon: Zap,
      color: '#3D9AE8',
    },
    {
      label: 'Badges Earned',
      value: isLoading ? '—' : `${earnedBadgeIds.size}/${BADGE_CATALOG.length}`,
      icon: Award,
      color: '#F5C534',
    },
    {
      label: 'Longest Streak',
      value: isLoading ? '—' : `${longestStreak} day${longestStreak !== 1 ? 's' : ''}`,
      icon: Flame,
      color: '#f97316',
    },
    {
      label: 'Certificates',
      value: isLoading ? '—' : String(data.certificateTotal),
      icon: Star,
      color: '#6DB84B',
    },
  ];

  // Merge catalog with earned state
  const badgeItems = BADGE_CATALOG.map((def) => ({
    ...def,
    earned: earnedBadgeIds.has(def.id),
    // earnedDate not available from current API — omitted
  }));

  return (
    <AppLayout pageTitle="Achievements">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

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
                {isLoading ? (
                  <div className="h-6 w-40 bg-white/20 rounded animate-pulse" />
                ) : (
                  <h2 className="text-xl font-extrabold text-white">
                    {currentStreak > 0
                      ? `${currentStreak} Day Streak!`
                      : 'Start Your Streak!'}
                  </h2>
                )}
                <p className="text-white/75 text-sm mt-1">
                  {currentStreak > 0
                    ? 'Keep it up! Complete a worksheet today to continue your streak.'
                    : 'Complete a worksheet today to start your streak.'}
                </p>
              </div>
            </div>

            {/* Center: day indicators */}
            <div className="flex items-center gap-2" aria-label="Streak days">
              {streakWeek.map((day) => (
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
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
              : summaryStats.map((stat) => {
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
            {!isLoading && (
              <span className="text-xs font-semibold text-muted-foreground">
                {earnedBadgeIds.size} / {BADGE_CATALOG.length} earned
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <BadgeSkeleton key={i} />)}
            </div>
          ) : earnedBadgeIds.size === 0 && !error ? (
            <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center">
              <Award className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No badges earned yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete worksheets to start earning badges.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {badgeItems.map((badge) => {
                const Icon = badge.icon;

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
                        <p className="text-sm font-extrabold text-foreground leading-tight">
                          {badge.name}
                        </p>
                        {badge.earned && (
                          <Badge variant="success" className="shrink-0 text-[10px] px-2">
                            Earned
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Certificates ─────────────────────────────────────────── */}
        <section aria-label="Certificates">
          <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Certificates
          </h2>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 bg-surface-2 rounded" />
                    <div className="h-2.5 w-24 bg-surface-2 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-surface-2 rounded-full" />
                </div>
              ))}
            </div>
          ) : data.certificates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center">
              <Award className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No certificates yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete worksheets with a passing score to earn certificates.
              </p>
              <Button variant="primary" size="sm" className="gap-1.5 mt-4" asChild>
                <Link to="/worksheet/new">
                  Start a Worksheet
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              {data.certificates.slice(0, 10).map((cert, i) => (
                <div
                  key={cert.certificateId}
                  className={[
                    'flex items-center gap-4 px-5 py-4',
                    i < data.certificates.slice(0, 10).length - 1 ? 'border-b border-border' : '',
                  ].join(' ')}
                >
                  {/* Subject icon area */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#3D9AE818' }}
                  >
                    <Award className="size-5" style={{ color: '#3D9AE8' }} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {cert.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cert.subject} · Grade {cert.grade} · {formatBadgeDate(cert.issuedAt)}
                    </p>
                  </div>

                  {/* Score badge */}
                  <Badge
                    variant={cert.percentage >= 90 ? 'success' : cert.percentage >= 70 ? 'warning' : 'muted'}
                    className="shrink-0"
                  >
                    {cert.percentage}%
                  </Badge>
                </div>
              ))}

              {/* Footer */}
              {data.certificateTotal > 10 && (
                <div className="px-5 py-3 bg-surface border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Showing 10 of {data.certificateTotal} certificates
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Practice CTA ─────────────────────────────────────────── */}
        <section
          aria-label="Keep practicing"
          className="bg-white rounded-2xl border border-border shadow-card px-5 py-4 flex items-center justify-between gap-4"
        >
          <p className="text-xs text-muted-foreground">
            Complete more worksheets to earn badges and certificates.
          </p>
          <Button variant="primary" size="sm" className="gap-1.5 shrink-0" asChild>
            <Link to="/worksheet/new">
              Practice Now
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </section>

      </div>
    </AppLayout>
  );
};

export default AchievementsPage;

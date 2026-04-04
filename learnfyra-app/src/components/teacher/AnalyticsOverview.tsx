/**
 * @file src/components/teacher/AnalyticsOverview.tsx
 * @description Summary cards for class analytics — completion rate,
 * weakest topics, and students below accuracy threshold.
 */

import * as React from 'react';
import { TrendingDown, Users, Target, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useTeacher } from '@/contexts/TeacherContext';

// ── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sublabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sublabel,
}) => (
  <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-3">
    <div className="flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
    </div>
    <p className="text-3xl font-extrabold text-foreground tabular-nums">
      {value}
    </p>
    {sublabel && (
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    )}
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────

const AnalyticsOverviewComponent: React.FC = () => {
  const { analytics, loadingAnalytics, errorAnalytics, fetchAnalytics } =
    useTeacher();

  React.useEffect(() => {
    void fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingAnalytics) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (errorAnalytics) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {errorAnalytics}
      </div>
    );
  }

  if (!analytics) return null;

  const completionPct = Math.round(analytics.overallCompletionRate * 100);
  const belowCount = analytics.studentsBelowThreshold.length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard
          label="Completion Rate"
          value={`${completionPct}%`}
          icon={Target}
          iconBg="bg-primary-light"
          iconColor="text-primary"
          sublabel={`${analytics.assignmentBreakdown.active} active · ${analytics.assignmentBreakdown.closed} closed`}
        />
        <StatCard
          label="Students Below Threshold"
          value={belowCount}
          icon={Users}
          iconBg="bg-destructive/10"
          iconColor="text-destructive"
          sublabel={`Threshold: ${analytics.accuracyThreshold}% accuracy`}
        />
        <StatCard
          label="Weakest Topics"
          value={analytics.weakestTopics.length}
          icon={TrendingDown}
          iconBg="bg-accent-light"
          iconColor="text-amber-600"
          sublabel="Topics needing attention"
        />
      </div>

      {/* Weakest topics */}
      {analytics.weakestTopics.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
          <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            Weakest Topics
          </h4>
          <ul className="space-y-2" aria-label="Weakest topics list">
            {analytics.weakestTopics.map((t) => (
              <li
                key={t.topic}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.attemptCount} attempt{t.attemptCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <Badge
                  variant={
                    t.averageAccuracy < 50 ? 'destructive' : 'warning'
                  }
                >
                  {Math.round(t.averageAccuracy)}% avg
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Students below threshold */}
      {analytics.studentsBelowThreshold.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
          <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
            Students Below {analytics.accuracyThreshold}% Threshold
          </h4>
          <ul
            className="space-y-2"
            aria-label="Students below accuracy threshold"
          >
            {analytics.studentsBelowThreshold.map((s) => (
              <li
                key={s.studentId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {s.displayName}
                </p>
                <Badge variant="destructive">
                  {Math.round(s.overallAccuracy)}% accuracy
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export { AnalyticsOverviewComponent as AnalyticsOverview };

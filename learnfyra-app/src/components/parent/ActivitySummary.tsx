/**
 * @file src/components/parent/ActivitySummary.tsx
 * @description 7-day and 30-day activity summary cards for the selected child.
 */

import * as React from 'react';
import { BookOpen, Clock, Star, Loader2 } from 'lucide-react';
import { useParent } from '@/contexts/ParentContext';
import type { ActivityWindow } from '@/types/parent';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// ── Activity card ──────────────────────────────────────────────────────────

interface ActivityCardProps {
  title: string;
  window: ActivityWindow;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ title, window: w }) => (
  <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
    <h4 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
      {title}
    </h4>

    <div className="grid grid-cols-3 gap-3">
      {/* Worksheets attempted */}
      <div className="space-y-1">
        <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
          <BookOpen className="size-4 text-primary" />
        </div>
        <p className="text-2xl font-extrabold text-foreground tabular-nums">
          {w.worksheetsAttempted}
        </p>
        <p className="text-xs text-muted-foreground">Worksheets</p>
      </div>

      {/* Average score */}
      <div className="space-y-1">
        <div className="w-9 h-9 rounded-xl bg-success-light flex items-center justify-center">
          <Star className="size-4 text-secondary" />
        </div>
        <p className="text-2xl font-extrabold text-foreground tabular-nums">
          {w.averageScore !== null
            ? `${Math.round(w.averageScore)}%`
            : '—'}
        </p>
        <p className="text-xs text-muted-foreground">Avg Score</p>
      </div>

      {/* Time spent */}
      <div className="space-y-1">
        <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center">
          <Clock className="size-4 text-amber-600" />
        </div>
        <p className="text-2xl font-extrabold text-foreground tabular-nums">
          {formatTime(w.totalTimeSpentSeconds)}
        </p>
        <p className="text-xs text-muted-foreground">Time Spent</p>
      </div>
    </div>
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────

const ActivitySummary: React.FC = () => {
  const { childProgress, loadingProgress, fetchChildProgress } = useParent();

  React.useEffect(() => {
    void fetchChildProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingProgress) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!childProgress) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No activity data yet.
      </p>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <ActivityCard title="Last 7 Days" window={childProgress.last7Days} />
      <ActivityCard title="Last 30 Days" window={childProgress.last30Days} />
    </div>
  );
};

export { ActivitySummary };

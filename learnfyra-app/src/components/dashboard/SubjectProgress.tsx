/**
 * @file src/components/dashboard/SubjectProgress.tsx
 * @description Displays per-subject progress bars with score percentages.
 *   Links to the full reports page. Shows animated skeleton bars while loading.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { BarChart3 } from 'lucide-react';
import { type SubjectProgress } from '@/types/dashboard';

export interface SubjectProgressProps {
  /** Array of subject progress entries to render. */
  progress: SubjectProgress[];
  /** When true, render skeleton placeholders instead of real data. */
  isLoading: boolean;
}

/**
 * Renders a "SUBJECT PROGRESS" card with one progress bar per subject.
 * Each bar fills to the subject's score percentage with a 700ms CSS transition.
 *
 * @param {SubjectProgressProps} props
 * @returns {React.ReactElement}
 */
const SubjectProgress: React.FC<SubjectProgressProps> = ({ progress, isLoading }) => {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5 space-y-4">
      {/* Section header */}
      <p className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
        Subject Progress
      </p>

      {/* Progress rows */}
      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-surface-2 rounded-md" />
                  <div className="h-4 w-10 bg-surface-2 rounded-md" />
                </div>
                <div className="h-2 w-full bg-surface-2 rounded-full" />
              </div>
            ))
          : progress.map((item) => (
              <div key={item.subject} className="space-y-1.5">
                {/* Name + score row */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-foreground">
                    {item.subject}
                  </span>
                  <span
                    className="text-sm font-extrabold"
                    style={{ color: item.color }}
                  >
                    {item.score}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.score))}%`,
                      backgroundColor: item.color,
                    }}
                    role="progressbar"
                    aria-valuenow={item.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.subject} progress: ${item.score}%`}
                  />
                </div>
              </div>
            ))}
      </div>

      {/* Footer link */}
      <Link
        to="/reports"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover transition-colors"
      >
        <BarChart3 className="size-4" aria-hidden="true" />
        View full report
      </Link>
    </div>
  );
};

SubjectProgress.displayName = 'SubjectProgress';

export { SubjectProgress };

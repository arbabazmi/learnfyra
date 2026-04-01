/**
 * @file src/components/dashboard/RecentWorksheets.tsx
 * @description Section listing the user's most recent worksheets with status
 *              badges and action links. Shows pulse skeleton rows while loading.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { DashboardWorksheet, WorksheetStatus } from '@/types/dashboard';

export interface RecentWorksheetsProps {
  worksheets: DashboardWorksheet[];
  isGuest: boolean;
  isLoading: boolean;
}

interface StatusConfig {
  label: string;
  variant: 'success' | 'primary' | 'warning';
  action: string;
}

const STATUS_CONFIG: Record<WorksheetStatus, StatusConfig> = {
  completed:   { label: 'Done',        variant: 'success',  action: 'Review' },
  new:         { label: 'New',         variant: 'primary',  action: 'Start'  },
  'in-progress': { label: 'In Progress', variant: 'warning',  action: 'Start'  },
};

/** Number of skeleton rows to show while loading. */
const SKELETON_COUNT = 4;

/**
 * Renders the "Recent Worksheets" card section with a section header,
 * a "View all" link, and a bordered list of worksheet rows.
 *
 * @param {RecentWorksheetsProps} props
 * @returns {React.ReactElement}
 */
const RecentWorksheets: React.FC<RecentWorksheetsProps> = ({
  worksheets,
  isLoading,
}) => {
  return (
    <section aria-label="Recent worksheets">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
          Recent Worksheets
        </h2>
        <Link
          to="/worksheet"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Card container */}
      <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        {isLoading ? (
          // Skeleton rows
          Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-4${i < SKELETON_COUNT - 1 ? ' border-b border-border' : ''}`}
              aria-busy="true"
              aria-label="Loading worksheet"
            >
              {/* Icon skeleton */}
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
              {/* Text skeleton */}
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
              {/* Right skeleton */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                <div className="h-3.5 w-10 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          worksheets.map((ws, i) => {
            const { label, variant, action } = STATUS_CONFIG[ws.status];
            const isLast = i === worksheets.length - 1;

            return (
              <div
                key={ws.id}
                className={`flex items-center gap-4 px-5 py-4${!isLast ? ' border-b border-border' : ''}`}
              >
                {/* Subject icon */}
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                  <BookOpen className="size-5 text-primary" aria-hidden="true" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{ws.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ws.subject} &middot; Grade {ws.grade}
                  </p>
                </div>

                {/* Score / Status / Action */}
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
                    aria-label={`${action} ${ws.title}`}
                  >
                    {action}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

RecentWorksheets.displayName = 'RecentWorksheets';

export { RecentWorksheets };

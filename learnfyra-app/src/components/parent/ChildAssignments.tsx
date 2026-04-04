/**
 * @file src/components/parent/ChildAssignments.tsx
 * @description Assignment status list for the selected child —
 * shows class, due date, status, and score.
 */

import * as React from 'react';
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useParent } from '@/contexts/ParentContext';
import type { ChildAssignmentStatus } from '@/types/parent';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusConfig(status: ChildAssignmentStatus): {
  label: string;
  icon: React.ElementType;
  variant: 'success' | 'primary' | 'warning' | 'destructive' | 'muted';
} {
  switch (status) {
    case 'submitted':
      return { label: 'Submitted', icon: CheckCircle, variant: 'success' };
    case 'in-progress':
      return { label: 'In Progress', icon: Clock, variant: 'primary' };
    case 'overdue':
      return { label: 'Overdue', icon: AlertCircle, variant: 'destructive' };
    default:
      return { label: 'Not Started', icon: Clock, variant: 'muted' };
  }
}

// ── Component ──────────────────────────────────────────────────────────────

const ChildAssignments: React.FC = () => {
  const {
    childAssignments,
    loadingAssignments,
    errorAssignments,
    fetchChildAssignments,
  } = useParent();

  React.useEffect(() => {
    void fetchChildAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingAssignments) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (errorAssignments) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {errorAssignments}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
        Assignments ({childAssignments.length})
      </h3>

      {childAssignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No assignments have been given yet.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm" aria-label="Child assignments">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Assignment
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                  Due
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {childAssignments.map((a) => {
                const cfg = statusConfig(a.status);
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={a.assignmentId}
                    className="bg-white hover:bg-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {a.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      <p className="font-medium">{a.className}</p>
                      <p className="text-xs">{a.teacherName}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {a.dueDate ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5 shrink-0" />
                          {formatDate(a.dueDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>
                        <StatusIcon className="size-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {a.score !== null ? (
                        <span className="font-bold text-foreground">
                          {a.score}/{a.totalPoints}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export { ChildAssignments };

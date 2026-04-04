/**
 * @file src/components/teacher/AssignmentList.tsx
 * @description Table of assignments for the selected class with
 * status badges and close/view actions.
 */

import * as React from 'react';
import { XCircle, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import * as teacherService from '@/services/api/teacherService';
import { useTeacher } from '@/contexts/TeacherContext';
import type { Assignment, AssignmentStatus } from '@/types/teacher';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusConfig(status: AssignmentStatus): {
  label: string;
  icon: React.ElementType;
  variant: 'success' | 'warning' | 'muted';
} {
  switch (status) {
    case 'active':
      return { label: 'Active', icon: CheckCircle, variant: 'success' };
    case 'closed':
      return { label: 'Closed', icon: XCircle, variant: 'muted' };
    default:
      return { label: 'Archived', icon: AlertCircle, variant: 'muted' };
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface AssignmentListProps {
  onCreateClick: () => void;
}

const AssignmentList: React.FC<AssignmentListProps> = ({ onCreateClick }) => {
  const { assignments, loadingAssignments, errorAssignments, fetchAssignments } =
    useTeacher();
  const [closingId, setClosingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = async (assignment: Assignment) => {
    if (assignment.status !== 'active') return;
    setClosingId(assignment.assignmentId);
    try {
      await teacherService.closeAssignment(assignment.assignmentId);
      await fetchAssignments();
    } catch {
      // Error is surfaced via fetchAssignments' errorAssignments
    } finally {
      setClosingId(null);
    }
  };

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
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
          Assignments
        </h3>
        <Button variant="primary" size="sm" onClick={onCreateClick}>
          + New Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            No assignments yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Create an assignment to get students working.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table
            className="w-full text-sm"
            aria-label="Assignments table"
          >
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                  Mode
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assignments.map((a) => {
                const cfg = statusConfig(a.status);
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={a.assignmentId}
                    className="bg-white hover:bg-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {a.title}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
                          a.mode === 'test'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-primary-light text-primary',
                        )}
                      >
                        {a.mode}
                      </span>
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
                    <td className="px-4 py-3 text-right">
                      {a.status === 'active' && (
                        <button
                          type="button"
                          disabled={closingId === a.assignmentId}
                          onClick={() => handleClose(a)}
                          aria-label={`Close assignment ${a.title}`}
                          className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                        >
                          {closingId === a.assignmentId
                            ? 'Closing...'
                            : 'Close'}
                        </button>
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

export { AssignmentList };

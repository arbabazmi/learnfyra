/**
 * @file src/components/teacher/StudentRoster.tsx
 * @description Student roster table for the selected class — shows activity summary,
 * accuracy, and per-student actions (remove, generate parent invite).
 */

import * as React from 'react';
import {
  UserMinus,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InviteCodeDisplay } from '@/components/shared/InviteCodeDisplay';
import * as teacherService from '@/services/api/teacherService';
import { useTeacher } from '@/contexts/TeacherContext';
import type { StudentRosterEntry } from '@/types/teacher';

// ── Parent invite modal ────────────────────────────────────────────────────

interface ParentInviteModalProps {
  student: StudentRosterEntry;
  classId: string;
  onClose: () => void;
}

const ParentInviteModal: React.FC<ParentInviteModalProps> = ({
  student,
  classId,
  onClose,
}) => {
  const [inviteCode, setInviteCode] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    teacherService
      .generateParentInvite(classId, student.studentId)
      .then(({ inviteCode: code, expiresAt: exp }) => {
        if (!mounted) return;
        setInviteCode(code);
        setExpiresAt(exp);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to generate code.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [classId, student.studentId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-invite-title"
    >
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3
          id="parent-invite-title"
          className="text-lg font-extrabold text-foreground"
        >
          Parent Invite — {student.displayName}
        </h3>
        <p className="text-sm text-muted-foreground">
          Share this code with the parent. It can only be used once.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive font-semibold">{error}</p>
        )}
        {inviteCode && (
          <InviteCodeDisplay
            code={inviteCode}
            expiresAt={expiresAt}
            label="Invite Code"
          />
        )}

        <Button
          variant="ghost"
          size="md"
          className="w-full"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────

const StudentRoster: React.FC = () => {
  const { currentClassId } = useTeacher();
  const [students, setStudents] = React.useState<StudentRosterEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [inviteStudent, setInviteStudent] =
    React.useState<StudentRosterEntry | null>(null);

  const load = React.useCallback(async () => {
    if (!currentClassId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teacherService.getStudents(currentClassId);
      setStudents(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load students.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentClassId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async (student: StudentRosterEntry) => {
    if (!currentClassId) return;
    if (
      !window.confirm(
        `Remove ${student.displayName} from this class? This cannot be undone.`,
      )
    )
      return;
    setRemovingId(student.studentId);
    try {
      await teacherService.removeStudent(currentClassId, student.studentId);
      await load();
    } catch {
      // Silently fail — the row will remain
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
          Students ({students.length})
        </h3>

        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No students have joined yet. Share the class invite code.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm" aria-label="Student roster">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                    Accuracy
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr
                    key={s.studentId}
                    className="bg-white hover:bg-surface transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">
                        {s.displayName}
                      </p>
                      {s.status === 'removed' && (
                        <Badge variant="muted" className="mt-0.5">
                          Removed
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {s.assignmentsSummary.submitted} /{' '}
                      {s.assignmentsSummary.total}
                      {s.assignmentsSummary.overdue > 0 && (
                        <span className="ml-2 text-destructive text-xs font-semibold">
                          ({s.assignmentsSummary.overdue} overdue)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {s.overallAccuracy !== null ? (
                        <Badge
                          variant={
                            s.overallAccuracy >= 80
                              ? 'success'
                              : s.overallAccuracy >= 60
                              ? 'warning'
                              : 'destructive'
                          }
                        >
                          {Math.round(s.overallAccuracy)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setInviteStudent(s)}
                          aria-label={`Generate parent invite for ${s.displayName}`}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary-light transition-colors"
                          title="Generate parent invite code"
                        >
                          <LinkIcon className="size-4" />
                        </button>
                        {s.status === 'active' && (
                          <button
                            type="button"
                            disabled={removingId === s.studentId}
                            onClick={() => handleRemove(s)}
                            aria-label={`Remove ${s.displayName} from class`}
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Remove student"
                          >
                            <UserMinus className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parent invite modal */}
      {inviteStudent && currentClassId && (
        <ParentInviteModal
          student={inviteStudent}
          classId={currentClassId}
          onClose={() => setInviteStudent(null)}
        />
      )}
    </>
  );
};

export { StudentRoster };

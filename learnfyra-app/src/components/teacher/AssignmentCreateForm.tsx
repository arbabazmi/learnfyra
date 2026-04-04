/**
 * @file src/components/teacher/AssignmentCreateForm.tsx
 * @description Form for creating a new assignment — includes mode, retake policy,
 * time limit, due date, open/close window, and worksheet selection.
 */

import * as React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import * as teacherService from '@/services/api/teacherService';
import { useTeacher } from '@/contexts/TeacherContext';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import type { AssignmentMode, RetakePolicy } from '@/types/teacher';

interface WorksheetOption {
  worksheetId: string;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  difficulty: string;
  questionCount: number;
}

const selectClass =
  'w-full h-11 pl-4 pr-9 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer';

const inputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

interface AssignmentCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AssignmentCreateForm: React.FC<AssignmentCreateFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { currentClassId, fetchAssignments } = useTeacher();

  const [worksheetId, setWorksheetId] = React.useState('');
  const [worksheets, setWorksheets] = React.useState<WorksheetOption[]>([]);
  const [loadingWorksheets, setLoadingWorksheets] = React.useState(true);

  // Fetch teacher's worksheets on mount
  React.useEffect(() => {
    const token = getAuthToken();
    if (!token) { setLoadingWorksheets(false); return; }
    fetch(`${apiUrl}/api/worksheets/mine?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { worksheets: [] })
      .then(data => setWorksheets(data.worksheets || []))
      .catch(() => {})
      .finally(() => setLoadingWorksheets(false));
  }, []);
  const [mode, setMode] = React.useState<AssignmentMode>('practice');
  const [retakePolicy, setRetakePolicy] =
    React.useState<RetakePolicy>('unlimited');
  const [retakeLimit, setRetakeLimit] = React.useState('3');
  const [timeLimit, setTimeLimit] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [openAt, setOpenAt] = React.useState('');
  const [closeAt, setCloseAt] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClassId || !worksheetId.trim()) {
      setError('Worksheet ID is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await teacherService.createAssignment({
        classId: currentClassId,
        worksheetId: worksheetId.trim(),
        mode,
        retakePolicy,
        ...(retakePolicy === 'limited'
          ? { retakeLimit: parseInt(retakeLimit, 10) || 1 }
          : {}),
        ...(timeLimit ? { timeLimit: parseInt(timeLimit, 10) * 60 } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        ...(openAt ? { openAt: new Date(openAt).toISOString() } : {}),
        ...(closeAt ? { closeAt: new Date(closeAt).toISOString() } : {}),
      });
      await fetchAssignments();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create assignment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>

      {/* Worksheet Selection */}
      <div className="space-y-1.5">
        <label htmlFor="ws-id" className="text-xs font-bold text-foreground">
          Worksheet <span className="text-destructive">*</span>
        </label>
        {loadingWorksheets ? (
          <div className="flex items-center gap-2 h-11 px-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your worksheets...
          </div>
        ) : worksheets.length === 0 ? (
          <div className="h-11 px-4 flex items-center text-sm text-muted-foreground rounded-xl border border-border bg-surface">
            No worksheets found. Generate a worksheet first, then come back to assign it.
          </div>
        ) : (
          <div className="relative">
            <select
              id="ws-id"
              value={worksheetId}
              onChange={(e) => setWorksheetId(e.target.value)}
              required
              className={selectClass}
            >
              <option value="">Select a worksheet...</option>
              {worksheets.map((ws) => (
                <option key={ws.worksheetId} value={ws.worksheetId}>
                  {ws.title} — Grade {ws.grade} · {ws.subject} · {ws.difficulty} ({ws.questionCount}Q)
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-foreground">Mode</label>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Assignment mode"
        >
          {(['practice', 'test'] as AssignmentMode[]).map((m) => (
            <label
              key={m}
              className={[
                'flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all capitalize text-sm font-semibold select-none',
                mode === m
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-surface hover:border-primary/30 text-foreground',
              ].join(' ')}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              {m === 'practice' ? 'Practice' : 'Test / Quiz'}
            </label>
          ))}
        </div>
      </div>

      {/* Retake policy */}
      <div className="space-y-1.5">
        <label htmlFor="retake-policy" className="text-xs font-bold text-foreground">
          Retake Policy
        </label>
        <div className="relative">
          <select
            id="retake-policy"
            value={retakePolicy}
            onChange={(e) => setRetakePolicy(e.target.value as RetakePolicy)}
            className={selectClass}
          >
            <option value="unlimited">Unlimited retakes</option>
            <option value="limited">Limited retakes</option>
            <option value="once">Once only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        </div>
      </div>

      {/* Retake limit — only shown when policy = limited */}
      {retakePolicy === 'limited' && (
        <div className="space-y-1.5">
          <label htmlFor="retake-limit" className="text-xs font-bold text-foreground">
            Number of Retakes Allowed
          </label>
          <input
            id="retake-limit"
            type="number"
            min={1}
            max={99}
            value={retakeLimit}
            onChange={(e) => setRetakeLimit(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {/* Time limit (minutes) */}
      <div className="space-y-1.5">
        <label htmlFor="time-limit" className="text-xs font-bold text-foreground">
          Time Limit (minutes){' '}
          <span className="text-muted-foreground font-normal">— leave blank for no limit</span>
        </label>
        <input
          id="time-limit"
          type="number"
          min={1}
          max={300}
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
          placeholder="e.g. 30"
          className={inputClass}
        />
      </div>

      {/* Due date */}
      <div className="space-y-1.5">
        <label htmlFor="due-date" className="text-xs font-bold text-foreground">
          Due Date{' '}
          <span className="text-muted-foreground font-normal">— optional</span>
        </label>
        <input
          id="due-date"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Open / close window */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="open-at" className="text-xs font-bold text-foreground">
            Opens At{' '}
            <span className="text-muted-foreground font-normal">— optional</span>
          </label>
          <input
            id="open-at"
            type="datetime-local"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="close-at" className="text-xs font-bold text-foreground">
            Closes At{' '}
            <span className="text-muted-foreground font-normal">— optional</span>
          </label>
          <input
            id="close-at"
            type="datetime-local"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="text-sm text-destructive font-semibold">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          className="flex-1"
        >
          Create Assignment
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export { AssignmentCreateForm };

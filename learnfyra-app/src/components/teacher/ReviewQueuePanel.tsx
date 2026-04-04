/**
 * @file src/components/teacher/ReviewQueuePanel.tsx
 * @description Pending review items panel — teacher can approve or override
 * auto-scored short-answer/essay questions.
 */

import * as React from 'react';
import { CheckCircle, Edit3, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import * as teacherService from '@/services/api/teacherService';
import { useTeacher } from '@/contexts/TeacherContext';
import type { ReviewQueueItem } from '@/types/teacher';

// ── Override form ──────────────────────────────────────────────────────────

interface OverrideFormProps {
  item: ReviewQueueItem;
  onSubmit: (score: number) => Promise<void>;
  onCancel: () => void;
}

const OverrideForm: React.FC<OverrideFormProps> = ({
  item,
  onSubmit,
  onCancel,
}) => {
  const [score, setScore] = React.useState(
    String(item.currentScore),
  );
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(score);
    if (isNaN(parsed) || parsed < 0 || parsed > item.pointsPossible) return;
    setSubmitting(true);
    await onSubmit(parsed);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <label htmlFor={`override-${item.reviewId}`} className="sr-only">
        Override score (0 – {item.pointsPossible})
      </label>
      <input
        id={`override-${item.reviewId}`}
        type="number"
        min={0}
        max={item.pointsPossible}
        step={0.5}
        value={score}
        onChange={(e) => setScore(e.target.value)}
        className="w-20 h-9 px-3 rounded-xl border border-border bg-white text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        aria-label={`Score out of ${item.pointsPossible}`}
      />
      <span className="text-sm text-muted-foreground">
        / {item.pointsPossible}
      </span>
      <Button type="submit" size="sm" variant="primary" loading={submitting}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </Button>
    </form>
  );
};

// ── Queue item row ─────────────────────────────────────────────────────────

interface QueueItemRowProps {
  item: ReviewQueueItem;
  onResolved: () => void;
}

const QueueItemRow: React.FC<QueueItemRowProps> = ({ item, onResolved }) => {
  const [showOverride, setShowOverride] = React.useState(false);
  const [approving, setApproving] = React.useState(false);

  const confidence = Math.round(item.systemConfidenceScore * 100);
  const confidenceVariant =
    confidence >= 80 ? 'success' : confidence >= 50 ? 'warning' : 'destructive';

  const handleApprove = async () => {
    setApproving(true);
    try {
      await teacherService.resolveReviewItem(item.reviewId, 'approve');
      onResolved();
    } catch {
      setApproving(false);
    }
  };

  const handleOverride = async (overrideScore: number) => {
    await teacherService.resolveReviewItem(
      item.reviewId,
      'override',
      overrideScore,
    );
    onResolved();
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Q{item.questionNumber} — {item.studentName}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {item.questionText}
          </p>
        </div>
        <Badge variant={confidenceVariant}>
          {confidence}% confidence
        </Badge>
      </div>

      {/* Answer comparison */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface border border-border p-3 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Student Answer
          </p>
          <p className="text-sm text-foreground">{item.studentAnswer}</p>
        </div>
        <div className="rounded-xl bg-success-light border border-success/20 p-3 space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Expected Answer
          </p>
          <p className="text-sm text-foreground">{item.expectedAnswer}</p>
        </div>
      </div>

      {/* Auto score */}
      <p className="text-xs text-muted-foreground">
        Auto-scored:{' '}
        <span className="font-bold text-foreground">
          {item.currentScore} / {item.pointsPossible}
        </span>
      </p>

      {/* Actions */}
      {showOverride ? (
        <OverrideForm
          item={item}
          onSubmit={handleOverride}
          onCancel={() => setShowOverride(false)}
        />
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleApprove}
            loading={approving}
            className="gap-1.5"
          >
            <CheckCircle className="size-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowOverride(true)}
            className="gap-1.5"
          >
            <Edit3 className="size-3.5" />
            Override Score
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Panel ──────────────────────────────────────────────────────────────────

const ReviewQueuePanel: React.FC = () => {
  const {
    reviewQueue,
    reviewPendingCount,
    loadingReviewQueue,
    errorReviewQueue,
    fetchReviewQueue,
  } = useTeacher();

  React.useEffect(() => {
    void fetchReviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingReviewQueue) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (errorReviewQueue) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        {errorReviewQueue}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
          Review Queue
        </h3>
        {reviewPendingCount > 0 && (
          <Badge variant="warning">{reviewPendingCount} pending</Badge>
        )}
      </div>

      {reviewQueue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center space-y-2">
          <CheckCircle className="size-8 text-secondary mx-auto" />
          <p className="text-sm font-semibold text-foreground">
            All caught up!
          </p>
          <p className="text-xs text-muted-foreground">
            No responses need manual review right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviewQueue.map((item) => (
            <QueueItemRow
              key={item.reviewId}
              item={item}
              onResolved={fetchReviewQueue}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { ReviewQueuePanel };

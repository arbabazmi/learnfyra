/**
 * @file src/components/dashboard/ScoreUploadModal.tsx
 * @description Modal for uploading a worksheet score with an optional marksheet
 *   file attachment. Guests see a simplified "sign in to save" prompt instead.
 *   Follows the same z-index and backdrop pattern as AuthModal.tsx.
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ScoreUploadModalProps {
  /** Controls visibility of the modal. */
  isOpen: boolean;
  /** Called when the modal should close (backdrop click, Escape, X button, Cancel). */
  onClose: () => void;
  /** UUID of the worksheet being scored. */
  worksheetId: string;
  /** Human-readable worksheet title shown as subtitle. */
  worksheetTitle: string;
  /** The existing score if one is already saved, otherwise null. */
  currentScore: number | null;
  /** When true, show a "sign in to save" prompt instead of the full form. */
  isGuest: boolean;
  /** Called with the validated score value when the user clicks "Save Score". */
  onScoreSaved: (score: number) => void;
}

/**
 * Renders a centered modal card for uploading a worksheet score.
 * Guests receive a simplified card prompting them to sign in.
 * Handles backdrop click, Escape key, X button, and Cancel to close.
 *
 * @param {ScoreUploadModalProps} props
 * @returns {React.ReactElement | null}
 */
const ScoreUploadModal: React.FC<ScoreUploadModalProps> = ({
  isOpen,
  onClose,
  worksheetTitle,
  currentScore,
  isGuest,
  onScoreSaved,
}) => {
  const [scoreInput, setScoreInput] = React.useState<string>(
    currentScore !== null ? String(currentScore) : '',
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string>('');

  // Reset internal state whenever the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setScoreInput(currentScore !== null ? String(currentScore) : '');
      setFile(null);
      setIsSaving(false);
      setError('');
    }
  }, [isOpen, currentScore]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Guest variant ────────────────────────────────────────────────────────

  if (isGuest) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Card */}
        <div
          className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl border border-border shadow-card p-6 animate-[scaleIn_200ms_ease-out]"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in required"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>

          <h2 className="text-base font-extrabold text-foreground">
            Save Your Score
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to save your score and track your progress over time.
          </p>

          <Button
            variant="primary"
            size="md"
            className="w-full mt-5"
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </div>
    );
  }

  // ── Full modal ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    const parsed = Number(scoreInput);
    if (!scoreInput.trim() || isNaN(parsed) || parsed < 0 || parsed > 100) {
      setError('Please enter a score between 0 and 100.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      // Actual API call will be added later; delegate to the parent callback.
      onScoreSaved(parsed);
      onClose();
    } catch {
      setError('Failed to save score. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl border border-border shadow-card p-6 animate-[scaleIn_200ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-modal-title"
      >
        {/* X close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {/* Heading */}
        <h2
          id="score-modal-title"
          className="text-base font-extrabold text-foreground pr-6"
        >
          Upload Your Score
        </h2>

        {/* Worksheet title subtitle */}
        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
          {worksheetTitle}
        </p>

        {/* Form */}
        <div className="mt-5 space-y-4">
          {/* Score input */}
          <div className="space-y-1.5">
            <label
              htmlFor="score-input"
              className="text-sm font-semibold text-foreground"
            >
              Score (0 – 100)
            </label>
            <input
              id="score-input"
              type="number"
              min={0}
              max={100}
              value={scoreInput}
              onChange={(e) => {
                setScoreInput(e.target.value);
                setError('');
              }}
              placeholder="e.g. 85"
              className="w-full h-11 px-4 rounded-xl border border-border bg-input-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>

          {/* Optional file upload */}
          <div className="space-y-1.5">
            <label
              htmlFor="marksheet-upload"
              className="text-sm font-semibold text-foreground"
            >
              Upload marksheet{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="marksheet-upload"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-light file:text-primary hover:file:bg-primary/10 transition cursor-pointer"
            />
            {file && (
              <p className="text-xs text-muted-foreground truncate">{file.name}</p>
            )}
          </div>

          {/* Inline error */}
          {error && (
            <p className="text-xs font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleSave}
            loading={isSaving}
            disabled={isSaving}
          >
            Save Score
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="flex-1"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

ScoreUploadModal.displayName = 'ScoreUploadModal';

export { ScoreUploadModal };

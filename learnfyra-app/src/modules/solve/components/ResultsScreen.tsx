/**
 * @file ResultsScreen.tsx
 * @description Shared results screen for both exam and practice modes.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, SkipForward, Clock, Trophy, Target, RotateCcw, Home, Eye, Lightbulb, ChevronDown, FlaskConical, Send, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import ConfettiEffect from './ui/ConfettiEffect';
import { useGradeTheme } from '../hooks/useGradeTheme';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import type { SolveResults, SolveMode, GradeTheme } from '../types';

interface ResultsScreenProps {
  results: SolveResults;
  grade: number;
  worksheetId?: string;
  onRetake: () => void;
  onSwitchMode: () => void;
  onHome: () => void;
}

/** Beta feedback banner with textarea — shown on the results screen. */
function BetaFeedbackBanner({ worksheetId, results }: { worksheetId?: string; results: SolveResults }) {
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async () => {
    if (!feedback.trim() || status === 'sending' || status === 'sent') return;
    setStatus('sending');
    try {
      const token = getAuthToken();
      await fetch(`${apiUrl}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          worksheetId: worksheetId || results.worksheetId,
          feedback: feedback.trim(),
          page: 'solve-results',
          userAgent: navigator.userAgent,
          score: results.totalScore,
          percentage: results.percentage,
          questionCount: results.results.length,
        }),
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <motion.div
      className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FlaskConical className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            Answer review is in beta
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            Our AI is reviewing your answers, so some results may not be accurate.
            If you notice anything off, please let us know — your feedback helps us improve!
          </p>
        </div>
      </div>

      {status === 'sent' ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success-light border border-success/20">
          <CheckCircle2 className="size-4 text-success" />
          <p className="text-sm font-semibold text-success">Thanks for your feedback!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Question 3 was marked wrong but my answer was correct…"
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {feedback.length}/2000
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!feedback.trim() || status === 'sending'}
              loading={status === 'sending'}
              className="gap-1.5"
            >
              {status !== 'sending' && <Send className="size-3.5" />}
              Send Feedback
            </Button>
          </div>
          {status === 'error' && (
            <p className="text-xs text-destructive font-semibold">
              Something went wrong. Please try again.
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function getScoreMessage(pct: number, theme: GradeTheme): { message: string; color: string } {
  if (pct >= 85) return { message: theme.useEmoji ? 'Excellent!' : 'Excellent', color: 'text-accent' };
  if (pct >= 65) return { message: theme.useEmoji ? 'Good Work!' : 'Good Work', color: 'text-success' };
  if (pct >= 50) return { message: theme.useEmoji ? 'Keep Practicing' : 'Keep Practicing', color: 'text-primary' };
  return { message: theme.useEmoji ? 'Let\'s Review Together' : 'Review and try again', color: 'text-chart-5' };
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-accent text-accent-foreground';
    case 'B': return 'bg-success text-white';
    case 'C': return 'bg-primary text-white';
    case 'D': return 'bg-chart-4 text-white';
    default: return 'bg-chart-5 text-white';
  }
}

// Animated SVG score ring
function ScoreRing({ percentage, color }: { percentage: number; color: string }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative size-44 mx-auto" role="img" aria-label={`Score: ${percentage}%`}>
      <svg className="size-44 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-5xl font-extrabold text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          {percentage}%
        </motion.span>
      </div>
    </div>
  );
}

export default function ResultsScreen({ results, grade, worksheetId, onRetake, onSwitchMode, onHome }: ResultsScreenProps) {
  const theme = useGradeTheme(grade);
  const [showReview, setShowReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [showConfetti, setShowConfetti] = useState(false);
  const scoreMsg = getScoreMessage(results.percentage, theme);

  const ringColor = results.percentage >= 85 ? 'var(--accent)' :
    results.percentage >= 65 ? 'var(--success)' :
    results.percentage >= 50 ? 'var(--primary)' : 'var(--chart-5)';

  useEffect(() => {
    if (results.percentage >= 50) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [results.percentage]);

  const filteredResults = results.results.filter(r => {
    if (reviewFilter === 'correct') return r.correct;
    if (reviewFilter === 'incorrect') return !r.correct;
    return true;
  });

  return (
    <div className="relative overflow-hidden">
      <ConfettiEffect active={showConfetti} theme={theme} />

      {theme.backgroundStyle === 'geometric' && (
        <div className="absolute inset-0 bg-dot-pattern pointer-events-none" />
      )}

      <div className="relative max-w-[720px] mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {results.mode === 'exam' ? (
            <>
              {/* Score Ring */}
              <ScoreRing percentage={results.percentage} color={ringColor} />
              <motion.h1
                className={cn('text-2xl sm:text-3xl font-extrabold mt-4', scoreMsg.color)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {scoreMsg.message} {theme.useEmoji && (results.percentage >= 85 ? '\uD83C\uDF1F' : results.percentage >= 65 ? '\uD83D\uDC4D' : results.percentage >= 50 ? '\uD83D\uDCAA' : '\uD83D\uDCDA')}
              </motion.h1>
              <motion.div
                className="mt-3"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 }}
              >
                <span className={cn('inline-flex items-center justify-center size-12 rounded-xl text-xl font-extrabold', getGradeColor(results.grade))}>
                  {results.grade}
                </span>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="size-20 mx-auto rounded-2xl bg-secondary-light flex items-center justify-center mb-4"
              >
                <Trophy className="size-10 text-secondary" />
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                Practice Complete! {theme.useEmoji && '\uD83C\uDF89'}
              </h1>
            </>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <StatCard icon={<CheckCircle className="size-5 text-success" />} label="Correct" value={results.correctCount} color="text-success" />
          <StatCard icon={<XCircle className="size-5 text-destructive" />} label="Incorrect" value={results.incorrectCount} color="text-destructive" />
          <StatCard icon={<SkipForward className="size-5 text-muted-foreground" />} label="Skipped" value={results.skippedCount} color="text-muted-foreground" />
          <StatCard icon={<Clock className="size-5 text-primary" />} label="Time Taken" value={formatTime(results.timeTaken)} color="text-primary" />
        </motion.div>

        {/* Practice extras */}
        {results.mode === 'practice' && results.hintsUsedTotal > 0 && (
          <motion.div
            className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-accent-light border border-accent/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Lightbulb className="size-4 text-accent" />
            <span className="text-sm text-muted-foreground">
              Hints used: <span className="font-bold text-foreground">{results.hintsUsedTotal}</span>
            </span>
          </motion.div>
        )}

        {/* Score summary */}
        <motion.div
          className="bg-card border border-border rounded-xl p-5 mb-6 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-sm text-muted-foreground">Total Score</p>
          <p className="text-3xl font-extrabold text-foreground">
            {results.totalScore} / {results.totalPoints}
          </p>
        </motion.div>

        {/* Beta feedback banner */}
        <BetaFeedbackBanner worksheetId={worksheetId} results={results} />

        {/* Review answers section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <button
            type="button"
            onClick={() => setShowReview(prev => !prev)}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-card border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="size-4" />
            Review Answers
            <ChevronDown className={cn('size-4 ml-auto transition-transform', showReview && 'rotate-180')} />
          </button>

          {showReview && (
            <div className="mt-4">
              {/* Filter tabs */}
              <div className="flex gap-2 mb-4">
                {(['all', 'correct', 'incorrect'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setReviewFilter(f)}
                    aria-pressed={reviewFilter === f}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-semibold transition-colors capitalize min-h-[44px]',
                      reviewFilter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-surface-2',
                    )}
                  >
                    {f} {f === 'correct' ? `(${results.correctCount})` : f === 'incorrect' ? `(${results.incorrectCount})` : `(${results.results.length})`}
                  </button>
                ))}
              </div>

              {/* Question review list */}
              <div className="space-y-3">
                {filteredResults.map(r => (
                  <div
                    key={r.questionId}
                    className={cn(
                      'p-4 rounded-xl border',
                      r.correct ? 'bg-success-light/50 border-success/20' : 'bg-destructive/5 border-destructive/15',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {r.correct ? (
                        <CheckCircle className="size-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-foreground">Question {r.number}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your answer: <span className="font-semibold">{r.studentAnswer || '(skipped)'}</span>
                        </p>
                        {!r.correct && (
                          <p className="text-sm text-success mt-0.5">
                            Correct: <span className="font-semibold">{r.correctAnswer}</span>
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.explanation}</p>
                      </div>
                      <Badge variant={r.correct ? 'success' : 'destructive'} className="text-xs shrink-0">
                        {r.pointsEarned}/{r.pointsPossible}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="flex flex-wrap gap-3 mt-8 justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Button variant="primary" size="lg" onClick={onRetake}>
            <RotateCcw className="size-4" />
            {results.mode === 'exam' ? 'Retake Exam' : 'Practice Again'}
          </Button>
          <Button variant="outline" size="lg" onClick={onSwitchMode}>
            <Target className="size-4" />
            {results.mode === 'exam' ? 'Try Practice Mode' : 'Try Exam Mode'}
          </Button>
          <Button variant="ghost" size="lg" onClick={onHome}>
            <Home className="size-4" />
            Back to Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className={cn('text-xl font-extrabold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

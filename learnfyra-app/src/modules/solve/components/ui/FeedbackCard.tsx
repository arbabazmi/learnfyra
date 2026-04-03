/**
 * @file FeedbackCard.tsx
 * @description Correct/incorrect reveal card with explanation.
 */

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GradeTheme } from '../../types';

interface FeedbackCardProps {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
  theme: GradeTheme;
}

export default function FeedbackCard({ correct, correctAnswer, explanation, pointsEarned, theme }: FeedbackCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'mt-5 p-5 rounded-xl border-2',
        correct
          ? 'bg-success-light border-success/30'
          : 'bg-destructive/5 border-destructive/20',
      )}
    >
      <div className="flex items-start gap-3">
        {correct ? (
          <CheckCircle className="size-6 text-success shrink-0 mt-0.5" />
        ) : (
          <XCircle className="size-6 text-destructive shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn('font-bold text-lg', correct ? 'text-success' : 'text-destructive')}>
            {correct
              ? `${theme.correctMessage} ${theme.useEmoji ? '\u2705' : ''}`
              : `${theme.incorrectMessage} ${theme.useEmoji ? '\uD83D\uDCAA' : ''}`}
          </p>

          {!correct && (
            <p className="text-[15px] text-muted-foreground mt-1">
              Correct answer: <span className="font-semibold text-foreground">{correctAnswer}</span>
            </p>
          )}

          <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">{explanation}</p>

          {correct && pointsEarned > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-accent/20 text-accent-foreground text-sm font-bold"
            >
              +{pointsEarned} pts {theme.useEmoji && '\u2B50'}
            </motion.span>
          )}

          {!correct && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-primary-light/50">
              <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Pro tip:</span> Review this concept and try similar problems for practice.
              </p>
            </div>
          )}

          {/* AI compliance note */}
          <p className="text-[10px] text-muted-foreground/60 mt-3 italic">
            AI-generated content — scoring may occasionally be inaccurate.{' '}
            <a href="mailto:support@learnfyra.com" className="underline hover:text-muted-foreground">Report an issue</a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

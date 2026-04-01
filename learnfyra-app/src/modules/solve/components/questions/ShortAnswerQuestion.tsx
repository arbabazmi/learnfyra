/**
 * @file ShortAnswerQuestion.tsx
 * @description Short text answer with textarea.
 */

import { cn } from '@/lib/utils';
import type { QuestionRendererProps } from '../../types';

export default function ShortAnswerQuestion({ question, value, onChange, disabled, showResult, isCorrect }: QuestionRendererProps) {
  const maxLen = 500;

  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Write your answer here..."
        rows={3}
        maxLength={maxLen}
        aria-label="Short answer"
        className={cn(
          'w-full px-4 py-3 rounded-xl border-2 bg-card text-base text-foreground resize-y',
          'placeholder:text-muted-foreground/50 transition-colors',
          'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20',
          !showResult && 'border-border',
          showResult && isCorrect && 'border-success bg-success-light',
          showResult && !isCorrect && 'border-destructive bg-destructive/5',
          disabled && 'opacity-70 cursor-not-allowed',
        )}
      />
      <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
        <span>{value.length} / {maxLen}</span>
      </div>
      {showResult && !isCorrect && (
        <p className="mt-2 text-[15px] text-success font-medium">
          Correct answer: {question.correctAnswer}
        </p>
      )}
    </div>
  );
}

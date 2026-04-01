/**
 * @file FillBlankQuestion.tsx
 * @description Fill in the blank with inline input.
 */

import { cn } from '@/lib/utils';
import type { FillBlankQuestion as FBType, QuestionRendererProps } from '../../types';

interface FillBlankProps extends Omit<QuestionRendererProps, 'question'> {
  question: FBType;
}

export default function FillBlankQuestion({ question, value, onChange, disabled, showResult, isCorrect }: FillBlankProps) {
  const parts = question.blankSentence.split('[BLANK]');

  return (
    <div className="text-lg leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          <span>{part}</span>
          {i < parts.length - 1 && (
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              disabled={disabled}
              placeholder="..."
              aria-label="Fill in the blank"
              className={cn(
                'inline-block mx-1 min-w-[120px] px-3 py-2.5 text-base font-semibold text-center',
                'border-b-2 bg-transparent outline-none transition-colors',
                'focus:border-primary',
                !showResult && 'border-border',
                showResult && isCorrect && 'border-success text-success',
                showResult && !isCorrect && 'border-destructive text-destructive',
                disabled && 'opacity-70',
              )}
            />
          )}
        </span>
      ))}
      {showResult && !isCorrect && (
        <p className="mt-2 text-[15px] text-success font-medium">
          Correct answer: {question.correctAnswer}
        </p>
      )}
    </div>
  );
}

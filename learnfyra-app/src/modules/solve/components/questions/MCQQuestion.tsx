/**
 * @file MCQQuestion.tsx
 * @description Multiple choice question with 2x2 grid options.
 */

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MCQQuestion as MCQType, QuestionRendererProps } from '../../types';

interface MCQProps extends Omit<QuestionRendererProps, 'question'> {
  question: MCQType;
}

export default function MCQQuestion({ question, value, onChange, disabled, showResult, isCorrect }: MCQProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {question.options.map(opt => {
        const isSelected = value === opt.letter;
        const isCorrectOption = question.correctAnswer === opt.letter;
        const showCorrect = showResult && isCorrectOption;
        const showWrong = showResult && isSelected && !isCorrectOption;

        return (
          <motion.button
            key={opt.letter}
            type="button"
            onClick={() => !disabled && onChange(opt.letter)}
            disabled={disabled}
            whileTap={!disabled ? { scale: 0.97 } : undefined}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              // Default
              !isSelected && !showResult && 'border-border bg-card hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5',
              // Selected (no result yet)
              isSelected && !showResult && 'border-primary bg-primary-light shadow-sm',
              // Correct
              showCorrect && 'border-success bg-success-light',
              // Wrong
              showWrong && 'border-destructive bg-destructive/5',
              // Unselected during result
              showResult && !isSelected && !isCorrectOption && 'border-border bg-card opacity-60',
              disabled && !showResult && 'opacity-60 cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center size-8 rounded-lg text-sm font-bold shrink-0 transition-colors',
                !isSelected && !showResult && 'bg-muted text-muted-foreground',
                isSelected && !showResult && 'bg-primary text-white',
                showCorrect && 'bg-success text-white',
                showWrong && 'bg-destructive text-white',
              )}
            >
              {showCorrect ? <Check className="size-4" /> : showWrong ? <X className="size-4" /> : opt.letter}
            </span>
            <span className="text-sm font-medium text-foreground">{opt.text}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

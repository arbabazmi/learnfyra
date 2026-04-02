/**
 * @file QuestionNavigator.tsx
 * @description Bubble grid showing question states: unanswered/answered/flagged/current.
 */

import { cn } from '@/lib/utils';
import { Flag } from 'lucide-react';
import type { Question } from '../../types';

interface QuestionNavigatorProps {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string>;
  flaggedQuestions: Set<string>;
  onNavigate: (index: number) => void;
}

export default function QuestionNavigator({
  questions,
  currentIndex,
  answers,
  flaggedQuestions,
  onNavigate,
}: QuestionNavigatorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {questions.map((q, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = Boolean(answers[q.id]);
        const isFlagged = flaggedQuestions.has(q.id);

        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onNavigate(i)}
            aria-label={`Question ${q.number}${isCurrent ? ' (current)' : ''}${isAnswered ? ' (answered)' : ''}${isFlagged ? ' (flagged)' : ''}`}
            className={cn(
              'relative size-9 rounded-lg text-xs font-bold transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isCurrent && 'bg-primary text-white shadow-primary-sm scale-110 ring-2 ring-primary/30',
              !isCurrent && isAnswered && 'bg-primary/15 text-primary border border-primary/25',
              !isCurrent && !isAnswered && 'bg-muted text-muted-foreground border border-border',
              'hover:scale-105',
            )}
          >
            {q.number}
            {isFlagged && (
              <span className="absolute -top-1 -right-1 text-amber-500">
                <Flag className="size-3 fill-amber-500" />
              </span>
            )}
            {isAnswered && !isCurrent && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

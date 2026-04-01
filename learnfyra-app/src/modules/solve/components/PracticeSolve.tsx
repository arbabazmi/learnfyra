/**
 * @file PracticeSolve.tsx
 * @description Practice mode: single column, instant feedback, hints.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import ProgressBar from './ui/ProgressBar';
import FeedbackCard from './ui/FeedbackCard';
import HintReveal from './ui/HintReveal';
import ConfettiEffect from './ui/ConfettiEffect';
import QuestionRenderer from './questions/QuestionRenderer';
import ToolsPanel from './tools/ToolsPanel';
import { useGradeTheme } from '../hooks/useGradeTheme';
import type { Worksheet, SolveSession } from '../types';

interface PracticeSolveProps {
  worksheet: Worksheet;
  session: SolveSession;
  onAnswer: (questionId: string, answer: string) => void;
  onHint: (questionId: string) => void;
  onComplete: () => void;
}

const difficultyDot: Record<string, string> = {
  easy: 'bg-success',
  medium: 'bg-accent',
  hard: 'bg-destructive',
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PracticeSolve({ worksheet, session, onAnswer, onHint, onComplete }: PracticeSolveProps) {
  const theme = useGradeTheme(worksheet.grade);
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);

  const q = worksheet.questions[session.currentQuestionIndex];
  const currentAnswer = session.answers[q.id] || '';
  const isLast = session.currentQuestionIndex >= worksheet.questions.length - 1;
  const answeredCount = Object.keys(session.answers).filter(id =>
    worksheet.questions.some(wq => wq.id === id),
  ).length;

  // Elapsed timer
  useEffect(() => {
    if (session.status !== 'in-progress') return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [session.status, session.startTime]);

  // Reset checked state on question change
  useEffect(() => {
    setChecked(false);
    setIsCorrect(false);
  }, [session.currentQuestionIndex]);

  const handleCheck = useCallback(() => {
    if (!currentAnswer) return;
    const correct = currentAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    setIsCorrect(correct);
    setChecked(true);
  }, [currentAnswer, q.correctAnswer]);

  const handleNext = () => {
    onComplete();
  };

  return (
    <div className="relative">
      <ConfettiEffect active={checked && isCorrect} theme={theme} />

      {/* Grade-aware background */}
      {theme.backgroundStyle === 'playful' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['\u2B50', '\uD83D\uDCDA', '\u270F\uFE0F', '\uD83C\uDF1F'].map((emoji, i) => (
            <motion.div
              key={i}
              className="absolute text-5xl opacity-[0.05] select-none"
              style={{ left: `${10 + i * 25}%`, top: `${15 + i * 18}%` }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
            >
              {emoji}
            </motion.div>
          ))}
        </div>
      )}
      {theme.backgroundStyle === 'geometric' && (
        <div className="absolute inset-0 bg-dot-pattern pointer-events-none" />
      )}

      <div className="relative max-w-[760px] mx-auto px-4 py-6 sm:py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">{worksheet.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="solid-success" className="text-[10px]">Practice Mode</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> {formatElapsed(elapsed)}
              </span>
            </div>
          </div>
          <button
            onClick={() => setToolsOpen(true)}
            className="lg:hidden text-sm text-muted-foreground px-3 py-1.5 rounded-lg bg-muted hover:bg-surface-2 transition-colors"
            type="button"
          >
            Tools
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <ProgressBar
            total={worksheet.questions.length}
            current={session.currentQuestionIndex}
            answered={answeredCount}
          />
        </div>

        <div className="flex gap-6">
          {/* Question card — main */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
                className={cn('bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card', theme.borderRadius)}
              >
                {/* Breadcrumb */}
                <p className="text-xs text-muted-foreground mb-3">
                  {worksheet.subject} <span className="mx-1">&rsaquo;</span> {worksheet.topic}
                </p>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-muted-foreground">
                    Q{q.number} of {worksheet.questions.length}
                  </span>
                  <span className={cn('size-2 rounded-full', difficultyDot[q.difficulty])} />
                  <Badge variant="muted" className="text-[10px]">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                </div>

                {/* Question text */}
                <p className={cn('text-foreground font-semibold mb-6 leading-relaxed', theme.tier === 'early' ? 'text-xl' : 'text-lg')}>
                  {q.question}
                </p>

                {/* Answer area */}
                <QuestionRenderer
                  question={q}
                  value={currentAnswer}
                  onChange={(val) => onAnswer(q.id, val)}
                  disabled={checked}
                  showResult={checked}
                  isCorrect={isCorrect}
                />

                {/* Hints */}
                {!checked && (
                  <HintReveal
                    hint1={q.hint1}
                    hint2={q.hint2}
                    hintsUsed={session.hintsUsed[q.id] || 0}
                    onUseHint={() => onHint(q.id)}
                    theme={theme}
                  />
                )}

                {/* Feedback */}
                {checked && (
                  <FeedbackCard
                    correct={isCorrect}
                    correctAnswer={q.correctAnswer}
                    explanation={q.explanation}
                    pointsEarned={isCorrect ? q.points : 0}
                    theme={theme}
                  />
                )}

                {/* Action buttons */}
                <div className="flex justify-end mt-6">
                  {!checked ? (
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleCheck}
                      disabled={!currentAnswer}
                    >
                      Check Answer
                    </Button>
                  ) : (
                    <Button variant="primary" size="lg" onClick={handleNext}>
                      {isLast ? 'See Results' : 'Next Question'} <ChevronRight className="size-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop tools sidebar */}
          <aside className="hidden lg:block w-[260px] shrink-0">
            <div className="sticky top-6 bg-card border border-border rounded-xl overflow-hidden">
              <ToolsPanel subject={worksheet.subject} grade={worksheet.grade} />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile tools drawer */}
      <AnimatePresence>
        {toolsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setToolsOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 max-h-[70vh] bg-card border-t border-border rounded-t-2xl z-50 lg:hidden overflow-y-auto"
            >
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <ToolsPanel subject={worksheet.subject} grade={worksheet.grade} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

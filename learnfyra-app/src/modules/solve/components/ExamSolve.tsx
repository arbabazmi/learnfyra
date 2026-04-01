/**
 * @file ExamSolve.tsx
 * @description Exam mode: 3-column layout with sidebar, question, and tools.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Flag, Send, BookOpen, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import CountdownTimer from './ui/CountdownTimer';
import QuestionNavigator from './ui/QuestionNavigator';
import QuestionRenderer from './questions/QuestionRenderer';
import ToolsPanel from './tools/ToolsPanel';
import { useGradeTheme } from '../hooks/useGradeTheme';
import type { Worksheet, SolveSession } from '../types';

interface ExamSolveProps {
  worksheet: Worksheet;
  session: SolveSession;
  onAnswer: (questionId: string, answer: string) => void;
  onFlag: (questionId: string) => void;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
}

const difficultyDot: Record<string, string> = {
  easy: 'bg-success',
  medium: 'bg-accent',
  hard: 'bg-destructive',
};

export default function ExamSolve({ worksheet, session, onAnswer, onFlag, onNavigate, onSubmit }: ExamSolveProps) {
  const theme = useGradeTheme(worksheet.grade);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const q = worksheet.questions[session.currentQuestionIndex];
  const answeredCount = Object.keys(session.answers).length;
  const unansweredCount = worksheet.questions.length - answeredCount;
  const isLast = session.currentQuestionIndex >= worksheet.questions.length - 1;
  const isFirst = session.currentQuestionIndex === 0;

  const handleTimeUp = useCallback(() => {
    onSubmit();
  }, [onSubmit]);

  const handleSubmitClick = () => {
    if (unansweredCount > 0) {
      setShowConfirm(true);
    } else {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="text-sm font-semibold text-primary min-h-[44px] px-2" type="button" aria-label="Open question navigator">
          Q {session.currentQuestionIndex + 1}/{worksheet.questions.length}
        </button>
        <CountdownTimer totalSeconds={worksheet.estimatedTimeSeconds} onTimeUp={handleTimeUp} />
        <button onClick={() => setToolsOpen(true)} className="text-sm text-muted-foreground min-h-[44px] px-2" type="button" aria-label="Open tools panel">
          Tools
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR — desktop */}
        <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-card border-r border-border p-4 sticky top-14 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-sm font-extrabold text-foreground truncate">{worksheet.title}</h2>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="primary" className="text-xs">{worksheet.subject}</Badge>
              <Badge variant="muted" className="text-xs">Grade {worksheet.grade}</Badge>
            </div>
          </div>

          <div className="mb-5">
            <CountdownTimer totalSeconds={worksheet.estimatedTimeSeconds} onTimeUp={handleTimeUp} />
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Questions</p>
          <QuestionNavigator
            questions={worksheet.questions}
            currentIndex={session.currentQuestionIndex}
            answers={session.answers}
            flaggedQuestions={session.flaggedQuestions}
            onNavigate={onNavigate}
          />

          <div className="mt-4 mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{answeredCount} / {worksheet.questions.length} Answered</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / worksheet.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFlag(q.id)}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              session.flaggedQuestions.has(q.id)
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-muted text-muted-foreground hover:bg-surface-2',
            )}
          >
            <Flag className="size-3.5" />
            {session.flaggedQuestions.has(q.id) ? 'Flagged' : 'Flag for Review'}
          </button>

          <div className="mt-auto pt-4">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleSubmitClick}
              disabled={answeredCount === 0}
            >
              <Send className="size-4" />
              Submit Exam
            </Button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-[260px] bg-card border-r border-border p-4 z-50 lg:hidden overflow-y-auto"
              >
                <button onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 text-muted-foreground" type="button">
                  <X className="size-5" />
                </button>
                <h3 className="text-sm font-extrabold mb-3">{worksheet.title}</h3>
                <QuestionNavigator
                  questions={worksheet.questions}
                  currentIndex={session.currentQuestionIndex}
                  answers={session.answers}
                  flaggedQuestions={session.flaggedQuestions}
                  onNavigate={(i) => { onNavigate(i); setSidebarOpen(false); }}
                />
                <Button variant="primary" size="md" className="w-full mt-4" onClick={handleSubmitClick} disabled={answeredCount === 0}>
                  <Send className="size-4" /> Submit
                </Button>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* CENTER MAIN */}
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="max-w-[720px] mx-auto">
            {/* Breadcrumb */}
            <p className="text-[13px] text-muted-foreground mb-4">
              {worksheet.subject} <span className="mx-1">&rsaquo;</span> {worksheet.topic}
            </p>

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className={cn('bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card', theme.borderRadius)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground">
                      Q{q.number} of {worksheet.questions.length}
                    </span>
                    <span className={cn('size-2 rounded-full', difficultyDot[q.difficulty])} />
                    <Badge variant="muted" className="text-xs">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFlag(q.id)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      session.flaggedQuestions.has(q.id) ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500',
                    )}
                    aria-label="Flag question"
                    aria-pressed={session.flaggedQuestions.has(q.id)}
                  >
                    <Flag className={cn('size-4', session.flaggedQuestions.has(q.id) && 'fill-amber-500')} />
                  </button>
                </div>

                {/* Question text */}
                <p className={cn('text-foreground font-semibold mb-6 leading-relaxed', theme.tier === 'early' ? 'text-2xl' : 'text-xl')}>
                  {q.question}
                </p>

                {/* Answer area */}
                <QuestionRenderer
                  question={q}
                  value={session.answers[q.id] || ''}
                  onChange={(val) => onAnswer(q.id, val)}
                />
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="ghost"
                size="md"
                onClick={() => onNavigate(session.currentQuestionIndex - 1)}
                disabled={isFirst}
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => isLast ? handleSubmitClick() : onNavigate(session.currentQuestionIndex + 1)}
              >
                {isLast ? 'Review & Submit' : 'Next'} <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </main>

        {/* RIGHT TOOLS — desktop */}
        <aside className="hidden lg:block w-[260px] shrink-0 border-l border-border bg-card sticky top-14 overflow-y-auto">
          <ToolsPanel subject={worksheet.subject} grade={worksheet.grade} />
        </aside>
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

      {/* Submit confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-card border border-border rounded-2xl p-6 z-50 shadow-xl"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground">Submit Exam?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You have <span className="font-bold text-foreground">{unansweredCount}</span> unanswered question{unansweredCount > 1 ? 's' : ''}.
                    Are you sure you want to submit?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" size="md" onClick={() => setShowConfirm(false)}>Go Back</Button>
                <Button variant="primary" size="md" onClick={() => { setShowConfirm(false); onSubmit(); }}>
                  Submit Anyway
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * @file src/modules/solve/components/ModeSelector.tsx
 * @description Entry screen for picking Exam or Practice mode.
 */

import { motion } from 'framer-motion';
import { Clock, Lightbulb, Timer, Ban, BarChart3, CheckCircle, RotateCcw, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useGradeTheme } from '../hooks/useGradeTheme';
import type { Worksheet, SolveMode } from '../types';

interface ModeSelectorProps {
  worksheet: Worksheet;
  onSelectMode: (mode: SolveMode) => void;
}

const subjectColors: Record<string, string> = {
  Math: 'bg-primary text-white',
  Science: 'bg-secondary text-white',
  ELA: 'bg-accent text-accent-foreground',
  'Social Studies': 'bg-chart-5 text-white',
  Health: 'bg-chart-4 text-white',
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
}

export default function ModeSelector({ worksheet, onSelectMode }: ModeSelectorProps) {
  const theme = useGradeTheme(worksheet.grade);
  const estimatedTime = formatTime(worksheet.estimatedTimeSeconds);

  return (
    <div className="relative overflow-hidden">
      {/* Grade-aware background */}
      {theme.backgroundStyle === 'playful' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['star', 'book', 'pencil'].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-6xl opacity-[0.06] select-none"
              style={{ left: `${20 + i * 30}%`, top: `${10 + i * 20}%` }}
              animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
            >
              {['\u2B50', '\uD83D\uDCDA', '\u270F\uFE0F'][i]}
            </motion.div>
          ))}
        </div>
      )}
      {theme.backgroundStyle === 'geometric' && (
        <div className="absolute inset-0 bg-dot-pattern pointer-events-none" />
      )}

      <div className="relative max-w-[920px] mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className={`text-3xl sm:text-4xl font-extrabold text-foreground mb-4 ${theme.tier === 'early' ? 'text-4xl sm:text-5xl' : ''}`}>
            {worksheet.title}
          </h1>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${subjectColors[worksheet.subject] || 'bg-primary text-white'}`}>
              <BookOpen className="size-3.5" />
              {worksheet.subject}
            </span>
            <Badge variant="muted">{worksheet.topic}</Badge>
            <Badge variant="primary">Grade {worksheet.grade}</Badge>
            <Badge variant="muted">{worksheet.questions.length} questions</Badge>
            <Badge variant="muted">
              <Clock className="size-3 mr-1 inline" />
              {estimatedTime}
            </Badge>
          </div>
        </motion.div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Exam Mode */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <button
              type="button"
              onClick={() => onSelectMode('exam')}
              className={`group w-full text-left bg-card border-2 border-border ${theme.borderRadius} p-7 sm:p-8 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-xl bg-primary-light flex items-center justify-center">
                  <Clock className="size-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Exam Mode</h2>
                  <p className="text-sm text-muted-foreground">Test your knowledge</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-5 leading-relaxed">
                Answer all questions then submit. No hints.
                Your score is revealed at the end.
              </p>

              <div className="flex flex-wrap gap-3 mb-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5 text-primary" /> Timed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ban className="size-3.5 text-destructive" /> No hints
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="size-3.5 text-primary" /> Full score breakdown
                </span>
              </div>

              <div className="flex justify-end">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm group-hover:bg-primary-hover transition-colors">
                  Start Exam
                  <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </button>
          </motion.div>

          {/* Practice Mode */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <button
              type="button"
              onClick={() => onSelectMode('practice')}
              className={`group w-full text-left bg-card border-2 border-border ${theme.borderRadius} p-7 sm:p-8 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-xl bg-secondary-light flex items-center justify-center">
                  <Lightbulb className="size-6 text-secondary" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Practice Mode</h2>
                  <p className="text-sm text-muted-foreground">Learn as you go</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-5 leading-relaxed">
                One question at a time. Get instant feedback
                and explanations after each answer.
              </p>

              <div className="flex flex-wrap gap-3 mb-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle className="size-3.5 text-secondary" /> Instant feedback
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb className="size-3.5 text-accent" /> Hints available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 text-secondary" /> Try again
                </span>
              </div>

              <div className="flex justify-end">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-white font-semibold text-sm group-hover:bg-secondary-hover transition-colors">
                  Start Practice
                  <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * @file src/pages/WorksheetPage.tsx
 * @description Worksheet solver page — renders questions and captures answers.
 * Uses :id param from the URL to load the correct worksheet.
 */

import * as React from 'react';
import { useParams, Link } from 'react-router';
import {
  ArrowLeft,
  Timer,
  CheckCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';

// ── Placeholder worksheet data — replace with GET /api/solve/:id ──────────
const PLACEHOLDER_WORKSHEET = {
  id: 'ws-001',
  title: 'Linear Equations',
  subject: 'Math',
  grade: 7,
  topic: 'Algebra',
  difficulty: 'Medium' as const,
  estimatedTime: '20 minutes',
  totalPoints: 10,
  questions: [
    {
      number: 1,
      type: 'multiple-choice' as const,
      question: 'Solve for x: 2x + 5 = 13',
      options: ['A. x = 3', 'B. x = 4', 'C. x = 6', 'D. x = 8'],
      points: 1,
    },
    {
      number: 2,
      type: 'multiple-choice' as const,
      question: 'What is the slope of the line y = 3x − 7?',
      options: ['A. −7', 'B. 3', 'C. 7', 'D. −3'],
      points: 1,
    },
    {
      number: 3,
      type: 'fill-in-the-blank' as const,
      question: 'If 4x = 20, then x = ____.',
      options: [],
      points: 1,
    },
  ],
};

const difficultyColor: Record<string, string> = {
  Easy:   'success',
  Medium: 'warning',
  Hard:   'destructive',
  Mixed:  'primary',
};

const WorksheetPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [currentQ, setCurrentQ]     = React.useState(0);
  const [answers, setAnswers]        = React.useState<Record<number, string>>({});
  const [submitted, setSubmitted]    = React.useState(false);

  const worksheet = PLACEHOLDER_WORKSHEET; // TODO: fetch from /api/solve/:id
  const question  = worksheet.questions[currentQ];
  const isLast    = currentQ === worksheet.questions.length - 1;
  const progress  = Math.round(((currentQ + 1) / worksheet.questions.length) * 100);

  usePageMeta({
    title: `${worksheet.title} — ${worksheet.subject} · Grade ${worksheet.grade}`,
    description: `Solve the "${worksheet.title}" worksheet. ${worksheet.questions.length} questions, ${worksheet.estimatedTime}.`,
    keywords: `worksheet, ${worksheet.subject}, grade ${worksheet.grade}, ${worksheet.topic}, online practice`,
  });

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [question.number]: value }));
  };

  const handleSubmit = () => {
    // TODO: POST /api/submit { worksheetId: id, answers }
    setSubmitted(true);
  };

  return (
    <AppLayout pageTitle={worksheet.title}>
      <div className="p-6 max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="primary">{worksheet.subject}</Badge>
                <Badge variant={difficultyColor[worksheet.difficulty] as 'success' | 'warning' | 'destructive' | 'primary'}>
                  {worksheet.difficulty}
                </Badge>
                <span className="text-xs text-muted-foreground">Grade {worksheet.grade}</span>
              </div>
              <h1 className="text-xl font-extrabold text-foreground">{worksheet.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {worksheet.questions.length} questions · {worksheet.estimatedTime} · {worksheet.totalPoints} points
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Timer className="size-4 text-primary" />
              <span className="text-sm font-bold text-primary">20:00</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-muted-foreground">
                Question {currentQ + 1} of {worksheet.questions.length}
              </span>
              <span className="text-primary">{progress}%</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question card */}
        {!submitted ? (
          <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">
            {/* Type label */}
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                {question.type.replace(/-/g, ' ')}
              </span>
            </div>

            {/* Question text */}
            <p className="text-base font-bold text-foreground leading-relaxed">
              {question.question}
            </p>

            {/* Input by type */}
            {question.type === 'multiple-choice' && (
              <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                {question.options.map((opt) => {
                  const selected = answers[question.number] === opt;
                  return (
                    <label
                      key={opt}
                      className={[
                        'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150',
                        selected
                          ? 'border-primary bg-primary-light text-primary'
                          : 'border-border bg-surface hover:border-primary/40 hover:bg-primary-light/30',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name={`q-${question.number}`}
                        value={opt}
                        checked={selected}
                        onChange={() => handleAnswer(opt)}
                        className="sr-only"
                      />
                      <span
                        className={[
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0',
                          selected ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground',
                        ].join(' ')}
                      >
                        {opt[0]}
                      </span>
                      <span className="text-sm font-semibold">{opt.slice(3)}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.type === 'fill-in-the-blank' && (
              <input
                type="text"
                value={answers[question.number] ?? ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer…"
                className="w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ((q) => q - 1)}
                className="gap-1"
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>

              {isLast ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < worksheet.questions.length}
                  className="gap-2"
                >
                  <CheckCircle className="size-4" />
                  Submit Worksheet
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentQ((q) => q + 1)}
                  className="gap-1"
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Submitted state */
          <div className="bg-white rounded-2xl border border-border shadow-card p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto">
              <CheckCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-foreground">Worksheet Submitted!</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Your answers have been recorded. Results will appear in your reports.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="md" asChild>
                <Link to="/reports">View Results</Link>
              </Button>
              <Button variant="outline" size="md" asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default WorksheetPage;

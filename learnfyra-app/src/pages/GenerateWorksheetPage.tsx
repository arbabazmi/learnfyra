/**
 * @file src/pages/GenerateWorksheetPage.tsx
 * @description Generate Worksheet page — teachers and students configure
 * and generate a new AI-powered, curriculum-aligned worksheet.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Timer,
  Infinity,
  ChevronDown,
  Minus,
  Plus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';

// ── Topic data — keyed by subject ─────────────────────────────────────────────

const TOPICS_BY_SUBJECT: Record<string, string[]> = {
  Math: [
    'Algebra',
    'Geometry',
    'Fractions',
    'Multiplication',
    'Division',
    'Decimals',
    'Percentages',
    'Statistics & Data',
    'Number Sense',
    'Word Problems',
    'Measurement',
    'Coordinate Plane',
  ],
  ELA: [
    'Reading Comprehension',
    'Vocabulary',
    'Grammar & Mechanics',
    'Parts of Speech',
    'Writing — Narrative',
    'Writing — Informative',
    'Figurative Language',
    'Main Idea & Details',
    'Context Clues',
    'Spelling Patterns',
  ],
  Science: [
    'Biology',
    'Chemistry',
    'Physics',
    'Earth Science',
    'Life Cycles',
    'Ecosystems',
    'Human Body',
    'Space & Solar System',
    'Weather & Climate',
    'Matter & Energy',
    'Forces & Motion',
    'Scientific Method',
  ],
  'Social Studies': [
    'US History',
    'World Geography',
    'Civics & Government',
    'Economics Basics',
    'The American Revolution',
    'The Civil War',
    'Ancient Civilizations',
    'Westward Expansion',
    'The Constitution',
    'Map Skills',
  ],
  Health: [
    'Nutrition & Diet',
    'Human Body Systems',
    'Mental Health & Wellness',
    'Personal Hygiene',
    'Physical Fitness',
    'Disease Prevention',
    'First Aid',
    'Substance Awareness',
  ],
};

const SUBJECTS = Object.keys(TOPICS_BY_SUBJECT);

const DIFFICULTIES = [
  {
    value: 'Easy',
    label: 'Easy',
    description: 'Foundational concepts, single-step problems',
    color: '#6DB84B',
    bgToken: 'bg-success-light',
    textToken: 'text-success',
    borderToken: 'border-success/30',
  },
  {
    value: 'Medium',
    label: 'Medium',
    description: 'Grade-level practice, mixed problem types',
    color: '#F5C534',
    bgToken: 'bg-accent-light',
    textToken: 'text-amber-700',
    borderToken: 'border-accent/40',
  },
  {
    value: 'Hard',
    label: 'Hard',
    description: 'Above-grade challenge, multi-step reasoning',
    color: '#f97316',
    bgToken: 'bg-orange-50',
    textToken: 'text-orange-600',
    borderToken: 'border-orange-200',
  },
  {
    value: 'Mixed',
    label: 'Mixed',
    description: 'Variety of easy through hard questions',
    color: '#3D9AE8',
    bgToken: 'bg-primary-light',
    textToken: 'text-primary',
    borderToken: 'border-primary/30',
  },
] as const;

type DifficultyValue = (typeof DIFFICULTIES)[number]['value'];

const QUESTION_TYPES = [
  { value: 'multiple-choice',   label: 'Multiple Choice' },
  { value: 'true-false',        label: 'True / False' },
  { value: 'fill-in-the-blank', label: 'Fill in the Blank' },
  { value: 'short-answer',      label: 'Short Answer' },
  { value: 'matching',          label: 'Matching' },
  { value: 'word-problem',      label: 'Word Problem' },
];

// Estimated minutes per question per difficulty
const MINUTES_PER_Q: Record<DifficultyValue, number> = {
  Easy:   1.5,
  Medium: 2,
  Hard:   3,
  Mixed:  2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function estimateMinutes(questionCount: number, difficulty: DifficultyValue): number {
  return Math.round(questionCount * MINUTES_PER_Q[difficulty]);
}

// ── Component ─────────────────────────────────────────────────────────────────

type TimerMode = 'timed' | 'untimed';
type GenerationState = 'idle' | 'generating' | 'success';

const GenerateWorksheetPage: React.FC = () => {
  // ── Form state
  const [grade,          setGrade]          = React.useState<string>('7');
  const [subject,        setSubject]        = React.useState<string>('Math');
  const [topic,          setTopic]          = React.useState<string>('Algebra');
  const [difficulty,     setDifficulty]     = React.useState<DifficultyValue>('Medium');
  const [questionCount,  setQuestionCount]  = React.useState<number>(10);
  const [timerMode,      setTimerMode]      = React.useState<TimerMode>('timed');
  const [selectedTypes,  setSelectedTypes]  = React.useState<string[]>(
    QUESTION_TYPES.map((t) => t.value),
  );

  // ── Generation state
  const [genState, setGenState] = React.useState<GenerationState>('idle');

  usePageMeta({
    title: 'Generate Worksheet',
    description:
      'Configure a new AI-powered worksheet — choose grade, subject, topic, difficulty, and question types. Learnfyra generates it in seconds.',
    keywords: 'generate worksheet, AI worksheet, curriculum-aligned, grade practice',
  });

  // ── Derived values
  const topicOptions    = TOPICS_BY_SUBJECT[subject] ?? [];
  const estimatedMins   = estimateMinutes(questionCount, difficulty);
  const allTypesSelected = selectedTypes.length === QUESTION_TYPES.length;

  // When subject changes, reset topic to the first option for that subject
  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setTopic(TOPICS_BY_SUBJECT[newSubject]?.[0] ?? '');
  };

  // Toggle a question type checkbox
  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  };

  // Stepper clamped 5–30
  const incrementQ = () => setQuestionCount((n) => Math.min(30, n + 1));
  const decrementQ = () => setQuestionCount((n) => Math.max(5,  n - 1));

  // Mock generation
  const handleGenerate = () => {
    if (selectedTypes.length === 0) return;
    setGenState('generating');
    setTimeout(() => setGenState('success'), 2000);
  };

  // ── Shared select class
  const selectClass =
    'w-full h-11 pl-4 pr-9 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground appearance-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout pageTitle="Generate Worksheet">
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* ── Back link ──────────────────────────────────────────────────── */}
        <Link
          to="/worksheet"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Worksheets
        </Link>

        {/* ── Hero card ──────────────────────────────────────────────────── */}
        <section
          aria-label="Page introduction"
          className="relative rounded-2xl bg-primary overflow-hidden p-6 lg:p-8"
        >
          {/* Dot-grid decoration */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
            aria-hidden="true"
          />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Create a New Worksheet
              </h2>
              <p className="text-white/75 text-sm mt-1 max-w-lg">
                AI generates a custom, curriculum-aligned worksheet in seconds.
                Configure the options below and hit Generate.
              </p>
            </div>
          </div>
        </section>

        {/* ── Success state ──────────────────────────────────────────────── */}
        {genState === 'success' && (
          <section
            aria-label="Worksheet ready"
            className="bg-white rounded-2xl border border-border shadow-card p-8 text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
              <CheckCircle className="size-8 text-secondary" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-foreground">
                Worksheet Ready!
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your worksheet has been generated with{' '}
                <span className="font-bold text-foreground">
                  {questionCount} questions
                </span>
                .
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="md" className="gap-2" asChild>
                <Link to="/worksheet/ws-new">
                  <Sparkles className="size-4" />
                  Start Solving
                </Link>
              </Button>
              <Button variant="outline" size="md" asChild>
                <Link to="/worksheet">Back to Worksheets</Link>
              </Button>
            </div>
          </section>
        )}

        {/* ── Form + Preview grid (hidden after success) ─────────────────── */}
        {genState !== 'success' && (
          <div className="grid lg:grid-cols-[3fr_2fr] gap-6 items-start">

            {/* ── LEFT: Form card ─────────────────────────────────────────── */}
            <section aria-label="Worksheet configuration">
              <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-7">

                {/* Section: Worksheet Setup */}
                <div className="space-y-5">
                  <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                    Worksheet Setup
                  </h3>

                  {/* Grade + Subject row */}
                  <div className="grid sm:grid-cols-2 gap-4">

                    {/* Grade */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="grade-select"
                        className="text-xs font-bold text-foreground"
                      >
                        Grade
                      </label>
                      <div className="relative">
                        <select
                          id="grade-select"
                          value={grade}
                          onChange={(e) => setGrade(e.target.value)}
                          className={selectClass}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                            <option key={g} value={String(g)}>
                              Grade {g}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="subject-select"
                        className="text-xs font-bold text-foreground"
                      >
                        Subject
                      </label>
                      <div className="relative">
                        <select
                          id="subject-select"
                          value={subject}
                          onChange={(e) => handleSubjectChange(e.target.value)}
                          className={selectClass}
                        >
                          {SUBJECTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Topic */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="topic-select"
                      className="text-xs font-bold text-foreground"
                    >
                      Topic
                    </label>
                    <div className="relative">
                      <select
                        id="topic-select"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className={selectClass}
                      >
                        {topicOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Section: Difficulty */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                    Difficulty
                  </h3>
                  <div
                    className="grid grid-cols-2 gap-2.5"
                    role="radiogroup"
                    aria-label="Difficulty level"
                  >
                    {DIFFICULTIES.map((d) => {
                      const selected = difficulty === d.value;
                      return (
                        <label
                          key={d.value}
                          className={[
                            'flex flex-col gap-1 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none',
                            selected
                              ? `${d.bgToken} ${d.borderToken}`
                              : 'border-border bg-surface hover:border-primary/30 hover:bg-primary-light/20',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="difficulty"
                            value={d.value}
                            checked={selected}
                            onChange={() => setDifficulty(d.value)}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            {/* Color dot */}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: d.color }}
                              aria-hidden="true"
                            />
                            <span
                              className={`text-sm font-bold ${selected ? d.textToken : 'text-foreground'}`}
                            >
                              {d.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground leading-snug pl-4">
                            {d.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Section: Number of Questions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                      Number of Questions
                    </h3>
                    <span className="text-xs text-muted-foreground">5 – 30</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Stepper */}
                    <div className="flex items-center gap-1 bg-surface rounded-xl border border-border p-1">
                      <button
                        type="button"
                        onClick={decrementQ}
                        disabled={questionCount <= 5}
                        aria-label="Decrease question count"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-10 text-center text-lg font-extrabold text-foreground select-none tabular-nums">
                        {questionCount}
                      </span>
                      <button
                        type="button"
                        onClick={incrementQ}
                        disabled={questionCount >= 30}
                        aria-label="Increase question count"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Slider */}
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      aria-label="Number of questions slider"
                      className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Section: Timer Mode */}
                <div className="space-y-3">
                  <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                    Timer Mode
                  </h3>
                  <div
                    className="grid grid-cols-2 gap-2.5"
                    role="radiogroup"
                    aria-label="Timer mode"
                  >
                    {/* Timed */}
                    {(
                      [
                        {
                          value: 'timed' as TimerMode,
                          Icon: Timer,
                          label: 'Timed',
                          description: 'Practice under test conditions',
                          color: '#3D9AE8',
                        },
                        {
                          value: 'untimed' as TimerMode,
                          Icon: Infinity,
                          label: 'Untimed',
                          description: 'Solve at your own pace',
                          color: '#6DB84B',
                        },
                      ] as const
                    ).map(({ value, Icon, label, description, color }) => {
                      const selected = timerMode === value;
                      return (
                        <label
                          key={value}
                          className={[
                            'flex flex-col gap-1.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none',
                            selected
                              ? 'border-primary bg-primary-light'
                              : 'border-border bg-surface hover:border-primary/30 hover:bg-primary-light/20',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="timer-mode"
                            value={value}
                            checked={selected}
                            onChange={() => setTimerMode(value)}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <Icon
                              className="size-4 shrink-0"
                              style={{ color: selected ? color : undefined }}
                              aria-hidden="true"
                            />
                            <span
                              className={`text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}
                            >
                              {label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground leading-snug pl-6">
                            {description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Section: Question Types */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                      Question Types
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTypes(
                          allTypesSelected
                            ? []
                            : QUESTION_TYPES.map((t) => t.value),
                        )
                      }
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {allTypesSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {selectedTypes.length === 0 && (
                    <p className="text-xs text-destructive font-semibold" role="alert">
                      Select at least one question type.
                    </p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2">
                    {QUESTION_TYPES.map(({ value, label }) => {
                      const checked = selectedTypes.includes(value);
                      return (
                        <label
                          key={value}
                          className={[
                            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 select-none',
                            checked
                              ? 'border-primary bg-primary-light text-primary'
                              : 'border-border bg-surface hover:border-primary/30 hover:bg-primary-light/20 text-foreground',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            value={value}
                            checked={checked}
                            onChange={() => toggleType(value)}
                            className="sr-only"
                          />
                          {/* Custom checkbox indicator */}
                          <span
                            className={[
                              'w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                              checked
                                ? 'bg-primary border-primary'
                                : 'border-border',
                            ].join(' ')}
                            aria-hidden="true"
                          >
                            {checked && (
                              <svg
                                viewBox="0 0 10 8"
                                className="w-2.5 h-2 fill-none stroke-white stroke-2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M1 4l2.5 2.5L9 1" />
                              </svg>
                            )}
                          </span>
                          <span className="text-sm font-semibold">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Generate button */}
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleGenerate}
                  loading={genState === 'generating'}
                  disabled={selectedTypes.length === 0 || genState === 'generating'}
                >
                  {genState !== 'generating' && <Sparkles className="size-5" />}
                  {genState === 'generating' ? 'Generating...' : 'Generate Worksheet'}
                </Button>

              </div>
            </section>

            {/* ── RIGHT: Preview summary card ─────────────────────────────── */}
            <aside aria-label="Worksheet preview summary" className="lg:sticky lg:top-6">
              <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">

                <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
                  Worksheet Preview
                </h3>

                {/* Subject + Topic */}
                <div className="space-y-1">
                  <p className="text-lg font-extrabold text-foreground leading-tight">
                    {subject} — {topic}
                  </p>
                  <p className="text-sm text-muted-foreground">Grade {grade}</p>
                </div>

                {/* Badge row */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">{subject}</Badge>
                  <Badge
                    variant={
                      difficulty === 'Easy'
                        ? 'success'
                        : difficulty === 'Medium'
                          ? 'warning'
                          : difficulty === 'Hard'
                            ? 'destructive'
                            : 'primary'
                    }
                  >
                    {difficulty}
                  </Badge>
                  <Badge variant={timerMode === 'timed' ? 'primary' : 'muted'}>
                    {timerMode === 'timed' ? 'Timed' : 'Untimed'}
                  </Badge>
                </div>

                {/* Stats list */}
                <ul className="space-y-3" aria-label="Configuration summary">
                  {(
                    [
                      { label: 'Grade',       value: `Grade ${grade}` },
                      { label: 'Subject',     value: subject },
                      { label: 'Topic',       value: topic },
                      { label: 'Difficulty',  value: difficulty },
                      {
                        label: 'Questions',
                        value: `${questionCount} questions · ~${estimatedMins} min`,
                      },
                      {
                        label: 'Timer',
                        value: timerMode === 'timed' ? 'Timed mode' : 'Untimed mode',
                      },
                    ] as const
                  ).map(({ label, value }) => (
                    <li
                      key={label}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground font-medium shrink-0">
                        {label}
                      </span>
                      <span className="font-bold text-foreground text-right">{value}</span>
                    </li>
                  ))}
                </ul>

                {/* Question types selected */}
                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Question Types
                  </p>
                  {selectedTypes.length === 0 ? (
                    <p className="text-xs text-destructive font-semibold">None selected</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTypes.map((t) => {
                        const found = QUESTION_TYPES.find((qt) => qt.value === t);
                        return found ? (
                          <span
                            key={t}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface border border-border text-xs font-semibold text-foreground"
                          >
                            {found.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Estimated time callout */}
                <div className="flex items-center gap-3 bg-primary-light rounded-xl px-4 py-3">
                  <Timer className="size-4 text-primary shrink-0" />
                  <p className="text-sm font-bold text-primary">
                    Estimated time: ~{estimatedMins} minutes
                  </p>
                </div>

              </div>
            </aside>

          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default GenerateWorksheetPage;

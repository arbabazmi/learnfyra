/**
 * @file src/pages/GenerateWorksheetPage.tsx
 * @description Generate Worksheet page — teachers and students configure
 * and generate a new AI-powered, curriculum-aligned worksheet.
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Timer,
  ChevronDown,
  Minus,
  Plus,
  FileText,
  FileDown,
  Printer,
  KeyRound,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';
import { saveWorksheet, loadWorksheet } from '@/modules/solve/worksheetStorage';
import { printWorksheet, downloadAsWord, downloadAsPDF } from '@/modules/solve/worksheetExport';
import type { Subject } from '@/modules/solve/types';
import { apiUrl } from '@/lib/env';
import { getAuthToken, GUEST_STORAGE_KEYS } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { TOPICS_BY_GRADE_SUBJECT, SUBJECTS } from '@/data/curriculumTopics';
import { LimitReachedModal } from '@/components/auth/LimitReachedModal';

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

type GenerationState = 'idle' | 'generating' | 'success';

const GenerateWorksheetPage: React.FC = () => {
  const auth = useAuth();
  // Guest-teacher and guest-parent can view the form but cannot generate
  const isGuestRestricted = auth.tokenState === 'guest'
    && (auth.role === 'guest-teacher' || auth.role === 'guest-parent');

  // ── Form state
  const [grade,          setGrade]          = React.useState<string>('7');
  const [subject,        setSubject]        = React.useState<string>('Math');
  const [topic,          setTopic]          = React.useState<string>(
    TOPICS_BY_GRADE_SUBJECT[7]?.['Math']?.[0] ?? 'Algebra',
  );
  const [difficulty,     setDifficulty]     = React.useState<DifficultyValue>('Medium');
  const [questionCount,  setQuestionCount]  = React.useState<number>(10);
  const [selectedTypes,  setSelectedTypes]  = React.useState<string[]>(
    QUESTION_TYPES.map((t) => t.value),
  );

  // ── Generation state
  const [genState, setGenState] = React.useState<GenerationState>('idle');
  const [generatedId, setGeneratedId] = React.useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const navigate = useNavigate();

  usePageMeta({
    title: 'Generate Worksheet',
    description:
      'Configure a new AI-powered worksheet — choose grade, subject, topic, difficulty, and question types. Learnfyra generates it in seconds.',
    keywords: 'generate worksheet, AI worksheet, curriculum-aligned, grade practice',
  });

  // ── Derived values
  const gradeNum        = parseInt(grade, 10);
  const topicOptions    = TOPICS_BY_GRADE_SUBJECT[gradeNum]?.[subject] ?? [];
  const estimatedMins   = estimateMinutes(questionCount, difficulty);
  const allTypesSelected = selectedTypes.length === QUESTION_TYPES.length;

  // When grade changes, keep subject but reset topic to first for that grade+subject
  const handleGradeChange = (newGrade: string) => {
    setGrade(newGrade);
    const g = parseInt(newGrade, 10);
    const subjectTopics = TOPICS_BY_GRADE_SUBJECT[g]?.[subject];
    // If current subject has no topics for this grade, keep first available subject
    if (!subjectTopics || subjectTopics.length === 0) {
      const firstSubj = SUBJECTS.find(s => (TOPICS_BY_GRADE_SUBJECT[g]?.[s]?.length ?? 0) > 0) ?? subject;
      setSubject(firstSubj);
      setTopic(TOPICS_BY_GRADE_SUBJECT[g]?.[firstSubj]?.[0] ?? '');
    } else {
      setTopic(subjectTopics[0]);
    }
  };

  // When subject changes, reset topic to the first option for that grade+subject
  const handleSubjectChange = (newSubject: string) => {
    setSubject(newSubject);
    setTopic(TOPICS_BY_GRADE_SUBJECT[gradeNum]?.[newSubject]?.[0] ?? '');
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

  const [genError, setGenError] = React.useState('');

  const generatingRef = React.useRef(false);

  // Generate worksheet via real API — AI-powered generation, stored server-side
  const handleGenerate = async () => {
    if (selectedTypes.length === 0 || generatingRef.current) return;

    const token = getAuthToken();
    generatingRef.current = true;
    setGenState('generating');
    setGenError('');

    try {
      const res = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          grade: gradeNum,
          subject,
          topic,
          difficulty,
          questionCount,
          format: 'HTML',
          includeAnswerKey: true,
          generationMode: 'auto',
          provenanceLevel: 'summary',
          worksheetDate: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await res.json();

      if (res.status === 403 && data?.code === 'GUEST_LIMIT_REACHED') {
        setShowLimitModal(true);
        setGenState('idle');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Generation failed (${res.status})`);
      }

      // Update guest worksheet count from backend response
      if (data.guestUsed !== undefined) {
        sessionStorage.setItem(GUEST_STORAGE_KEYS.used, String(data.guestUsed));
        sessionStorage.setItem(GUEST_STORAGE_KEYS.limit, String(data.guestLimit ?? 10));
      }

      // Store the worksheet ID from the API response
      const wsId = data.metadata?.id || data.worksheetId;
      if (!wsId) throw new Error('No worksheet ID in response');

      setGeneratedId(wsId);
      setGenState('success');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
      setGenState('idle');
    } finally {
      generatingRef.current = false;
    }
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
        {genState === 'success' && generatedId && (
          <section
            aria-label="Worksheet ready"
            className="bg-white rounded-2xl border border-border shadow-card p-8 space-y-6"
          >
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-success-light flex items-center justify-center mx-auto">
                <CheckCircle className="size-8 text-secondary" />
              </div>
              <h3 className="text-xl font-extrabold text-foreground mt-4">
                Worksheet Ready!
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your worksheet has been generated with{' '}
                <span className="font-bold text-foreground">
                  {questionCount} questions
                </span>{' '}
                — {subject}, {topic}, Grade {grade}.
              </p>
            </div>

            {/* Primary CTA — solve online */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" className="gap-2" asChild>
                <Link to={`/solve/${generatedId}`}>
                  <Sparkles className="size-4" />
                  Start Solving Online
                </Link>
              </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Offline &amp; Print
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Download & Print grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* PDF */}
              <button
                type="button"
                onClick={() => {
                  const ws = loadWorksheet(generatedId);
                  if (ws) downloadAsPDF(ws);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-surface hover:bg-primary-light hover:border-primary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/15 transition-colors">
                  <FileDown className="size-5 text-destructive" />
                </div>
                <span className="text-sm font-bold text-foreground">Save as PDF</span>
                <span className="text-[11px] text-muted-foreground">Print dialog → Save as PDF</span>
              </button>

              {/* Word */}
              <button
                type="button"
                onClick={() => {
                  const ws = loadWorksheet(generatedId);
                  if (ws) downloadAsWord(ws);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-surface hover:bg-primary-light hover:border-primary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <FileText className="size-5 text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground">Download Word</span>
                <span className="text-[11px] text-muted-foreground">.doc format</span>
              </button>

              {/* Print */}
              <button
                type="button"
                onClick={() => {
                  const ws = loadWorksheet(generatedId);
                  if (ws) printWorksheet(ws);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-surface hover:bg-primary-light hover:border-primary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Printer className="size-5 text-amber-600" />
                </div>
                <span className="text-sm font-bold text-foreground">Print Worksheet</span>
                <span className="text-[11px] text-muted-foreground">Questions only</span>
              </button>

              {/* Answer Key */}
              <button
                type="button"
                onClick={() => {
                  const ws = loadWorksheet(generatedId);
                  if (ws) downloadAsWord(ws, true);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-surface hover:bg-secondary-light hover:border-secondary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center group-hover:bg-secondary/15 transition-colors">
                  <KeyRound className="size-5 text-secondary" />
                </div>
                <span className="text-sm font-bold text-foreground">Answer Key</span>
                <span className="text-[11px] text-muted-foreground">.doc with answers</span>
              </button>
            </div>

            {/* Secondary links */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button variant="ghost" size="md" asChild>
                <Link to="/worksheet/new" onClick={() => { setGenState('idle'); setGeneratedId(null); }}>
                  Generate Another
                </Link>
              </Button>
              <Button variant="ghost" size="md" asChild>
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
                          onChange={(e) => handleGradeChange(e.target.value)}
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

                {/* Generate button — or login CTA for restricted guest roles */}
                {isGuestRestricted ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => {
                      sessionStorage.setItem(
                        GUEST_STORAGE_KEYS.preLoginUrl,
                        window.location.pathname + window.location.search,
                      );
                      navigate('/');
                    }}
                  >
                    Login to Generate Worksheets
                  </Button>
                ) : (
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
                )}

                {genError && (
                  <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive font-semibold">
                    {genError}
                  </div>
                )}

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

      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
      />
    </AppLayout>
  );
};

export default GenerateWorksheetPage;

/**
 * @file src/modules/solve/index.tsx
 * @description Module entry point and route wrapper for the Solve module.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import ModeSelector from './components/ModeSelector';
import ExamSolve from './components/ExamSolve';
import PracticeSolve from './components/PracticeSolve';
import ResultsScreen from './components/ResultsScreen';
import { useSolveSession } from './hooks/useSolveSession';
import { useSolveResults } from './hooks/useSolveResults';
import { mathFractionsWorksheet, scienceSolarSystemWorksheet } from './mock-data';
import { loadWorksheet } from './worksheetStorage';
import { mapApiToWorksheet } from './apiMapper';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import type { SolveMode, SolveSession, SolveResults, QuestionResult, Worksheet } from './types';

/** Main solve page — handles all screens (mode select, solve, results) */
export default function SolvePage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();

  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!worksheetId) { setLoading(false); return; }
    let isMounted = true;
    const controller = new AbortController();

    // 1. Check localStorage first (for backwards compat)
    const stored = loadWorksheet(worksheetId);
    if (stored) { setWorksheet(stored); setLoading(false); return; }

    // 2. Check demo worksheets
    if (worksheetId === 'ws-math-fractions-001' || worksheetId === 'demo-math') {
      setWorksheet(mathFractionsWorksheet); setLoading(false); return;
    }
    if (worksheetId === 'ws-science-solar-001' || worksheetId === 'demo-science') {
      setWorksheet(scienceSolarSystemWorksheet); setLoading(false); return;
    }

    // 3. Fetch from API (real generated worksheets)
    (async () => {
      try {
        const token = getAuthToken();

        const res = await fetch(`${apiUrl}/api/solve/${worksheetId}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Worksheet not found (${res.status})`);
        const data = await res.json();
        if (!isMounted) return;
        setWorksheet(mapApiToWorksheet(data));
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load worksheet');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => { isMounted = false; controller.abort(); };
  }, [worksheetId]);

  if (loading) {
    return (
      <AppLayout pageTitle="Loading...">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-10 h-10 border-4 border-surface-2 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!worksheet) {
    return (
      <AppLayout pageTitle="Worksheet Not Found">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-foreground mb-2">Worksheet Not Found</h1>
            <p className="text-muted-foreground mb-4">{error || "The worksheet you're looking for doesn't exist."}</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const pageTitle = `${worksheet.title || `Grade ${worksheet.grade} ${worksheet.topic}`} — ${worksheet.subject}`;

  return (
    <AppLayout pageTitle={pageTitle}>
      <SolveController worksheet={worksheet} />
    </AppLayout>
  );
}

/** Maps a POST /api/submit response to the frontend SolveResults type. */
function mapSubmitResponse(
  apiResult: Record<string, unknown>,
  session: SolveSession,
  worksheet: Worksheet,
): SolveResults {
  const results = apiResult.results as Array<Record<string, unknown>>;
  const timeTaken = (apiResult.timeTaken as number) || 0;
  const totalScore = (apiResult.totalScore as number) || 0;
  const totalPoints = (apiResult.totalPoints as number) || worksheet.totalPoints;
  const percentage = (apiResult.percentage as number) || 0;

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const questionResults: QuestionResult[] = results.map((r) => {
    const studentAnswer = (r.studentAnswer as string) || '';
    const correct = r.correct as boolean;
    if (!studentAnswer) skippedCount++;
    else if (correct) correctCount++;
    else incorrectCount++;

    const questionId = `q-${r.number}`;
    return {
      questionId,
      number: r.number as number,
      correct,
      studentAnswer,
      correctAnswer: (r.correctAnswer as string) || '',
      explanation: (r.explanation as string) || '',
      pointsEarned: (r.pointsEarned as number) || 0,
      pointsPossible: (r.pointsPossible as number) || 1,
      hintsUsed: session.hintsUsed[questionId] || 0,
      timeSpent: session.questionTimings[questionId] || 0,
    };
  });

  const getGradeLetter = (pct: number) => {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  };

  return {
    worksheetId: worksheet.worksheetId,
    mode: session.mode,
    totalScore,
    totalPoints,
    percentage,
    grade: getGradeLetter(percentage),
    timeTaken,
    results: questionResults,
    correctCount,
    incorrectCount,
    skippedCount,
    hintsUsedTotal: Object.values(session.hintsUsed).reduce((a, b) => a + b, 0),
    averageTimePerQuestion: worksheet.questions.length > 0
      ? Math.round(timeTaken / worksheet.questions.length)
      : 0,
  };
}

function SolveController({ worksheet }: { worksheet: Worksheet }) {
  const navigate = useNavigate();
  const {
    session,
    startSession,
    answerQuestion,
    flagQuestion,
    useHint,
    navigateToQuestion,
    submitExam,
    completeQuestion,
  } = useSolveSession(worksheet);

  // Server-scored results (for exam mode)
  const [serverResults, setServerResults] = useState<SolveResults | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Client-side results (fallback for practice mode / local worksheets)
  const clientResults = useSolveResults(worksheet, session);

  // Call POST /api/submit when exam is submitted
  useEffect(() => {
    if (session.status !== 'submitted' || session.mode !== 'exam') return;
    if (serverResults) return; // already scored

    const timeTaken = session.startTime
      ? Math.floor((Date.now() - session.startTime) / 1000)
      : 0;

    // Build answers array for the API: [{number, answer}]
    const answers = worksheet.questions.map((q) => ({
      number: q.number,
      answer: session.answers[q.id] || '',
    }));

    const token = getAuthToken();

    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            worksheetId: worksheet.worksheetId,
            answers,
            timeTaken,
            timed: session.mode === 'exam',
          }),
        });

        if (!res.ok) throw new Error(`Submit failed (${res.status})`);
        const data = await res.json();
        setServerResults(mapSubmitResponse(data, session, worksheet));
      } catch (err) {
        console.error('Submit API error:', err);
        setSubmitError(err instanceof Error ? err.message : 'Scoring failed');
      }
    })();
  }, [session.status, session.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use server results for exam, client results for practice
  const results = session.mode === 'exam' ? serverResults : clientResults;

  const handleSelectMode = useCallback((mode: SolveMode) => {
    startSession(mode);
    setServerResults(null);
    setSubmitError('');
  }, [startSession]);

  const handleRetake = useCallback(() => {
    setServerResults(null);
    setSubmitError('');
    startSession(session.mode);
  }, [startSession, session.mode]);

  const handleSwitchMode = useCallback(() => {
    setServerResults(null);
    setSubmitError('');
    startSession(session.mode === 'exam' ? 'practice' : 'exam');
  }, [startSession, session.mode]);

  const handleHome = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Not started — show mode selector
  if (session.status === 'not-started') {
    return <ModeSelector worksheet={worksheet} onSelectMode={handleSelectMode} />;
  }

  // Submitted — waiting for server scoring
  if ((session.status === 'submitted' || session.status === 'completed') && !results && !submitError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
        <div className="w-10 h-10 border-4 border-surface-2 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-semibold text-sm">Scoring your answers...</p>
      </div>
    );
  }

  // Submit error — show error with retry
  if (submitError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-destructive font-semibold">{submitError}</p>
        <button
          onClick={() => { setSubmitError(''); setServerResults(null); }}
          className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Submitted — show results
  if ((session.status === 'submitted' || session.status === 'completed') && results) {
    return (
      <ResultsScreen
        results={results}
        grade={worksheet.grade}
        onRetake={handleRetake}
        onSwitchMode={handleSwitchMode}
        onHome={handleHome}
      />
    );
  }

  // In progress — show solve screen
  if (session.mode === 'exam') {
    return (
      <ExamSolve
        worksheet={worksheet}
        session={session}
        onAnswer={answerQuestion}
        onFlag={flagQuestion}
        onNavigate={navigateToQuestion}
        onSubmit={submitExam}
      />
    );
  }

  return (
    <PracticeSolve
      worksheet={worksheet}
      session={session}
      onAnswer={answerQuestion}
      onHint={useHint}
      onComplete={completeQuestion}
    />
  );
}

// Export types for route definition
export type { Worksheet, SolveMode } from './types';

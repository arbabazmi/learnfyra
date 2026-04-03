/**
 * @file src/modules/solve/index.tsx
 * @description Module entry point and route wrapper for the Solve module.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { getAuthToken, setGuestCookie, GUEST_STORAGE_KEYS } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import type { SolveMode, SolveSession, SolveResults, QuestionResult, Worksheet } from './types';

/**
 * Auto-provisions a guest session so shared solve links work for anyone.
 * Calls POST /api/auth/guest with role=student (default for anonymous visitors).
 * Returns the new guest token, or null on failure.
 */
async function ensureGuestSession(): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' }),
    });
    if (!res.ok) return null;
    // Set cookie client-side from response body (cross-origin Set-Cookie headers are blocked)
    const data = await res.json();
    if (data.guestToken) setGuestCookie(data.guestToken);
    return getAuthToken();
  } catch {
    return null;
  }
}

/** Main solve page — handles all screens (mode select, solve, results) */
export default function SolvePage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();

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
        // Auto-create guest session for anonymous visitors (shared links)
        let token = getAuthToken();
        if (!token && auth.tokenState === 'none') {
          token = await ensureGuestSession();
          if (token) auth.refresh(); // update auth context with new guest state
        }

        // Initial load: no answers/explanations (prevents cheating in exam mode).
        // Practice mode re-fetches with ?mode=practice after mode selection.
        const res = await fetch(`${apiUrl}/api/solve/${worksheetId}`, {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Worksheet not found (${res.status})`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Worksheet not found');
        }
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
  }, [worksheetId]); // eslint-disable-line react-hooks/exhaustive-deps

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

/**
 * Persists a worksheet attempt to the backend (POST /api/progress/save).
 * Best-effort: failures are logged but never block the results screen.
 * Populates LearnfyraAttempts + LearnfyraAggregates in DynamoDB.
 */
async function saveProgress(
  worksheet: Worksheet,
  solveResults: SolveResults,
  session: SolveSession,
): Promise<void> {
  const token = getAuthToken();
  if (!token) return; // guest/anonymous — nothing to track

  const answers = solveResults.results.map((r) => ({
    number: r.number,
    answer: r.studentAnswer,
  }));

  try {
    await fetch(`${apiUrl}/api/progress/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        worksheetId: worksheet.worksheetId,
        grade: worksheet.grade,
        subject: worksheet.subject,
        topic: worksheet.topic,
        // Backend expects capitalized difficulty ('Easy', 'Medium', 'Hard', 'Mixed')
        // but the solve module uses lowercase ('easy', 'medium', 'hard')
        difficulty: worksheet.difficulty.charAt(0).toUpperCase() + worksheet.difficulty.slice(1),
        totalScore: solveResults.totalScore,
        totalPoints: solveResults.totalPoints,
        percentage: solveResults.percentage,
        answers,
        timeTaken: solveResults.timeTaken,
        timed: session.mode === 'exam',
      }),
    });
  } catch (err) {
    // Non-fatal: results are already displayed; progress save is best-effort
    console.error('Progress save failed (non-fatal):', err);
  }
}

function SolveController({ worksheet: initialWorksheet }: { worksheet: Worksheet }) {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();

  // Worksheet with answers hydrated for practice mode
  const [worksheet, setWorksheet] = useState<Worksheet>(initialWorksheet);

  const {
    session,
    startSession: rawStartSession,
    answerQuestion,
    flagQuestion,
    useHint,
    navigateToQuestion,
    submitExam,
    completeQuestion,
  } = useSolveSession(worksheet);

  // When practice mode is selected, re-fetch with ?mode=practice to get answers/explanations
  const startSession = useCallback(async (mode: SolveMode) => {
    if (mode === 'practice' && worksheetId) {
      try {
        const token = getAuthToken();
        const res = await fetch(`${apiUrl}/api/solve/${worksheetId}?mode=practice`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setWorksheet(mapApiToWorksheet(data));
        }
      } catch {
        // Non-fatal: practice mode will work with client-side scoring as fallback
      }
    }
    rawStartSession(mode);
  }, [worksheetId, rawStartSession]);

  // Server-scored results (for exam mode)
  const [serverResults, setServerResults] = useState<SolveResults | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Track whether progress has been saved for the current attempt to avoid duplicates
  const progressSavedRef = useRef(false);

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
        const mapped = mapSubmitResponse(data, session, worksheet);
        setServerResults(mapped);

        // Persist attempt to backend (populates Attempts + Aggregates tables)
        if (!progressSavedRef.current) {
          progressSavedRef.current = true;
          saveProgress(worksheet, mapped, session);
        }
      } catch (err) {
        console.error('Submit API error:', err);
        setSubmitError(err instanceof Error ? err.message : 'Scoring failed');
      }
    })();
  }, [session.status, session.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save progress for practice mode when the session is submitted
  useEffect(() => {
    if (session.status !== 'submitted' || session.mode !== 'practice') return;
    if (!clientResults || progressSavedRef.current) return;

    progressSavedRef.current = true;
    saveProgress(worksheet, clientResults, session);
  }, [session.status, session.mode, clientResults]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use server results for exam, client results for practice
  const results = session.mode === 'exam' ? serverResults : clientResults;

  const handleSelectMode = useCallback((mode: SolveMode) => {
    startSession(mode);
    setServerResults(null);
    setSubmitError('');
    progressSavedRef.current = false;
  }, [startSession]);

  const handleRetake = useCallback(() => {
    setServerResults(null);
    setSubmitError('');
    progressSavedRef.current = false;
    startSession(session.mode);
  }, [startSession, session.mode]);

  const handleSwitchMode = useCallback(() => {
    setServerResults(null);
    setSubmitError('');
    progressSavedRef.current = false;
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
        worksheetId={worksheetId}
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

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
import { apiUrl } from '@/lib/env';
import type { SolveMode, Worksheet } from './types';

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
    fetch(`${apiUrl}/api/solve/${worksheetId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Worksheet not found (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setWorksheet(data as Worksheet);
      })
      .catch((err) => {
        if (!isMounted || err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => { if (isMounted) setLoading(false); });

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

  const pageTitle = `${worksheet.title} — ${worksheet.subject}`;

  return (
    <AppLayout pageTitle={pageTitle}>
      <SolveController worksheet={worksheet} />
    </AppLayout>
  );
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

  const results = useSolveResults(worksheet, session);

  const handleSelectMode = useCallback((mode: SolveMode) => {
    startSession(mode);
  }, [startSession]);

  const handleRetake = useCallback(() => {
    startSession(session.mode);
  }, [startSession, session.mode]);

  const handleSwitchMode = useCallback(() => {
    startSession(session.mode === 'exam' ? 'practice' : 'exam');
  }, [startSession, session.mode]);

  const handleHome = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Not started — show mode selector
  if (session.status === 'not-started') {
    return <ModeSelector worksheet={worksheet} onSelectMode={handleSelectMode} />;
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

/**
 * @file src/modules/solve/index.tsx
 * @description Module entry point and route wrapper for the Solve module.
 */

import { useState, useCallback } from 'react';
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
import type { SolveMode, Worksheet } from './types';

// Worksheet lookup: check storage first, then fall back to mock data for demos
function getWorksheet(id: string): Worksheet | null {
  // Check localStorage for generated worksheets
  const stored = loadWorksheet(id);
  if (stored) return stored;

  // Fall back to built-in demo worksheets
  if (id === 'ws-math-fractions-001' || id === 'demo-math') return mathFractionsWorksheet;
  if (id === 'ws-science-solar-001' || id === 'demo-science') return scienceSolarSystemWorksheet;

  return null;
}

/** Main solve page — handles all screens (mode select, solve, results) */
export default function SolvePage() {
  const { worksheetId } = useParams<{ worksheetId: string }>();
  const navigate = useNavigate();

  const worksheet = getWorksheet(worksheetId || '');

  if (!worksheet) {
    return (
      <AppLayout pageTitle="Worksheet Not Found">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-foreground mb-2">Worksheet Not Found</h1>
            <p className="text-muted-foreground mb-4">The worksheet you're looking for doesn't exist.</p>
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

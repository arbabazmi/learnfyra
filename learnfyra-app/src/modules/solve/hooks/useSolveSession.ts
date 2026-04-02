/**
 * @file src/modules/solve/hooks/useSolveSession.ts
 * @description State management hook for the solve session.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SolveMode, SolveSession, Worksheet } from '../types';

const STORAGE_KEY = 'learnfyra-solve-session';

function loadSession(worksheetId: string): Partial<SolveSession> | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}-${worksheetId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.flaggedQuestions = new Set(data.flaggedQuestions || []);
    return data;
  } catch {
    return null;
  }
}

function saveSession(session: SolveSession) {
  try {
    const serializable = {
      ...session,
      flaggedQuestions: Array.from(session.flaggedQuestions),
    };
    sessionStorage.setItem(`${STORAGE_KEY}-${session.worksheetId}`, JSON.stringify(serializable));
  } catch { /* silently fail */ }
}

export function useSolveSession(worksheet: Worksheet) {
  const [session, setSession] = useState<SolveSession>(() => {
    const saved = loadSession(worksheet.worksheetId);
    if (saved && saved.status === 'in-progress') {
      return {
        worksheetId: worksheet.worksheetId,
        mode: saved.mode || 'exam',
        currentQuestionIndex: saved.currentQuestionIndex || 0,
        answers: saved.answers || {},
        flaggedQuestions: saved.flaggedQuestions || new Set(),
        hintsUsed: saved.hintsUsed || {},
        startTime: saved.startTime || Date.now(),
        questionTimings: saved.questionTimings || {},
        questionStartTime: Date.now(),
        status: 'in-progress',
      };
    }
    return {
      worksheetId: worksheet.worksheetId,
      mode: 'exam',
      currentQuestionIndex: 0,
      answers: {},
      flaggedQuestions: new Set(),
      hintsUsed: {},
      startTime: 0,
      questionTimings: {},
      questionStartTime: 0,
      status: 'not-started',
    };
  });

  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Auto-save on changes
  useEffect(() => {
    if (session.status === 'in-progress') {
      saveSession(session);
    }
  }, [session]);

  const startSession = useCallback((mode: SolveMode) => {
    setSession(prev => ({
      ...prev,
      mode,
      status: 'in-progress',
      startTime: Date.now(),
      questionStartTime: Date.now(),
      currentQuestionIndex: 0,
      answers: {},
      flaggedQuestions: new Set(),
      hintsUsed: {},
      questionTimings: {},
    }));
  }, []);

  const answerQuestion = useCallback((questionId: string, answer: string) => {
    setSession(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  }, []);

  const flagQuestion = useCallback((questionId: string) => {
    setSession(prev => {
      const flagged = new Set(prev.flaggedQuestions);
      if (flagged.has(questionId)) {
        flagged.delete(questionId);
      } else {
        flagged.add(questionId);
      }
      return { ...prev, flaggedQuestions: flagged };
    });
  }, []);

  const useHint = useCallback((questionId: string) => {
    setSession(prev => {
      const current = prev.hintsUsed[questionId] || 0;
      if (current >= 2) return prev;
      return {
        ...prev,
        hintsUsed: { ...prev.hintsUsed, [questionId]: current + 1 },
      };
    });
  }, []);

  const navigateToQuestion = useCallback((index: number) => {
    setSession(prev => {
      const currentQ = worksheet.questions[prev.currentQuestionIndex];
      const elapsed = Date.now() - prev.questionStartTime;
      const existingTime = prev.questionTimings[currentQ.id] || 0;

      return {
        ...prev,
        currentQuestionIndex: index,
        questionStartTime: Date.now(),
        questionTimings: {
          ...prev.questionTimings,
          [currentQ.id]: existingTime + elapsed,
        },
      };
    });
  }, [worksheet.questions]);

  const submitExam = useCallback(() => {
    setSession(prev => {
      const currentQ = worksheet.questions[prev.currentQuestionIndex];
      const elapsed = Date.now() - prev.questionStartTime;
      const existingTime = prev.questionTimings[currentQ.id] || 0;

      return {
        ...prev,
        status: 'submitted',
        questionTimings: {
          ...prev.questionTimings,
          [currentQ.id]: existingTime + elapsed,
        },
      };
    });
  }, [worksheet.questions]);

  const completeQuestion = useCallback(() => {
    setSession(prev => {
      const currentQ = worksheet.questions[prev.currentQuestionIndex];
      const elapsed = Date.now() - prev.questionStartTime;
      const existingTime = prev.questionTimings[currentQ.id] || 0;
      const isLast = prev.currentQuestionIndex >= worksheet.questions.length - 1;

      return {
        ...prev,
        currentQuestionIndex: isLast ? prev.currentQuestionIndex : prev.currentQuestionIndex + 1,
        questionStartTime: Date.now(),
        status: isLast ? 'submitted' : prev.status,
        questionTimings: {
          ...prev.questionTimings,
          [currentQ.id]: existingTime + elapsed,
        },
      };
    });
  }, [worksheet.questions]);

  const answeredCount = Object.keys(session.answers).length;
  const totalQuestions = worksheet.questions.length;
  const currentQuestion = worksheet.questions[session.currentQuestionIndex];
  const elapsedTime = session.startTime ? Math.floor((Date.now() - session.startTime) / 1000) : 0;

  return {
    session,
    currentQuestion,
    answeredCount,
    totalQuestions,
    elapsedTime,
    startSession,
    answerQuestion,
    flagQuestion,
    useHint,
    navigateToQuestion,
    submitExam,
    completeQuestion,
  };
}

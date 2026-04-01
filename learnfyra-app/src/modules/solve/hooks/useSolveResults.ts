/**
 * @file src/modules/solve/hooks/useSolveResults.ts
 * @description Computes results from a solve session.
 */

import { useMemo } from 'react';
import type { SolveSession, Worksheet, SolveResults, QuestionResult } from '../types';

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

function checkAnswer(studentAnswer: string, correctAnswer: string, type: string): boolean {
  const student = normalizeAnswer(studentAnswer);
  const correct = normalizeAnswer(correctAnswer);

  if (type === 'multiple-choice' || type === 'true-false') {
    return student === correct;
  }

  if (type === 'fill-in-the-blank') {
    return student === correct;
  }

  if (type === 'short-answer') {
    // Keyword match: correct answer must appear in student answer
    const keywords = correct.split(/\s+/);
    return keywords.some(kw => student.includes(kw));
  }

  if (type === 'matching') {
    try {
      const studentPairs = JSON.parse(studentAnswer);
      const correctPairs = JSON.parse(correctAnswer);
      return JSON.stringify(studentPairs) === JSON.stringify(correctPairs);
    } catch {
      return false;
    }
  }

  return student === correct;
}

function getGradeLetter(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

export function useSolveResults(
  worksheet: Worksheet,
  session: SolveSession,
): SolveResults | null {
  return useMemo(() => {
    if (session.status !== 'submitted' && session.status !== 'completed') {
      return null;
    }

    const timeTaken = session.startTime
      ? Math.floor((Date.now() - session.startTime) / 1000)
      : 0;

    let totalScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let hintsUsedTotal = 0;
    const results: QuestionResult[] = [];

    for (const question of worksheet.questions) {
      const studentAnswer = session.answers[question.id] || '';
      const hintsUsed = session.hintsUsed[question.id] || 0;
      const timeSpent = session.questionTimings[question.id] || 0;
      hintsUsedTotal += hintsUsed;

      if (!studentAnswer) {
        skippedCount++;
        results.push({
          questionId: question.id,
          number: question.number,
          correct: false,
          studentAnswer: '',
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          pointsEarned: 0,
          pointsPossible: question.points,
          hintsUsed,
          timeSpent,
        });
        continue;
      }

      const correct = checkAnswer(studentAnswer, question.correctAnswer, question.type);
      const pointsEarned = correct ? question.points : 0;
      totalScore += pointsEarned;

      if (correct) correctCount++;
      else incorrectCount++;

      results.push({
        questionId: question.id,
        number: question.number,
        correct,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        pointsEarned,
        pointsPossible: question.points,
        hintsUsed,
        timeSpent,
      });
    }

    const percentage = worksheet.totalPoints > 0
      ? Math.round((totalScore / worksheet.totalPoints) * 100)
      : 0;

    return {
      worksheetId: worksheet.worksheetId,
      mode: session.mode,
      totalScore,
      totalPoints: worksheet.totalPoints,
      percentage,
      grade: getGradeLetter(percentage),
      timeTaken,
      results,
      correctCount,
      incorrectCount,
      skippedCount,
      hintsUsedTotal,
      averageTimePerQuestion: worksheet.questions.length > 0
        ? Math.round(timeTaken / worksheet.questions.length)
        : 0,
    };
  }, [worksheet, session]);
}

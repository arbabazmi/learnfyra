/**
 * @file src/modules/solve/hooks/useSolveResults.ts
 * @description Computes results from a solve session.
 */

import { useMemo } from 'react';
import type { SolveSession, Worksheet, SolveResults, QuestionResult } from '../types';

// ---------------------------------------------------------------------------
// Scoring helpers — mirror src/solve/scorer.js exactly (same logic, TS types).
// Do NOT import from the backend; the module systems differ.
// ---------------------------------------------------------------------------

/**
 * Normalises a string for comparison: lowercase, collapse internal whitespace
 * to a single space, and trim leading/trailing whitespace.
 */
function normalizeText(str: string): string {
  return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalises a numeric string to a canonical form.
 * Handles leading-dot decimals (.5 → 0.5) and trailing zeros (20.0 → 20).
 * Returns null if the string does not represent a finite number.
 */
function normalizeNumeric(str: string): string | null {
  const trimmed = String(str).trim();
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  if (trimmed === '' || isNaN(Number(trimmed))) return null;
  return String(n);
}

/**
 * Extracts the leading number from a string that may contain trailing units
 * (e.g. "24 stickers" → "24").
 */
function extractLeadingNumber(str: string): string | null {
  const trimmed = String(str).trim();
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

/**
 * Compares two answer strings numerically first, falling back to normalised
 * text equality. Handles answers with trailing units (e.g. "24 stickers" vs "24").
 */
function numericEquals(a: string, b: string): boolean {
  const na = normalizeNumeric(a);
  const nb = normalizeNumeric(b);
  if (na !== null && nb !== null) return na === nb;

  const la = extractLeadingNumber(a);
  const lb = extractLeadingNumber(b);
  if (la !== null && lb !== null) return la === lb;

  return normalizeText(a) === normalizeText(b);
}

/**
 * Extracts the option letter from a multiple-choice answer string.
 * Normalises both "B. 56" (stored format) and "B" (student input) to "B".
 * Returns '' when no single-letter option can be identified.
 */
function extractOptionLetter(str: string): string {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  const match = trimmed.match(/^([A-Za-z])(?:[.\s]|$)/);
  if (match) return match[1].toUpperCase();
  if (/^[A-Za-z]$/.test(trimmed)) return trimmed.toUpperCase();
  return '';
}

/**
 * Expands true/false abbreviations and synonyms used on both sides.
 */
function expandTrueFalse(v: string): string {
  if (v === 't' || v === 'yes') return 'true';
  if (v === 'f' || v === 'no') return 'false';
  return v;
}

/**
 * Scores a single answer against the correct answer for the given question type.
 * Mirrors the switch statement in src/solve/scorer.js scoreQuestion().
 */
export function checkAnswer(studentAnswer: string, correctAnswer: string, type: string): boolean {
  if (type === 'multiple-choice') {
    const correctLetter = extractOptionLetter(String(correctAnswer));
    const studentLetter = extractOptionLetter(String(studentAnswer));
    if (correctLetter === '' || studentLetter === '') return false;
    return correctLetter === studentLetter;
  }

  if (type === 'true-false') {
    const normCorrect = expandTrueFalse(normalizeText(correctAnswer));
    const normStudent = expandTrueFalse(normalizeText(studentAnswer));
    return normCorrect === normStudent;
  }

  if (type === 'fill-in-the-blank') {
    return numericEquals(correctAnswer, studentAnswer);
  }

  if (type === 'short-answer') {
    const normStudent = normalizeText(studentAnswer);
    if (normStudent === '') return false;
    const keywords = normalizeText(correctAnswer).split(/\s+/).filter(Boolean);
    return keywords.every(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(normStudent);
    });
  }

  if (type === 'matching') {
    // studentAnswer arrives as a JSON string of Array<{left, right}>
    let parsedStudent: { left: string; right: string }[];
    let parsedCorrect: { left: string; right: string }[];
    try {
      parsedStudent = typeof studentAnswer === 'string'
        ? JSON.parse(studentAnswer)
        : (studentAnswer as unknown as typeof parsedStudent);
      parsedCorrect = typeof correctAnswer === 'string'
        ? JSON.parse(correctAnswer)
        : (correctAnswer as unknown as typeof parsedCorrect);
    } catch {
      return false;
    }
    if (!Array.isArray(parsedStudent) || !Array.isArray(parsedCorrect)) return false;

    const correctMap: Record<string, string> = {};
    for (const pair of parsedCorrect) {
      correctMap[normalizeText(pair.left)] = normalizeText(pair.right);
    }
    let correctCount = 0;
    for (const pair of parsedStudent) {
      const key = normalizeText(pair.left);
      const val = normalizeText(pair.right);
      if (correctMap[key] !== undefined && correctMap[key] === val) correctCount++;
    }
    return correctCount === parsedCorrect.length;
  }

  // show-your-work / word-problem: extract finalAnswer from object if present
  if (type === 'show-your-work' || type === 'word-problem') {
    const answerUnknown: unknown = studentAnswer;
    const rawFinal =
      typeof answerUnknown === 'object' && answerUnknown !== null
        ? String((answerUnknown as Record<string, unknown>).finalAnswer ?? '')
        : String(studentAnswer);
    if (rawFinal === '') return false;
    return numericEquals(correctAnswer, rawFinal);
  }

  // Unknown type — normalised text equality
  return numericEquals(correctAnswer, studentAnswer);
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

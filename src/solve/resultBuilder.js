/**
 * @file src/solve/resultBuilder.js
 * @description Builds the score result object from a submitted worksheet attempt.
 * Combines the stored worksheet (with answers) against the student's submitted answers
 * and produces a full per-question breakdown plus summary statistics.
 */

import { scoreQuestion } from './scorer.js';

/**
 * Builds a complete result object for a worksheet submission.
 *
 * @param {Object} worksheet - Full solve-data.json content (questions include answers)
 * @param {Array<{number: number, answer: string|Array}>} answers - Student's submitted answers
 * @param {number} timeTaken - Seconds the student spent on the worksheet
 * @param {boolean} timed - Whether the student was in timed mode
 * @returns {Object} Result object matching the submit response schema
 */
export function buildResult(worksheet, answers, timeTaken, timed) {
  // Build a quick-lookup map: question number → student answer
  const answerMap = {};
  if (Array.isArray(answers)) {
    for (const entry of answers) {
      if (entry && entry.number != null) {
        answerMap[entry.number] = entry.answer;
      }
    }
  }

  let totalScore = 0;

  // Compute the authoritative total from per-question points, falling back to
  // worksheet.totalPoints only when questions are missing the points field.
  const questionPointsSum = (worksheet.questions || []).reduce(
    (sum, q) => sum + (typeof q.points === 'number' ? q.points : 1),
    0,
  );
  const totalPoints = questionPointsSum > 0
    ? questionPointsSum
    : (typeof worksheet.totalPoints === 'number' ? worksheet.totalPoints : 0);

  const results = (worksheet.questions || []).map((question) => {
    const studentAnswer = answerMap[question.number] ?? null;
    const { correct, pointsEarned } = scoreQuestion(question, studentAnswer);

    totalScore += pointsEarned;

    return {
      number: question.number,
      correct,
      studentAnswer: studentAnswer ?? '',
      correctAnswer: question.answer,
      explanation: question.explanation || '',
      pointsEarned,
      pointsPossible: typeof question.points === 'number' ? question.points : 1,
    };
  });

  const percentage = totalPoints > 0
    ? Math.min(100, Math.round((totalScore / totalPoints) * 100))
    : 0;

  return {
    worksheetId: worksheet.worksheetId,
    totalScore,
    totalPoints,
    percentage,
    timeTaken: typeof timeTaken === 'number' ? timeTaken : 0,
    timed: Boolean(timed),
    results,
  };
}

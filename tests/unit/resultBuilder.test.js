/**
 * @file tests/unit/resultBuilder.test.js
 * @description Unit tests for src/solve/resultBuilder.js
 * Tests verify score calculation, percentage rounding, result structure,
 * and pass-through of timeTaken/timed/worksheetId.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { buildResult } from '../../src/solve/resultBuilder.js';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const mockWorksheet = {
  worksheetId: 'test-uuid-123',
  totalPoints: 3,
  questions: [
    { number: 1, type: 'fill-in-the-blank', answer: '24',      explanation: '4×6=24',  points: 1 },
    { number: 2, type: 'multiple-choice',   answer: 'B. 56',   explanation: '7×8=56',  points: 1 },
    { number: 3, type: 'true-false',        answer: 'True',    explanation: '5×9=45',  points: 1 },
  ],
};

// All-correct answers
const allCorrectAnswers = [
  { number: 1, answer: '24' },
  { number: 2, answer: 'B' },
  { number: 3, answer: 'True' },
];

// All-wrong answers
const allWrongAnswers = [
  { number: 1, answer: '99' },
  { number: 2, answer: 'A' },
  { number: 3, answer: 'False' },
];

// Mixed: q1 and q2 correct, q3 wrong
const mixedAnswers = [
  { number: 1, answer: '24' },
  { number: 2, answer: 'B' },
  { number: 3, answer: 'False' },
];

// ─── Score totals ─────────────────────────────────────────────────────────────

describe('buildResult — score totals', () => {

  it('returns totalScore: 3 and percentage: 100 when all answers are correct', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 120, false);
    expect(result.totalScore).toBe(3);
    expect(result.percentage).toBe(100);
  });

  it('returns totalScore: 0 and percentage: 0 when all answers are wrong', () => {
    const result = buildResult(mockWorksheet, allWrongAnswers, 120, false);
    expect(result.totalScore).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('returns totalScore: 2 and percentage: 67 for 2 correct out of 3', () => {
    const result = buildResult(mockWorksheet, mixedAnswers, 120, false);
    expect(result.totalScore).toBe(2);
    expect(result.percentage).toBe(67); // Math.round(2/3*100) === 67
  });

  it('returns totalScore: 0 and percentage: 0 when answers array is empty', () => {
    const result = buildResult(mockWorksheet, [], 0, false);
    expect(result.totalScore).toBe(0);
    expect(result.percentage).toBe(0);
  });

});

// ─── Result structure ─────────────────────────────────────────────────────────

describe('buildResult — result object structure', () => {

  it('includes worksheetId from the worksheet fixture', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.worksheetId).toBe('test-uuid-123');
  });

  it('includes totalPoints from the worksheet fixture', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.totalPoints).toBe(3);
  });

  it('results array length matches number of questions', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results).toHaveLength(3);
  });

  it('each result entry has the required fields', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    const entry = result.results[0];
    expect(entry).toHaveProperty('number');
    expect(entry).toHaveProperty('correct');
    expect(entry).toHaveProperty('studentAnswer');
    expect(entry).toHaveProperty('correctAnswer');
    expect(entry).toHaveProperty('explanation');
    expect(entry).toHaveProperty('pointsEarned');
    expect(entry).toHaveProperty('pointsPossible');
  });

  it('result entry for a correct question has correct: true', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results[0].correct).toBe(true);
  });

  it('result entry for a wrong question has correct: false', () => {
    const result = buildResult(mockWorksheet, allWrongAnswers, 0, false);
    expect(result.results[0].correct).toBe(false);
  });

  it('result entry carries explanation from the worksheet', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results[0].explanation).toBe('4×6=24');
  });

  it('result entry carries the correct answer from the worksheet', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results[0].correctAnswer).toBe('24');
  });

  it('result entry carries the student answer', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results[0].studentAnswer).toBe('24');
  });

  it('result entry pointsPossible matches question points value', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 0, false);
    expect(result.results[0].pointsPossible).toBe(1);
  });

});

// ─── timeTaken and timed pass-through ────────────────────────────────────────

describe('buildResult — timeTaken and timed pass-through', () => {

  it('passes timeTaken through to the result', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 845, false);
    expect(result.timeTaken).toBe(845);
  });

  it('passes timed: true through to the result', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 845, true);
    expect(result.timed).toBe(true);
  });

  it('passes timed: false through to the result', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, 120, false);
    expect(result.timed).toBe(false);
  });

  it('defaults timeTaken to 0 when a non-number is passed', () => {
    const result = buildResult(mockWorksheet, allCorrectAnswers, undefined, false);
    expect(result.timeTaken).toBe(0);
  });

});

/**
 * @file tests/unit/scorer.test.js
 * @description Unit tests for src/solve/scorer.js
 * Tests cover extractOptionLetter and scoreQuestion for every question type
 * defined in the Learnfyra worksheet schema.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { extractOptionLetter, scoreQuestion } from '../../src/solve/scorer.js';

// ─── extractOptionLetter ──────────────────────────────────────────────────────

describe('extractOptionLetter', () => {

  it('extracts letter from "B. 56" format', () => {
    expect(extractOptionLetter('B. 56')).toBe('B');
  });

  it('extracts letter from "A. 42" format', () => {
    expect(extractOptionLetter('A. 42')).toBe('A');
  });

  it('returns plain letter unchanged', () => {
    expect(extractOptionLetter('B')).toBe('B');
  });

  it('normalises lowercase letter to uppercase', () => {
    expect(extractOptionLetter('b')).toBe('B');
  });

  it('returns empty string for empty string input', () => {
    expect(extractOptionLetter('')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(extractOptionLetter(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(extractOptionLetter(undefined)).toBe('');
  });

  it('extracts letter from "B." (trailing dot, no text after)', () => {
    expect(extractOptionLetter('B.')).toBe('B');
  });

});

// ─── scoreQuestion — multiple-choice ─────────────────────────────────────────

describe('scoreQuestion — multiple-choice', () => {

  const question = { type: 'multiple-choice', answer: 'B. 56', points: 1 };

  it('scores correct when student answer matches by letter', () => {
    const result = scoreQuestion(question, 'B');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when student answer does not match', () => {
    const result = scoreQuestion(question, 'A');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('scores correct when both correct answer and student answer are in full "B. 56" format', () => {
    const result = scoreQuestion(question, 'B. 56');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

});

// ─── scoreQuestion — true-false ───────────────────────────────────────────────

describe('scoreQuestion — true-false', () => {

  const question = { type: 'true-false', answer: 'True', points: 1 };

  it('scores correct when student answers True', () => {
    const result = scoreQuestion(question, 'True');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores correct case-insensitively', () => {
    const result = scoreQuestion(question, 'true');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when student answers False', () => {
    const result = scoreQuestion(question, 'False');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — fill-in-the-blank ───────────────────────────────────────

describe('scoreQuestion — fill-in-the-blank', () => {

  it('scores correct on exact match', () => {
    const q = { type: 'fill-in-the-blank', answer: '24', points: 1 };
    const result = scoreQuestion(q, '24');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores correct case-insensitively', () => {
    const q = { type: 'fill-in-the-blank', answer: 'Paris', points: 1 };
    const result = scoreQuestion(q, 'paris');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores correct with leading and trailing whitespace', () => {
    const q = { type: 'fill-in-the-blank', answer: '24', points: 1 };
    const result = scoreQuestion(q, ' 24 ');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when answer does not match', () => {
    const q = { type: 'fill-in-the-blank', answer: '24', points: 1 };
    const result = scoreQuestion(q, '25');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — short-answer ─────────────────────────────────────────────

describe('scoreQuestion — short-answer', () => {

  const question = { type: 'short-answer', answer: 'photosynthesis', points: 1 };

  it('scores correct when student answer contains the keyword', () => {
    const result = scoreQuestion(question, 'Photosynthesis is how plants make food');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when student answer does not contain the keyword', () => {
    const result = scoreQuestion(question, "I don't know");
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — matching ─────────────────────────────────────────────────

describe('scoreQuestion — matching', () => {

  const correctPairs = [
    { left: 'Cat', right: 'Meow' },
    { left: 'Dog', right: 'Woof' },
  ];
  const question = { type: 'matching', answer: correctPairs, points: 1 };

  it('scores correct when all pairs match', () => {
    const studentAnswer = [
      { left: 'Cat', right: 'Meow' },
      { left: 'Dog', right: 'Woof' },
    ];
    const result = scoreQuestion(question, studentAnswer);
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores partial credit when one pair is correct out of two on a 2-point question', () => {
    const twoPointQuestion = { type: 'matching', answer: correctPairs, points: 2 };
    const studentAnswer = [
      { left: 'Cat', right: 'Meow' },
      { left: 'Dog', right: 'Bark' }, // wrong
    ];
    const result = scoreQuestion(twoPointQuestion, studentAnswer);
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(1);
  });

  it('returns { correct: false, pointsEarned: 0 } when student answer is not an array', () => {
    const result = scoreQuestion(question, 'Cat=Meow,Dog=Woof');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — show-your-work ──────────────────────────────────────────

describe('scoreQuestion — show-your-work', () => {

  const question = { type: 'show-your-work', answer: '42', points: 1 };

  it('scores correct when student submits the answer as a string', () => {
    const result = scoreQuestion(question, '42');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores correct when student submits an object with finalAnswer', () => {
    const result = scoreQuestion(question, { finalAnswer: '42' });
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when answer is wrong', () => {
    const result = scoreQuestion(question, '41');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — word-problem ─────────────────────────────────────────────

describe('scoreQuestion — word-problem', () => {

  const question = { type: 'word-problem', answer: '42', points: 1 };

  it('scores correct when student submits the answer as a string', () => {
    const result = scoreQuestion(question, '42');
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores correct when student submits an object with finalAnswer', () => {
    const result = scoreQuestion(question, { finalAnswer: '42' });
    expect(result.correct).toBe(true);
    expect(result.pointsEarned).toBe(1);
  });

  it('scores incorrect when answer is wrong', () => {
    const result = scoreQuestion(question, '41');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

// ─── scoreQuestion — edge cases ───────────────────────────────────────────────

describe('scoreQuestion — edge cases', () => {

  const question = { type: 'fill-in-the-blank', answer: '42', points: 1 };

  it('returns { correct: false, pointsEarned: 0 } for empty string student answer', () => {
    const result = scoreQuestion(question, '');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('returns { correct: false, pointsEarned: 0 } for null student answer', () => {
    const result = scoreQuestion(question, null);
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it('returns { correct: false, pointsEarned: 0 } for unknown question type', () => {
    const unknownQ = { type: 'essay', answer: 'some answer', points: 1 };
    const result = scoreQuestion(unknownQ, 'some answer');
    expect(result.correct).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

});

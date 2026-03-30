/**
 * @file tests/unit/questionBankUtils.test.js
 * @description Unit tests for src/questionBank/utils.js
 */

import { describe, it, expect } from '@jest/globals';
import { computeDedupeHash } from '../../src/questionBank/utils.js';

const BASE = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  type: 'multiple-choice',
  question: 'What is 6 × 7?',
};

describe('computeDedupeHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeDedupeHash(BASE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for identical inputs', () => {
    expect(computeDedupeHash(BASE)).toBe(computeDedupeHash({ ...BASE }));
  });

  it('is case-insensitive on subject', () => {
    const lower = computeDedupeHash({ ...BASE, subject: 'math' });
    const upper = computeDedupeHash({ ...BASE, subject: 'MATH' });
    expect(lower).toBe(upper);
  });

  it('is case-insensitive on topic', () => {
    const a = computeDedupeHash({ ...BASE, topic: 'multiplication' });
    const b = computeDedupeHash({ ...BASE, topic: 'MULTIPLICATION' });
    expect(a).toBe(b);
  });

  it('is case-insensitive on type', () => {
    const a = computeDedupeHash({ ...BASE, type: 'multiple-choice' });
    const b = computeDedupeHash({ ...BASE, type: 'Multiple-Choice' });
    expect(a).toBe(b);
  });

  it('is case-insensitive on question text', () => {
    const a = computeDedupeHash({ ...BASE, question: 'what is 6 × 7?' });
    const b = computeDedupeHash({ ...BASE, question: 'WHAT IS 6 × 7?' });
    expect(a).toBe(b);
  });

  it('trims whitespace from question text', () => {
    const a = computeDedupeHash({ ...BASE, question: '  What is 6 × 7?  ' });
    const b = computeDedupeHash({ ...BASE, question: 'What is 6 × 7?' });
    expect(a).toBe(b);
  });

  it('produces different hashes for different grades', () => {
    const a = computeDedupeHash({ ...BASE, grade: 3 });
    const b = computeDedupeHash({ ...BASE, grade: 4 });
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different question text', () => {
    const a = computeDedupeHash({ ...BASE, question: 'What is 6 × 7?' });
    const b = computeDedupeHash({ ...BASE, question: 'What is 6 × 8?' });
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different types', () => {
    const a = computeDedupeHash({ ...BASE, type: 'multiple-choice' });
    const b = computeDedupeHash({ ...BASE, type: 'true-false' });
    expect(a).not.toBe(b);
  });

  it('handles numeric grade as string without changing the hash', () => {
    const a = computeDedupeHash({ ...BASE, grade: 3 });
    const b = computeDedupeHash({ ...BASE, grade: '3' });
    expect(a).toBe(b);
  });

  it('handles missing fields gracefully (empty string fallback)', () => {
    expect(() => computeDedupeHash({})).not.toThrow();
    const hash = computeDedupeHash({});
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

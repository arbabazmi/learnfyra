/**
 * @file tests/unit/antiGaming.test.js
 * @description Unit tests for src/rewards/antiGaming.js — detectGaming pure function.
 * No mocking required; all tests are synchronous.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { detectGaming } from '../../src/rewards/antiGaming.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds an answers array from a plain array of answer strings.
 * @param {string[]} letters
 * @returns {Array<{answer: string}>}
 */
function answers(letters) {
  return letters.map((a) => ({ answer: a }));
}

// ─── All-identical MC answers (RANDOM_PATTERN) ───────────────────────────────

describe('detectGaming — all-A pattern', () => {

  it('isGaming is true for 10 identical "A" answers', () => {
    const result = detectGaming(answers(Array(10).fill('A')), 300, 600);
    expect(result.isGaming).toBe(true);
  });

  it('warnings includes RANDOM_PATTERN for all-A answers', () => {
    const result = detectGaming(answers(Array(10).fill('A')), 300, 600);
    expect(result.warnings).toContain('RANDOM_PATTERN');
  });

  it('pointsMultiplier is 0 for all-A answers', () => {
    const result = detectGaming(answers(Array(10).fill('A')), 300, 600);
    expect(result.pointsMultiplier).toBe(0);
  });

});

describe('detectGaming — all-B pattern', () => {

  it('isGaming is true for 10 identical "B" answers', () => {
    const result = detectGaming(answers(Array(10).fill('B')), 300, 600);
    expect(result.isGaming).toBe(true);
  });

  it('warnings includes RANDOM_PATTERN for all-B answers', () => {
    const result = detectGaming(answers(Array(10).fill('B')), 300, 600);
    expect(result.warnings).toContain('RANDOM_PATTERN');
  });

  it('pointsMultiplier is 0 for all-B answers', () => {
    const result = detectGaming(answers(Array(10).fill('B')), 300, 600);
    expect(result.pointsMultiplier).toBe(0);
  });

});

// ─── Alternating period-2 pattern ────────────────────────────────────────────

describe('detectGaming — alternating A/B period-2 pattern', () => {

  it('isGaming is true for A,B,A,B,A,B,A,B', () => {
    const result = detectGaming(answers(['A','B','A','B','A','B','A','B']), 300, 600);
    expect(result.isGaming).toBe(true);
  });

  it('warnings includes ALTERNATING_PATTERN for period-2 sequence', () => {
    const result = detectGaming(answers(['A','B','A','B','A','B','A','B']), 300, 600);
    expect(result.warnings).toContain('ALTERNATING_PATTERN');
  });

  it('pointsMultiplier is 0 for period-2 alternating pattern', () => {
    const result = detectGaming(answers(['A','B','A','B','A','B','A','B']), 300, 600);
    expect(result.pointsMultiplier).toBe(0);
  });

});

// ─── Alternating period-4 pattern ────────────────────────────────────────────

describe('detectGaming — alternating A/B/C/D period-4 pattern', () => {

  it('isGaming is true for A,B,C,D,A,B,C,D', () => {
    const result = detectGaming(answers(['A','B','C','D','A','B','C','D']), 300, 600);
    expect(result.isGaming).toBe(true);
  });

  it('warnings includes ALTERNATING_PATTERN for period-4 sequence', () => {
    const result = detectGaming(answers(['A','B','C','D','A','B','C','D']), 300, 600);
    expect(result.warnings).toContain('ALTERNATING_PATTERN');
  });

  it('pointsMultiplier is 0 for period-4 alternating pattern', () => {
    const result = detectGaming(answers(['A','B','C','D','A','B','C','D']), 300, 600);
    expect(result.pointsMultiplier).toBe(0);
  });

});

// ─── TOO_FAST check ───────────────────────────────────────────────────────────

describe('detectGaming — TOO_FAST', () => {

  it('isGaming is true when timeTaken=30 and estimatedTime=600 (under 10%)', () => {
    const result = detectGaming(answers(['B','C','A','D','B']), 30, 600);
    expect(result.isGaming).toBe(true);
  });

  it('warnings includes TOO_FAST when timeTaken < estimatedTime * 0.1', () => {
    const result = detectGaming(answers(['B','C','A','D','B']), 30, 600);
    expect(result.warnings).toContain('TOO_FAST');
  });

  it('isGaming is false when timeTaken is exactly at the 10% threshold', () => {
    // timeTaken=60 is NOT < 600*0.1=60 — boundary is strict less-than
    const result = detectGaming(answers(['B','C','A','D','B']), 60, 600);
    expect(result.isGaming).toBe(false);
  });

});

// ─── Legitimate submission ────────────────────────────────────────────────────

describe('detectGaming — legitimate submission', () => {

  it('isGaming is false for varied answers at normal speed', () => {
    const result = detectGaming(
      answers(['A','C','B','D','B','A','C','D','B','A']),
      300,
      600,
    );
    expect(result.isGaming).toBe(false);
  });

  it('pointsMultiplier is 1 for a clean submission', () => {
    const result = detectGaming(
      answers(['A','C','B','D','B','A','C','D','B','A']),
      300,
      600,
    );
    expect(result.pointsMultiplier).toBe(1);
  });

  it('warnings array is empty for a clean submission', () => {
    const result = detectGaming(
      answers(['A','C','B','D','B','A','C','D','B','A']),
      300,
      600,
    );
    expect(result.warnings).toHaveLength(0);
  });

});

// ─── Fill-in-the-blank answers are ignored ───────────────────────────────────

describe('detectGaming — fill-in-the-blank answers not flagged', () => {

  it('isGaming is false for text answers like "24" and "hello"', () => {
    // Multi-character strings are filtered out — only single letters count
    const result = detectGaming(
      answers(['24','hello','42','world','yes','no','maybe','always']),
      300,
      600,
    );
    expect(result.isGaming).toBe(false);
  });

  it('pointsMultiplier is 1 when all answers are non-MC text', () => {
    const result = detectGaming(
      answers(['24','hello','42','world']),
      300,
      600,
    );
    expect(result.pointsMultiplier).toBe(1);
  });

});

// ─── Below threshold — fewer than 4 MC answers ───────────────────────────────

describe('detectGaming — only 3 MC answers (below 4-answer threshold)', () => {

  it('isGaming is false for only 3 single-letter MC answers', () => {
    // 3 identical letters: not enough to trigger pattern check (threshold is >= 4)
    const result = detectGaming(answers(['A','A','A']), 300, 600);
    expect(result.isGaming).toBe(false);
  });

  it('warnings array is empty when fewer than 4 MC answers are present', () => {
    const result = detectGaming(answers(['A','B','A']), 300, 600);
    expect(result.warnings).toHaveLength(0);
  });

});

// ─── Zero estimatedTime — TOO_FAST is skipped ────────────────────────────────

describe('detectGaming — zero estimatedTime skips TOO_FAST check', () => {

  it('isGaming is false when estimatedTime is 0 even with very low timeTaken', () => {
    const result = detectGaming(
      answers(['B','C','A','D','B','C','A','D']),
      1,
      0,
    );
    // ALTERNATING would fire on that sequence, so use varied answers
    const clean = detectGaming(
      answers(['A','C','B','D','B']),
      1,
      0,
    );
    expect(clean.isGaming).toBe(false);
  });

  it('warnings does not include TOO_FAST when estimatedTime is 0', () => {
    const result = detectGaming(answers(['A','C','B','D','B']), 1, 0);
    expect(result.warnings).not.toContain('TOO_FAST');
  });

});

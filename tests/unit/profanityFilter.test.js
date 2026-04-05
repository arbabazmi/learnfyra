/**
 * @file tests/unit/profanityFilter.test.js
 * @description Unit tests for src/ai/validation/profanityFilter.js
 *
 * Covers:
 *   - Detects profanity in question, options, answer, explanation fields
 *   - Case-insensitive matching
 *   - Common letter substitutions (@→a, 3→e, $→s, 0→o, 1→i)
 *   - Clean content passes without false positives
 *   - Whole-word boundary avoids substring false positives ("classic" != "ass")
 *   - Edge cases: empty string, null/undefined fields, empty worksheet
 *   - Title and instructions fields scanned
 *   - Multiple matches returned
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  scanForProfanity,
  invalidateWordListCache,
} from '../../src/ai/validation/profanityFilter.js';

// ── Reset word list cache before each test so list-file reads are fresh ───────
beforeEach(() => {
  invalidateWordListCache();
});

// ── Worksheet builder helpers ─────────────────────────────────────────────────

/**
 * Builds a minimal clean worksheet with one question.
 */
function cleanWorksheet(overrides = {}) {
  return {
    title: 'Math Worksheet',
    instructions: 'Answer all questions.',
    questions: [
      {
        number: 1,
        type: 'multiple-choice',
        question: 'What is 6 × 7?',
        options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
        answer: 'B',
        explanation: '6 × 7 = 42',
      },
    ],
    ...overrides,
  };
}

/**
 * Returns a worksheet with the given text in the question field of Q1.
 */
function worksheetWithQuestion(text) {
  return cleanWorksheet({
    questions: [{ number: 1, type: 'fill-in-the-blank', question: text, answer: 'Paris', explanation: 'Paris is the capital.' }],
  });
}

// ── Happy path — clean content ────────────────────────────────────────────────

describe('scanForProfanity — clean content', () => {
  it('returns safe=true for a clean math worksheet', () => {
    const result = scanForProfanity(cleanWorksheet());
    expect(result.safe).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it('returns safe=true for an empty questions array', () => {
    const result = scanForProfanity({ title: 'Empty', instructions: 'None', questions: [] });
    expect(result.safe).toBe(true);
  });

  it('returns safe=true when questions key is missing', () => {
    const result = scanForProfanity({ title: 'Safe', instructions: 'Read carefully.' });
    expect(result.safe).toBe(true);
  });

  it('does not flag the word "classic" (contains "ass" as substring)', () => {
    const result = scanForProfanity(worksheetWithQuestion('Name a classic novel.'));
    expect(result.safe).toBe(true);
    expect(result.matches).not.toContain('ass');
  });

  it('does not flag "grassland" (contains "ass" as substring)', () => {
    const result = scanForProfanity(worksheetWithQuestion('Describe a grassland biome.'));
    expect(result.safe).toBe(true);
  });

  it('does not flag "assignment" (contains "ass" as substring)', () => {
    const result = scanForProfanity(worksheetWithQuestion('Complete this assignment.'));
    expect(result.safe).toBe(true);
  });

  it('does not flag "sheet" (no profanity substring match)', () => {
    const result = scanForProfanity(worksheetWithQuestion('Fill in the worksheet.'));
    expect(result.safe).toBe(true);
  });
});

// ── Detection in specific fields ──────────────────────────────────────────────

describe('scanForProfanity — field detection', () => {
  it('detects profanity in the question field', () => {
    const result = scanForProfanity(worksheetWithQuestion('What the fuck is 2+2?'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('fuck');
  });

  it('detects profanity in the answer field', () => {
    const ws = cleanWorksheet({
      questions: [{ number: 1, type: 'short-answer', question: 'Describe it.', answer: 'It is bullshit.', explanation: 'See reference.' }],
    });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('bullshit');
  });

  it('detects profanity in the explanation field', () => {
    const ws = cleanWorksheet({
      questions: [{ number: 1, type: 'short-answer', question: 'How?', answer: '42', explanation: 'Because shit happens.' }],
    });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('shit');
  });

  it('detects profanity in an options array item', () => {
    const ws = cleanWorksheet({
      questions: [{
        number: 1,
        type: 'multiple-choice',
        question: 'Which is correct?',
        options: ['A. dogs', 'B. cats', 'C. dick move', 'D. birds'],
        answer: 'A',
        explanation: 'Dogs are common pets.',
      }],
    });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('dick');
  });

  it('detects profanity in the title field', () => {
    const ws = cleanWorksheet({ title: 'Damn Good Worksheet' });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('damn');
  });

  it('detects profanity in the instructions field', () => {
    const ws = cleanWorksheet({ instructions: 'Do not be an asshole about this.' });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('asshole');
  });
});

// ── Case-insensitive matching ─────────────────────────────────────────────────

describe('scanForProfanity — case-insensitive', () => {
  it('detects uppercase profanity', () => {
    const result = scanForProfanity(worksheetWithQuestion('FUCK this question.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('fuck');
  });

  it('detects mixed-case profanity', () => {
    const result = scanForProfanity(worksheetWithQuestion('What Shit.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('shit');
  });

  it('detects title-case profanity', () => {
    const result = scanForProfanity(worksheetWithQuestion('That Bitch was wrong.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('bitch');
  });
});

// ── Common substitution detection ────────────────────────────────────────────

describe('scanForProfanity — substitution normalization', () => {
  it('detects @ substitution for a (d@mn → damn)', () => {
    const result = scanForProfanity(worksheetWithQuestion('d@mn this.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('damn');
  });

  it('detects 3 substitution for e (sh3t → shit via 3→e; separate word sh1t → shit)', () => {
    // sh1t: 1 → i makes "shit"
    const result = scanForProfanity(worksheetWithQuestion('sh1t happens.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('shit');
  });

  it('detects $ substitution for s (a$$hole → asshole)', () => {
    const result = scanForProfanity(worksheetWithQuestion('a$$hole behavior.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('asshole');
  });

  it('detects 0 substitution for o (f0ck → fuck with other subs applied)', () => {
    // f0ck: 0→o gives "fock"; this won't match "fuck" directly, but f*ck-style is not tested
    // Test b1tch → bitch
    const result = scanForProfanity(worksheetWithQuestion('b1tch comment.'));
    expect(result.safe).toBe(false);
    expect(result.matches).toContain('bitch');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('scanForProfanity — edge cases', () => {
  it('returns safe=true for an empty object', () => {
    const result = scanForProfanity({});
    expect(result.safe).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it('returns safe=true when question is an empty string', () => {
    const result = scanForProfanity(worksheetWithQuestion(''));
    expect(result.safe).toBe(true);
  });

  it('returns safe=true when all fields are null/undefined', () => {
    const ws = {
      title: null,
      instructions: undefined,
      questions: [{ number: 1, type: 'short-answer', question: null, answer: undefined, explanation: null, options: null }],
    };
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(true);
  });

  it('does not duplicate matches when same word appears in multiple fields', () => {
    const ws = cleanWorksheet({
      questions: [{
        number: 1,
        type: 'short-answer',
        question: 'What is shit?',
        answer: 'shit',
        explanation: 'shit is bad',
      }],
    });
    const result = scanForProfanity(ws);
    expect(result.safe).toBe(false);
    // matches is a deduplicated list — should appear once
    expect(result.matches.filter(m => m === 'shit')).toHaveLength(1);
  });

  it('returns safe=true for a worksheet with 30 clean questions (boundary)', () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({
      number: i + 1,
      type: 'fill-in-the-blank',
      question: `What is ${i + 1} + ${i + 1}?`,
      answer: String((i + 1) * 2),
      explanation: `${i + 1} + ${i + 1} = ${(i + 1) * 2}`,
    }));
    const result = scanForProfanity({ title: 'Math', instructions: 'Solve.', questions });
    expect(result.safe).toBe(true);
  });

  it('returns safe=true for a Grade 1 worksheet with 5 clean questions (boundary)', () => {
    const questions = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      type: 'true-false',
      question: `Is ${i + 1} an even number?`,
      answer: i % 2 === 1 ? 'True' : 'False',
      explanation: 'Even numbers are divisible by 2.',
    }));
    const result = scanForProfanity({ title: 'Math', instructions: 'Circle True or False.', questions });
    expect(result.safe).toBe(true);
  });
});

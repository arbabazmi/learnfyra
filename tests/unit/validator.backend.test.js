/**
 * @file tests/unit/validator.backend.test.js
 * @description Unit tests for backend/middleware/validator.js — validateGenerateBody().
 *   Pure function, no mocks needed.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import { validateGenerateBody } from '../../backend/middleware/validator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid body — all required fields present and correct */
function validBody(overrides = {}) {
  return {
    grade: 3,
    subject: 'Math',
    topic: 'Multiplication Facts (1–10)',
    difficulty: 'Medium',
    questionCount: 10,
    format: 'PDF',
    ...overrides,
  };
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('validateGenerateBody() — happy path', () => {

  it('returns normalised object for a complete valid body', () => {
    const result = validateGenerateBody(validBody());
    expect(result).toMatchObject({
      grade: 3,
      subject: 'Math',
      topic: 'Multiplication Facts (1–10)',
      difficulty: 'Medium',
      questionCount: 10,
      format: 'PDF',
      includeAnswerKey: true,
    });
  });

  it('normalises grade to a Number when passed as a numeric string', () => {
    const result = validateGenerateBody(validBody({ grade: '3' }));
    expect(result.grade).toBe(3);
    expect(typeof result.grade).toBe('number');
  });

  it('normalises questionCount to a Number when passed as a numeric string', () => {
    const result = validateGenerateBody(validBody({ questionCount: '10' }));
    expect(result.questionCount).toBe(10);
    expect(typeof result.questionCount).toBe('number');
  });

  it('trims leading and trailing whitespace from topic', () => {
    const result = validateGenerateBody(validBody({ topic: '  Fractions  ' }));
    expect(result.topic).toBe('Fractions');
  });

  it('defaults includeAnswerKey to true when omitted', () => {
    const body = validBody();
    delete body.includeAnswerKey;
    expect(validateGenerateBody(body).includeAnswerKey).toBe(true);
  });

  it('normalises includeAnswerKey: false to false', () => {
    const result = validateGenerateBody(validBody({ includeAnswerKey: false }));
    expect(result.includeAnswerKey).toBe(false);
  });

  it('normalises includeAnswerKey: true to true', () => {
    const result = validateGenerateBody(validBody({ includeAnswerKey: true }));
    expect(result.includeAnswerKey).toBe(true);
  });

  it('normalises optional student and class fields when provided', () => {
    const result = validateGenerateBody(validBody({
      studentName: '  Ava Johnson  ',
      worksheetDate: '2026-03-24',
      teacherName: '  Ms. Carter ',
      period: ' 2nd ',
      className: ' Algebra Readiness ',
    }));

    expect(result.studentName).toBe('Ava Johnson');
    expect(result.worksheetDate).toBe('2026-03-24');
    expect(result.teacherName).toBe('Ms. Carter');
    expect(result.period).toBe('2nd');
    expect(result.className).toBe('Algebra Readiness');
  });

  it('defaults optional student and class fields to empty strings', () => {
    const result = validateGenerateBody(validBody());

    expect(result.studentName).toBe('');
    expect(result.worksheetDate).toBe('');
    expect(result.teacherName).toBe('');
    expect(result.period).toBe('');
    expect(result.className).toBe('');
  });

  it('throws for invalid worksheetDate format', () => {
    expect(() => validateGenerateBody(validBody({ worksheetDate: '03/24/2026' }))).toThrow(
      'worksheetDate must be in YYYY-MM-DD format.'
    );
  });

});

// ─── Grade boundary values ────────────────────────────────────────────────────

describe('validateGenerateBody() — grade boundaries', () => {

  it('accepts grade 1 (lower boundary)', () => {
    expect(validateGenerateBody(validBody({ grade: 1 })).grade).toBe(1);
  });

  it('accepts grade 10 (upper boundary)', () => {
    expect(validateGenerateBody(validBody({ grade: 10 })).grade).toBe(10);
  });

  it('throws for grade 0 (below minimum)', () => {
    expect(() => validateGenerateBody(validBody({ grade: 0 }))).toThrow('grade must be');
  });

  it('throws for grade 11 (above maximum)', () => {
    expect(() => validateGenerateBody(validBody({ grade: 11 }))).toThrow('grade must be');
  });

  it('throws for grade as non-numeric string', () => {
    expect(() => validateGenerateBody(validBody({ grade: 'abc' }))).toThrow('grade must be');
  });

  it('throws when grade is missing', () => {
    const body = validBody();
    delete body.grade;
    expect(() => validateGenerateBody(body)).toThrow('grade must be');
  });

  it('throws for a fractional grade (2.5)', () => {
    expect(() => validateGenerateBody(validBody({ grade: 2.5 }))).toThrow('grade must be');
  });

});

// ─── Subject validation ───────────────────────────────────────────────────────

describe('validateGenerateBody() — subject', () => {

  it('accepts all valid subjects', () => {
    const subjects = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
    for (const subject of subjects) {
      expect(() => validateGenerateBody(validBody({ subject }))).not.toThrow();
    }
  });

  it('throws for an unrecognised subject', () => {
    expect(() => validateGenerateBody(validBody({ subject: 'Art' }))).toThrow('subject must be');
  });

  it('throws for a lowercase subject (case-sensitive)', () => {
    expect(() => validateGenerateBody(validBody({ subject: 'math' }))).toThrow('subject must be');
  });

  it('throws when subject is missing', () => {
    const body = validBody();
    delete body.subject;
    expect(() => validateGenerateBody(body)).toThrow('subject must be');
  });

});

// ─── Topic validation ─────────────────────────────────────────────────────────

describe('validateGenerateBody() — topic', () => {

  it('throws when topic is missing', () => {
    const body = validBody();
    delete body.topic;
    expect(() => validateGenerateBody(body)).toThrow('topic must be');
  });

  it('throws when topic is an empty string', () => {
    expect(() => validateGenerateBody(validBody({ topic: '' }))).toThrow('topic must be');
  });

  it('throws when topic is only whitespace', () => {
    expect(() => validateGenerateBody(validBody({ topic: '   ' }))).toThrow('topic must be');
  });

  it('throws when topic is not a string', () => {
    expect(() => validateGenerateBody(validBody({ topic: 123 }))).toThrow('topic must be');
  });

});

// ─── Difficulty validation ────────────────────────────────────────────────────

describe('validateGenerateBody() — difficulty', () => {

  it('accepts all valid difficulties', () => {
    const difficulties = ['Easy', 'Medium', 'Hard', 'Mixed'];
    for (const difficulty of difficulties) {
      expect(() => validateGenerateBody(validBody({ difficulty }))).not.toThrow();
    }
  });

  it('throws for an unrecognised difficulty', () => {
    expect(() => validateGenerateBody(validBody({ difficulty: 'Extreme' }))).toThrow(
      'difficulty must be'
    );
  });

  it('throws for a lowercase difficulty', () => {
    expect(() => validateGenerateBody(validBody({ difficulty: 'easy' }))).toThrow(
      'difficulty must be'
    );
  });

  it('throws when difficulty is missing', () => {
    const body = validBody();
    delete body.difficulty;
    expect(() => validateGenerateBody(body)).toThrow('difficulty must be');
  });

});

// ─── questionCount boundary values ───────────────────────────────────────────

describe('validateGenerateBody() — questionCount boundaries', () => {

  it('accepts questionCount 5 (lower boundary)', () => {
    expect(validateGenerateBody(validBody({ questionCount: 5 })).questionCount).toBe(5);
  });

  it('accepts questionCount 10 (upper boundary)', () => {
    expect(validateGenerateBody(validBody({ questionCount: 10 })).questionCount).toBe(10);
  });

  it('throws for questionCount 4 (below minimum)', () => {
    expect(() => validateGenerateBody(validBody({ questionCount: 4 }))).toThrow(
      'questionCount must be'
    );
  });

  it('throws for questionCount 31 (above maximum)', () => {
    expect(() => validateGenerateBody(validBody({ questionCount: 31 }))).toThrow(
      'questionCount must be'
    );
  });

  it('throws when questionCount is missing', () => {
    const body = validBody();
    delete body.questionCount;
    expect(() => validateGenerateBody(body)).toThrow('questionCount must be');
  });

  it('throws for fractional questionCount (7.5)', () => {
    expect(() => validateGenerateBody(validBody({ questionCount: 7.5 }))).toThrow(
      'questionCount must be'
    );
  });

});

// ─── Format validation ────────────────────────────────────────────────────────

describe('validateGenerateBody() — format', () => {

  it('accepts all valid formats', () => {
    const formats = ['PDF', 'Word (.docx)', 'HTML'];
    for (const format of formats) {
      expect(() => validateGenerateBody(validBody({ format }))).not.toThrow();
    }
  });

  it('throws for an unrecognised format', () => {
    expect(() => validateGenerateBody(validBody({ format: 'TXT' }))).toThrow(
      'format must be'
    );
  });

  it('throws when format is missing', () => {
    const body = validBody();
    delete body.format;
    expect(() => validateGenerateBody(body)).toThrow('format must be');
  });

});

// ─── Null / non-object body ───────────────────────────────────────────────────

describe('validateGenerateBody() — null and non-object bodies', () => {

  it('throws when body is null', () => {
    expect(() => validateGenerateBody(null)).toThrow();
  });

  it('throws when body is undefined', () => {
    expect(() => validateGenerateBody(undefined)).toThrow();
  });

  it('throws when body is a plain string', () => {
    expect(() => validateGenerateBody('{"grade":3}')).toThrow();
  });

  it('throws when body is a number', () => {
    expect(() => validateGenerateBody(42)).toThrow();
  });

});

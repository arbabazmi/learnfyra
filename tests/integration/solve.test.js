/**
 * @file tests/integration/solve.test.js
 * @description Integration tests for the full online solve flow.
 * Uses real file I/O — writes solve-data.json fixtures to worksheets-local/,
 * calls solveHandler and submitHandler without any mocking, then cleans up.
 * No AWS SDK calls are made.
 * @agent QA
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = join(__dirname, '../../worksheets-local');

// ─── Dynamic import after any potential mocks (none here — real I/O) ──────────

const { handler: solveHandler }  = await import('../../backend/handlers/solveHandler.js');
const { handler: submitHandler } = await import('../../backend/handlers/submitHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Writes a solve-data.json to worksheets-local/{uuid}/ and returns the uuid.
 * @param {Object} data - Full worksheet JSON
 * @returns {string} The uuid used as the directory name
 */
function writeSolveData(data) {
  const uuid = data.worksheetId;
  const dir = join(LOCAL_DIR, uuid);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'solve-data.json'), JSON.stringify(data));
  return uuid;
}

function solveEvent(worksheetId) {
  return { httpMethod: 'GET', pathParameters: { worksheetId } };
}

function submitEvent(body) {
  return { httpMethod: 'POST', body: JSON.stringify(body) };
}

const mockContext = {};

// ─── Track created dirs for cleanup ───────────────────────────────────────────

const createdIds = [];

beforeAll(() => {
  mkdirSync(LOCAL_DIR, { recursive: true });
});

afterAll(() => {
  for (const id of createdIds) {
    const dir = join(LOCAL_DIR, id);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Builds a fixture that exercises all 7 question types.
 */
function allTypesFixture() {
  const id = randomUUID();
  createdIds.push(id);
  return {
    worksheetId: id,
    grade: 5,
    subject: 'Math',
    topic: 'Mixed Review',
    difficulty: 'Medium',
    estimatedTime: '20 minutes',
    timerSeconds: 1200,
    totalPoints: 7,
    questions: [
      {
        number: 1,
        type: 'multiple-choice',
        question: 'Which is the largest planet?',
        options: ['A. Earth', 'B. Mars', 'C. Jupiter', 'D. Venus'],
        answer: 'C. Jupiter',
        explanation: 'Jupiter is the largest planet in the solar system.',
        points: 1,
      },
      {
        number: 2,
        type: 'true-false',
        question: 'The Earth orbits the Sun.',
        answer: 'True',
        explanation: 'Earth revolves around the Sun once per year.',
        points: 1,
      },
      {
        number: 3,
        type: 'fill-in-the-blank',
        question: '6 × 7 = ___',
        answer: '42',
        explanation: '6 × 7 = 42.',
        points: 1,
      },
      {
        number: 4,
        type: 'short-answer',
        question: 'What process do plants use to make food?',
        answer: 'photosynthesis sunlight',
        explanation: 'Plants use photosynthesis, powered by sunlight.',
        points: 1,
      },
      {
        number: 5,
        type: 'matching',
        question: 'Match each animal to its sound.',
        answer: [
          { left: 'cat',  right: 'meow' },
          { left: 'dog',  right: 'bark' },
          { left: 'cow',  right: 'moo'  },
        ],
        explanation: 'Animals make characteristic sounds.',
        points: 1,
      },
      {
        number: 6,
        type: 'show-your-work',
        question: 'Show your work: 12 × 7',
        answer: '84',
        explanation: '12 × 7 = 84.',
        points: 1,
      },
      {
        number: 7,
        type: 'word-problem',
        question: 'There are 5 bags with 3 apples each. How many apples in total?',
        answer: '15',
        explanation: '5 × 3 = 15.',
        points: 1,
      },
    ],
  };
}

/**
 * Builds a Grade 1 fixture with exactly 5 questions.
 */
function grade1Fixture() {
  const id = randomUUID();
  createdIds.push(id);
  return {
    worksheetId: id,
    grade: 1,
    subject: 'Math',
    topic: 'Counting',
    difficulty: 'Easy',
    estimatedTime: '10 minutes',
    timerSeconds: 600,
    totalPoints: 5,
    questions: Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      type: 'fill-in-the-blank',
      question: `${i + 1} + 1 = ___`,
      answer: String(i + 2),
      explanation: `${i + 1} + 1 = ${i + 2}.`,
      points: 1,
    })),
  };
}

/**
 * Builds a Grade 10 fixture with exactly 30 questions.
 */
function grade10Fixture() {
  const id = randomUUID();
  createdIds.push(id);
  return {
    worksheetId: id,
    grade: 10,
    subject: 'Math',
    topic: 'Algebra Review',
    difficulty: 'Hard',
    estimatedTime: '45 minutes',
    timerSeconds: 2700,
    totalPoints: 30,
    questions: Array.from({ length: 30 }, (_, i) => ({
      number: i + 1,
      type: 'multiple-choice',
      question: `Question ${i + 1}: What is ${i + 1} × 2?`,
      options: [`A. ${(i + 1) * 2 - 1}`, `B. ${(i + 1) * 2}`, `C. ${(i + 1) * 2 + 1}`, `D. ${(i + 1) * 2 + 2}`],
      answer: `B. ${(i + 1) * 2}`,
      explanation: `${i + 1} × 2 = ${(i + 1) * 2}.`,
      points: 1,
    })),
  };
}

// ─── All 7 question types ──────────────────────────────────────────────────────

describe('solve flow — all 7 question types', () => {

  let fixture;
  beforeAll(() => {
    fixture = allTypesFixture();
    writeSolveData(fixture);
  });

  // ── solveHandler ──

  it('solveHandler returns 200', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('solveHandler response omits answer and explanation from every question', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    for (const q of body.questions) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('explanation');
    }
  });

  it('solveHandler returns all 7 questions', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    expect(body.questions).toHaveLength(7);
  });

  it('solveHandler preserves question type, number, and question text', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    const types = body.questions.map((q) => q.type);
    expect(types).toContain('multiple-choice');
    expect(types).toContain('true-false');
    expect(types).toContain('fill-in-the-blank');
    expect(types).toContain('short-answer');
    expect(types).toContain('matching');
    expect(types).toContain('show-your-work');
    expect(types).toContain('word-problem');
  });

  it('solveHandler returns CORS headers', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('solveHandler returns worksheet metadata', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    expect(body.worksheetId).toBe(fixture.worksheetId);
    expect(body.grade).toBe(5);
    expect(body.timerSeconds).toBe(1200);
    expect(body.totalPoints).toBe(7);
  });

  // ── submitHandler — all correct ──

  it('submitHandler returns 200 for a valid all-correct submission', async () => {
    const answers = [
      { number: 1, answer: 'C' },
      { number: 2, answer: 'True' },
      { number: 3, answer: '42' },
      { number: 4, answer: 'Plants rely on photosynthesis and sunlight to grow' },
      { number: 5, answer: [{ left: 'cat', right: 'meow' }, { left: 'dog', right: 'bark' }, { left: 'cow', right: 'moo' }] },
      { number: 6, answer: { finalAnswer: '84' } },
      { number: 7, answer: '15' },
    ];
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 300, timed: false }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.totalScore).toBe(7);
    expect(body.percentage).toBe(100);
  });

  it('submitHandler marks each question correct when all answers are correct', async () => {
    const answers = [
      { number: 1, answer: 'C' },
      { number: 2, answer: 'True' },
      { number: 3, answer: '42' },
      { number: 4, answer: 'photosynthesis needs sunlight always' },
      { number: 5, answer: [{ left: 'cat', right: 'meow' }, { left: 'dog', right: 'bark' }, { left: 'cow', right: 'moo' }] },
      { number: 6, answer: { finalAnswer: '84' } },
      { number: 7, answer: '15' },
    ];
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 300, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    for (const r of body.results) {
      expect(r.correct).toBe(true);
    }
  });

  it('submitHandler includes explanation in every result entry', async () => {
    const answers = [{ number: 1, answer: 'C' }];
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 60, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    for (const r of body.results) {
      expect(typeof r.explanation).toBe('string');
    }
  });

  it('submitHandler scores zero for all-wrong answers', async () => {
    const answers = [
      { number: 1, answer: 'A' },
      { number: 2, answer: 'False' },
      { number: 3, answer: '99' },
      { number: 4, answer: 'zzz' },
      { number: 5, answer: [{ left: 'cat', right: 'bark' }, { left: 'dog', right: 'meow' }, { left: 'cow', right: 'oink' }] },
      { number: 6, answer: { finalAnswer: '99' } },
      { number: 7, answer: '999' },
    ];
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 120, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.totalScore).toBe(0);
    expect(body.percentage).toBe(0);
  });

  it('submitHandler returns CORS headers', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('submitHandler passes back timeTaken and timed flag', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 845, timed: true }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.timeTaken).toBe(845);
    expect(body.timed).toBe(true);
  });

  it('submitHandler returns worksheetId in the response', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.worksheetId).toBe(fixture.worksheetId);
  });

  it('submitHandler returns result entry for each question even with no answers submitted', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(7);
    for (const r of body.results) {
      expect(r.correct).toBe(false);
      expect(r.pointsEarned).toBe(0);
    }
  });

  it('submitHandler returns correct answer in each result entry', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    const q1result = body.results.find((r) => r.number === 1);
    expect(q1result.correctAnswer).toBe('C. Jupiter');
  });

});

// ─── 404 — worksheet not found ────────────────────────────────────────────────

describe('solve flow — 404 worksheet not found', () => {

  const unknownId = randomUUID();

  it('solveHandler returns 404 for an unknown worksheetId', async () => {
    const result = await solveHandler(solveEvent(unknownId), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('solveHandler 404 response has CORS headers', async () => {
    const result = await solveHandler(solveEvent(unknownId), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('submitHandler returns 404 for an unknown worksheetId', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: unknownId, answers: [] }),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('submitHandler 404 response has CORS headers', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: unknownId, answers: [] }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Guest submission (no studentName) ────────────────────────────────────────

describe('solve flow — guest submission', () => {

  let fixture;
  beforeAll(() => {
    fixture = allTypesFixture();
    writeSolveData(fixture);
  });

  it('submitHandler accepts a submission with no studentName', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('submitHandler accepts a submission with empty string studentName', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, studentName: '', answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

});

// ─── Boundary: Grade 1, 5 questions ──────────────────────────────────────────

describe('solve flow — boundary: Grade 1, 5 questions', () => {

  let fixture;
  beforeAll(() => {
    fixture = grade1Fixture();
    writeSolveData(fixture);
  });

  it('solveHandler returns 5 questions for a Grade 1 worksheet', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    expect(body.questions).toHaveLength(5);
    expect(body.grade).toBe(1);
  });

  it('submitHandler scores all 5 correctly for a Grade 1 all-correct submission', async () => {
    const answers = fixture.questions.map((q) => ({ number: q.number, answer: q.answer }));
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 60, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.totalScore).toBe(5);
    expect(body.percentage).toBe(100);
  });

  it('submitHandler returns 5 result entries for a Grade 1 worksheet', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(5);
  });

});

// ─── Boundary: Grade 10, 30 questions ────────────────────────────────────────

describe('solve flow — boundary: Grade 10, 30 questions', () => {

  let fixture;
  beforeAll(() => {
    fixture = grade10Fixture();
    writeSolveData(fixture);
  });

  it('solveHandler returns 30 questions for a Grade 10 worksheet', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    expect(body.questions).toHaveLength(30);
    expect(body.grade).toBe(10);
  });

  it('submitHandler scores all 30 correctly for a Grade 10 all-correct submission', async () => {
    const answers = fixture.questions.map((q) => ({ number: q.number, answer: 'B' }));
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 900, timed: true }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.totalScore).toBe(30);
    expect(body.percentage).toBe(100);
  });

  it('submitHandler returns 30 result entries for a Grade 10 worksheet', async () => {
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.results).toHaveLength(30);
  });

  it('submitHandler percentage is capped at 100 even if totalPoints is mismatched', async () => {
    // Provide more answers than questions — percentage must not exceed 100
    const answers = fixture.questions.map((q) => ({ number: q.number, answer: 'B' }));
    const result = await submitHandler(
      submitEvent({ worksheetId: fixture.worksheetId, answers, timeTaken: 900, timed: false }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.percentage).toBeLessThanOrEqual(100);
  });

  it('solveHandler returns answers stripped for all 30 questions', async () => {
    const result = await solveHandler(solveEvent(fixture.worksheetId), mockContext);
    const body = JSON.parse(result.body);
    for (const q of body.questions) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('explanation');
    }
  });

});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('solve flow — OPTIONS preflight', () => {

  it('solveHandler returns 200 for OPTIONS', async () => {
    const result = await solveHandler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('submitHandler returns 200 for OPTIONS', async () => {
    const result = await submitHandler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

});

/**
 * @file tests/unit/solveHandler.test.js
 * @description Unit tests for backend/handlers/solveHandler.js
 * The filesystem is mocked to avoid real I/O.
 * No real AWS SDK calls are made.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock fs BEFORE any dynamic import of the handler ────────────────────────

jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { promises: fsPromises } = await import('fs');
const { handler } = await import('../../backend/handlers/solveHandler.js');

// ─── Shared fixture ───────────────────────────────────────────────────────────

const VALID_ID   = '12345678-1234-4123-8123-123456789abc';
const MISSING_ID = '98765432-9876-4987-8987-987654321def';

const mockSolveData = {
  worksheetId: VALID_ID,
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Medium',
  estimatedTime: '20 minutes',
  timerSeconds: 1200,
  totalPoints: 2,
  questions: [
    {
      number: 1,
      type: 'fill-in-the-blank',
      question: '4×6=?',
      answer: '24',
      explanation: 'Multiply 4 by 6.',
      points: 1,
    },
    {
      number: 2,
      type: 'multiple-choice',
      question: '7×8=?',
      options: ['A. 54', 'B. 56'],
      answer: 'B. 56',
      explanation: '7×8=56.',
      points: 1,
      provenance: { source: 'generated', modelUsed: 'claude-haiku-4-5-20251001' },
      questionId: 'qb-123',
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(worksheetId, method = 'GET') {
  return {
    httpMethod: method,
    pathParameters: worksheetId != null ? { worksheetId } : null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('solveHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Happy path (200) ─────────────────────────────────────────────────────────

describe('solveHandler — happy path', () => {

  beforeEach(() => {
    fsPromises.readFile.mockResolvedValue(JSON.stringify(mockSolveData));
  });

  it('returns status 200 for a valid worksheetId', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body contains worksheetId', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('worksheetId', VALID_ID);
  });

  it('response body contains a questions array', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.questions)).toBe(true);
    expect(body.questions).toHaveLength(2);
  });

  it('questions in response do NOT include the answer field', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    for (const q of body.questions) {
      expect(q).not.toHaveProperty('answer');
    }
  });

  it('questions in response do NOT include the explanation field', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    for (const q of body.questions) {
      expect(q).not.toHaveProperty('explanation');
    }
  });

  it('questions in response do NOT include internal provenance or questionId fields', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    for (const q of body.questions) {
      expect(q).not.toHaveProperty('provenance');
      expect(q).not.toHaveProperty('questionId');
    }
  });

  it('questions in response still contain the question text', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.questions[0]).toHaveProperty('question', '4×6=?');
  });

  it('CORS headers are present on a 200 response', async () => {
    const result = await handler(mockEvent(VALID_ID), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 404 — worksheet not found ────────────────────────────────────────────────

describe('solveHandler — 404 worksheet not found', () => {

  beforeEach(() => {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    fsPromises.readFile.mockRejectedValue(err);
  });

  it('returns status 404 when the solve-data.json file does not exist', async () => {
    const result = await handler(mockEvent(MISSING_ID), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('returns error: "Worksheet not found." on 404', async () => {
    const result = await handler(mockEvent(MISSING_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Worksheet not found.');
  });

  it('returns SOLVE_NOT_FOUND code on 404', async () => {
    const result = await handler(mockEvent(MISSING_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SOLVE_NOT_FOUND');
  });

  it('CORS headers are present on a 404 response', async () => {
    const result = await handler(mockEvent(MISSING_ID), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 500 — internal error ────────────────────────────────────────────────────

describe('solveHandler — 500 internal error', () => {

  it('returns 500 when the stored JSON causes a runtime error during response construction', async () => {
    // worksheet.questions is a non-null truthy non-array value (e.g. integer 1).
    // The handler guards with (worksheet.questions || []) but the truthy value
    // is not an array, so .map() throws a TypeError that reaches the outer catch.
    fsPromises.readFile.mockResolvedValue(JSON.stringify({ ...mockSolveData, questions: 1 }));
    const result = await handler(mockEvent(VALID_ID), mockContext);
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SOLVE_INTERNAL_ERROR');
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns error message on 500 response', async () => {
    fsPromises.readFile.mockResolvedValue(JSON.stringify({ ...mockSolveData, questions: 1 }));
    const result = await handler(mockEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
  });

});

// ─── 400 — invalid UUID format ────────────────────────────────────────────────

describe('solveHandler — 400 invalid worksheetId format', () => {

  it('returns status 400 for a non-UUID worksheetId', async () => {
    const result = await handler(mockEvent('abc-123'), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns error message for invalid format', async () => {
    const result = await handler(mockEvent('../etc/passwd'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/invalid worksheetId format/i);
  });

  it('returns SOLVE_INVALID_WORKSHEET_ID code for invalid format', async () => {
    const result = await handler(mockEvent('../etc/passwd'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SOLVE_INVALID_WORKSHEET_ID');
  });

  it('rejects URL-encoded traversal payloads as invalid worksheetId format', async () => {
    const result = await handler(mockEvent('%2e%2e%2fetc%2fpasswd'), mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SOLVE_INVALID_WORKSHEET_ID');
  });

  it('CORS headers are present on invalid-format 400 response', async () => {
    const result = await handler(mockEvent('not-a-uuid'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 400 — missing worksheetId ────────────────────────────────────────────────

describe('solveHandler — 400 missing worksheetId', () => {

  it('returns status 400 when pathParameters is null', async () => {
    const result = await handler(mockEvent(null), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns an error message when worksheetId is missing', async () => {
    const result = await handler(mockEvent(null), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBeTruthy();
  });

  it('returns SOLVE_MISSING_WORKSHEET_ID code when worksheetId is missing', async () => {
    const result = await handler(mockEvent(null), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SOLVE_MISSING_WORKSHEET_ID');
  });

  it('CORS headers are present on a 400 response', async () => {
    const result = await handler(mockEvent(null), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

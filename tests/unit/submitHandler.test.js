/**
 * @file tests/unit/submitHandler.test.js
 * @description Unit tests for backend/handlers/submitHandler.js
 * The filesystem and resultBuilder are mocked to isolate the handler.
 * No real AWS SDK calls or file I/O occur.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock fs BEFORE any dynamic import of the handler ────────────────────────

jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

// ─── Mock resultBuilder BEFORE any dynamic import of the handler ─────────────

jest.unstable_mockModule('../../src/solve/resultBuilder.js', () => ({
  buildResult: jest.fn(),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { promises: fsPromises } = await import('fs');
const { buildResult } = await import('../../src/solve/resultBuilder.js');
const { handler } = await import('../../backend/handlers/submitHandler.js');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_ID   = '12345678-1234-4123-8123-123456789abc';
const MISSING_ID = '98765432-9876-4987-8987-987654321def';

const mockSolveData = {
  worksheetId: VALID_ID,
  totalPoints: 2,
  questions: [
    { number: 1, type: 'fill-in-the-blank', answer: '24', explanation: '4×6=24', points: 1 },
    { number: 2, type: 'multiple-choice',   answer: 'B. 56', explanation: '7×8=56', points: 1 },
  ],
};

const mockResultResponse = {
  worksheetId: VALID_ID,
  totalScore: 2,
  totalPoints: 2,
  percentage: 100,
  timeTaken: 120,
  timed: false,
  results: [
    { number: 1, correct: true,  studentAnswer: '24', correctAnswer: '24',     explanation: '4×6=24', pointsEarned: 1, pointsPossible: 1 },
    { number: 2, correct: true,  studentAnswer: 'B',  correctAnswer: 'B. 56',  explanation: '7×8=56', pointsEarned: 1, pointsPossible: 1 },
  ],
};

const validAnswers = [
  { number: 1, answer: '24' },
  { number: 2, answer: 'B' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(body, method = 'POST') {
  return {
    httpMethod: method,
    body: JSON.stringify(body),
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  fsPromises.readFile.mockResolvedValue(JSON.stringify(mockSolveData));
  buildResult.mockReturnValue(mockResultResponse);
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('submitHandler — OPTIONS preflight', () => {

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

describe('submitHandler — happy path', () => {

  it('returns status 200 for a valid request', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers, timeTaken: 120, timed: false }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('calls buildResult with the worksheet and student answers', async () => {
    await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers, timeTaken: 120, timed: false }),
      mockContext,
    );
    expect(buildResult).toHaveBeenCalledTimes(1);
    expect(buildResult).toHaveBeenCalledWith(
      mockSolveData,
      validAnswers,
      120,
      false,
    );
  });

  it('response body contains the result from buildResult', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({ worksheetId: VALID_ID, totalScore: 2, percentage: 100 });
  });

  it('passes an empty answers array through for valid no-answer submissions', async () => {
    await handler(
      mockEvent({ worksheetId: VALID_ID, answers: [], timeTaken: 0, timed: false }),
      mockContext,
    );
    expect(buildResult).toHaveBeenCalledWith(mockSolveData, [], 0, false);
  });

  it('CORS headers are present on a 200 response', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 400 — invalid UUID format ────────────────────────────────────────────────

describe('submitHandler — 400 invalid worksheetId format', () => {

  it('returns status 400 for a non-UUID worksheetId', async () => {
    const result = await handler(
      mockEvent({ worksheetId: 'abc-123', answers: validAnswers }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns error message for invalid format', async () => {
    const result = await handler(
      mockEvent({ worksheetId: '../etc/passwd', answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/invalid worksheetId format/i);
  });

  it('returns SUBMIT_INVALID_REQUEST code for invalid worksheetId format', async () => {
    const result = await handler(
      mockEvent({ worksheetId: '../etc/passwd', answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INVALID_REQUEST');
  });

  it('rejects URL-encoded traversal payloads as invalid worksheetId format', async () => {
    const result = await handler(
      mockEvent({ worksheetId: '%2e%2e%2fetc%2fpasswd', answers: validAnswers }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INVALID_REQUEST');
  });

  it('CORS headers are present on invalid-format 400 response', async () => {
    const result = await handler(
      mockEvent({ worksheetId: 'not-a-uuid', answers: validAnswers }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 400 — missing worksheetId ────────────────────────────────────────────────

describe('submitHandler — 400 missing worksheetId', () => {

  it('returns status 400 when worksheetId is absent', async () => {
    const result = await handler(
      mockEvent({ answers: validAnswers }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('response body error indicates worksheetId is required', async () => {
    const result = await handler(
      mockEvent({ answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    // Implementation message: 'worksheetId is required.'
    expect(body.error).toMatch(/worksheetId/i);
  });

  it('returns SUBMIT_INVALID_REQUEST code when worksheetId is missing', async () => {
    const result = await handler(
      mockEvent({ answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INVALID_REQUEST');
  });

  it('CORS headers are present on a 400 response', async () => {
    const result = await handler(
      mockEvent({ answers: validAnswers }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── 400 — answers not an array ───────────────────────────────────────────────

describe('submitHandler — 400 answers not an array', () => {

  it('returns status 400 when answers is a string', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: 'not-an-array' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns error: "answers must be an array." when answers is not an array', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: 'not-an-array' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toBe('answers must be an array.');
  });

  it('returns SUBMIT_INVALID_REQUEST code when answers is not an array', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: 'not-an-array' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INVALID_REQUEST');
  });

  it('returns status 400 when answers is missing (undefined → undefined)', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers are present on a 400 answers-invalid response', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: 42 }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 400 when an answers entry is not an object', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: ['wrong-shape'] }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when an answers entry number is missing or invalid', async () => {
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: [{ answer: '24' }] }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/positive integer number/i);
  });

  it('returns 400 when answers contains duplicate question numbers', async () => {
    const result = await handler(
      mockEvent({
        worksheetId: VALID_ID,
        answers: [
          { number: 1, answer: '24' },
          { number: 1, answer: '25' },
        ],
      }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/duplicate question numbers/i);
  });

});

// ─── 400 — malformed JSON body ────────────────────────────────────────────────

describe('submitHandler — 400 malformed JSON body', () => {

  it('returns 400 for malformed JSON body', async () => {
    const event = {
      httpMethod: 'POST',
      body: '{not valid json{{',
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns SUBMIT_INVALID_REQUEST code for malformed JSON body', async () => {
    const event = {
      httpMethod: 'POST',
      body: '{not valid json{{',
    };
    const result = await handler(event, mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INVALID_REQUEST');
  });

});

// ─── 500 — unexpected internal error ─────────────────────────────────────────

describe('submitHandler — 500 internal error', () => {

  it('returns 500 when buildResult throws an unexpected error', async () => {
    buildResult.mockImplementation(() => {
      throw new Error('unexpected error');
    });
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers, timeTaken: 120, timed: false }),
      mockContext,
    );
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns SUBMIT_INTERNAL_ERROR code on 500', async () => {
    buildResult.mockImplementation(() => {
      throw new Error('unexpected error');
    });
    const result = await handler(
      mockEvent({ worksheetId: VALID_ID, answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_INTERNAL_ERROR');
  });

});

// ─── 404 — worksheet not found ────────────────────────────────────────────────

describe('submitHandler — 404 worksheet not found', () => {

  beforeEach(() => {
    const err = new Error('ENOENT: no such file or directory');
    err.code = 'ENOENT';
    fsPromises.readFile.mockRejectedValue(err);
  });

  it('returns status 404 when solve-data.json does not exist', async () => {
    const result = await handler(
      mockEvent({ worksheetId: MISSING_ID, answers: validAnswers }),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('returns an error message on 404', async () => {
    const result = await handler(
      mockEvent({ worksheetId: MISSING_ID, answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toBeTruthy();
  });

  it('returns SUBMIT_NOT_FOUND code on 404', async () => {
    const result = await handler(
      mockEvent({ worksheetId: MISSING_ID, answers: validAnswers }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.code).toBe('SUBMIT_NOT_FOUND');
  });

  it('CORS headers are present on a 404 response', async () => {
    const result = await handler(
      mockEvent({ worksheetId: MISSING_ID, answers: validAnswers }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

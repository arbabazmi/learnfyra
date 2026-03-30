/**
 * @file tests/unit/questionBankReuse.test.js
 * @description Tests for POST /api/qb/questions/:id/reuse endpoint and the
 * updated error model (code field) on questionBankHandler.js.
 *
 * Covers:
 *   - POST /api/qb/questions/:id/reuse happy path
 *   - POST /api/qb/questions/:id/reuse 404 (unknown ID)
 *   - Error responses now include a machine-readable `code` field
 *   - CORS and Lambda context guard for the reuse route
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock adapter stubs ───────────────────────────────────────────────────────

const mockAddIfNotExists      = jest.fn();
const mockGetQuestion         = jest.fn();
const mockListQuestions       = jest.fn();
const mockIncrementReuseCount = jest.fn();

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn(async () => ({
    addIfNotExists:      mockAddIfNotExists,
    getQuestion:         mockGetQuestion,
    listQuestions:       mockListQuestions,
    incrementReuseCount: mockIncrementReuseCount,
  })),
}));

// ─── Dynamic import — must follow all mockModule calls ────────────────────────

const { handler } = await import('../../backend/handlers/questionBankHandler.js');

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VALID_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const STORED_QUESTION = {
  questionId:  VALID_ID,
  grade:       3,
  subject:     'Math',
  topic:       'Multiplication',
  difficulty:  'Medium',
  type:        'multiple-choice',
  question:    'What is 6 × 7?',
  options:     ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
  answer:      'B',
  explanation: '6 × 7 = 42',
  reuseCount:  1,
  createdAt:   '2026-03-25T10:00:00.000Z',
  standards:   [],
  modelUsed:   '',
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

function reuseEvent(id) {
  return {
    httpMethod:            'POST',
    path:                  `/api/qb/questions/${id}/reuse`,
    headers:               { 'Content-Type': 'application/json' },
    body:                  null,
    queryStringParameters: null,
    pathParameters:        { id },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIncrementReuseCount.mockReturnValue(STORED_QUESTION);
  mockGetQuestion.mockReturnValue(STORED_QUESTION);
  mockListQuestions.mockReturnValue([STORED_QUESTION]);
  mockAddIfNotExists.mockReturnValue({ stored: STORED_QUESTION, duplicate: false });
});

// ─── POST /api/qb/questions/:id/reuse — happy path ───────────────────────────

describe('questionBankHandler — POST /api/qb/questions/:id/reuse happy path', () => {

  it('returns 200 for a known question ID', async () => {
    const result = await handler(reuseEvent(VALID_ID), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body has success: true', async () => {
    const result = await handler(reuseEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('response body contains the updated question object', async () => {
    const result = await handler(reuseEvent(VALID_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.question).toHaveProperty('questionId', VALID_ID);
    expect(body.question).toHaveProperty('reuseCount', 1);
  });

  it('calls incrementReuseCount with the correct question ID', async () => {
    await handler(reuseEvent(VALID_ID), mockContext);
    expect(mockIncrementReuseCount).toHaveBeenCalledTimes(1);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith(VALID_ID);
  });

  it('CORS headers are present on 200 reuse response', async () => {
    const result = await handler(reuseEvent(VALID_ID), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(reuseEvent(VALID_ID), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('trims whitespace from the ID before calling incrementReuseCount', async () => {
    const event = {
      ...reuseEvent(VALID_ID),
      path: `/api/qb/questions/${VALID_ID}/reuse`,
      pathParameters: { id: `  ${VALID_ID}  ` },
    };
    await handler(event, mockContext);
    expect(mockIncrementReuseCount).toHaveBeenCalledWith(VALID_ID);
  });

});

// ─── POST /api/qb/questions/:id/reuse — 404 ──────────────────────────────────

describe('questionBankHandler — POST /api/qb/questions/:id/reuse not found', () => {

  beforeEach(() => {
    mockIncrementReuseCount.mockReturnValue(null);
  });

  it('returns 404 when the adapter returns null for an unknown ID', async () => {
    const result = await handler(reuseEvent('unknown-id-xyz'), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('error body has a code field equal to QB_NOT_FOUND', async () => {
    const result = await handler(reuseEvent('unknown-id-xyz'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_NOT_FOUND');
  });

  it('error body has a non-empty error string', async () => {
    const result = await handler(reuseEvent('unknown-id-xyz'), mockContext);
    const body = JSON.parse(result.body);
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('CORS headers present on 404 reuse response', async () => {
    const result = await handler(reuseEvent('unknown-id-xyz'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on 404', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(reuseEvent('unknown-id-xyz'), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

});

// ─── Error model — code field present on all error responses ─────────────────

describe('questionBankHandler — error responses carry machine-readable code field', () => {

  it('400 grade error has code QB_INVALID_GRADE', async () => {
    const event = {
      httpMethod:            'POST',
      path:                  '/api/qb/questions',
      headers:               {},
      body:                  JSON.stringify({ grade: 0, subject: 'Math', topic: 'Fractions', difficulty: 'Easy', type: 'short-answer', question: 'Q?', answer: 'A', explanation: 'E' }),
      pathParameters:        null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_INVALID_GRADE');
    expect(typeof body.error).toBe('string');
  });

  it('400 subject error has code QB_INVALID_SUBJECT', async () => {
    const event = {
      httpMethod:            'POST',
      path:                  '/api/qb/questions',
      headers:               {},
      body:                  JSON.stringify({ grade: 3, subject: 'Art', topic: 'Fractions', difficulty: 'Easy', type: 'short-answer', question: 'Q?', answer: 'A', explanation: 'E' }),
      pathParameters:        null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_INVALID_SUBJECT');
  });

  it('409 duplicate error has code QB_DUPLICATE', async () => {
    mockAddIfNotExists.mockReturnValue({ stored: null, duplicate: true });
    const event = {
      httpMethod:            'POST',
      path:                  '/api/qb/questions',
      headers:               {},
      body:                  JSON.stringify({ grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy', type: 'short-answer', question: 'Q?', answer: 'A', explanation: 'E' }),
      pathParameters:        null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_DUPLICATE');
  });

  it('404 get-by-id error has code QB_NOT_FOUND', async () => {
    mockGetQuestion.mockReturnValue(null);
    const event = {
      httpMethod:            'GET',
      path:                  '/api/qb/questions/nonexistent-id',
      headers:               {},
      body:                  null,
      pathParameters:        { id: 'nonexistent-id' },
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_NOT_FOUND');
  });

  it('400 grade filter error on GET list has code QB_INVALID_GRADE', async () => {
    const event = {
      httpMethod:            'GET',
      path:                  '/api/qb/questions',
      headers:               {},
      body:                  null,
      pathParameters:        null,
      queryStringParameters: { grade: '99' },
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_INVALID_GRADE');
  });

  it('400 options-invalid error has code QB_OPTIONS_INVALID', async () => {
    const event = {
      httpMethod:            'POST',
      path:                  '/api/qb/questions',
      headers:               {},
      body:                  JSON.stringify({
        grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
        type: 'short-answer', question: 'Q?', answer: 'A', explanation: 'E',
        options: ['A', 'B', 'C', 'D'],
      }),
      pathParameters:        null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_OPTIONS_INVALID');
  });

  it('all error responses have both code and error fields', async () => {
    mockGetQuestion.mockReturnValue(null);
    const event = {
      httpMethod:            'GET',
      path:                  '/api/qb/questions/no-such-id',
      headers:               {},
      body:                  null,
      pathParameters:        { id: 'no-such-id' },
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('error');
  });

});

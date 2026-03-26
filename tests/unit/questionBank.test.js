/**
 * @file tests/unit/questionBank.test.js
 * @description Unit tests for backend/handlers/questionBankHandler.js
 * The question bank adapter (src/questionBank/index.js) is mocked via
 * jest.unstable_mockModule — no real storage is ever touched.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock adapter method stubs ────────────────────────────────────────────────

const mockAddIfNotExists = jest.fn();
const mockGetQuestion    = jest.fn();
const mockListQuestions  = jest.fn();

// ─── Mock src/questionBank/index.js BEFORE any dynamic import ────────────────

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn(async () => ({
    addIfNotExists:  mockAddIfNotExists,
    getQuestion:     mockGetQuestion,
    listQuestions:   mockListQuestions,
  })),
}));

// ─── Dynamic import (must come after all mockModule calls) ───────────────────

const { handler } = await import('../../backend/handlers/questionBankHandler.js');

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const VALID_QUESTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const VALID_MC_BODY = {
  grade:       3,
  subject:     'Math',
  topic:       'Multiplication',
  difficulty:  'Medium',
  type:        'multiple-choice',
  question:    'What is 6 × 7?',
  options:     ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
  answer:      'B',
  explanation: '6 × 7 = 42',
};

const VALID_SHORT_BODY = {
  grade:       5,
  subject:     'Science',
  topic:       'Photosynthesis',
  difficulty:  'Easy',
  type:        'short-answer',
  question:    'What gas do plants absorb during photosynthesis?',
  answer:      'Carbon dioxide',
  explanation: 'Plants absorb CO₂ and release O₂.',
};

const STORED_MC_QUESTION = {
  ...VALID_MC_BODY,
  questionId:  VALID_QUESTION_ID,
  reuseCount:  0,
  createdAt:   '2026-03-25T10:00:00.000Z',
  standards:   [],
  modelUsed:   '',
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Event builder helpers ─────────────────────────────────────────────────────

function postEvent(body) {
  return {
    httpMethod: 'POST',
    path:       '/api/qb/questions',
    headers:    { 'Content-Type': 'application/json' },
    body:       JSON.stringify(body),
    pathParameters:       null,
    queryStringParameters: null,
  };
}

function getListEvent(queryStringParameters = null) {
  return {
    httpMethod: 'GET',
    path:       '/api/qb/questions',
    headers:    {},
    body:       null,
    pathParameters:       null,
    queryStringParameters,
  };
}

function getByIdEvent(id) {
  return {
    httpMethod: 'GET',
    path:       `/api/qb/questions/${id}`,
    headers:    {},
    body:       null,
    pathParameters:       { id },
    queryStringParameters: null,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default happy-path mock responses
  mockAddIfNotExists.mockReturnValue({ stored: STORED_MC_QUESTION, duplicate: false });
  mockGetQuestion.mockReturnValue(STORED_MC_QUESTION);
  mockListQuestions.mockReturnValue([STORED_MC_QUESTION]);
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('questionBankHandler — OPTIONS preflight', () => {

  it('returns 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns empty body on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.body).toBe('');
  });

});

// ─── POST /api/qb/questions — happy path ─────────────────────────────────────

describe('questionBankHandler — POST /api/qb/questions happy path', () => {

  it('returns 201 when a valid multiple-choice question is submitted', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.statusCode).toBe(201);
  });

  it('response body contains the stored question object', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.question).toHaveProperty('questionId', VALID_QUESTION_ID);
    expect(body.question).toHaveProperty('grade', 3);
    expect(body.question).toHaveProperty('subject', 'Math');
  });

  it('returns 201 for a valid short-answer question (no options field)', async () => {
    const stored = { ...VALID_SHORT_BODY, questionId: VALID_QUESTION_ID, reuseCount: 0, createdAt: '2026-03-25T10:00:00.000Z', standards: [], modelUsed: '' };
    mockAddIfNotExists.mockReturnValue({ stored, duplicate: false });
    const result = await handler(postEvent(VALID_SHORT_BODY), mockContext);
    expect(result.statusCode).toBe(201);
  });

  it('calls addIfNotExists with the correct candidate dedupe key', async () => {
    await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(mockAddIfNotExists).toHaveBeenCalledTimes(1);
    const [candidate] = mockAddIfNotExists.mock.calls[0];
    expect(candidate).toMatchObject({
      grade:    3,
      subject:  'Math',
      topic:    'Multiplication',
      type:     'multiple-choice',
      question: 'What is 6 × 7?',
    });
  });

  it('CORS headers are present on 201 response', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/qb/questions — duplicate ──────────────────────────────────────

describe('questionBankHandler — POST /api/qb/questions duplicate', () => {

  beforeEach(() => {
    mockAddIfNotExists.mockReturnValue({ stored: null, duplicate: true });
  });

  it('returns 409 when the adapter reports a duplicate', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.statusCode).toBe(409);
  });

  it('error body describes the duplicate constraint', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('CORS headers are present on 409 response', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('question is not stored a second time (addIfNotExists called once)', async () => {
    await handler(postEvent(VALID_MC_BODY), mockContext);
    // addIfNotExists is the single atomic operation — called exactly once
    expect(mockAddIfNotExists).toHaveBeenCalledTimes(1);
  });

});

// ─── POST /api/qb/questions — validation: required fields ────────────────────

describe('questionBankHandler — POST /api/qb/questions missing required fields', () => {

  it('returns 400 when the question text field is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.question;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "question" when question text is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.question;
    const result = await handler(postEvent(body), mockContext);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toMatch(/question/i);
  });

  it('returns 400 when answer is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.answer;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when explanation is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.explanation;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when topic is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.topic;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when difficulty is absent', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.difficulty;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 with code QB_INVALID_DIFFICULTY for an unrecognised difficulty value', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, difficulty: 'Super Hard' }), mockContext);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('QB_INVALID_DIFFICULTY');
  });

  it('CORS headers are present on 400 missing-field responses', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.question;
    const result = await handler(postEvent(body), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/qb/questions — validation: grade ──────────────────────────────

describe('questionBankHandler — POST /api/qb/questions grade validation', () => {

  it('returns 400 when grade is 0 (below minimum)', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 0 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when grade is 11 (above maximum)', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 11 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when grade is a non-numeric string', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 'five' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when grade is a float (non-integer)', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 3.5 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 201 for boundary grade 1', async () => {
    const stored = { ...VALID_MC_BODY, grade: 1, questionId: VALID_QUESTION_ID, reuseCount: 0, createdAt: '2026-03-25T10:00:00.000Z', standards: [], modelUsed: '' };
    mockAddIfNotExists.mockReturnValue({ stored, duplicate: false });
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 1 }), mockContext);
    expect(result.statusCode).toBe(201);
  });

  it('returns 201 for boundary grade 10', async () => {
    const stored = { ...VALID_MC_BODY, grade: 10, questionId: VALID_QUESTION_ID, reuseCount: 0, createdAt: '2026-03-25T10:00:00.000Z', standards: [], modelUsed: '' };
    mockAddIfNotExists.mockReturnValue({ stored, duplicate: false });
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 10 }), mockContext);
    expect(result.statusCode).toBe(201);
  });

  it('error body mentions "grade" for out-of-range grade', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 0 }), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/grade/i);
  });

});

// ─── POST /api/qb/questions — validation: subject ────────────────────────────

describe('questionBankHandler — POST /api/qb/questions subject validation', () => {

  it('returns 400 for an unrecognised subject', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, subject: 'Art' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "subject" for invalid subject', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, subject: 'Art' }), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/subject/i);
  });

  it('returns 400 when subject is an empty string', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, subject: '' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('accepts all five valid subjects without error', async () => {
    const validSubjects = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
    for (const subject of validSubjects) {
      mockAddIfNotExists.mockReturnValue({ stored: { ...STORED_MC_QUESTION, subject }, duplicate: false });
      const result = await handler(postEvent({ ...VALID_MC_BODY, subject }), mockContext);
      expect(result.statusCode).toBe(201);
    }
  });

});

// ─── POST /api/qb/questions — validation: options field ──────────────────────

describe('questionBankHandler — POST /api/qb/questions options field validation', () => {

  it('returns 400 when options is sent for a non-multiple-choice type', async () => {
    const body = {
      ...VALID_SHORT_BODY,
      options: ['A. yes', 'B. no', 'C. maybe', 'D. never'],
    };
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "options" when options is invalid for the type', async () => {
    const body = { ...VALID_SHORT_BODY, options: ['A', 'B', 'C', 'D'] };
    const result = await handler(postEvent(body), mockContext);
    const parsed = JSON.parse(result.body);
    expect(parsed.error).toMatch(/options/i);
  });

  it('returns 400 when multiple-choice question has no options', async () => {
    const body = { ...VALID_MC_BODY };
    delete body.options;
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when multiple-choice options array has fewer than 4 items', async () => {
    const body = { ...VALID_MC_BODY, options: ['A. 36', 'B. 42', 'C. 48'] };
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when multiple-choice options array has more than 4 items', async () => {
    const body = { ...VALID_MC_BODY, options: ['A. 36', 'B. 42', 'C. 48', 'D. 54', 'E. 60'] };
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when an option in the array is an empty string', async () => {
    const body = { ...VALID_MC_BODY, options: ['A. 36', '', 'C. 48', 'D. 54'] };
    const result = await handler(postEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when options is sent for true-false type', async () => {
    const trueFalseBody = {
      grade:       4,
      subject:     'Science',
      topic:       'Gravity',
      difficulty:  'Easy',
      type:        'true-false',
      question:    'Gravity pulls objects downward.',
      answer:      'True',
      explanation: 'Gravity is a downward force.',
      options:     ['A', 'B', 'C', 'D'],
    };
    const result = await handler(postEvent(trueFalseBody), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers present on 400 options-validation response', async () => {
    const body = { ...VALID_SHORT_BODY, options: ['A', 'B', 'C', 'D'] };
    const result = await handler(postEvent(body), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/qb/questions — malformed JSON body ────────────────────────────

describe('questionBankHandler — POST malformed JSON body', () => {

  it('returns 400 for a non-JSON body string', async () => {
    const event = {
      httpMethod: 'POST',
      path:       '/api/qb/questions',
      headers:    { 'Content-Type': 'application/json' },
      body:       '{ not valid json :::',
      pathParameters:       null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers present on 400 malformed-JSON response', async () => {
    const event = {
      httpMethod: 'POST',
      path:       '/api/qb/questions',
      headers:    {},
      body:       '{{{',
      pathParameters:       null,
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/qb/questions — list ────────────────────────────────────────────

describe('questionBankHandler — GET /api/qb/questions list', () => {

  it('returns 200 with no filters applied', async () => {
    const result = await handler(getListEvent(), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body is an array wrapped in questions key', async () => {
    const result = await handler(getListEvent(), mockContext);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.questions)).toBe(true);
  });

  it('response body count matches the questions array length', async () => {
    mockListQuestions.mockReturnValue([STORED_MC_QUESTION, STORED_MC_QUESTION]);
    const result = await handler(getListEvent(), mockContext);
    const body = JSON.parse(result.body);
    expect(body.count).toBe(2);
    expect(body.questions).toHaveLength(2);
  });

  it('returns 200 with grade + subject filters and calls listQuestions with parsed grade', async () => {
    mockListQuestions.mockReturnValue([STORED_MC_QUESTION]);
    const result = await handler(getListEvent({ grade: '3', subject: 'Math' }), mockContext);
    expect(result.statusCode).toBe(200);
    expect(mockListQuestions).toHaveBeenCalledWith(expect.objectContaining({ grade: 3, subject: 'Math' }));
  });

  it('returns 200 with grade-only filter', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(getListEvent({ grade: '5' }), mockContext);
    expect(result.statusCode).toBe(200);
    expect(mockListQuestions).toHaveBeenCalledWith(expect.objectContaining({ grade: 5 }));
  });

  it('returns 200 with subject-only filter', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(getListEvent({ subject: 'Science' }), mockContext);
    expect(result.statusCode).toBe(200);
    expect(mockListQuestions).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Science' }));
  });

  it('returns 200 with topic, difficulty, and type filters', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(
      getListEvent({ topic: 'Multiplication', difficulty: 'Medium', type: 'multiple-choice' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    expect(mockListQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Multiplication', difficulty: 'Medium', type: 'multiple-choice' }),
    );
  });

  it('returns 400 for a non-integer grade filter value', async () => {
    const result = await handler(getListEvent({ grade: 'abc' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for grade filter of 0', async () => {
    const result = await handler(getListEvent({ grade: '0' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for grade filter of 11', async () => {
    const result = await handler(getListEvent({ grade: '11' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "grade" for invalid grade filter', async () => {
    const result = await handler(getListEvent({ grade: 'abc' }), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/grade/i);
  });

  it('CORS headers present on 200 list response', async () => {
    const result = await handler(getListEvent(), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 400 invalid-grade-filter response', async () => {
    const result = await handler(getListEvent({ grade: 'bad' }), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns empty array when listQuestions returns no results', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(getListEvent({ grade: '9' }), mockContext);
    const body = JSON.parse(result.body);
    expect(body.count).toBe(0);
    expect(body.questions).toEqual([]);
  });

  it('accepts boundary grade filter 1', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(getListEvent({ grade: '1' }), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('accepts boundary grade filter 10', async () => {
    mockListQuestions.mockReturnValue([]);
    const result = await handler(getListEvent({ grade: '10' }), mockContext);
    expect(result.statusCode).toBe(200);
  });

});

// ─── GET /api/qb/questions/:id — get by ID ───────────────────────────────────

describe('questionBankHandler — GET /api/qb/questions/:id', () => {

  it('returns 200 for an existing question ID', async () => {
    const result = await handler(getByIdEvent(VALID_QUESTION_ID), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body contains the question object', async () => {
    const result = await handler(getByIdEvent(VALID_QUESTION_ID), mockContext);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.question).toHaveProperty('questionId', VALID_QUESTION_ID);
  });

  it('calls getQuestion with the correct ID', async () => {
    await handler(getByIdEvent(VALID_QUESTION_ID), mockContext);
    expect(mockGetQuestion).toHaveBeenCalledWith(VALID_QUESTION_ID);
  });

  it('returns 404 when the adapter returns null for an unknown ID', async () => {
    mockGetQuestion.mockReturnValue(null);
    const result = await handler(getByIdEvent('unknown-id-1234'), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('error body mentions "not found" on 404', async () => {
    mockGetQuestion.mockReturnValue(null);
    const result = await handler(getByIdEvent('unknown-id-1234'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/not found/i);
  });

  it('CORS headers are present on 200 get-by-id response', async () => {
    const result = await handler(getByIdEvent(VALID_QUESTION_ID), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers are present on 404 get-by-id response', async () => {
    mockGetQuestion.mockReturnValue(null);
    const result = await handler(getByIdEvent('no-such-id'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Unknown route ────────────────────────────────────────────────────────────

describe('questionBankHandler — unknown route', () => {

  it('returns 404 for an unrecognised path', async () => {
    const result = await handler(
      { httpMethod: 'DELETE', path: '/api/qb/questions', headers: {}, body: null, pathParameters: null, queryStringParameters: null },
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('CORS headers are present on unknown-route 404 response', async () => {
    const result = await handler(
      { httpMethod: 'PATCH', path: '/api/qb/questions', headers: {}, body: null, pathParameters: null, queryStringParameters: null },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Lambda context — callbackWaitsForEmptyEventLoop ─────────────────────────

describe('questionBankHandler — Lambda context guard', () => {

  it('sets context.callbackWaitsForEmptyEventLoop to false on OPTIONS invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler({ httpMethod: 'OPTIONS' }, ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on POST invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(postEvent(VALID_MC_BODY), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on GET list invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(getListEvent(), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on GET by-id invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(getByIdEvent(VALID_QUESTION_ID), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on 400 error response', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(postEvent({ ...VALID_MC_BODY, grade: 0 }), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('sets context.callbackWaitsForEmptyEventLoop to false on 404 response', async () => {
    mockGetQuestion.mockReturnValue(null);
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(getByIdEvent('no-such-id'), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

});

// ─── CORS headers present on all response types ───────────────────────────────

describe('questionBankHandler — CORS headers on every status code', () => {

  it('201 response includes Access-Control-Allow-Origin', async () => {
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.statusCode).toBe(201);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('400 response includes Access-Control-Allow-Origin', async () => {
    const result = await handler(postEvent({ ...VALID_MC_BODY, grade: 99 }), mockContext);
    expect(result.statusCode).toBe(400);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('404 response includes Access-Control-Allow-Origin', async () => {
    mockGetQuestion.mockReturnValue(null);
    const result = await handler(getByIdEvent('nonexistent'), mockContext);
    expect(result.statusCode).toBe(404);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('409 response includes Access-Control-Allow-Origin', async () => {
    mockAddIfNotExists.mockReturnValue({ stored: null, duplicate: true });
    const result = await handler(postEvent(VALID_MC_BODY), mockContext);
    expect(result.statusCode).toBe(409);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('200 GET list response includes Access-Control-Allow-Origin', async () => {
    const result = await handler(getListEvent(), mockContext);
    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('200 GET by-id response includes Access-Control-Allow-Origin', async () => {
    const result = await handler(getByIdEvent(VALID_QUESTION_ID), mockContext);
    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

/**
 * @file tests/unit/generateQuestionsHandler.test.js
 * @description Unit tests for backend/handlers/generateQuestionsHandler.js.
 * The batchGenerator is mocked — no real API calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateBatch = jest.fn();
jest.unstable_mockModule('../../src/ai/pipeline/batchGenerator.js', () => ({
  generateQuestionBatch: mockGenerateBatch,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/generateQuestionsHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(body = {}, method = 'POST') {
  return {
    httpMethod: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    pathParameters: null,
    queryStringParameters: null,
  };
}

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'learnfyra-generate-questions',
  getRemainingTimeInMillis: () => 15000,
};

const validBody = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Easy',
  questionType: 'multiple-choice',
  count: 3,
};

const mockBatchResult = {
  questions: [
    { type: 'multiple-choice', question: 'Q1', answer: 'B', explanation: 'Because B', points: 1 },
    { type: 'multiple-choice', question: 'Q2', answer: 'A', explanation: 'Because A', points: 1 },
    { type: 'multiple-choice', question: 'Q3', answer: 'C', explanation: 'Because C', points: 1 },
  ],
  cost: { totalInputTokens: 900, totalOutputTokens: 450, estimatedUSDCents: 0.01 },
  cacheStats: { hits: 0, misses: 3 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateBatch.mockResolvedValue(mockBatchResult);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handler() — OPTIONS (CORS preflight)', () => {

  it('returns 200 for OPTIONS request', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('includes CORS headers on OPTIONS response', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
  });

});

describe('handler() — successful generation', () => {

  it('returns 200 with questions on valid input', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('questions');
    expect(body.questions).toHaveLength(3);
  });

  it('returns count field matching questions.length', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.count).toBe(body.questions.length);
  });

  it('returns cost object in response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.cost).toHaveProperty('totalInputTokens');
    expect(body.cost).toHaveProperty('estimatedUSDCents');
  });

  it('returns cacheStats in response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.cacheStats).toHaveProperty('hits');
    expect(body.cacheStats).toHaveProperty('misses');
  });

  it('defaults count to 5 when not provided', async () => {
    const { count: _, ...bodyNoCount } = validBody;
    await handler(mockEvent(bodyNoCount), mockContext);

    expect(mockGenerateBatch).toHaveBeenCalledWith(
      expect.objectContaining({ count: 5 })
    );
  });

  it('passes all params to generateQuestionBatch', async () => {
    await handler(mockEvent(validBody), mockContext);

    expect(mockGenerateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: 3, subject: 'Math', topic: 'Multiplication',
        difficulty: 'Easy', questionType: 'multiple-choice', count: 3,
      })
    );
  });

  it('includes CORS headers on success response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
  });

});

describe('handler() — input validation', () => {

  it('returns 400 for missing grade', async () => {
    const { grade: _, ...body } = validBody;
    const result = await handler(mockEvent(body), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for grade 0', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for grade 11', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 11 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid subject', async () => {
    const result = await handler(mockEvent({ ...validBody, subject: 'Art' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for empty topic', async () => {
    const result = await handler(mockEvent({ ...validBody, topic: '' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid difficulty', async () => {
    const result = await handler(mockEvent({ ...validBody, difficulty: 'Expert' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid questionType', async () => {
    const result = await handler(mockEvent({ ...validBody, questionType: 'essay' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for count above 30', async () => {
    const result = await handler(mockEvent({ ...validBody, count: 31 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for count 0', async () => {
    const result = await handler(mockEvent({ ...validBody, count: 0 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns error message in body for invalid input', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('does not call generateQuestionBatch on invalid input', async () => {
    await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(mockGenerateBatch).not.toHaveBeenCalled();
  });

});

describe('handler() — accepted boundary values', () => {

  it('accepts grade 1', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 1 }), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('accepts grade 10', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 10 }), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('accepts count 1', async () => {
    mockGenerateBatch.mockResolvedValue({ ...mockBatchResult, questions: [mockBatchResult.questions[0]] });
    const result = await handler(mockEvent({ ...validBody, count: 1 }), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('accepts count 30', async () => {
    const result = await handler(mockEvent({ ...validBody, count: 30 }), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('accepts all valid subjects', async () => {
    const subjects = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];
    for (const subject of subjects) {
      const result = await handler(mockEvent({ ...validBody, subject }), mockContext);
      expect(result.statusCode).toBe(200);
    }
  });

  it('accepts Mixed difficulty', async () => {
    const result = await handler(mockEvent({ ...validBody, difficulty: 'Mixed' }), mockContext);
    expect(result.statusCode).toBe(200);
  });

});

describe('handler() — error handling', () => {

  it('returns 500 when generateQuestionBatch throws', async () => {
    mockGenerateBatch.mockRejectedValue(new Error('Pipeline failure'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('includes error message in body on 500', async () => {
    mockGenerateBatch.mockRejectedValue(new Error('API timeout'));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('API timeout');
  });

  it('includes CORS headers on error response', async () => {
    mockGenerateBatch.mockRejectedValue(new Error('fail'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
  });

  it('handles null body gracefully', async () => {
    const result = await handler({ httpMethod: 'POST', body: null }, mockContext);
    expect(result.statusCode).toBe(400); // missing required fields
  });

  it('handles unparseable body gracefully', async () => {
    const result = await handler({ httpMethod: 'POST', body: '{invalid json' }, mockContext);
    expect(result.statusCode).toBe(400); // missing required fields after failed parse
  });

});

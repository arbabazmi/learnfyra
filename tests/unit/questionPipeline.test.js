/**
 * @file tests/unit/questionPipeline.test.js
 * @description Unit tests for the 4-step question generation pipeline.
 * Client, retryUtils, and answerValidator are all mocked so no real API calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: async (fn) => fn(),
}));

const mockCreate = jest.fn();
jest.unstable_mockModule('../../src/ai/client.js', () => ({
  getAnthropicClient: jest.fn(() => ({ messages: { create: mockCreate } })),
  CLAUDE_MODEL: 'claude-sonnet-4-6',
  MAX_TOKENS: 8192,
}));

// Mock validateAnswer directly for clean pipeline unit tests
const mockValidateAnswer = jest.fn();
jest.unstable_mockModule('../../src/ai/validation/answerValidator.js', () => ({
  validateAnswer: mockValidateAnswer,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { runQuestionPipeline } = await import('../../src/ai/pipeline/questionPipeline.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MC_QUESTION = {
  type: 'multiple-choice',
  question: 'What is 6 × 7?',
  options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
  answer: 'B',
  explanation: '6 × 7 = 42',
  points: 1,
};

const VALID_VALIDATION = {
  is_correct: true,
  confidence: 0.99,
  corrected_answer: 'B',
  validation_notes: '',
};

function mockGenResponse(q = MC_QUESTION) {
  return {
    content: [{ text: JSON.stringify(q) }],
    usage: { input_tokens: 200, output_tokens: 100 },
  };
}

function mockExplainResponse(text = '6 × 7 = 42 because multiplication is repeated addition.') {
  return {
    content: [{ text: JSON.stringify({ explanation: text }) }],
    usage: { input_tokens: 80, output_tokens: 40 },
  };
}

const baseParams = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication',
  difficulty: 'Easy',
  questionType: 'multiple-choice',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateAnswer.mockResolvedValue(VALID_VALIDATION);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runQuestionPipeline()', () => {

  it('returns a question object with required fields', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);

    expect(result).toHaveProperty('type', 'multiple-choice');
    expect(result).toHaveProperty('question');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('explanation');
    expect(result).toHaveProperty('points');
  });

  it('includes options array for multiple-choice', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);
    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options).toHaveLength(4);
  });

  it('uses explanation text from explain step', async () => {
    const customExplanation = 'Multiplication means repeated addition!';
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse(customExplanation));

    const result = await runQuestionPipeline(baseParams);
    expect(result.explanation).toBe(customExplanation);
  });

  it('corrects the answer when validator returns is_correct=false then true', async () => {
    // First validation: incorrect → retry
    mockValidateAnswer
      .mockResolvedValueOnce({ is_correct: false, confidence: 0.5, corrected_answer: 'B', validation_notes: '' })
      .mockResolvedValueOnce({ is_correct: true,  confidence: 0.99, corrected_answer: 'B', validation_notes: '' });

    mockCreate
      .mockResolvedValueOnce(mockGenResponse({ ...MC_QUESTION, answer: 'C' })) // attempt 0
      .mockResolvedValueOnce(mockGenResponse())                                  // attempt 1 (retry)
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);
    expect(result.answer).toBe('B');
  });

  it('attaches _meta with generateModel, explainModel, usage', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);

    expect(result._meta).toBeDefined();
    expect(typeof result._meta.generateModel).toBe('string');
    expect(typeof result._meta.explainModel).toBe('string');
    expect(result._meta.usage).toBeDefined();
    expect(typeof result._meta.usage.inputTokens).toBe('number');
    expect(typeof result._meta.usage.outputTokens).toBe('number');
  });

  it('accumulates tokens from generation and explain steps', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())   // 200 in + 100 out
      .mockResolvedValueOnce(mockExplainResponse()); // 80 in + 40 out

    const result = await runQuestionPipeline(baseParams);
    expect(result._meta.usage.inputTokens).toBe(280);
    expect(result._meta.usage.outputTokens).toBe(140);
  });

  it('throws when generation returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: '' }], usage: {} });
    await expect(runQuestionPipeline(baseParams)).rejects.toThrow(/empty/i);
  });

  it('throws when generation returns non-JSON text', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: 'Here is a question for you!' }],
      usage: {},
    });
    await expect(runQuestionPipeline(baseParams)).rejects.toThrow(/no JSON/i);
  });

  it('throws when generation JSON missing question field', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ type: 'multiple-choice', answer: 'B' }) }],
      usage: {},
    });
    await expect(runQuestionPipeline(baseParams)).rejects.toThrow(/question/i);
  });

  it('marks wasEscalated=false when validation passes on first attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);
    expect(result._meta.wasEscalated).toBe(false);
  });

  it('calls validateAnswer once on first successful attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    await runQuestionPipeline(baseParams);
    expect(mockValidateAnswer).toHaveBeenCalledTimes(1);
  });

  it('calls validateAnswer with correct parameters', async () => {
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce(mockExplainResponse());

    await runQuestionPipeline(baseParams);

    const callArgs = mockValidateAnswer.mock.calls[0][0];
    expect(callArgs).toHaveProperty('grade', 3);
    expect(callArgs).toHaveProperty('subject', 'Math');
    expect(callArgs).toHaveProperty('questionType', 'multiple-choice');
    expect(callArgs).toHaveProperty('question');
    expect(callArgs).toHaveProperty('answer');
  });

  it('marks wasEscalated=true after 2 failed validation retries', async () => {
    // 3 validation attempts all failing (confidence < 0.9 and is_correct=false)
    mockValidateAnswer
      .mockResolvedValue({ is_correct: false, confidence: 0.5, corrected_answer: 'B', validation_notes: '' });

    mockCreate
      .mockResolvedValueOnce(mockGenResponse()) // attempt 0
      .mockResolvedValueOnce(mockGenResponse()) // attempt 1
      .mockResolvedValueOnce(mockGenResponse()) // attempt 2 (escalated)
      .mockResolvedValueOnce(mockExplainResponse());

    const result = await runQuestionPipeline(baseParams);
    expect(result._meta.wasEscalated).toBe(true);
  });

  it('uses explanation fallback text when explain response is not JSON', async () => {
    const rawText = 'Simply put, 6 times 7 is 42.';
    mockCreate
      .mockResolvedValueOnce(mockGenResponse())
      .mockResolvedValueOnce({ content: [{ text: rawText }], usage: { input_tokens: 50, output_tokens: 20 } });

    const result = await runQuestionPipeline(baseParams);
    expect(result.explanation).toBe(rawText);
  });

});

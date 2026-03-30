/**
 * @file tests/unit/answerValidator.test.js
 * @description Unit tests for src/ai/validation/answerValidator.js.
 * Anthropic client is mocked — no real API calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: async (fn) => fn(),
}));

jest.unstable_mockModule('../../src/ai/client.js', () => ({
  getAnthropicClient: jest.fn(),
  anthropic: { messages: { create: jest.fn() } },
  CLAUDE_MODEL: 'claude-sonnet-4-6',
  MAX_TOKENS: 8192,
}));

const { getAnthropicClient } = await import('../../src/ai/client.js');
const { validateAnswer }     = await import('../../src/ai/validation/answerValidator.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCreate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getAnthropicClient.mockReturnValue({ messages: { create: mockCreate } });
});

const baseParams = {
  grade: 3,
  subject: 'Math',
  questionType: 'multiple-choice',
  question: 'What is 6 × 7?',
  answer: 'B',
  options: ['A. 36', 'B. 42', 'C. 48', 'D. 54'],
};

function mockValidationResponse(obj) {
  return {
    content: [{ text: JSON.stringify(obj) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateAnswer()', () => {

  it('returns is_correct=true and corrected_answer when answer is correct', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true,
      confidence: 0.99,
      corrected_answer: 'B',
      validation_notes: '6 × 7 = 42, which is option B',
    }));

    const result = await validateAnswer(baseParams);

    expect(result.is_correct).toBe(true);
    expect(result.corrected_answer).toBe('B');
    expect(result.confidence).toBe(0.99);
  });

  it('returns is_correct=false with corrected answer when answer is wrong', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: false,
      confidence: 0.95,
      corrected_answer: 'B',
      validation_notes: '6 × 7 = 42, answer should be B not C',
    }));

    const result = await validateAnswer({ ...baseParams, answer: 'C' });

    expect(result.is_correct).toBe(false);
    expect(result.corrected_answer).toBe('B');
  });

  it('defaults confidence to 1.0 if missing from response', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true,
      corrected_answer: 'B',
    }));

    const result = await validateAnswer(baseParams);
    expect(result.confidence).toBe(1.0);
  });

  it('defaults validation_notes to empty string if missing', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true,
      corrected_answer: 'B',
    }));

    const result = await validateAnswer(baseParams);
    expect(result.validation_notes).toBe('');
  });

  it('strips markdown fences from the response text', async () => {
    const json = JSON.stringify({ is_correct: true, confidence: 0.9, corrected_answer: 'B', validation_notes: '' });
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '```json\n' + json + '\n```' }],
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const result = await validateAnswer(baseParams);
    expect(result.is_correct).toBe(true);
  });

  it('throws when response text is empty', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: '' }], usage: {} });
    await expect(validateAnswer(baseParams)).rejects.toThrow(/empty/i);
  });

  it('throws when response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: 'I cannot validate this.' }],
      usage: {},
    });
    await expect(validateAnswer(baseParams)).rejects.toThrow(/not valid JSON/i);
  });

  it('throws when is_correct field is missing from response', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      confidence: 0.9,
      corrected_answer: 'B',
    }));
    await expect(validateAnswer(baseParams)).rejects.toThrow(/is_correct/i);
  });

  it('throws when corrected_answer field is missing from response', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true,
    }));
    await expect(validateAnswer(baseParams)).rejects.toThrow(/corrected_answer/i);
  });

  it('calls the Anthropic client with MODEL_SONNET', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true, confidence: 1.0, corrected_answer: 'B', validation_notes: '',
    }));

    await validateAnswer(baseParams);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toContain('sonnet');
  });

  it('works for true-false questions', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true, confidence: 1.0, corrected_answer: 'True', validation_notes: '',
    }));

    const result = await validateAnswer({
      grade: 4, subject: 'Science', questionType: 'true-false',
      question: 'The sun is a star.', answer: 'True',
    });

    expect(result.corrected_answer).toBe('True');
  });

  it('works when options parameter is omitted', async () => {
    mockCreate.mockResolvedValueOnce(mockValidationResponse({
      is_correct: true, confidence: 0.9, corrected_answer: '42', validation_notes: '',
    }));

    const result = await validateAnswer({
      grade: 3, subject: 'Math', questionType: 'fill-in-the-blank',
      question: 'The answer to 6 × 7 is _______.', answer: '42',
    });

    expect(result.is_correct).toBe(true);
  });

});

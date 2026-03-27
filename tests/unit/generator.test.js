/**
 * @file tests/unit/generator.test.js
 * @description Unit tests for AI worksheet generator, JSON extractor, and type coercion.
 *   The Anthropic client and retryUtils are fully mocked so no real API calls are made.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock retryUtils to eliminate backoff delays in tests
jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: async (fn, opts = {}) => {
    const maxRetries = opts.maxRetries ?? 3;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries && opts.onRetry) opts.onRetry(attempt + 1, err);
      }
    }
    throw lastError;
  },
}));

// Mock the Anthropic client before importing generator
jest.unstable_mockModule('../../src/ai/client.js', () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 8192,
}));

// Dynamic imports must come after mockModule calls
const { generateWorksheet, extractJSON, coerceTypes } =
  await import('../../src/ai/generator.js');
const { anthropic } = await import('../../src/ai/client.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock Anthropic response wrapping a JSON string */
function mockResponse(obj) {
  return { content: [{ text: JSON.stringify(obj) }], stop_reason: 'end_turn' };
}

const validOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
};

// ─── extractJSON() ────────────────────────────────────────────────────────────

describe('extractJSON()', () => {

  it('returns bare JSON unchanged', () => {
    const input = '{"foo":"bar"}';
    expect(extractJSON(input)).toBe(input);
  });

  it('strips leading and trailing markdown fences', () => {
    const json = '{"a":1}';
    expect(extractJSON('```json\n' + json + '\n```')).toBe(json);
    expect(extractJSON('```\n'    + json + '\n```')).toBe(json);
  });

  it('extracts JSON embedded in surrounding text', () => {
    const json  = '{"title":"Test","questions":[]}';
    const input = 'Here is your worksheet:\n' + json + '\nLet me know if you need changes.';
    expect(extractJSON(input)).toBe(json);
  });

  it('handles nested braces inside string values', () => {
    const json  = '{"question":"Solve {x} = 5","answer":"x = 5"}';
    expect(() => extractJSON(json)).not.toThrow();
    expect(extractJSON(json)).toBe(json);
  });

  it('throws when no JSON object is present', () => {
    expect(() => extractJSON('Sorry, I cannot help with that.')).toThrow(
      /no JSON object/i
    );
  });

  it('throws on empty string', () => {
    expect(() => extractJSON('')).toThrow();
  });

});

// ─── coerceTypes() ───────────────────────────────────────────────────────────

describe('coerceTypes()', () => {

  it('converts grade from string to number', () => {
    const data = { grade: '3', totalPoints: 10, questions: [] };
    expect(coerceTypes(data).grade).toBe(3);
  });

  it('converts totalPoints from string to number', () => {
    const data = { grade: 3, totalPoints: '20', questions: [] };
    expect(coerceTypes(data).totalPoints).toBe(20);
  });

  it('converts question number and points to integers', () => {
    const data = {
      grade: 3, totalPoints: 2,
      questions: [{ number: '1', points: '2', answer: 'A' }],
    };
    const result = coerceTypes(data);
    expect(result.questions[0].number).toBe(1);
    expect(result.questions[0].points).toBe(2);
  });

  it('converts non-string answer to string', () => {
    const data = {
      grade: 3, totalPoints: 1,
      questions: [{ number: 1, points: 1, answer: 42 }],
    };
    expect(coerceTypes(data).questions[0].answer).toBe('42');
  });

  it('returns the same object reference', () => {
    const data = { grade: 3, totalPoints: 0, questions: [] };
    expect(coerceTypes(data)).toBe(data);
  });

});

// ─── generateWorksheet() ─────────────────────────────────────────────────────

describe('generateWorksheet()', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MAX_RETRIES = '3';
  });

  it('returns valid worksheet JSON for grade 3 math', async () => {
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(sampleWorksheet));

    const result = await generateWorksheet(validOptions);

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('questions');
    expect(Array.isArray(result.questions)).toBe(true);
    expect(result.grade).toBe(3);
  });

  it('calls the Anthropic API exactly once on success', async () => {
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(sampleWorksheet));
    await generateWorksheet(validOptions);
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
  });

  it('passes system prompt and correct model to the API', async () => {
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(sampleWorksheet));
    await generateWorksheet(validOptions);

    const call = anthropic.messages.create.mock.calls[0][0];
    expect(call.system).toContain('CCSS');
    expect(call.model).toBe('claude-sonnet-4-20250514');
    expect(call.max_tokens).toBe(8192);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it('throws on invalid grade (0) without calling API', async () => {
    await expect(generateWorksheet({ ...validOptions, grade: 0 }))
      .rejects.toThrow('Grade must be between 1 and 10');
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('throws on invalid grade (11) without calling API', async () => {
    await expect(generateWorksheet({ ...validOptions, grade: 11 }))
      .rejects.toThrow('Grade must be between 1 and 10');
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('throws on invalid subject without calling API', async () => {
    await expect(generateWorksheet({ ...validOptions, subject: 'Art' }))
      .rejects.toThrow();
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('throws on question count below minimum (4) without calling API', async () => {
    await expect(generateWorksheet({ ...validOptions, questionCount: 4 }))
      .rejects.toThrow('Question count must be between 5 and 10');
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('throws on question count above maximum (11) without calling API', async () => {
    await expect(generateWorksheet({ ...validOptions, questionCount: 11 }))
      .rejects.toThrow();
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  // ── JSON extraction and parsing ─────────────────────────────────────────────

  it('throws when Claude returns non-JSON text', async () => {
    process.env.MAX_RETRIES = '0';
    anthropic.messages.create.mockResolvedValue({
      content: [{ text: 'I cannot help with that request.' }],
      stop_reason: 'end_turn',
    });

    await expect(generateWorksheet(validOptions)).rejects.toThrow();
  });

  it('succeeds when JSON is wrapped in markdown fences', async () => {
    const fenced = {
      content: [{ text: '```json\n' + JSON.stringify(sampleWorksheet) + '\n```' }],
      stop_reason: 'end_turn',
    };
    anthropic.messages.create.mockResolvedValueOnce(fenced);

    const result = await generateWorksheet(validOptions);
    expect(result).toHaveProperty('title');
  });

  it('succeeds when JSON is preceded by explanatory text', async () => {
    const withPreamble = {
      content: [{ text: 'Here is the worksheet:\n' + JSON.stringify(sampleWorksheet) }],
      stop_reason: 'end_turn',
    };
    anthropic.messages.create.mockResolvedValueOnce(withPreamble);

    const result = await generateWorksheet(validOptions);
    expect(result).toHaveProperty('questions');
  });

  it('throws when response is empty', async () => {
    process.env.MAX_RETRIES = '0';
    anthropic.messages.create.mockResolvedValue({
      content: [{ text: '' }],
      stop_reason: 'end_turn',
    });

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/empty/i);
  });

  it('throws when stop_reason is max_tokens (truncated response)', async () => {
    process.env.MAX_RETRIES = '0';
    anthropic.messages.create.mockResolvedValue({
      content: [{ text: '{"title":"Test","questions":[' }],
      stop_reason: 'max_tokens',
    });

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/truncated/i);
  });

  // ── Schema validation ────────────────────────────────────────────────────────

  it('throws when required top-level field is missing', async () => {
    process.env.MAX_RETRIES = '0';
    const { instructions: _removed, ...incomplete } = sampleWorksheet;
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(incomplete));

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/instructions/);
  });

  it('throws when question count does not match requested count', async () => {
    process.env.MAX_RETRIES = '0';
    const tooFew = { ...sampleWorksheet, questions: sampleWorksheet.questions.slice(0, 3) };
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(tooFew));

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/Expected exactly 10/);
  });

  it('throws when a question is missing the "answer" field', async () => {
    process.env.MAX_RETRIES = '0';
    const badQuestion = sampleWorksheet.questions.map((q, i) =>
      i === 0 ? { ...q, answer: undefined } : q
    );
    const badWorksheet = { ...sampleWorksheet, questions: badQuestion };
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(badWorksheet));

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/answer/);
  });

  it('throws when multiple-choice question has wrong option count', async () => {
    process.env.MAX_RETRIES = '0';
    const badQuestion = sampleWorksheet.questions.map((q) =>
      q.type === 'multiple-choice'
        ? { ...q, options: ['A. only', 'B. two'] }  // only 2 options
        : q
    );
    const badWorksheet = { ...sampleWorksheet, questions: badQuestion };
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(badWorksheet));

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/4 strings/);
  });

  it('coerces grade from string to number in response', async () => {
    const stringGrade = { ...sampleWorksheet, grade: '3' };
    anthropic.messages.create.mockResolvedValueOnce(mockResponse(stringGrade));

    const result = await generateWorksheet(validOptions);
    expect(typeof result.grade).toBe('number');
    expect(result.grade).toBe(3);
  });

  // ── Retry behaviour ──────────────────────────────────────────────────────────

  it('retries on API error and succeeds on second attempt', async () => {
    anthropic.messages.create
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce(mockResponse(sampleWorksheet));

    const result = await generateWorksheet(validOptions);

    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty('title');
  });

  it('throws after all retries are exhausted', async () => {
    process.env.MAX_RETRIES = '2';
    anthropic.messages.create.mockRejectedValue(new Error('API timeout'));

    await expect(generateWorksheet(validOptions)).rejects.toThrow('API timeout');
    // 1 initial attempt + 2 retries = 3 total
    expect(anthropic.messages.create).toHaveBeenCalledTimes(3);
  });

  it('uses strict prompt on retry attempts (attempt ≥ 1)', async () => {
    // First call fails, second succeeds — check that second call uses the strict prompt
    anthropic.messages.create
      .mockRejectedValueOnce(new Error('API timeout'))
      .mockResolvedValueOnce(mockResponse(sampleWorksheet));

    await generateWorksheet(validOptions);

    const secondCallContent = anthropic.messages.create.mock.calls[1][0].messages[0].content;
    expect(secondCallContent).toContain('CRITICAL');
  });

  // ── Safety refusal detection ─────────────────────────────────────────────────

  it('throws a descriptive error when Claude refuses the request', async () => {
    process.env.MAX_RETRIES = '0';
    anthropic.messages.create.mockResolvedValue({
      content: [{ text: 'I cannot generate this content as it goes against my policy.' }],
      stop_reason: 'end_turn',
    });

    await expect(generateWorksheet(validOptions)).rejects.toThrow(/refused/i);
  });

});

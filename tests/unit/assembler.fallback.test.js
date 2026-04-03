/**
 * @file tests/unit/assembler.fallback.test.js
 * @description Focused unit tests for the 3-tier fallback chain in assembleWorksheet().
 *   Tier 2 (partial): AI fails, bank has questions → serve bank questions only.
 *   Tier 3 (none):    AI fails, bank is empty → return 0 questions.
 *   Normal path:      AI succeeds → fallbackMode is null.
 *
 *   Uses the identical mock setup as tests/unit/assembler.test.js.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Shared question factory ──────────────────────────────────────────────────

function makeQuestion(overrides = {}) {
  return {
    questionId: overrides.questionId || 'qid-001',
    number:     overrides.number     || 1,
    type:       overrides.type       || 'fill-in-the-blank',
    question:   overrides.question   || 'What is 2 + 2?',
    answer:     overrides.answer     || '4',
    explanation:overrides.explanation|| 'Basic addition.',
    points:     overrides.points     || 1,
    grade:      overrides.grade      || 3,
    subject:    overrides.subject    || 'Math',
    topic:      overrides.topic      || 'Addition',
    difficulty: overrides.difficulty || 'Easy',
    reuseCount: overrides.reuseCount || 0,
    ...overrides,
  };
}

/** Builds a valid Claude response containing `count` questions */
function claudeResponse(count, topic = 'Addition') {
  const questions = Array.from({ length: count }, (_, i) => ({
    number:     i + 1,
    type:       'fill-in-the-blank',
    question:   `Generated question ${i + 1} for ${topic}`,
    answer:     `Answer ${i + 1}`,
    explanation:`Explanation ${i + 1}`,
    points:     1,
  }));
  return {
    stop_reason: 'end_turn',
    content: [{ text: JSON.stringify({
      title:        `Grade 3 Math: ${topic}`,
      grade:        3,
      subject:      'Math',
      topic,
      difficulty:   'Easy',
      instructions: 'Solve each problem.',
      totalPoints:  count,
      questions,
    }) }],
  };
}

// ─── Module mocks — identical to assembler.test.js ────────────────────────────

const mockListQuestions  = jest.fn();
const mockAddIfNotExists = jest.fn();

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn().mockResolvedValue({
    listQuestions:  mockListQuestions,
    addIfNotExists: mockAddIfNotExists,
  }),
}));

const mockRecordReuse = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../../src/questionBank/reuseHook.js', () => ({
  recordQuestionReuse: mockRecordReuse,
}));

const mockMessagesCreate = jest.fn();
jest.unstable_mockModule('../../src/ai/client.js', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS:   8192,
  anthropic: {
    messages: { create: mockMessagesCreate },
  },
}));

// Strip retry delays so tests run fast
jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: jest.fn(async (fn) => fn()),
}));

const mockValidateQuestion = jest.fn();
const mockExtractJSON      = jest.fn((raw) => raw);
const mockCoerceTypes      = jest.fn((data) => data);

jest.unstable_mockModule('../../src/ai/generator.js', () => ({
  validateQuestion: mockValidateQuestion,
  extractJSON:      mockExtractJSON,
  coerceTypes:      mockCoerceTypes,
}));

// ─── Dynamic import (must come after all mockModule calls) ────────────────────

const { assembleWorksheet } = await import('../../src/ai/assembler.js');

// ─── Shared options ───────────────────────────────────────────────────────────

const baseOptions = {
  grade:         3,
  subject:       'Math',
  topic:         'Addition',
  difficulty:    'Easy',
  questionCount: 5,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockAddIfNotExists.mockReturnValue({ stored: { questionId: 'new-qid' }, duplicate: false });
  mockValidateQuestion.mockReturnValue(undefined); // valid by default
  mockExtractJSON.mockImplementation((raw) => raw);
  mockCoerceTypes.mockImplementation((data) => data);
});

// ─── Normal path (AI succeeds) ────────────────────────────────────────────────

describe('assembleWorksheet — normal path (AI succeeds)', () => {

  it('fallbackMode is null when AI succeeds (empty bank)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.fallbackMode).toBeNull();
  });

  it('fallbackMode is null when bank fully covers the request', async () => {
    const banked = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}` })
    );
    mockListQuestions.mockReturnValue(banked);

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.fallbackMode).toBeNull();
  });

  it('bankStats.fallbackUsed is false on the normal path', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fallbackUsed).toBe(false);
  });

  it('bankStats.generated equals questionCount when bank is empty and AI succeeds', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(5);
  });

});

// ─── Tier 2: partial fallback (AI fails, bank has questions) ─────────────────

describe('assembleWorksheet — Tier 2 partial fallback', () => {

  it('returns bank questions with fallbackMode: partial when AI fails', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}`, question: `Bank Q ${i + 1}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is unavailable'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.fallbackMode).toBe('partial');
    expect(worksheet.questions).toHaveLength(3);
  });

  it('returns the correct actualCount reflecting only bank questions', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}`, question: `Bank Q ${i + 1}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.actualCount).toBe(3);
    expect(worksheet.requestedCount).toBe(5);
  });

  it('bankStats.fallbackUsed is true on Tier 2', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fallbackUsed).toBe(true);
  });

  it('bankStats.generated is 0 when fallback activates', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(0);
  });

  it('does NOT store any new questions to the bank on Tier 2 fallback', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    await assembleWorksheet(baseOptions);
    expect(mockAddIfNotExists).not.toHaveBeenCalled();
  });

  it('still records reuse for the banked questions served on Tier 2', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    await assembleWorksheet(baseOptions);
    expect(mockRecordReuse).toHaveBeenCalledTimes(1);
    const [calledIds] = mockRecordReuse.mock.calls[0];
    expect(calledIds).toHaveLength(3);
  });

  it('Tier 2 boundary — bank has 1 question, AI fails → actualCount: 1', async () => {
    mockListQuestions.mockReturnValue([
      makeQuestion({ questionId: 'solo-bqid', question: 'Solo bank Q' }),
    ]);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.fallbackMode).toBe('partial');
    expect(worksheet.actualCount).toBe(1);
    expect(worksheet.questions).toHaveLength(1);
  });

  it('worksheet contains a fallbackReason string on Tier 2', async () => {
    const banked = [makeQuestion({ questionId: 'bqid-0' })];
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('Rate limit exceeded'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(typeof worksheet.fallbackReason).toBe('string');
    expect(worksheet.fallbackReason.length).toBeGreaterThan(0);
  });

  it('questions are still renumbered 1..N on Tier 2', async () => {
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}`, number: i + 10 }) // intentionally wrong numbers
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    const numbers = worksheet.questions.map(q => q.number);
    expect(numbers).toEqual([1, 2, 3]);
  });

});

// ─── Tier 3: none fallback (AI fails, bank empty) ────────────────────────────

describe('assembleWorksheet — Tier 3 none fallback', () => {

  it('returns fallbackMode: none when AI fails and bank is empty', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.fallbackMode).toBe('none');
  });

  it('returns 0 questions on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.questions).toHaveLength(0);
  });

  it('worksheet.actualCount is 0 on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.actualCount).toBe(0);
  });

  it('worksheet.requestedCount reflects the original questionCount on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions); // questionCount: 5
    expect(worksheet.requestedCount).toBe(5);
  });

  it('bankStats.fallbackUsed is true on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fallbackUsed).toBe(true);
  });

  it('bankStats.generated is 0 on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(0);
  });

  it('bankStats.fromBank is 0 on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fromBank).toBe(0);
  });

  it('does not call addIfNotExists on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    await assembleWorksheet(baseOptions);
    expect(mockAddIfNotExists).not.toHaveBeenCalled();
  });

  it('does not call recordQuestionReuse on Tier 3 (no bank questions used)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    await assembleWorksheet(baseOptions);
    expect(mockRecordReuse).not.toHaveBeenCalled();
  });

  it('worksheet contains a fallbackReason explaining the error on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Timeout connecting to Anthropic'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(typeof worksheet.fallbackReason).toBe('string');
    expect(worksheet.fallbackReason).toContain('Timeout connecting to Anthropic');
  });

  it('totalPoints is 0 on Tier 3 (no questions)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.totalPoints).toBe(0);
  });

  it('worksheet still has required metadata fields on Tier 3', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('Claude is down'));

    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet).toHaveProperty('title');
    expect(worksheet).toHaveProperty('grade', 3);
    expect(worksheet).toHaveProperty('subject', 'Math');
    expect(worksheet).toHaveProperty('topic', 'Addition');
    expect(worksheet).toHaveProperty('difficulty', 'Easy');
    expect(worksheet).toHaveProperty('estimatedTime');
    expect(worksheet).toHaveProperty('timerSeconds');
    expect(worksheet).toHaveProperty('instructions');
  });

});

// ─── provenance on fallback paths ─────────────────────────────────────────────

describe('assembleWorksheet — provenance on fallback paths', () => {

  it('provenance is returned even on Tier 2 fallback (summary level)', async () => {
    const banked = [makeQuestion({ questionId: 'bqid-0' })];
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { provenance } = await assembleWorksheet(baseOptions);
    expect(provenance).toBeDefined();
    expect(provenance.mode).toBe('bank-first');
  });

  it('provenance is returned even on Tier 3 fallback (summary level)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { provenance } = await assembleWorksheet(baseOptions);
    expect(provenance).toBeDefined();
  });

  it('provenance is undefined when provenanceLevel is none (Tier 2)', async () => {
    const banked = [makeQuestion({ questionId: 'bqid-0' })];
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockRejectedValue(new Error('AI down'));

    const { provenance } = await assembleWorksheet({ ...baseOptions, provenanceLevel: 'none' });
    expect(provenance).toBeUndefined();
  });

});

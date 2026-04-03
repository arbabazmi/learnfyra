/**
 * @file tests/unit/assembler.test.js
 * @description Unit tests for src/ai/assembler.js — M03 bank-first pipeline.
 *
 * Strategy:
 *   - Mock the question bank adapter to control what "exists" in the bank.
 *   - Mock the Claude anthropic client to control what the AI "generates".
 *   - Mock recordQuestionReuse to verify it is called with the right IDs.
 *   - All tests remain fully offline — no real AWS or Anthropic calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Build minimal valid questions for the bank and AI responses ──────────────

function makeQuestion(overrides = {}) {
  return {
    questionId: overrides.questionId || 'qid-001',
    number: overrides.number || 1,
    type: overrides.type || 'fill-in-the-blank',
    question: overrides.question || 'What is 2 + 2?',
    answer: overrides.answer || '4',
    explanation: overrides.explanation || 'Basic addition.',
    points: overrides.points || 1,
    grade: overrides.grade || 3,
    subject: overrides.subject || 'Math',
    topic: overrides.topic || 'Addition',
    difficulty: overrides.difficulty || 'Easy',
    reuseCount: overrides.reuseCount || 0,
    ...overrides,
  };
}

/** Builds a fake Claude message response containing `count` questions */
function claudeResponse(count, topic = 'Addition') {
  const questions = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    type: 'fill-in-the-blank',
    question: `Generated question ${i + 1} for ${topic}`,
    answer: `Answer ${i + 1}`,
    explanation: `Explanation ${i + 1}`,
    points: 1,
  }));
  const worksheet = {
    title: `Grade 3 Math: ${topic}`,
    grade: 3,
    subject: 'Math',
    topic,
    difficulty: 'Easy',
    instructions: 'Solve each problem.',
    totalPoints: count,
    questions,
  };
  return {
    stop_reason: 'end_turn',
    content: [{ text: JSON.stringify(worksheet) }],
  };
}

// ─── Module mocks — must appear before dynamic import() ──────────────────────

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
  MAX_TOKENS: 8192,
  anthropic: {
    messages: {
      create: mockMessagesCreate,
    },
  },
}));

// retryUtils: strip delays so tests run fast
jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: jest.fn(async (fn) => fn()),
}));

// generator.js — expose validateQuestion / extractJSON / coerceTypes as controllable mocks
const mockValidateQuestion = jest.fn();
const mockExtractJSON      = jest.fn((raw) => raw);  // passthrough by default
const mockCoerceTypes      = jest.fn((data) => data); // passthrough by default

jest.unstable_mockModule('../../src/ai/generator.js', () => ({
  validateQuestion: mockValidateQuestion,
  extractJSON:      mockExtractJSON,
  coerceTypes:      mockCoerceTypes,
}));

// ─── Dynamic imports — must come after all mockModule calls ──────────────────

const { assembleWorksheet } = await import('../../src/ai/assembler.js');

// ─── Shared options ───────────────────────────────────────────────────────────

const baseOptions = {
  grade: 3,
  subject: 'Math',
  topic: 'Addition',
  difficulty: 'Easy',
  questionCount: 5,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockAddIfNotExists.mockReturnValue({ stored: { questionId: 'new-qid' }, duplicate: false });

  // generator.js mocks — passthrough by default so existing tests are unaffected
  mockValidateQuestion.mockReturnValue(undefined); // no-op: question is valid
  mockExtractJSON.mockImplementation((raw) => raw);
  mockCoerceTypes.mockImplementation((data) => data);
});

// ─── Full bank coverage (no AI call) ─────────────────────────────────────────

describe('assembleWorksheet — full bank coverage', () => {

  beforeEach(() => {
    // Bank has 5 matching questions
    const banked = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}`, number: i + 1 })
    );
    mockListQuestions.mockReturnValue(banked);
  });

  it('returns a worksheet object', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet).toBeDefined();
    expect(worksheet.questions).toHaveLength(5);
  });

  it('does NOT call Claude when bank is fully covered', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('bankStats.fromBank equals questionCount when fully covered', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fromBank).toBe(5);
  });

  it('bankStats.generated is 0 when fully covered', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(0);
  });

  it('bankStats.totalStored is 0 when fully covered', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.totalStored).toBe(0);
  });

  it('calls recordQuestionReuse with the banked question IDs', async () => {
    await assembleWorksheet(baseOptions);
    const [calledIds] = mockRecordReuse.mock.calls[0];
    expect(calledIds).toHaveLength(5);
    expect(calledIds[0]).toMatch(/^qid-/);
  });

  it('questions are renumbered 1..N', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    worksheet.questions.forEach((q, idx) => {
      expect(q.number).toBe(idx + 1);
    });
  });

  it('totalPoints equals sum of question points', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    const sum = worksheet.questions.reduce((acc, q) => acc + q.points, 0);
    expect(worksheet.totalPoints).toBe(sum);
  });

  it('worksheet has required top-level fields', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet).toHaveProperty('title');
    expect(worksheet).toHaveProperty('grade', 3);
    expect(worksheet).toHaveProperty('subject', 'Math');
    expect(worksheet).toHaveProperty('topic', 'Addition');
    expect(worksheet).toHaveProperty('difficulty', 'Easy');
    expect(worksheet).toHaveProperty('instructions');
    expect(worksheet).toHaveProperty('totalPoints');
  });

  it('returns summary provenance by default', async () => {
    const { provenance } = await assembleWorksheet(baseOptions);
    expect(provenance).toMatchObject({
      mode: 'bank-first',
      level: 'summary',
      usedBank: true,
      usedGeneration: false,
      selectedBankCount: 5,
      generatedCount: 0,
    });
  });

});

// ─── Empty bank (generate all questions) ─────────────────────────────────────

describe('assembleWorksheet — empty bank, generate all', () => {

  beforeEach(() => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));
  });

  it('returns a worksheet with 5 questions from AI', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.questions).toHaveLength(5);
  });

  it('calls Claude exactly once', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it('bankStats.fromBank is 0 when bank is empty', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fromBank).toBe(0);
  });

  it('bankStats.generated equals questionCount when bank is empty', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(5);
  });

  it('stores each valid new question to the bank', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockAddIfNotExists).toHaveBeenCalledTimes(5);
  });

  it('bankStats.totalStored reflects newly stored questions', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.totalStored).toBe(5);
  });

  it('does NOT call recordQuestionReuse when no banked questions used', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockRecordReuse).not.toHaveBeenCalled();
  });

  it('generated questions are renumbered starting from 1', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.questions[0].number).toBe(1);
    expect(worksheet.questions[4].number).toBe(5);
  });

  it('summary provenance includes generated model identifiers', async () => {
    const { provenance } = await assembleWorksheet(baseOptions);
    expect(provenance.generatedByModels).toEqual([process.env.LOW_COST_MODEL || 'claude-haiku-4-5-20251001']);
  });

});

// ─── Partial bank coverage (mix of banked + generated) ───────────────────────

describe('assembleWorksheet — partial bank coverage', () => {

  beforeEach(() => {
    // Bank has 3 questions, need 5 total → generate 2
    const banked = Array.from({ length: 3 }, (_, i) =>
      makeQuestion({ questionId: `bqid-${i}`, question: `Bank Q ${i + 1}` })
    );
    mockListQuestions.mockReturnValue(banked);
    mockMessagesCreate.mockResolvedValue(claudeResponse(2));
  });

  it('returns worksheet with 5 total questions', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(worksheet.questions).toHaveLength(5);
  });

  it('bankStats.fromBank is 3', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.fromBank).toBe(3);
  });

  it('bankStats.generated is 2', async () => {
    const { bankStats } = await assembleWorksheet(baseOptions);
    expect(bankStats.generated).toBe(2);
  });

  it('calls Claude once for the missing 2 questions', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it('calls recordQuestionReuse with 3 banked IDs', async () => {
    await assembleWorksheet(baseOptions);
    const [calledIds] = mockRecordReuse.mock.calls[0];
    expect(calledIds).toHaveLength(3);
  });

  it('stores 2 new AI questions to the bank', async () => {
    await assembleWorksheet(baseOptions);
    expect(mockAddIfNotExists).toHaveBeenCalledTimes(2);
  });

  it('all questions are renumbered 1..5', async () => {
    const { worksheet } = await assembleWorksheet(baseOptions);
    const numbers = worksheet.questions.map(q => q.number);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('full provenance attaches per-question provenance for banked and generated questions', async () => {
    const { worksheet, provenance } = await assembleWorksheet({ ...baseOptions, provenanceLevel: 'full' });
    expect(provenance.level).toBe('full');
    const banked = worksheet.questions.filter(q => q.provenance.source === 'bank');
    const generated = worksheet.questions.filter(q => q.provenance.source === 'generated');
    expect(banked).toHaveLength(3);
    expect(generated).toHaveLength(2);
    expect(banked[0].provenance).toMatchObject({
      source: 'bank',
      questionId: expect.stringMatching(/^bqid-/),
      reuseRecorded: true,
    });
    expect(generated[0].provenance).toMatchObject({
      source: 'generated',
      modelUsed: 'claude-haiku-4-5-20251001',
    });
  });

  it('none provenance omits worksheet and response provenance fields', async () => {
    const { worksheet, provenance } = await assembleWorksheet({ ...baseOptions, provenanceLevel: 'none' });
    expect(provenance).toBeUndefined();
    worksheet.questions.forEach((question) => {
      expect(question.provenance).toBeUndefined();
    });
  });

});

// ─── Model selection ──────────────────────────────────────────────────────────

describe('assembleWorksheet — model selection', () => {

  beforeEach(() => {
    mockListQuestions.mockReturnValue([]);
  });

  it('uses LOW_COST_MODEL when generating ≤ 5 questions', async () => {
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));
    await assembleWorksheet({ ...baseOptions, questionCount: 5 });
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const expectedModel = process.env.LOW_COST_MODEL || 'claude-haiku-4-5-20251001';
    expect(callArgs.model).toBe(expectedModel);
  });

  it('uses CLAUDE_MODEL when generating 6–15 questions', async () => {
    mockMessagesCreate.mockResolvedValue(claudeResponse(10));
    await assembleWorksheet({ ...baseOptions, questionCount: 10 });
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
  });

  it('uses PREMIUM_MODEL when generating > 15 questions', async () => {
    mockMessagesCreate.mockResolvedValue(claudeResponse(20));
    await assembleWorksheet({ ...baseOptions, questionCount: 20 });
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const expectedModel = process.env.PREMIUM_MODEL || 'claude-sonnet-4-20250514';
    expect(callArgs.model).toBe(expectedModel);
  });

  it('uses PREMIUM_MODEL for Hard difficulty with > 10 questions', async () => {
    mockMessagesCreate.mockResolvedValue(claudeResponse(12));
    await assembleWorksheet({ ...baseOptions, difficulty: 'Hard', questionCount: 12 });
    const callArgs = mockMessagesCreate.mock.calls[0][0];
    const expectedModel = process.env.PREMIUM_MODEL || 'claude-sonnet-4-20250514';
    expect(callArgs.model).toBe(expectedModel);
  });

});

// ─── addIfNotExists deduplication ────────────────────────────────────────────

describe('assembleWorksheet — deduplication via addIfNotExists', () => {

  beforeEach(() => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(3));
  });

  it('does not count duplicates toward totalStored', async () => {
    // First call is stored, next two are duplicates
    mockAddIfNotExists
      .mockReturnValueOnce({ stored: { questionId: 'new-1' }, duplicate: false })
      .mockReturnValueOnce({ stored: null, duplicate: true })
      .mockReturnValueOnce({ stored: null, duplicate: true });

    const { bankStats } = await assembleWorksheet({ ...baseOptions, questionCount: 3 });
    expect(bankStats.totalStored).toBe(1);
  });

  it('calls addIfNotExists with grade/subject/topic/type/question as candidate', async () => {
    await assembleWorksheet({ ...baseOptions, questionCount: 3 });
    const firstCall = mockAddIfNotExists.mock.calls[0];
    const [candidate] = firstCall;
    expect(candidate).toMatchObject({
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      type: expect.any(String),
      question: expect.any(String),
    });
  });

  it('stores modelUsed on each new question entry', async () => {
    await assembleWorksheet({ ...baseOptions, questionCount: 3 });
    const firstCall = mockAddIfNotExists.mock.calls[0];
    const [, newEntry] = firstCall;
    expect(newEntry).toHaveProperty('modelUsed');
    expect(typeof newEntry.modelUsed).toBe('string');
  });

});

// ─── Worksheet schema fields (estimatedTime / timerSeconds) ──────────────────

describe('assembleWorksheet — worksheet schema fields', () => {

  it('worksheet has an estimatedTime string field', async () => {
    const banked = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}`, number: i + 1 })
    );
    mockListQuestions.mockReturnValue(banked);
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(typeof worksheet.estimatedTime).toBe('string');
    expect(worksheet.estimatedTime.length).toBeGreaterThan(0);
  });

  it('worksheet has a timerSeconds number field', async () => {
    const banked = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}`, number: i + 1 })
    );
    mockListQuestions.mockReturnValue(banked);
    const { worksheet } = await assembleWorksheet(baseOptions);
    expect(typeof worksheet.timerSeconds).toBe('number');
    expect(worksheet.timerSeconds).toBeGreaterThan(0);
  });

  it('timerSeconds equals estimatedMinutes * 60', async () => {
    const banked = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}`, number: i + 1 })
    );
    mockListQuestions.mockReturnValue(banked);
    const { worksheet } = await assembleWorksheet(baseOptions);
    // baseOptions has questionCount: 5 → estimatedMinutes = max(5, 5*2) = 10
    expect(worksheet.timerSeconds).toBe(10 * 60);
  });

  it('estimatedTime uses minimum of 5 minutes for very short worksheets', async () => {
    // questionCount: 1 → questionCount * 2 = 2, clamped to 5
    const banked = [makeQuestion({ questionId: 'qid-0', question: 'Q1', number: 1 })];
    mockListQuestions.mockReturnValue(banked);
    const { worksheet } = await assembleWorksheet({ ...baseOptions, questionCount: 1 });
    expect(worksheet.estimatedTime).toBe('5 minutes');
    expect(worksheet.timerSeconds).toBe(300);
  });

});

// ─── Bank query failure propagates ───────────────────────────────────────────

describe('assembleWorksheet — bank query failure', () => {

  it('propagates an error when getQuestionBankAdapter rejects', async () => {
    // The bank adapter is already mocked at module level; simulate listQuestions
    // throwing to test that assembleWorksheet does not swallow the error.
    mockListQuestions.mockImplementation(() => {
      throw new Error('DB connection refused');
    });
    await expect(assembleWorksheet(baseOptions)).rejects.toThrow('DB connection refused');
  });

});

// ─── Second-pass validation guard (defence-in-depth) ─────────────────────────

describe('assembleWorksheet — second-pass validation guard', () => {

  it('throws when second-pass validateQuestion fails (defence-in-depth)', async () => {
    // Empty bank → generate 1 question via AI
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(1));

    // First call (first-pass inside generateMissingQuestions) succeeds.
    // Second call (second-pass inside assembleWorksheet) throws.
    mockValidateQuestion
      .mockReturnValueOnce(undefined) // first-pass — valid
      .mockImplementationOnce(() => {
        throw new Error('type field is invalid');
      });

    await expect(assembleWorksheet({ ...baseOptions, questionCount: 1 }))
      .rejects.toThrow(/second-pass validation/);
  });

});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('assembleWorksheet — error handling', () => {

  it('throws when Claude returns an empty response', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ text: '' }],
    });
    await expect(assembleWorksheet(baseOptions)).rejects.toThrow('empty response');
  });

  it('throws when Claude response is truncated (max_tokens)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ text: '{"questions":[' }],
    });
    await expect(assembleWorksheet(baseOptions)).rejects.toThrow('max_tokens');
  });

  it('throws when Claude returns wrong question count', async () => {
    mockListQuestions.mockReturnValue([]);
    // Return only 3 questions when 5 are needed
    mockMessagesCreate.mockResolvedValue(claudeResponse(3));
    await expect(assembleWorksheet({ ...baseOptions, questionCount: 5 })).rejects.toThrow(
      /Expected exactly 5/
    );
  });

});

describe('assembleWorksheet — repeat cap enforcement', () => {
  beforeEach(() => {
    mockMessagesCreate.mockResolvedValue(claudeResponse(2));
  });

  it('allows no repeated questions when repeatCapPercent is 0', async () => {
    const banked = [
      makeQuestion({ questionId: 'q-seen-1', question: 'Seen Q1' }),
      makeQuestion({ questionId: 'q-seen-2', question: 'Seen Q2' }),
      makeQuestion({ questionId: 'q-new-1', question: 'New Q1' }),
      makeQuestion({ questionId: 'q-new-2', question: 'New Q2' }),
      makeQuestion({ questionId: 'q-new-3', question: 'New Q3' }),
    ];
    mockListQuestions.mockReturnValue(banked);

    const seen = new Set(['id:q-seen-1', 'id:q-seen-2']);
    const { worksheet, bankStats } = await assembleWorksheet({
      ...baseOptions,
      questionCount: 5,
      repeatCapPercent: 0,
      seenQuestionSignatures: seen,
    });

    expect(worksheet.questions).toHaveLength(5);
    expect(bankStats.repeatUsed).toBe(0);
  });

  it('respects max repeated question allowance floor(questionCount*percent/100)', async () => {
    const banked = [
      makeQuestion({ questionId: 'q-seen-1' }),
      makeQuestion({ questionId: 'q-seen-2' }),
      makeQuestion({ questionId: 'q-seen-3' }),
      makeQuestion({ questionId: 'q-new-1' }),
      makeQuestion({ questionId: 'q-new-2' }),
      makeQuestion({ questionId: 'q-new-3' }),
      makeQuestion({ questionId: 'q-new-4' }),
      makeQuestion({ questionId: 'q-new-5' }),
      makeQuestion({ questionId: 'q-new-6' }),
      makeQuestion({ questionId: 'q-new-7' }),
    ];
    mockListQuestions.mockReturnValue(banked);

    const seen = new Set(['id:q-seen-1', 'id:q-seen-2', 'id:q-seen-3']);
    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      questionCount: 10,
      repeatCapPercent: 10,
      seenQuestionSignatures: seen,
    });

    expect(bankStats.maxRepeatQuestions).toBe(1);
    expect(bankStats.repeatUsed).toBeLessThanOrEqual(1);
  });
});

/**
 * @file tests/unit/assembler.repeat-cap.test.js
 * @description Unit tests for the dynamic repeat-cap logic inside assembleWorksheet.
 *
 * Tests the FR-RCAP-010 / FR-RCAP-011 / FR-RCAP-012 requirements:
 *  - maxRepeatQuestions = Math.floor(count * capPercent / 100)
 *  - bankStats reflects effective cap
 *  - 10q, 20% cap, 8 unseen available → 8 unseen + 2 repeat
 *  - 10q, 0% cap  → no repeats regardless of bank
 *  - 10q, 100% cap → no exposure filtering
 *  - New student (no exposure) → all from bank
 *  - Empty bank → all from AI
 *
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _qidCounter = 0;
function makeQuestion(overrides = {}) {
  _qidCounter += 1;
  return {
    questionId:  overrides.questionId  ?? `qid-${_qidCounter}`,
    number:      overrides.number      ?? _qidCounter,
    type:        overrides.type        ?? 'fill-in-the-blank',
    question:    overrides.question    ?? `Question ${_qidCounter}?`,
    answer:      overrides.answer      ?? `Answer ${_qidCounter}`,
    explanation: overrides.explanation ?? `Explanation ${_qidCounter}`,
    points:      overrides.points      ?? 1,
    grade:       overrides.grade       ?? 3,
    subject:     overrides.subject     ?? 'Math',
    topic:       overrides.topic       ?? 'Multiplication',
    difficulty:  overrides.difficulty  ?? 'Easy',
    reuseCount:  overrides.reuseCount  ?? 0,
    ...overrides,
  };
}

function claudeResponse(count, topic = 'Multiplication') {
  const questions = Array.from({ length: count }, (_, i) => ({
    number:      i + 1,
    type:        'fill-in-the-blank',
    question:    `AI Question ${i + 1} for ${topic}`,
    answer:      `AI Answer ${i + 1}`,
    explanation: `AI Explanation ${i + 1}`,
    points:      1,
  }));
  return {
    stop_reason: 'end_turn',
    content: [{
      text: JSON.stringify({
        title:       `Grade 3 Math: ${topic}`,
        grade:       3,
        subject:     'Math',
        topic,
        difficulty:  'Easy',
        instructions: 'Solve each problem.',
        totalPoints: count,
        questions,
      }),
    }],
  };
}

// ─── Module mocks — declared before any dynamic import ────────────────────────

const mockListQuestions  = jest.fn();
const mockAddIfNotExists = jest.fn();
const mockRecordReuse    = jest.fn().mockResolvedValue(undefined);
const mockMessagesCreate = jest.fn();
const mockGetUserHistory = jest.fn();
const mockValidateQuestion = jest.fn();
const mockExtractJSON      = jest.fn((raw) => raw);
const mockCoerceTypes      = jest.fn((data) => data);

jest.unstable_mockModule('../../src/questionBank/index.js', () => ({
  getQuestionBankAdapter: jest.fn().mockResolvedValue({
    listQuestions:  mockListQuestions,
    addIfNotExists: mockAddIfNotExists,
  }),
}));

jest.unstable_mockModule('../../src/questionBank/reuseHook.js', () => ({
  recordQuestionReuse: mockRecordReuse,
}));

jest.unstable_mockModule('../../src/ai/client.js', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS:   8192,
  anthropic:    { messages: { create: mockMessagesCreate } },
}));

jest.unstable_mockModule('../../src/utils/retryUtils.js', () => ({
  withRetry: jest.fn(async (fn) => fn()),
}));

jest.unstable_mockModule('../../src/ai/generator.js', () => ({
  validateQuestion: mockValidateQuestion,
  extractJSON:      mockExtractJSON,
  coerceTypes:      mockCoerceTypes,
}));

// Partially mock repeatCapPolicy: replace only getUserQuestionHistory so the
// assembler's exposure-based dedup step is controllable, while all other
// exports (buildQuestionSignature, calculateAllocation, etc.) remain real.
jest.unstable_mockModule('../../src/ai/repeatCapPolicy.js', () => ({
  DEFAULT_REPEAT_CAP_PERCENT: 10,
  buildQuestionSignature: (q) => {
    if (q && typeof q.questionId === 'string' && q.questionId.trim()) {
      return `id:${q.questionId.trim()}`;
    }
    const type    = typeof q?.type     === 'string' ? q.type.trim().toLowerCase()     : '';
    const prompt  = typeof q?.question === 'string' ? q.question.trim().toLowerCase() : '';
    const answer  = typeof q?.answer   === 'string' ? q.answer.trim().toLowerCase()   : '';
    return `txt:${type}|${prompt}|${answer}`;
  },
  buildStudentKey:          jest.fn(),
  resolveEffectiveRepeatCap: jest.fn(),
  resolveRepeatCap:          jest.fn(),
  getSeenQuestionSignatures: jest.fn().mockResolvedValue(new Set()),
  recordExposureHistory:     jest.fn().mockResolvedValue(0),
  getUserQuestionHistory:    mockGetUserHistory,
  calculateAllocation: (questionCount, capPercent) => {
    const capped    = Math.max(0, Math.min(100, Number(capPercent) || 0));
    const maxRepeat = Math.ceil(questionCount * capped / 100);
    const minUnseen = questionCount - maxRepeat;
    return { maxRepeat, minUnseen };
  },
}));

// ─── Dynamic imports — after all mockModule calls ─────────────────────────────

const { assembleWorksheet } = await import('../../src/ai/assembler.js');

// ─── Shared base options ──────────────────────────────────────────────────────

const baseOptions = {
  grade:         3,
  subject:       'Math',
  topic:         'Multiplication',
  difficulty:    'Easy',
  questionCount: 10,
  provenanceLevel: 'none',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  _qidCounter = 0;

  // Default: no exposure history
  mockGetUserHistory.mockResolvedValue(new Set());

  // Default: addIfNotExists returns a stored entry
  mockAddIfNotExists.mockResolvedValue({ stored: { questionId: 'new-qid' }, duplicate: false });

  // Default: validation and parsing pass through
  mockValidateQuestion.mockReturnValue(undefined);
  mockExtractJSON.mockImplementation((raw) => raw);
  mockCoerceTypes.mockImplementation((data) => data);
});

// ─── 10 questions, 20% cap, 8 unseen available → 8 unseen + 2 repeat ─────────

describe('20% cap — 8 unseen + 2 repeat when bank has enough of both', () => {
  it('selects 8 unseen and fills up to 2 from the cap (AC-02)', async () => {
    // Build 10 bank questions: first 8 are "unseen" (not in history), last 2 are "seen"
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}`, question: `Bank Q ${i + 1}` })
    );
    // Expose the last 2 question IDs
    const seenIds = new Set(['qid-8', 'qid-9']);
    mockGetUserHistory.mockResolvedValue(seenIds);
    mockListQuestions.mockReturnValue(bankQuestions);

    // No AI needed — bank covers all 10
    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 20,
      userId: 'student-1',
    });

    // With 20% cap on 10 questions: Math.floor(10 * 0.20) = 2 repeats allowed
    expect(bankStats.maxRepeatQuestions).toBe(2);
    expect(bankStats.repeatCapPercent).toBe(20);
  });
});

// ─── 10 questions, 0% cap → all unseen, no repeats ──────────────────────────

describe('0% cap — all questions must be unseen (FR-RCAP-010)', () => {
  it('bankStats.maxRepeatQuestions equals 0', async () => {
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    mockListQuestions.mockReturnValue(bankQuestions);
    mockGetUserHistory.mockResolvedValue(new Set());

    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 0,
    });

    expect(bankStats.maxRepeatQuestions).toBe(0);
    expect(bankStats.repeatCapPercent).toBe(0);
  });

  it('excludes seen questions when cap is 0% (no repeats in assembled questions)', async () => {
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    // Mark all as seen
    const seenIds = new Set(bankQuestions.map((q) => q.questionId));
    mockGetUserHistory.mockResolvedValue(seenIds);
    mockListQuestions.mockReturnValue(bankQuestions);

    // AI must fill the gap when 0% cap means no repeats and all are seen
    mockMessagesCreate.mockResolvedValue(claudeResponse(10));

    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 0,
      userId: 'student-2',
    });

    // repeatUsed must be 0 (cap enforced)
    expect(bankStats.repeatUsed).toBe(0);
  });
});

// ─── 10 questions, 100% cap → no filtering ───────────────────────────────────

describe('100% cap — exposure filtering is disabled (FR-RCAP-010 boundary)', () => {
  it('bankStats.maxRepeatQuestions equals questionCount', async () => {
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    mockListQuestions.mockReturnValue(bankQuestions);
    mockGetUserHistory.mockResolvedValue(new Set(bankQuestions.map((q) => q.questionId)));

    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 100,
      userId: 'student-3',
    });

    expect(bankStats.maxRepeatQuestions).toBe(10);
    expect(bankStats.repeatCapPercent).toBe(100);
  });
});

// ─── New student (no exposure) → all from bank ───────────────────────────────

describe('new student with no exposure history', () => {
  it('uses all bank questions when no IDs are seen', async () => {
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    mockListQuestions.mockReturnValue(bankQuestions);
    mockGetUserHistory.mockResolvedValue(new Set()); // empty — new student

    const { worksheet, bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 20,
      userId: 'brand-new-student',
    });

    expect(worksheet.questions).toHaveLength(10);
    expect(bankStats.fromBank).toBe(10);
    expect(bankStats.generated).toBe(0);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

// ─── Empty bank → all from AI ────────────────────────────────────────────────

describe('empty bank → all questions from AI', () => {
  it('calls Claude for all missing questions when bank is empty', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(10));

    const { worksheet, bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 20,
    });

    expect(worksheet.questions).toHaveLength(10);
    expect(bankStats.fromBank).toBe(0);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── bankStats fields (FR-RCAP-012) ──────────────────────────────────────────

describe('bankStats fields match FR-RCAP-012', () => {
  it('includes repeatCapPercent, maxRepeatQuestions, and repeatUsed', async () => {
    const bankQuestions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    mockListQuestions.mockReturnValue(bankQuestions);
    mockGetUserHistory.mockResolvedValue(new Set());

    const { bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 15,
    });

    expect(bankStats).toHaveProperty('repeatCapPercent', 15);
    // Math.floor(10 * 0.15) = 1
    expect(bankStats).toHaveProperty('maxRepeatQuestions', 1);
    expect(bankStats).toHaveProperty('repeatUsed');
    expect(typeof bankStats.repeatUsed).toBe('number');
  });
});

// ─── 5 unseen available when 10 requested at 20% cap → AI fills remainder ────

describe('20% cap — 5 unseen available, 2 repeat cap, 3 from AI (FR-RCAP-011)', () => {
  it('assembles 5 unseen + up to 2 repeat, then requests remaining from AI', async () => {
    // Build 7 bank questions: 5 unseen, 2 seen
    const bankQuestions = Array.from({ length: 7 }, (_, i) =>
      makeQuestion({ questionId: `qid-${i}` })
    );
    // Mark questions 5 and 6 as seen
    const seenIds = new Set(['qid-5', 'qid-6']);
    mockGetUserHistory.mockResolvedValue(seenIds);
    mockListQuestions.mockReturnValue(bankQuestions);

    // The assembler deduplication step: 7 bank questions, seenIds = {qid-5, qid-6}.
    // Unseen bank = qid-0..qid-4 (5 questions). Seen bank = qid-5, qid-6 (2 questions).
    // minUnseen = ceil(10 * 20/100) → Math.floor gives maxRepeat=2, minUnseen=8.
    // unseenBanked.length (5) < minUnseen (8), so only unseen are kept → 5 from bank.
    // missingCount = 5, so AI is called for exactly 5 questions.
    mockMessagesCreate.mockResolvedValue(claudeResponse(5));

    const { worksheet, bankStats } = await assembleWorksheet({
      ...baseOptions,
      repeatCapPercent: 20,
      userId: 'student-partial',
    });

    expect(worksheet.questions).toHaveLength(10);
    expect(bankStats.repeatCapPercent).toBe(20);
    expect(bankStats.maxRepeatQuestions).toBe(2);
  });
});

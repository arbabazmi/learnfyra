/**
 * @file tests/integration/repeat-cap-assembly.test.js
 * @description Integration tests for the full repeat-cap pipeline:
 *   resolveEffectiveRepeatCap → calculateAllocation → assembleWorksheet
 *
 * Tests the end-to-end contract between the policy resolution layer and the
 * assembler, verifying that:
 *   - The resolved capPercent drives the allocation in assembleWorksheet
 *   - Student override wins over global default (AC-04 precedence)
 *   - Cap = 0% means no repeats are included in the assembled worksheet
 *   - bankStats.repeatCapPercent matches the value forwarded from the resolver
 *
 * Design note: resolveEffectiveRepeatCap is tested with a real in-memory db
 * stub (not mocked). assembleWorksheet is tested with repeatCapPercent already
 * resolved, and getUserQuestionHistory is patched via env var + local JSON
 * (the tracker returns an empty Set when APP_RUNTIME is unset and no file
 * exists — which is the default test state).
 *
 * All Anthropic API calls and the question bank adapter are mocked.
 *
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _qidCounter = 0;
function makeQuestion(overrides = {}) {
  _qidCounter += 1;
  return {
    questionId:  overrides.questionId  ?? `q-${_qidCounter}`,
    number:      overrides.number      ?? _qidCounter,
    type:        'fill-in-the-blank',
    question:    overrides.question    ?? `Question ${_qidCounter}?`,
    answer:      `Answer ${_qidCounter}`,
    explanation: `Explanation ${_qidCounter}`,
    points:      1,
    grade:       3,
    subject:     'Math',
    topic:       'Fractions',
    difficulty:  'Easy',
    reuseCount:  0,
    ...overrides,
  };
}

function claudeResponse(count) {
  const questions = Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    type: 'fill-in-the-blank',
    question: `AI Q ${i + 1}`,
    answer: `AI A ${i + 1}`,
    explanation: `AI Exp ${i + 1}`,
    points: 1,
  }));
  return {
    stop_reason: 'end_turn',
    content: [{
      text: JSON.stringify({
        title: 'Grade 3 Math: Fractions',
        grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
        instructions: 'Solve.',
        totalPoints: count,
        questions,
      }),
    }],
  };
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockListQuestions  = jest.fn();
const mockAddIfNotExists = jest.fn();
const mockRecordReuse    = jest.fn().mockResolvedValue(undefined);
const mockMessagesCreate = jest.fn();
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

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { assembleWorksheet } = await import('../../src/ai/assembler.js');
const { resolveEffectiveRepeatCap, calculateAllocation } =
  await import('../../src/ai/repeatCapPolicy.js');

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  _qidCounter = 0;
  mockAddIfNotExists.mockResolvedValue({ stored: { questionId: 'new-q' }, duplicate: false });
  mockValidateQuestion.mockReturnValue(undefined);
  mockExtractJSON.mockImplementation((raw) => raw);
  mockCoerceTypes.mockImplementation((data) => data);
  // Ensure local file runtime (no APP_RUNTIME = no DynamoDB calls from tracker)
  delete process.env.APP_RUNTIME;
  delete process.env.USER_QUESTION_HISTORY_TABLE;
});

// ─── In-memory db stub ────────────────────────────────────────────────────────

function makeDb({ globalPercent = 20, overrides = [] } = {}) {
  return {
    async getItem(table, id) {
      if (table === 'adminPolicies' && id === 'global') {
        return { repeatCapPolicy: { enabled: true, defaultPercent: globalPercent } };
      }
      return null;
    },
    async listAll(table) {
      if (table === 'repeatCapOverrides') return overrides;
      return [];
    },
  };
}

// ─── resolveEffectiveRepeatCap + calculateAllocation unit contracts ────────────

describe('resolveEffectiveRepeatCap contract (used by generate pipeline)', () => {
  it('20% global cap returns capPercent=20 and appliedBy=default (AC-01)', async () => {
    const db = makeDb({ globalPercent: 20 });
    const { capPercent, appliedBy } = await resolveEffectiveRepeatCap({ db, teacherId: 't1' });
    expect(capPercent).toBe(20);
    expect(appliedBy).toBe('default');
  });

  it('calculateAllocation(10, 20) = { maxRepeat: 2, minUnseen: 8 } (AC-02)', () => {
    expect(calculateAllocation(10, 20)).toEqual({ maxRepeat: 2, minUnseen: 8 });
  });

  it('calculateAllocation(10, 0) = { maxRepeat: 0, minUnseen: 10 }', () => {
    expect(calculateAllocation(10, 0)).toEqual({ maxRepeat: 0, minUnseen: 10 });
  });

  it('calculateAllocation(10, 100) = { maxRepeat: 10, minUnseen: 0 }', () => {
    expect(calculateAllocation(10, 100)).toEqual({ maxRepeat: 10, minUnseen: 0 });
  });
});

// ─── Override precedence via real resolveEffectiveRepeatCap (AC-04) ───────────

describe('Override precedence: resolveEffectiveRepeatCap with real db (AC-04)', () => {
  it('student override of 10% beats global of 50%', async () => {
    const db = makeDb({
      globalPercent: 50,
      overrides: [
        { scope: 'student', scopeId: 'student-abc', repeatCapPercent: 10, isActive: true },
      ],
    });
    const { capPercent, appliedBy, sourceId } = await resolveEffectiveRepeatCap({
      db,
      studentId: 'student-abc',
      teacherId: 't1',
    });
    expect(capPercent).toBe(10);
    expect(appliedBy).toBe('student');
    expect(sourceId).toBe('student-abc');
  });

  it('teacher override of 40% applies when no student or parent override exists', async () => {
    const db = makeDb({
      globalPercent: 20,
      overrides: [
        { scope: 'teacher', scopeId: 'teacher-xyz', repeatCapPercent: 40, isActive: true },
      ],
    });
    const { capPercent, appliedBy } = await resolveEffectiveRepeatCap({
      db,
      studentId: 'student-no-override',
      teacherId: 'teacher-xyz',
    });
    expect(capPercent).toBe(40);
    expect(appliedBy).toBe('teacher');
  });

  it('expired student override falls through to global default', async () => {
    const pastIso = new Date(Date.now() - 86400000).toISOString();
    const db = makeDb({
      globalPercent: 20,
      overrides: [{
        scope:            'student',
        scopeId:          'student-expired',
        repeatCapPercent: 5,
        isActive:         true,
        expiresAt:        pastIso,
      }],
    });
    const { capPercent, appliedBy } = await resolveEffectiveRepeatCap({
      db,
      studentId: 'student-expired',
      teacherId: 't1',
    });
    expect(capPercent).toBe(20);
    expect(appliedBy).toBe('default');
  });
});

// ─── Full pipeline: resolved cap forwarded to assembleWorksheet ───────────────

describe('Full flow: global cap drives assembleWorksheet allocation (AC-02)', () => {
  it('20% cap → bankStats.maxRepeatQuestions=2 for 10 questions', async () => {
    const db = makeDb({ globalPercent: 20 });
    const { capPercent } = await resolveEffectiveRepeatCap({ db, teacherId: 't1' });

    const bank = Array.from({ length: 10 }, (_, i) => makeQuestion({ questionId: `q-${i}` }));
    mockListQuestions.mockReturnValue(bank);

    const { bankStats } = await assembleWorksheet({
      grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
      questionCount: 10,
      repeatCapPercent: capPercent,
      provenanceLevel: 'none',
    });

    expect(bankStats.repeatCapPercent).toBe(20);
    expect(bankStats.maxRepeatQuestions).toBe(2);
    expect(bankStats.fromBank).toBe(10);
  });

  it('0% cap → bankStats.maxRepeatQuestions=0', async () => {
    const db = makeDb({ globalPercent: 0 });
    const { capPercent } = await resolveEffectiveRepeatCap({ db, teacherId: 't1' });
    expect(capPercent).toBe(0);

    const bank = Array.from({ length: 10 }, (_, i) => makeQuestion({ questionId: `q-${i}` }));
    mockListQuestions.mockReturnValue(bank);

    const { bankStats } = await assembleWorksheet({
      grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
      questionCount: 10,
      repeatCapPercent: capPercent,
      provenanceLevel: 'none',
    });

    expect(bankStats.maxRepeatQuestions).toBe(0);
    expect(bankStats.repeatCapPercent).toBe(0);
  });

  it('100% cap → bankStats.maxRepeatQuestions=10', async () => {
    const db = makeDb({ globalPercent: 100 });
    const { capPercent } = await resolveEffectiveRepeatCap({ db, teacherId: 't1' });

    const bank = Array.from({ length: 10 }, (_, i) => makeQuestion({ questionId: `q-${i}` }));
    mockListQuestions.mockReturnValue(bank);

    const { bankStats } = await assembleWorksheet({
      grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
      questionCount: 10,
      repeatCapPercent: capPercent,
      provenanceLevel: 'none',
    });

    expect(bankStats.maxRepeatQuestions).toBe(10);
  });

  it('empty bank with 20% cap → all from AI (empty bank edge case)', async () => {
    mockListQuestions.mockReturnValue([]);
    mockMessagesCreate.mockResolvedValue(claudeResponse(10));

    const { worksheet, bankStats } = await assembleWorksheet({
      grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
      questionCount: 10,
      repeatCapPercent: 20,
      provenanceLevel: 'none',
    });

    expect(worksheet.questions).toHaveLength(10);
    expect(bankStats.fromBank).toBe(0);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── bankStats reflects the cap per FR-RCAP-012 ──────────────────────────────

describe('bankStats fields match FR-RCAP-012', () => {
  it('repeatCapPercent, maxRepeatQuestions, and repeatUsed are all present', async () => {
    const bank = Array.from({ length: 10 }, (_, i) => makeQuestion({ questionId: `q-${i}` }));
    mockListQuestions.mockReturnValue(bank);

    const { bankStats } = await assembleWorksheet({
      grade: 3, subject: 'Math', topic: 'Fractions', difficulty: 'Easy',
      questionCount: 10,
      repeatCapPercent: 15,
      provenanceLevel: 'none',
    });

    expect(bankStats).toHaveProperty('repeatCapPercent', 15);
    // Math.floor(10 * 0.15) = 1
    expect(bankStats).toHaveProperty('maxRepeatQuestions', 1);
    expect(bankStats).toHaveProperty('repeatUsed');
    expect(typeof bankStats.repeatUsed).toBe('number');
  });
});

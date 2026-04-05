/**
 * @file tests/unit/outputValidator.test.js
 * @description Unit tests for src/ai/validation/outputValidator.js
 *
 * Covers:
 *   - Orchestrates profanity + sensitive topic filters in sequence
 *   - Returns correct ValidationResult schema (safe, failureReason, failureDetails, validatorsRun)
 *   - Stops pipeline on first failure (profanity failure does not run sensitiveTopics)
 *   - Both filters running for clean content
 *   - validationFilters controls which filters run
 *   - Filter-level errors are caught and do not propagate (fail-open)
 *   - factualCheck filter is a no-op placeholder (never fails)
 *   - Grade-level escalation passed correctly to sensitiveTopicFilter
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockScanForProfanity       = jest.fn();
const mockScanForSensitiveTopics = jest.fn();

jest.unstable_mockModule('../../src/ai/validation/profanityFilter.js', () => ({
  scanForProfanity:        mockScanForProfanity,
  invalidateWordListCache: jest.fn(),
}));

jest.unstable_mockModule('../../src/ai/validation/sensitiveTopicFilter.js', () => ({
  scanForSensitiveTopics:        mockScanForSensitiveTopics,
  invalidateSensitiveTopicCache: jest.fn(),
}));

// resolveEffectiveLevel is a pure function we can allow to run for real,
// but we mock guardrailsBuilder to avoid DynamoDB calls.
jest.unstable_mockModule('../../src/ai/guardrails/guardrailsBuilder.js', () => ({
  resolveEffectiveLevel: (grade, policyLevel = 'medium') =>
    (grade <= 3 || policyLevel === 'strict') ? 'strict' : 'medium',
  buildGuardrailSuffix: jest.fn().mockResolvedValue('guardrail clause'),
}));

// ── Import under test (after mocks) ─────────────────────────────────────────

const { validateWorksheetOutput } =
  await import('../../src/ai/validation/outputValidator.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLEAN_WORKSHEET = {
  title: 'Math Worksheet',
  grade: 5,
  subject: 'Math',
  questions: [{ number: 1, type: 'fill-in-the-blank', question: 'What is 5+5?', answer: '10', explanation: '5+5=10' }],
};

const BASE_CONTEXT = {
  grade: 5,
  subject: 'Math',
  guardrailLevel: 'medium',
  validationFilters: ['profanity', 'sensitiveTopics'],
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: both filters pass
  mockScanForProfanity.mockReturnValue({ safe: true, matches: [] });
  mockScanForSensitiveTopics.mockReturnValue({ safe: true, triggeredCategories: [] });
});

// ── ValidationResult schema ───────────────────────────────────────────────────

describe('validateWorksheetOutput — result schema', () => {
  it('returns the correct shape for a passing result', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('failureReason');
    expect(result).toHaveProperty('failureDetails');
    expect(result).toHaveProperty('validatorsRun');
  });

  it('returns safe=true when both filters pass', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.safe).toBe(true);
    expect(result.failureReason).toBeNull();
    expect(result.failureDetails).toBeNull();
  });

  it('lists both filter names in validatorsRun when both run', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.validatorsRun).toContain('profanityFilter');
    expect(result.validatorsRun).toContain('sensitiveTopicFilter');
  });
});

// ── Profanity failure ─────────────────────────────────────────────────────────

describe('validateWorksheetOutput — profanity failure', () => {
  beforeEach(() => {
    mockScanForProfanity.mockReturnValue({ safe: false, matches: ['fuck', 'shit'] });
  });

  it('returns safe=false when profanity detected', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.safe).toBe(false);
  });

  it('sets failureReason to "profanity"', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.failureReason).toBe('profanity');
  });

  it('includes matched tokens in failureDetails', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.failureDetails).toContain('fuck');
    expect(result.failureDetails).toContain('shit');
  });

  it('stops pipeline on profanity failure — sensitiveTopics not called', async () => {
    await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(mockScanForSensitiveTopics).not.toHaveBeenCalled();
  });

  it('validatorsRun contains only profanityFilter when it fails first', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.validatorsRun).toContain('profanityFilter');
    expect(result.validatorsRun).not.toContain('sensitiveTopicFilter');
  });
});

// ── Sensitive topic failure ───────────────────────────────────────────────────

describe('validateWorksheetOutput — sensitive topic failure', () => {
  beforeEach(() => {
    mockScanForProfanity.mockReturnValue({ safe: true, matches: [] });
    mockScanForSensitiveTopics.mockReturnValue({ safe: false, triggeredCategories: ['violence'] });
  });

  it('returns safe=false when sensitive topic detected', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.safe).toBe(false);
  });

  it('sets failureReason to "sensitiveTopics"', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.failureReason).toBe('sensitiveTopics');
  });

  it('includes triggered category in failureDetails', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.failureDetails).toContain('violence');
  });

  it('runs profanityFilter then sensitiveTopicFilter — both appear in validatorsRun', async () => {
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.validatorsRun).toEqual(['profanityFilter', 'sensitiveTopicFilter']);
  });
});

// ── validationFilters controls which validators run ───────────────────────────

describe('validateWorksheetOutput — validationFilters config', () => {
  it('skips sensitiveTopics when not in validationFilters', async () => {
    const context = { ...BASE_CONTEXT, validationFilters: ['profanity'] };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForSensitiveTopics).not.toHaveBeenCalled();
    expect(mockScanForProfanity).toHaveBeenCalledTimes(1);
  });

  it('skips profanity when not in validationFilters', async () => {
    const context = { ...BASE_CONTEXT, validationFilters: ['sensitiveTopics'] };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForProfanity).not.toHaveBeenCalled();
    expect(mockScanForSensitiveTopics).toHaveBeenCalledTimes(1);
  });

  it('runs no validators when validationFilters is empty', async () => {
    const context = { ...BASE_CONTEXT, validationFilters: [] };
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(result.safe).toBe(true);
    expect(result.validatorsRun).toHaveLength(0);
    expect(mockScanForProfanity).not.toHaveBeenCalled();
    expect(mockScanForSensitiveTopics).not.toHaveBeenCalled();
  });

  it('includes factualValidator in validatorsRun when factualCheck is in filters', async () => {
    const context = { ...BASE_CONTEXT, validationFilters: ['profanity', 'sensitiveTopics', 'factualCheck'] };
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(result.validatorsRun).toContain('factualValidator');
    // factualCheck is a no-op placeholder — must never fail
    expect(result.safe).toBe(true);
  });

  it('defaults validationFilters to profanity + sensitiveTopics when omitted', async () => {
    const context = { grade: 5, subject: 'Math' };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForProfanity).toHaveBeenCalledTimes(1);
    expect(mockScanForSensitiveTopics).toHaveBeenCalledTimes(1);
  });
});

// ── Grade-level context passed to sensitiveTopicFilter ───────────────────────

describe('validateWorksheetOutput — grade-level context propagation', () => {
  it('passes "strict" effective level to sensitiveTopicFilter for Grade 2', async () => {
    const context = { grade: 2, subject: 'ELA', guardrailLevel: 'medium', validationFilters: ['profanity', 'sensitiveTopics'] };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForSensitiveTopics).toHaveBeenCalledWith(CLEAN_WORKSHEET, 'strict');
  });

  it('passes "medium" effective level to sensitiveTopicFilter for Grade 6 with medium policy', async () => {
    const context = { grade: 6, subject: 'Science', guardrailLevel: 'medium', validationFilters: ['profanity', 'sensitiveTopics'] };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForSensitiveTopics).toHaveBeenCalledWith(CLEAN_WORKSHEET, 'medium');
  });

  it('passes "strict" effective level for Grade 10 when policy is strict', async () => {
    const context = { grade: 10, subject: 'Math', guardrailLevel: 'strict', validationFilters: ['profanity', 'sensitiveTopics'] };
    await validateWorksheetOutput(CLEAN_WORKSHEET, context);
    expect(mockScanForSensitiveTopics).toHaveBeenCalledWith(CLEAN_WORKSHEET, 'strict');
  });
});

// ── Filter error resilience (fail-open) ───────────────────────────────────────

describe('validateWorksheetOutput — filter error resilience', () => {
  it('treats profanityFilter error as safe=true and continues pipeline', async () => {
    mockScanForProfanity.mockImplementation(() => { throw new Error('word list missing'); });
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    // Should not throw; sensitiveTopics should still run
    expect(mockScanForSensitiveTopics).toHaveBeenCalledTimes(1);
    expect(result.safe).toBe(true);
  });

  it('treats sensitiveTopicFilter error as safe=true and does not propagate', async () => {
    mockScanForSensitiveTopics.mockImplementation(() => { throw new Error('pattern file missing'); });
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.safe).toBe(true);
  });

  it('returns safe=true even when both filters throw', async () => {
    mockScanForProfanity.mockImplementation(() => { throw new Error('error A'); });
    mockScanForSensitiveTopics.mockImplementation(() => { throw new Error('error B'); });
    const result = await validateWorksheetOutput(CLEAN_WORKSHEET, BASE_CONTEXT);
    expect(result.safe).toBe(true);
    expect(result.failureReason).toBeNull();
  });
});

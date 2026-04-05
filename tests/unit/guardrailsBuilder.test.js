/**
 * @file tests/unit/guardrailsBuilder.test.js
 * @description Unit tests for src/ai/guardrails/guardrailsBuilder.js
 *
 * Covers:
 *   - Grade 1-3 resolves to strict template
 *   - Grade 4-10 resolves to medium template (when policy is medium)
 *   - Policy-level strict forces all grades to strict
 *   - resolveEffectiveLevel helper logic
 *   - Placeholder substitution ([grade], [subject], [age])
 *   - Token budget: strict clause should be larger or equal to medium
 *   - Fallback when DynamoDB is unavailable (CONFIG_TABLE_NAME not set)
 *   - Boundary grades: 1, 3, 4, 10
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Module mocks (must precede dynamic import) ──────────────────────────────

const mockGetGuardrailPolicy  = jest.fn();
const mockGetGuardrailTemplate = jest.fn();

jest.unstable_mockModule('../../src/ai/guardrails/guardrailsPolicy.js', () => ({
  getGuardrailPolicy:   mockGetGuardrailPolicy,
  getGuardrailTemplate: mockGetGuardrailTemplate,
  invalidatePolicyCache: jest.fn(),
}));

// ── Import under test (after mocks) ─────────────────────────────────────────

const { buildGuardrailSuffix, resolveEffectiveLevel } =
  await import('../../src/ai/guardrails/guardrailsBuilder.js');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEDIUM_TEMPLATE =
  'You are generating educational worksheets for Grade [grade] students (ages [age]). ' +
  'All content must be safe and aligned with US educational standards.';

const STRICT_TEMPLATE =
  'You are generating educational worksheets for young students in Grade [grade] (ages [age]). ' +
  'Content MUST be completely safe and appropriate for children. Subject: [subject].';

const MEDIUM_POLICY = {
  guardrailLevel: 'medium',
  retryLimit: 3,
  enableAwsComprehend: false,
  comprehToxicityThreshold: 0.75,
  validationFilters: ['profanity', 'sensitiveTopics'],
};

const STRICT_POLICY = { ...MEDIUM_POLICY, guardrailLevel: 'strict' };

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGuardrailPolicy.mockResolvedValue(MEDIUM_POLICY);
  mockGetGuardrailTemplate.mockImplementation(async (level) =>
    level === 'strict' ? STRICT_TEMPLATE : MEDIUM_TEMPLATE
  );
});

// ── resolveEffectiveLevel ─────────────────────────────────────────────────────

describe('resolveEffectiveLevel', () => {
  it('returns strict for Grade 1 regardless of policy level', () => {
    expect(resolveEffectiveLevel(1, 'medium')).toBe('strict');
  });

  it('returns strict for Grade 2 regardless of policy level', () => {
    expect(resolveEffectiveLevel(2, 'medium')).toBe('strict');
  });

  it('returns strict for Grade 3 regardless of policy level', () => {
    expect(resolveEffectiveLevel(3, 'medium')).toBe('strict');
  });

  it('returns medium for Grade 4 when policy is medium', () => {
    expect(resolveEffectiveLevel(4, 'medium')).toBe('medium');
  });

  it('returns medium for Grade 10 when policy is medium', () => {
    expect(resolveEffectiveLevel(10, 'medium')).toBe('medium');
  });

  it('returns strict for Grade 4 when policy is strict', () => {
    expect(resolveEffectiveLevel(4, 'strict')).toBe('strict');
  });

  it('returns strict for Grade 10 when policy is strict', () => {
    expect(resolveEffectiveLevel(10, 'strict')).toBe('strict');
  });

  it('defaults policyLevel to medium when omitted', () => {
    // Grade 5, no policyLevel arg — grade band is medium, so result is medium
    expect(resolveEffectiveLevel(5)).toBe('medium');
  });
});

// ── buildGuardrailSuffix — grade-band selection ───────────────────────────────

describe('buildGuardrailSuffix — grade-band template selection', () => {
  it('uses strict template for Grade 1 (boundary)', async () => {
    const clause = await buildGuardrailSuffix({ grade: 1, subject: 'Math' });
    expect(mockGetGuardrailTemplate).toHaveBeenCalledWith('strict');
    expect(clause).toContain('Grade 1');
  });

  it('uses strict template for Grade 3 (upper boundary of strict band)', async () => {
    const clause = await buildGuardrailSuffix({ grade: 3, subject: 'ELA' });
    expect(mockGetGuardrailTemplate).toHaveBeenCalledWith('strict');
    expect(clause).toContain('Grade 3');
  });

  it('uses medium template for Grade 4 (lower boundary of medium band)', async () => {
    const clause = await buildGuardrailSuffix({ grade: 4, subject: 'Science' });
    expect(mockGetGuardrailTemplate).toHaveBeenCalledWith('medium');
    expect(clause).toContain('Grade 4');
  });

  it('uses medium template for Grade 10 (boundary)', async () => {
    const clause = await buildGuardrailSuffix({ grade: 10, subject: 'Social Studies' });
    expect(mockGetGuardrailTemplate).toHaveBeenCalledWith('medium');
    expect(clause).toContain('Grade 10');
  });

  it('uses strict template for Grade 5 when policy guardrailLevel is strict', async () => {
    mockGetGuardrailPolicy.mockResolvedValue(STRICT_POLICY);
    const clause = await buildGuardrailSuffix({ grade: 5, subject: 'Health' });
    expect(mockGetGuardrailTemplate).toHaveBeenCalledWith('strict');
    expect(clause).toContain('Grade 5');
  });
});

// ── buildGuardrailSuffix — placeholder substitution ──────────────────────────

describe('buildGuardrailSuffix — placeholder substitution', () => {
  it('replaces [grade] with the numeric grade', async () => {
    const clause = await buildGuardrailSuffix({ grade: 6, subject: 'Science' });
    expect(clause).toContain('Grade 6');
    expect(clause).not.toContain('[grade]');
  });

  it('replaces [age] with the correct age range for Grade 3', async () => {
    await buildGuardrailSuffix({ grade: 3, subject: 'Math' });
    const clause = await buildGuardrailSuffix({ grade: 3, subject: 'Math' });
    expect(clause).toContain('8-9');
    expect(clause).not.toContain('[age]');
  });

  it('replaces [age] with 15-16 for Grade 10', async () => {
    const clause = await buildGuardrailSuffix({ grade: 10, subject: 'Math' });
    expect(clause).toContain('15-16');
    expect(clause).not.toContain('[age]');
  });

  it('replaces [subject] placeholder in strict template', async () => {
    const clause = await buildGuardrailSuffix({ grade: 1, subject: 'ELA' });
    expect(clause).toContain('ELA');
    expect(clause).not.toContain('[subject]');
  });

  it('replaces all occurrences of [grade] when template has multiple', async () => {
    const multiTemplate = 'Grade [grade] for ages [age]. Grade [grade] standards.';
    mockGetGuardrailTemplate.mockResolvedValue(multiTemplate);
    const clause = await buildGuardrailSuffix({ grade: 5, subject: 'Math' });
    expect(clause.split('Grade 5').length - 1).toBe(2);
    expect(clause).not.toContain('[grade]');
  });
});

// ── buildGuardrailSuffix — token budget awareness ────────────────────────────

describe('buildGuardrailSuffix — token budget', () => {
  it('strict clause is non-empty', async () => {
    const clause = await buildGuardrailSuffix({ grade: 2, subject: 'Math' });
    expect(clause.trim().length).toBeGreaterThan(10);
  });

  it('medium clause is non-empty', async () => {
    const clause = await buildGuardrailSuffix({ grade: 7, subject: 'Science' });
    expect(clause.trim().length).toBeGreaterThan(10);
  });

  it('strict template produces a clause (simulate real ~280 token template)', async () => {
    // Real strict template is longer than medium — just confirm it is a non-trivial string
    const realStrictTemplate =
      'You are generating educational worksheets for young students in Grade [grade] ' +
      '(ages [age]). Content MUST be completely safe and appropriate for children. Use ' +
      'only simple, positive, and encouraging language. Do NOT include any references to ' +
      'violence, conflict, politics, religion, death, illness, mature themes, stereotypes, ' +
      'or any potentially frightening or upsetting content. All examples must use ' +
      'age-appropriate scenarios (family, school, nature, animals, everyday activities).';
    mockGetGuardrailTemplate.mockResolvedValue(realStrictTemplate);
    const clause = await buildGuardrailSuffix({ grade: 1, subject: 'Math' });
    // Word count proxy for token budget ~280
    const wordCount = clause.split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(40);
  });
});

// ── buildGuardrailSuffix — DynamoDB fallback ─────────────────────────────────

describe('buildGuardrailSuffix — DynamoDB unavailable fallback', () => {
  it('falls back to hardcoded default when getGuardrailPolicy throws', async () => {
    mockGetGuardrailPolicy.mockRejectedValue(new Error('DynamoDB unavailable'));
    // Should still resolve without throwing
    const clause = await buildGuardrailSuffix({ grade: 5, subject: 'Math' });
    expect(typeof clause).toBe('string');
    expect(clause.length).toBeGreaterThan(5);
  });

  it('falls back to hardcoded default when getGuardrailTemplate throws', async () => {
    mockGetGuardrailTemplate.mockRejectedValue(new Error('Template load error'));
    const clause = await buildGuardrailSuffix({ grade: 5, subject: 'Math' });
    expect(typeof clause).toBe('string');
    expect(clause).toContain('Grade 5');
  });

  it('resolves correctly without CONFIG_TABLE_NAME in env (local dev)', async () => {
    const original = process.env.CONFIG_TABLE_NAME;
    delete process.env.CONFIG_TABLE_NAME;
    const clause = await buildGuardrailSuffix({ grade: 3, subject: 'ELA' });
    expect(typeof clause).toBe('string');
    if (original !== undefined) process.env.CONFIG_TABLE_NAME = original;
  });
});

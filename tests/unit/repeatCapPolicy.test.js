/**
 * @file tests/unit/repeatCapPolicy.test.js
 * @description Unit tests for repeat-cap policy helpers.
 *
 * Covers:
 *  - buildStudentKey
 *  - buildQuestionSignature
 *  - resolveEffectiveRepeatCap  (existing tests preserved)
 *  - resolveRepeatCap           (thin wrapper — AC-01, AC-04, FR-RCAP-009)
 *  - calculateAllocation        (FR-RCAP-010, AC-02)
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  buildStudentKey,
  buildQuestionSignature,
  resolveEffectiveRepeatCap,
  resolveRepeatCap,
  calculateAllocation,
  DEFAULT_REPEAT_CAP_PERCENT,
} from '../../src/ai/repeatCapPolicy.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal in-memory db stub used by resolveEffectiveRepeatCap /
 * resolveRepeatCap.  Both sources of the global default are wired:
 *   - adminPolicies table  (adminHandler path)
 *   - config table         (guardrailsAdminHandler path)
 */
function makeDb({ globalPolicy, configRecord, overrides = [] } = {}) {
  return {
    async getItem(table, id) {
      if (table === 'adminPolicies' && id === 'global') {
        return globalPolicy || null;
      }
      if (table === 'config' && id === 'repeat-cap:global') {
        return configRecord || null;
      }
      return null;
    },
    async listAll(table) {
      if (table === 'repeatCapOverrides') return overrides;
      return [];
    },
  };
}

/** Returns an ISO-8601 string offset from now by `offsetMs` milliseconds. */
function isoOffset(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── buildStudentKey ──────────────────────────────────────────────────────────

describe('buildStudentKey', () => {
  it('uses studentId when present', () => {
    expect(buildStudentKey({ studentId: 'stu-1', studentName: 'Ava', teacherId: 't1' }))
      .toBe('student:stu-1');
  });

  it('falls back to teacher + studentName when studentId missing', () => {
    expect(buildStudentKey({ studentName: ' Ava Johnson ', teacherId: 'teacher-7' }))
      .toBe('teacher:teacher-7#student-name:ava johnson');
  });

  it('returns null when no usable student identity', () => {
    expect(buildStudentKey({ teacherId: 'teacher-7' })).toBeNull();
  });
});

// ─── buildQuestionSignature ───────────────────────────────────────────────────

describe('buildQuestionSignature', () => {
  it('prefers questionId', () => {
    expect(buildQuestionSignature({ questionId: 'q-10', question: '2+2?' })).toBe('id:q-10');
  });

  it('builds normalized text signature when questionId is absent', () => {
    const sig = buildQuestionSignature({
      type: 'short-answer',
      question: '  What Is 2+2? ',
      answer: ' 4 ',
    });
    expect(sig).toBe('txt:short-answer|what is 2+2?|4');
  });
});

// ─── resolveEffectiveRepeatCap ────────────────────────────────────────────────

describe('resolveEffectiveRepeatCap', () => {
  it('returns default 10 when no config exists', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb(),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 10, appliedBy: 'default' });
  });

  it('uses global default from adminPolicies when configured', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({ globalPolicy: { repeatCapPolicy: { defaultPercent: 25 } } }),
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 25, appliedBy: 'default' });
  });

  it('uses config table source when adminPolicies lacks repeatCapPolicy.defaultPercent', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({ configRecord: { value: 30 } }),
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 30, appliedBy: 'default' });
  });

  it('applies precedence: student > parent > teacher > default (AC-04)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 10 } },
        overrides: [
          { scope: 'teacher', scopeId: 't1', repeatCapPercent: 70, isActive: true },
          { scope: 'parent',  scopeId: 'p1', repeatCapPercent: 40, isActive: true },
          { scope: 'student', scopeId: 's1', repeatCapPercent: 5,  isActive: true },
        ],
      }),
      studentId: 's1',
      parentId: 'p1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 5, appliedBy: 'student', sourceId: 's1' });
  });

  it('falls through to parent when no student override exists', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 10 } },
        overrides: [
          { scope: 'teacher', scopeId: 't1', repeatCapPercent: 70, isActive: true },
          { scope: 'parent',  scopeId: 'p1', repeatCapPercent: 40, isActive: true },
        ],
      }),
      studentId: 'no-override-student',
      parentId: 'p1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 40, appliedBy: 'parent', sourceId: 'p1' });
  });

  it('returns 100 when repeat-cap policy is globally disabled (FR-RCAP-002)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { enabled: false, defaultPercent: 10 } },
      }),
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 100, appliedBy: 'disabled' });
  });

  it('skips an override that has isActive = false (FR-RCAP-007)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 10 } },
        overrides: [
          { scope: 'student', scopeId: 's1', repeatCapPercent: 50, isActive: false },
        ],
      }),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ appliedBy: 'default' });
  });

  it('skips an override whose expiresAt is in the past (FR-RCAP-006, AC-05 boundary)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 20 } },
        overrides: [
          {
            scope: 'student',
            scopeId: 's1',
            repeatCapPercent: 5,
            isActive: true,
            expiresAt: isoOffset(-60 * 60 * 1000), // 1 hour ago
          },
        ],
      }),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 20, appliedBy: 'default' });
  });

  it('honours an override whose expiresAt is in the future (FR-RCAP-008)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 20 } },
        overrides: [
          {
            scope: 'student',
            scopeId: 's1',
            repeatCapPercent: 15,
            isActive: true,
            expiresAt: isoOffset(24 * 60 * 60 * 1000), // tomorrow
          },
        ],
      }),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 15, appliedBy: 'student', sourceId: 's1' });
  });

  it('supports the guardrailsAdminHandler schema (value field on override)', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 20 } },
        overrides: [
          { scope: 'student', scopeId: 's1', value: 35, isActive: true },
        ],
      }),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 35, appliedBy: 'student' });
  });
});

// ─── resolveRepeatCap (thin wrapper) ──────────────────────────────────────────

describe('resolveRepeatCap', () => {
  it('returns student override capPercent when student override exists (AC-01)', async () => {
    const db = makeDb({
      globalPolicy: { repeatCapPolicy: { defaultPercent: 20 } },
      overrides: [
        { scope: 'student', scopeId: 's1', repeatCapPercent: 10, isActive: true },
      ],
    });
    const result = await resolveRepeatCap({ db, studentId: 's1', teacherId: 't1' });
    expect(result.capPercent).toBe(10);
    expect(result.fallback).toBe(false);
  });

  it('returns parent override when no student override exists (AC-04)', async () => {
    const db = makeDb({
      globalPolicy: { repeatCapPolicy: { defaultPercent: 20 } },
      overrides: [
        { scope: 'parent', scopeId: 'p1', repeatCapPercent: 15, isActive: true },
      ],
    });
    const result = await resolveRepeatCap({ db, parentId: 'p1', teacherId: 't1' });
    expect(result.capPercent).toBe(15);
    expect(result.fallback).toBe(false);
  });

  it('returns global default when no overrides exist (AC-01)', async () => {
    const db = makeDb({
      globalPolicy: { repeatCapPolicy: { defaultPercent: 25 } },
    });
    const result = await resolveRepeatCap({ db, teacherId: 't1' });
    expect(result.capPercent).toBe(25);
    expect(result.fallback).toBe(false);
  });

  it('returns DEFAULT_REPEAT_CAP_PERCENT with fallback=true when db.getItem throws (FR-RCAP-009)', async () => {
    const brokenDb = {
      getItem: jest.fn().mockRejectedValue(new Error('DynamoDB unreachable')),
      listAll: jest.fn().mockRejectedValue(new Error('DynamoDB unreachable')),
    };
    const result = await resolveRepeatCap({ db: brokenDb, studentId: 's1', teacherId: 't1' });
    expect(result.capPercent).toBe(DEFAULT_REPEAT_CAP_PERCENT);
    expect(result.fallback).toBe(true);
  });

  it('returns DEFAULT_REPEAT_CAP_PERCENT with fallback=true when db.listAll throws (FR-RCAP-009)', async () => {
    const brokenDb = {
      getItem: jest.fn().mockResolvedValue(null),
      listAll: jest.fn().mockRejectedValue(new Error('DynamoDB timeout')),
    };
    const result = await resolveRepeatCap({ db: brokenDb, teacherId: 't1' });
    expect(result.capPercent).toBe(DEFAULT_REPEAT_CAP_PERCENT);
    expect(result.fallback).toBe(true);
  });
});

// ─── calculateAllocation ──────────────────────────────────────────────────────

describe('calculateAllocation', () => {
  it('(10, 20%) → maxRepeat=2, minUnseen=8 (AC-02)', () => {
    expect(calculateAllocation(10, 20)).toEqual({ maxRepeat: 2, minUnseen: 8 });
  });

  it('(10, 0%) → maxRepeat=0, minUnseen=10 (FR-RCAP-010 boundary: 0%)', () => {
    expect(calculateAllocation(10, 0)).toEqual({ maxRepeat: 0, minUnseen: 10 });
  });

  it('(10, 100%) → maxRepeat=10, minUnseen=0 (FR-RCAP-010 boundary: 100%)', () => {
    expect(calculateAllocation(10, 100)).toEqual({ maxRepeat: 10, minUnseen: 0 });
  });

  it('(5, 20%) → maxRepeat=1, minUnseen=4 (ceil: 5*0.20=1.0)', () => {
    expect(calculateAllocation(5, 20)).toEqual({ maxRepeat: 1, minUnseen: 4 });
  });

  it('(30, 20%) → maxRepeat=6, minUnseen=24', () => {
    expect(calculateAllocation(30, 20)).toEqual({ maxRepeat: 6, minUnseen: 24 });
  });

  it('clamps negative capPercent to 0', () => {
    expect(calculateAllocation(10, -5)).toEqual({ maxRepeat: 0, minUnseen: 10 });
  });

  it('clamps capPercent above 100 to 100', () => {
    expect(calculateAllocation(10, 150)).toEqual({ maxRepeat: 10, minUnseen: 0 });
  });

  it('boundary: 1 question at 20% → maxRepeat=0 (floor(0.2)=0)', () => {
    expect(calculateAllocation(1, 20)).toEqual({ maxRepeat: 0, minUnseen: 1 });
  });

  it('boundary: 1 question at 0% → maxRepeat=0, minUnseen=1', () => {
    expect(calculateAllocation(1, 0)).toEqual({ maxRepeat: 0, minUnseen: 1 });
  });
});

/**
 * @file tests/unit/repeatCapPolicy.test.js
 * @description Unit tests for repeat-cap policy helpers.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildStudentKey,
  buildQuestionSignature,
  resolveEffectiveRepeatCap,
} from '../../src/ai/repeatCapPolicy.js';

function makeDb({ globalPolicy, overrides = [] } = {}) {
  return {
    async getItem(table, id) {
      if (table === 'adminPolicies' && id === 'global') {
        return globalPolicy || null;
      }
      return null;
    },
    async listAll(table) {
      if (table === 'repeatCapOverrides') return overrides;
      return [];
    },
  };
}

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

describe('buildQuestionSignature', () => {
  it('prefers questionId', () => {
    expect(buildQuestionSignature({ questionId: 'q-10', question: '2+2?' })).toBe('id:q-10');
  });

  it('builds normalized text signature when questionId is absent', () => {
    const sig = buildQuestionSignature({ type: 'short-answer', question: '  What Is 2+2? ', answer: ' 4 ' });
    expect(sig).toBe('txt:short-answer|what is 2+2?|4');
  });
});

describe('resolveEffectiveRepeatCap', () => {
  it('returns default 10 when no config exists', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb(),
      studentId: 's1',
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 10, appliedBy: 'default' });
  });

  it('uses global default when configured', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({ globalPolicy: { repeatCapPolicy: { defaultPercent: 25 } } }),
      teacherId: 't1',
    });
    expect(out).toMatchObject({ capPercent: 25, appliedBy: 'default' });
  });

  it('applies precedence student > parent > teacher > default', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({
        globalPolicy: { repeatCapPolicy: { defaultPercent: 10 } },
        overrides: [
          { scope: 'teacher', scopeId: 't1', repeatCapPercent: 70, isActive: true },
          { scope: 'parent', scopeId: 'p1', repeatCapPercent: 40, isActive: true },
          { scope: 'student', scopeId: 's1', repeatCapPercent: 5, isActive: true },
        ],
      }),
      studentId: 's1',
      parentId: 'p1',
      teacherId: 't1',
    });

    expect(out).toMatchObject({ capPercent: 5, appliedBy: 'student', sourceId: 's1' });
  });

  it('returns 100 when repeat-cap policy is globally disabled', async () => {
    const out = await resolveEffectiveRepeatCap({
      db: makeDb({ globalPolicy: { repeatCapPolicy: { enabled: false, defaultPercent: 10 } } }),
      teacherId: 't1',
    });

    expect(out).toMatchObject({ capPercent: 100, appliedBy: 'disabled' });
  });
});

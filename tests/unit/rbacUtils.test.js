/**
 * @file tests/unit/rbacUtils.test.js
 * @description Unit tests for backend/utils/rbacUtils.js
 * The DB adapter is fully mocked. No real I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  verifyTeacherOwnsClass,
  verifyTeacherOwnsAssignment,
  verifyParentChildLink,
  verifyStudentInClass,
} from '../../backend/utils/rbacUtils.js';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const TEACHER_ID  = '22222222-2222-4222-8222-222222222222';
const OTHER_ID    = '99999999-9999-4999-8999-999999999999';
const CLASS_ID    = '33333333-3333-4333-8333-333333333333';
const ASSIGN_ID   = '44444444-4444-4444-8444-444444444444';
const PARENT_ID   = '55555555-5555-4555-8555-555555555555';
const CHILD_ID    = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID  = '11111111-1111-4111-8111-111111111111';

// ─── DB mock factory ──────────────────────────────────────────────────────────

function makeDb(overrides = {}) {
  return {
    queryByPk: jest.fn(),
    getItem: jest.fn(),
    queryByField: jest.fn(),
    putItem: jest.fn(),
    updateItem: jest.fn(),
    ...overrides,
  };
}

// ─── verifyTeacherOwnsClass ───────────────────────────────────────────────────

describe('verifyTeacherOwnsClass — matching teacher', () => {
  it('returns authorized true with the class record when teacherId matches', async () => {
    const classRecord = { classId: CLASS_ID, teacherId: TEACHER_ID, className: 'Grade 3 Math', status: 'active' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([classRecord]) });

    const result = await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(result.authorized).toBe(true);
    expect(result.record).toMatchObject({ classId: CLASS_ID, teacherId: TEACHER_ID });
  });

  it('calls queryByPk with the correct composite key', async () => {
    const classRecord = { classId: CLASS_ID, teacherId: TEACHER_ID };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([classRecord]) });

    await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(db.queryByPk).toHaveBeenCalledWith(
      'classes',
      `CLASS#${CLASS_ID}`,
      expect.objectContaining({ filterValues: expect.objectContaining({ ':sk': 'METADATA' }) }),
    );
  });
});

describe('verifyTeacherOwnsClass — different teacher', () => {
  it('returns NOT_CLASS_OWNER when teacherId does not match', async () => {
    const classRecord = { classId: CLASS_ID, teacherId: OTHER_ID };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([classRecord]) });

    const result = await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });
});

describe('verifyTeacherOwnsClass — class not found', () => {
  it('returns NOT_CLASS_OWNER (not 404) when the class record is missing', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });

    const result = await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });

  it('returns NOT_CLASS_OWNER when queryByPk resolves null', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue(null) });

    const result = await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });

  it('returns NOT_CLASS_OWNER when the DB adapter throws', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockRejectedValue(new Error('DynamoDB timeout')) });

    const result = await verifyTeacherOwnsClass(db, CLASS_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });
});

// ─── verifyTeacherOwnsAssignment ──────────────────────────────────────────────

describe('verifyTeacherOwnsAssignment — matching teacher', () => {
  it('returns authorized true with the assignment record', async () => {
    const assignRecord = { assignmentId: ASSIGN_ID, teacherId: TEACHER_ID };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([assignRecord]) });

    const result = await verifyTeacherOwnsAssignment(db, ASSIGN_ID, TEACHER_ID);

    expect(result.authorized).toBe(true);
    expect(result.record).toMatchObject({ assignmentId: ASSIGN_ID });
  });
});

describe('verifyTeacherOwnsAssignment — different teacher', () => {
  it('returns NOT_CLASS_OWNER when assignment belongs to a different teacher', async () => {
    const assignRecord = { assignmentId: ASSIGN_ID, teacherId: OTHER_ID };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([assignRecord]) });

    const result = await verifyTeacherOwnsAssignment(db, ASSIGN_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });
});

describe('verifyTeacherOwnsAssignment — assignment not found', () => {
  it('returns NOT_CLASS_OWNER when no assignment record exists', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });

    const result = await verifyTeacherOwnsAssignment(db, ASSIGN_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });

  it('returns NOT_CLASS_OWNER when the DB adapter throws', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockRejectedValue(new Error('db error')) });

    const result = await verifyTeacherOwnsAssignment(db, ASSIGN_ID, TEACHER_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('NOT_CLASS_OWNER');
  });
});

// ─── verifyParentChildLink ────────────────────────────────────────────────────

describe('verifyParentChildLink — active link exists', () => {
  it('returns authorized true with the link record for an active link', async () => {
    const linkRecord = { parentId: PARENT_ID, childId: CHILD_ID, status: 'active' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([linkRecord]) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(true);
    expect(result.record).toMatchObject({ parentId: PARENT_ID, childId: CHILD_ID, status: 'active' });
  });

  it('calls queryByPk with USER# prefixed parentId and CHILD# prefixed childId', async () => {
    const linkRecord = { parentId: PARENT_ID, childId: CHILD_ID, status: 'active' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([linkRecord]) });

    await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(db.queryByPk).toHaveBeenCalledWith(
      'parentchildlinks',
      `USER#${PARENT_ID}`,
      expect.objectContaining({ filterValues: expect.objectContaining({ ':sk': `CHILD#${CHILD_ID}` }) }),
    );
  });
});

describe('verifyParentChildLink — revoked link', () => {
  it('returns CHILD_NOT_LINKED when link status is revoked', async () => {
    const linkRecord = { parentId: PARENT_ID, childId: CHILD_ID, status: 'revoked' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([linkRecord]) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('CHILD_NOT_LINKED');
  });
});

describe('verifyParentChildLink — no link', () => {
  it('returns CHILD_NOT_LINKED when no link record exists', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('CHILD_NOT_LINKED');
  });

  it('returns CHILD_NOT_LINKED when queryByPk resolves null', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue(null) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('CHILD_NOT_LINKED');
  });

  it('returns CHILD_NOT_LINKED when the DB adapter throws', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockRejectedValue(new Error('network error')) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('CHILD_NOT_LINKED');
  });

  it('returns CHILD_NOT_LINKED when queryByPk returns an empty result for the PK+SK combo', async () => {
    // In production the adapter enforces filterValues: { ':sk': CHILD#{childId} }
    // so a record for a different child would not be returned by the query.
    // Simulate that: adapter returns empty for the specific CHILD#${CHILD_ID} filter.
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });

    const result = await verifyParentChildLink(db, PARENT_ID, CHILD_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('CHILD_NOT_LINKED');
  });
});

// ─── verifyStudentInClass ─────────────────────────────────────────────────────

describe('verifyStudentInClass — enrolled student', () => {
  it('returns authorized true with the membership record for an active member', async () => {
    const membership = { classId: CLASS_ID, studentId: STUDENT_ID, status: 'active' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([membership]) });

    const result = await verifyStudentInClass(db, CLASS_ID, STUDENT_ID);

    expect(result.authorized).toBe(true);
    expect(result.record).toMatchObject({ classId: CLASS_ID, studentId: STUDENT_ID });
  });
});

describe('verifyStudentInClass — not enrolled', () => {
  it('returns STUDENT_NOT_IN_CLASS when no membership record exists', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([]) });

    const result = await verifyStudentInClass(db, CLASS_ID, STUDENT_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('STUDENT_NOT_IN_CLASS');
  });

  it('returns STUDENT_NOT_IN_CLASS when membership status is removed', async () => {
    const membership = { classId: CLASS_ID, studentId: STUDENT_ID, status: 'removed' };
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue([membership]) });

    const result = await verifyStudentInClass(db, CLASS_ID, STUDENT_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('STUDENT_NOT_IN_CLASS');
  });

  it('returns STUDENT_NOT_IN_CLASS (not 404) — error code never leaks 404', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockResolvedValue(null) });

    const result = await verifyStudentInClass(db, CLASS_ID, STUDENT_ID);

    // Confirm no '404' appears anywhere in the result
    expect(result.authorized).toBe(false);
    expect(result.reason).not.toContain('404');
    expect(result.reason).toBe('STUDENT_NOT_IN_CLASS');
  });

  it('returns STUDENT_NOT_IN_CLASS when the DB adapter throws', async () => {
    const db = makeDb({ queryByPk: jest.fn().mockRejectedValue(new Error('timeout')) });

    const result = await verifyStudentInClass(db, CLASS_ID, STUDENT_ID);

    expect(result.authorized).toBe(false);
    expect(result.reason).toBe('STUDENT_NOT_IN_CLASS');
  });
});

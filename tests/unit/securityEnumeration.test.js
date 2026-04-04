/**
 * @file tests/unit/securityEnumeration.test.js
 * @description Security tests verifying that 403 is always returned (never 404)
 * for RBAC denials in M05 handlers — preventing student/class/assignment ID enumeration.
 * Auth and DB adapters are mocked; no real I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_PARENT_ID    = '55555555-5555-4555-8555-555555555555';
const NONEXISTENT_CHILD  = '00000000-0000-4000-8000-000000000000';
const VALID_TEACHER_ID   = '22222222-2222-4222-8222-222222222222';
const NONEXISTENT_CLASS  = '00000001-0001-4001-8001-000000000001';
const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const NONEXISTENT_ASSIGN = '00000002-0002-4002-8002-000000000002';

// ─── Mock function references ─────────────────────────────────────────────────

const mockVerifyToken    = jest.fn();
const mockGetItem        = jest.fn();
const mockQueryByField   = jest.fn();
const mockUpdateItem     = jest.fn();
const mockPutItem        = jest.fn();

// Mock RBAC utilities
const mockVerifyParentChildLink   = jest.fn();
const mockVerifyTeacherOwnsClass  = jest.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({ verifyToken: mockVerifyToken })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
    updateItem:   mockUpdateItem,
  })),
}));

jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyParentChildLink: mockVerifyParentChildLink,
  verifyTeacherOwnsClass: mockVerifyTeacherOwnsClass,
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler: parentHandler }     = await import('../../backend/handlers/parentHandler.js');
const { handler: assignmentHandler } = await import('../../backend/handlers/assignmentHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockContext = { callbackWaitsForEmptyEventLoop: true };

function makeEvent(method, path, token, pathParameters = {}, body = null) {
  return {
    httpMethod: method,
    path,
    headers: { authorization: `Bearer ${token}` },
    body: body !== null ? JSON.stringify(body) : null,
    pathParameters,
  };
}

function makeChildNotLinkedError() {
  const err = new Error('Child not linked to this parent account.');
  err.statusCode = 403;
  err.errorCode = 'CHILD_NOT_LINKED';
  return err;
}

function makeNotClassOwnerError() {
  const err = new Error('You do not own this class.');
  err.statusCode = 403;
  err.errorCode = 'NOT_CLASS_OWNER';
  return err;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Parent accessing unlinked child: always 403, never 404 ──────────────────

describe('securityEnumeration — parent accessing unlinked child', () => {
  const parentDecoded = { sub: VALID_PARENT_ID, role: 'parent', email: 'parent@test.com' };

  it('GET /parent/children/:studentId/progress returns 403 CHILD_NOT_LINKED (not 404)', async () => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await parentHandler(
      makeEvent('GET', `/api/parent/children/${NONEXISTENT_CHILD}/progress`, 'parent-token',
        { studentId: NONEXISTENT_CHILD }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });

  it('GET /parent/children/:studentId/assignments returns 403 CHILD_NOT_LINKED (not 404)', async () => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await parentHandler(
      makeEvent('GET', `/api/parent/children/${NONEXISTENT_CHILD}/assignments`, 'parent-token',
        { studentId: NONEXISTENT_CHILD }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });

  it('DELETE /parent/children/:studentId returns 403 CHILD_NOT_LINKED (not 404)', async () => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await parentHandler(
      makeEvent('DELETE', `/api/parent/children/${NONEXISTENT_CHILD}`, 'parent-token',
        { studentId: NONEXISTENT_CHILD }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
  });

  it('response body for unlinked child never reveals whether the studentId exists', async () => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await parentHandler(
      makeEvent('GET', `/api/parent/children/${NONEXISTENT_CHILD}/progress`, 'parent-token',
        { studentId: NONEXISTENT_CHILD }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    // Must only expose CHILD_NOT_LINKED — not 'Student not found' or similar
    expect(body.error).toBe('CHILD_NOT_LINKED');
    expect(JSON.stringify(body)).not.toMatch(/not found/i);
  });
});

// ─── Teacher accessing non-owned class: always 403, never 404 ────────────────

describe('securityEnumeration — teacher accessing non-owned class', () => {
  const teacherDecoded = { sub: VALID_TEACHER_ID, role: 'teacher', email: 'teacher@test.com' };

  it('GET /api/assignments/:assignmentId returns 403 NOT_CLASS_OWNER (not 404) for non-owned assignment', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    // Assignment exists but belongs to a different teacher
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${NONEXISTENT_ASSIGN}`,
      assignmentId: NONEXISTENT_ASSIGN,
      teacherId: '99999999-9999-4999-8999-999999999999',
      status: 'active',
    });

    const result = await assignmentHandler(
      makeEvent('GET', `/api/assignments/${NONEXISTENT_ASSIGN}`, 'teacher-token',
        { assignmentId: NONEXISTENT_ASSIGN }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('NOT_CLASS_OWNER');
  });

  it('GET /api/classes/:classId/assignments returns 403 NOT_CLASS_OWNER for non-owned class', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockVerifyTeacherOwnsClass.mockRejectedValue(makeNotClassOwnerError());

    const result = await assignmentHandler(
      makeEvent('GET', `/api/classes/${NONEXISTENT_CLASS}/assignments`, 'teacher-token',
        { classId: NONEXISTENT_CLASS }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('NOT_CLASS_OWNER');
  });

  it('POST /api/assignments returns 403 NOT_CLASS_OWNER when class not owned', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockVerifyTeacherOwnsClass.mockRejectedValue(makeNotClassOwnerError());

    const result = await assignmentHandler(
      makeEvent('POST', '/api/assignments', 'teacher-token', {},
        {
          classId: NONEXISTENT_CLASS,
          worksheetId: '55555555-5555-4555-8555-555555555555',
          mode: 'practice',
          retakePolicy: 'unlimited',
        }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
  });
});

// ─── Student accessing non-assigned assignment: always 403, never 404 ─────────

describe('securityEnumeration — student accessing non-assigned assignment', () => {
  const studentDecoded = { sub: VALID_STUDENT_ID, role: 'student', email: 'student@test.com' };

  it('GET /student/assignments/:assignmentId returns 403 (not 404) for unknown assignment', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    // No StudentAssignmentStatus record for this student + assignment
    mockGetItem.mockResolvedValue(null);

    const result = await parentHandler(
      makeEvent('GET', `/api/student/assignments/${NONEXISTENT_ASSIGN}`, 'student-token',
        { assignmentId: NONEXISTENT_ASSIGN }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
  });

  it('GET /student/assignments/:assignmentId returns 403 when status record belongs to a different student', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    // Status record exists but for a different student
    mockGetItem.mockResolvedValue({
      PK: `ASSIGNMENT#${NONEXISTENT_ASSIGN}`,
      assignmentId: NONEXISTENT_ASSIGN,
      studentId: '99999999-9999-4999-8999-999999999999', // different student
      status: 'not-started',
    });

    const result = await parentHandler(
      makeEvent('GET', `/api/student/assignments/${NONEXISTENT_ASSIGN}`, 'student-token',
        { assignmentId: NONEXISTENT_ASSIGN }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    expect(result.statusCode).not.toBe(404);
  });
});

// ─── CORS headers always present on enumeration-prevention responses ──────────

describe('securityEnumeration — CORS headers present on all 403 responses', () => {
  it('parent 403 CHILD_NOT_LINKED includes CORS headers', async () => {
    const parentDecoded = { sub: VALID_PARENT_ID, role: 'parent', email: 'parent@test.com' };
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await parentHandler(
      makeEvent('GET', `/api/parent/children/${NONEXISTENT_CHILD}/progress`, 'parent-token',
        { studentId: NONEXISTENT_CHILD }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('teacher 403 NOT_CLASS_OWNER includes CORS headers', async () => {
    const teacherDecoded = { sub: VALID_TEACHER_ID, role: 'teacher', email: 'teacher@test.com' };
    mockVerifyToken.mockReturnValue(teacherDecoded);
    mockVerifyTeacherOwnsClass.mockRejectedValue(makeNotClassOwnerError());

    const result = await assignmentHandler(
      makeEvent('GET', `/api/classes/${NONEXISTENT_CLASS}/assignments`, 'teacher-token',
        { classId: NONEXISTENT_CLASS }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

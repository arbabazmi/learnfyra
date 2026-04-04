/**
 * @file tests/unit/parentHandler.test.js
 * @description Unit tests for backend/handlers/parentHandler.js
 * Auth, DB adapters, and RBAC utilities are mocked; no real I/O occurs.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_PARENT_ID   = '55555555-5555-4555-8555-555555555555';
const VALID_CHILD_ID    = '11111111-1111-4111-8111-111111111111';
const VALID_STUDENT_ID  = '11111111-1111-4111-8111-111111111111';
const VALID_CLASS_ID    = '33333333-3333-4333-8333-333333333333';
const VALID_ASSIGN_ID   = '44444444-4444-4444-8444-444444444444';

// ─── Mock function references ─────────────────────────────────────────────────

const mockVerifyToken    = jest.fn();
const mockPutItem        = jest.fn();
const mockGetItem        = jest.fn();
const mockQueryByField   = jest.fn();
const mockUpdateItem     = jest.fn();
const mockVerifyParentChildLink = jest.fn();

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

// Mock src/utils/rbac.js — parentHandler imports verifyParentChildLink from here
jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyParentChildLink: mockVerifyParentChildLink,
  verifyTeacherOwnsClass: jest.fn(),
}));

// ─── Dynamic import ───────────────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/parentHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockContext = { callbackWaitsForEmptyEventLoop: true };

const parentDecoded = {
  sub: VALID_PARENT_ID,
  email: 'parent@test.com',
  role: 'parent',
};

const studentDecoded = {
  sub: VALID_STUDENT_ID,
  email: 'student@test.com',
  role: 'student',
};

function makeEvent(method, path, body = null, token = null, pathParameters = null) {
  return {
    httpMethod: method,
    path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body !== null ? JSON.stringify(body) : null,
    pathParameters: pathParameters || {},
  };
}

function makeChildNotLinkedError() {
  const err = new Error('Child not linked to this parent account.');
  err.statusCode = 403;
  err.errorCode = 'CHILD_NOT_LINKED';
  return err;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('parentHandler — OPTIONS preflight', () => {
  it('returns 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('includes CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/parent/link — valid code ───────────────────────────────────────

describe('parentHandler — POST /api/parent/link valid code', () => {
  const validInviteRecord = {
    PK: 'INVITE#ABCD34XY',
    code: 'ABCD34XY',
    targetStudentId: VALID_CHILD_ID,
    linkMethod: 'student-invite',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    used: false,
  };

  const childUser = {
    userId: VALID_CHILD_ID,
    displayName: 'Test Student',
    grade: 4,
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockGetItem.mockImplementation(async (table, key) => {
      if (table === 'parentinvitecodes') return validInviteRecord;
      if (table === 'users') return childUser;
      return null;
    });
    mockUpdateItem.mockResolvedValue({});
    mockPutItem.mockResolvedValue({});
  });

  it('returns 201 for a valid unused unexpired invite code', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'ABCD34XY' }, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
  });

  it('response body contains childId and displayName', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'ABCD34XY' }, 'parent-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('childId', VALID_CHILD_ID);
    expect(body).toHaveProperty('displayName', 'Test Student');
  });

  it('writes a ParentChildLink record with status=active', async () => {
    await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'ABCD34XY' }, 'parent-token'),
      mockContext,
    );
    const linkCall = mockPutItem.mock.calls.find(c => c[0] === 'parentchildlinks');
    expect(linkCall).toBeDefined();
    expect(linkCall[1]).toMatchObject({ status: 'active', parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID });
  });

  it('marks the invite code as used', async () => {
    await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'ABCD34XY' }, 'parent-token'),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'parentinvitecodes',
      'INVITE#ABCD34XY',
      expect.objectContaining({ used: true }),
    );
  });

  it('includes CORS headers on 201 response', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'ABCD34XY' }, 'parent-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/parent/link — expired code ─────────────────────────────────────

describe('parentHandler — POST /api/parent/link expired code', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockGetItem.mockResolvedValue({
      PK: 'INVITE#EXPIREDX',
      code: 'EXPIREDX',
      targetStudentId: VALID_CHILD_ID,
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      used: false,
    });
  });

  it('returns 410 INVITE_CODE_EXPIRED for an expired code', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'EXPIREDX' }, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(410);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('INVITE_CODE_EXPIRED');
  });

  it('does not write any ParentChildLink record for an expired code', async () => {
    await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'EXPIREDX' }, 'parent-token'),
      mockContext,
    );
    expect(mockPutItem).not.toHaveBeenCalled();
  });
});

// ─── POST /api/parent/link — already used code ───────────────────────────────

describe('parentHandler — POST /api/parent/link used code', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockGetItem.mockResolvedValue({
      PK: 'INVITE#USEDCODE',
      code: 'USEDCODE',
      targetStudentId: VALID_CHILD_ID,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      used: true,
    });
  });

  it('returns 409 INVITE_CODE_ALREADY_USED for an already-consumed code', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'USEDCODE' }, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('INVITE_CODE_ALREADY_USED');
  });
});

// ─── POST /api/parent/link — not found ───────────────────────────────────────

describe('parentHandler — POST /api/parent/link code not found', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockGetItem.mockResolvedValue(null);
  });

  it('returns 404 INVITE_CODE_NOT_FOUND when no matching record exists', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/link', { inviteCode: 'NOPE23AB' }, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('INVITE_CODE_NOT_FOUND');
  });
});

// ─── GET /api/parent/children ─────────────────────────────────────────────────

describe('parentHandler — GET /api/parent/children', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
  });

  it('returns only children with active links', async () => {
    mockQueryByField.mockResolvedValue([
      { childId: VALID_CHILD_ID, parentId: VALID_PARENT_ID, status: 'active',  linkedAt: '2026-01-01T00:00:00Z', linkMethod: 'student-invite' },
      { childId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', parentId: VALID_PARENT_ID, status: 'revoked', linkedAt: '2026-01-02T00:00:00Z', linkMethod: 'student-invite' },
    ]);
    mockGetItem.mockResolvedValue({ displayName: 'Test Student', grade: 4 });

    const result = await handler(
      makeEvent('GET', '/api/parent/children', null, 'parent-token'),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.children)).toBe(true);
    expect(body.children).toHaveLength(1);
    expect(body.children[0].studentId).toBe(VALID_CHILD_ID);
  });

  it('returns 200 and empty children array when no active links exist', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      makeEvent('GET', '/api/parent/children', null, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.children).toHaveLength(0);
  });

  it('includes CORS headers on response', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      makeEvent('GET', '/api/parent/children', null, 'parent-token'),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── DELETE /api/parent/children/:studentId ───────────────────────────────────

describe('parentHandler — DELETE /api/parent/children/:studentId', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
  });

  it('returns 200 and sets status to revoked', async () => {
    const linkRecord = { PK: `USER#${VALID_PARENT_ID}`, childId: VALID_CHILD_ID, parentId: VALID_PARENT_ID, status: 'active' };
    mockVerifyParentChildLink.mockResolvedValue(linkRecord);
    mockQueryByField.mockResolvedValue([linkRecord]);
    mockUpdateItem.mockResolvedValue({});

    const result = await handler(
      makeEvent('DELETE', `/api/parent/children/${VALID_CHILD_ID}`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('status', 'revoked');
    expect(body).toHaveProperty('childId', VALID_CHILD_ID);
  });

  it('calls updateItem with status=revoked', async () => {
    const linkRecord = { PK: `USER#${VALID_PARENT_ID}`, childId: VALID_CHILD_ID, parentId: VALID_PARENT_ID, status: 'active' };
    mockVerifyParentChildLink.mockResolvedValue(linkRecord);
    mockQueryByField.mockResolvedValue([linkRecord]);
    mockUpdateItem.mockResolvedValue({});

    await handler(
      makeEvent('DELETE', `/api/parent/children/${VALID_CHILD_ID}`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'parentchildlinks',
      expect.any(String),
      expect.objectContaining({ status: 'revoked' }),
    );
  });

  it('returns 403 CHILD_NOT_LINKED when no active link exists', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('DELETE', `/api/parent/children/${VALID_CHILD_ID}`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });
});

// ─── GET /api/parent/children/:studentId/progress ────────────────────────────

describe('parentHandler — GET /api/parent/children/:studentId/progress', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
  });

  it('returns 200 with activity summary and needsAttention for a linked child', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockGetItem.mockResolvedValue({ displayName: 'Test Student', grade: 4 });

    const now = Date.now();
    mockQueryByField.mockResolvedValue([
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 86400000).toISOString(), percentage: 80, totalScore: 8, totalPoints: 10, timeTaken: 120, topic: 'Fractions' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 86400000).toISOString(), percentage: 40, totalScore: 4, totalPoints: 10, timeTaken: 90,  topic: 'Fractions' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 86400000).toISOString(), percentage: 30, totalScore: 3, totalPoints: 10, timeTaken: 100, topic: 'Fractions' },
    ]);

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('last7Days');
    expect(body).toHaveProperty('last30Days');
    expect(body).toHaveProperty('overallAccuracy');
    expect(body).toHaveProperty('needsAttention');
    expect(Array.isArray(body.needsAttention)).toBe(true);
  });

  it('includes Fractions in needsAttention when accuracy < 60% across 3+ attempts', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockGetItem.mockResolvedValue({ displayName: 'Test Student' });

    const now = Date.now();
    // 4 attempts at Fractions, all scoring 40%
    mockQueryByField.mockResolvedValue([
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 1000).toISOString(), percentage: 40, totalScore: 4, totalPoints: 10, timeTaken: 60, topic: 'Fractions' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 2000).toISOString(), percentage: 40, totalScore: 4, totalPoints: 10, timeTaken: 60, topic: 'Fractions' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 3000).toISOString(), percentage: 40, totalScore: 4, totalPoints: 10, timeTaken: 60, topic: 'Fractions' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 4000).toISOString(), percentage: 40, totalScore: 4, totalPoints: 10, timeTaken: 60, topic: 'Fractions' },
    ]);

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    const fractionsEntry = body.needsAttention.find(t => t.topic === 'Fractions');
    expect(fractionsEntry).toBeDefined();
    expect(fractionsEntry.currentAccuracy).toBe(40);
    expect(fractionsEntry.attemptCount).toBe(4);
  });

  it('does not include topics above 60% accuracy in needsAttention', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockGetItem.mockResolvedValue({ displayName: 'Test Student' });

    const now = Date.now();
    mockQueryByField.mockResolvedValue([
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 1000).toISOString(), percentage: 90, totalScore: 9, totalPoints: 10, timeTaken: 60, topic: 'Multiplication' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 2000).toISOString(), percentage: 90, totalScore: 9, totalPoints: 10, timeTaken: 60, topic: 'Multiplication' },
      { studentId: VALID_CHILD_ID, createdAt: new Date(now - 3000).toISOString(), percentage: 90, totalScore: 9, totalPoints: 10, timeTaken: 60, topic: 'Multiplication' },
    ]);

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.needsAttention).toHaveLength(0);
  });

  it('returns 403 CHILD_NOT_LINKED (not 404) for an unlinked student', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });

  it('returns 403 CHILD_NOT_LINKED even when the studentId does not exist at all', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    // Must never return 404 — prevents student ID enumeration
    expect(result.statusCode).not.toBe(404);
    expect(result.statusCode).toBe(403);
  });

  it('includes CORS headers on 403 responses', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/progress`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── GET /api/parent/children/:studentId/assignments ─────────────────────────

describe('parentHandler — GET /api/parent/children/:studentId/assignments', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
  });

  it('returns assignment statuses for a linked child', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockQueryByField.mockResolvedValue([
      { PK: `ASSIGNMENT#${VALID_ASSIGN_ID}`, assignmentId: VALID_ASSIGN_ID, studentId: VALID_CHILD_ID, status: 'not-started', score: null, submittedAt: null },
    ]);
    mockGetItem.mockResolvedValue({
      assignmentId: VALID_ASSIGN_ID,
      title: 'Multiplication Test',
      dueDate: new Date(Date.now() + 3600000).toISOString(),
      mode: 'test',
      status: 'active',
    });

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/assignments`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(body.assignments[0]).toHaveProperty('assignmentId', VALID_ASSIGN_ID);
  });

  it('returns 403 CHILD_NOT_LINKED for an unlinked child', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/assignments`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });
});

// ─── POST /api/student/parent-invite ─────────────────────────────────────────

describe('parentHandler — POST /api/student/parent-invite', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    mockGetItem.mockResolvedValue(null); // no prior tracker
    mockPutItem.mockResolvedValue({});
  });

  it('returns 201 with an inviteCode and expiresAt', async () => {
    const result = await handler(
      makeEvent('POST', '/api/student/parent-invite', null, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('inviteCode');
    expect(body).toHaveProperty('expiresAt');
    expect(body).toHaveProperty('linkMethod', 'student-invite');
  });

  it('writes a ParentInviteCode record with TTL (expiresAt = +48h)', async () => {
    await handler(
      makeEvent('POST', '/api/student/parent-invite', null, 'student-token'),
      mockContext,
    );
    const inviteCall = mockPutItem.mock.calls.find(
      c => c[0] === 'parentinvitecodes' && c[1].PK && c[1].PK.startsWith('INVITE#'),
    );
    expect(inviteCall).toBeDefined();
    expect(inviteCall[1]).toHaveProperty('used', false);
    expect(inviteCall[1]).toHaveProperty('linkMethod', 'student-invite');
    // expiresAt should be approximately 48 hours from now
    const expiresAt = new Date(inviteCall[1].expiresAt);
    const hoursUntilExpiry = (expiresAt - new Date()) / 3600000;
    expect(hoursUntilExpiry).toBeGreaterThan(47);
    expect(hoursUntilExpiry).toBeLessThan(49);
  });

  it('invalidates a prior unused code before writing the new one', async () => {
    const priorCode = 'PRIORCD9';
    mockGetItem.mockResolvedValue({ PK: `STUDENTINVITE#${VALID_STUDENT_ID}`, currentCode: priorCode });
    mockUpdateItem.mockResolvedValue({});

    await handler(
      makeEvent('POST', '/api/student/parent-invite', null, 'student-token'),
      mockContext,
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'parentinvitecodes',
      `INVITE#${priorCode}`,
      expect.objectContaining({ used: true }),
    );
  });

  it('returns 403 when a teacher attempts to generate a student parent invite', async () => {
    mockVerifyToken.mockReturnValue({
      sub: '22222222-2222-4222-8222-222222222222',
      role: 'teacher',
    });

    const result = await handler(
      makeEvent('POST', '/api/student/parent-invite', null, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── POST /api/student/classes/join ──────────────────────────────────────────

describe('parentHandler — POST /api/student/classes/join', () => {
  const classRecord = {
    PK: `CLASS#${VALID_CLASS_ID}`,
    classId: VALID_CLASS_ID,
    className: 'Grade 3 Math',
    teacherId: '22222222-2222-4222-8222-222222222222',
    inviteCode: 'ABCDEF',
    status: 'active',
    studentCount: 5,
    gradeLevel: 3,
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns 200 with classId and className on valid join', async () => {
    mockQueryByField.mockResolvedValue([classRecord]);
    mockGetItem.mockResolvedValue(null); // no existing membership
    mockPutItem.mockResolvedValue({});
    mockUpdateItem.mockResolvedValue({});

    const result = await handler(
      makeEvent('POST', '/api/student/classes/join', { inviteCode: 'ABCDEF' }, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classId', VALID_CLASS_ID);
    expect(body).toHaveProperty('className', 'Grade 3 Math');
  });

  it('returns 404 INVALID_JOIN_CODE when no class matches the invite code', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      makeEvent('POST', '/api/student/classes/join', { inviteCode: 'NOPE23' }, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('INVALID_JOIN_CODE');
  });

  it('returns 409 ALREADY_ENROLLED when student is already an active member', async () => {
    mockQueryByField.mockResolvedValue([classRecord]);
    mockGetItem.mockResolvedValue({
      id: `${VALID_CLASS_ID}#${VALID_STUDENT_ID}`,
      classId: VALID_CLASS_ID,
      studentId: VALID_STUDENT_ID,
      status: 'active',
    });

    const result = await handler(
      makeEvent('POST', '/api/student/classes/join', { inviteCode: 'ABCDEF' }, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('ALREADY_ENROLLED');
  });

  it('creates StudentAssignmentStatus records for active assignments on join', async () => {
    mockQueryByField.mockImplementation(async (table, field) => {
      if (table === 'classes') return [classRecord];
      if (table === 'assignments') {
        return [
          { assignmentId: VALID_ASSIGN_ID, classId: VALID_CLASS_ID, status: 'active' },
        ];
      }
      return [];
    });
    mockGetItem.mockResolvedValue(null); // no existing membership
    mockPutItem.mockResolvedValue({});
    mockUpdateItem.mockResolvedValue({});

    await handler(
      makeEvent('POST', '/api/student/classes/join', { inviteCode: 'ABCDEF' }, 'student-token'),
      mockContext,
    );

    const statusCall = mockPutItem.mock.calls.find(
      c => c[0] === 'studentassignmentstatus',
    );
    expect(statusCall).toBeDefined();
    expect(statusCall[1]).toMatchObject({ assignmentId: VALID_ASSIGN_ID, status: 'not-started', studentId: VALID_STUDENT_ID });
  });

  it('returns 403 when a teacher tries to join a class', async () => {
    mockVerifyToken.mockReturnValue({
      sub: '22222222-2222-4222-8222-222222222222',
      role: 'teacher',
    });

    const result = await handler(
      makeEvent('POST', '/api/student/classes/join', { inviteCode: 'ABCDEF' }, 'teacher-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── GET /api/student/assignments ─────────────────────────────────────────────

describe('parentHandler — GET /api/student/assignments', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(studentDecoded);
  });

  it('returns assignments via the studentassignmentstatus query', async () => {
    mockQueryByField.mockResolvedValue([
      { PK: 'A1', assignmentId: VALID_ASSIGN_ID, studentId: VALID_STUDENT_ID, status: 'not-started', score: null, submittedAt: null },
    ]);
    mockGetItem.mockResolvedValue({
      assignmentId: VALID_ASSIGN_ID,
      title: 'Math Test',
      mode: 'test',
      dueDate: null,
      openAt: null,
      closeAt: null,
      timeLimit: null,
      retakePolicy: 'once',
      status: 'active',
    });

    const result = await handler(
      makeEvent('GET', '/api/student/assignments', null, 'student-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(body.assignments[0]).toHaveProperty('assignmentId', VALID_ASSIGN_ID);
  });

  it('returns 403 when a parent tries to access student assignments endpoint', async () => {
    mockVerifyToken.mockReturnValue(parentDecoded);

    const result = await handler(
      makeEvent('GET', '/api/student/assignments', null, 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── GET /api/parent/children/:studentId/export ──────────────────────────────

describe('parentHandler — GET /api/parent/children/:studentId/export', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
  });

  it('returns 200 with full data bundle for a linked child', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockGetItem.mockResolvedValue({ displayName: 'Test Student', grade: 4, passwordHash: 'hash-should-be-stripped' });
    mockQueryByField.mockImplementation(async (table) => {
      if (table === 'attempts')      return [{ attemptId: 'a1' }];
      if (table === 'worksheets')    return [];
      if (table === 'certificates')  return [];
      if (table === 'scores')        return [];
      return [];
    });

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/export`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('exportedAt');
    expect(body).toHaveProperty('studentId', VALID_CHILD_ID);
    expect(body.user).toBeDefined();
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(Array.isArray(body.attempts)).toBe(true);
  });

  it('returns 401 when no Authorization header', async () => {
    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/export`, null, null),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 403 when caller role is not parent', async () => {
    mockVerifyToken.mockReturnValue({ sub: VALID_STUDENT_ID, role: 'student', email: 'student@test.com' });

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/export`, null, 'student-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 CHILD_NOT_LINKED when parent is not linked to that child', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/export`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const result = await handler(
      makeEvent('GET', '/api/parent/children/not-a-uuid/export', null, 'parent-token',
        { studentId: 'not-a-uuid' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('includes CORS headers on export response', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });
    mockGetItem.mockResolvedValue({ displayName: 'Test Student', grade: 4 });
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      makeEvent('GET', `/api/parent/children/${VALID_CHILD_ID}/export`, null, 'parent-token',
        { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── POST /api/parent/children/:studentId/revoke-consent ─────────────────────

// Mock revokeConsent from consentStore — must be declared before the mock module setup above,
// so we use a module-level mock added after the file-level mocks via jest.unstable_mockModule.
// Since that mock is file-scoped, we capture its fn reference here.

const mockRevokeConsent = jest.fn();

jest.unstable_mockModule('../../src/consent/consentStore.js', () => ({
  revokeConsent: mockRevokeConsent,
  createConsentRequest: jest.fn(),
  getConsentByToken: jest.fn(),
  grantConsent: jest.fn(),
}));

// Re-import the handler so the new mock is applied.
// In ESM, a second import of the same specifier returns the cached module,
// so we need to use the already-imported handler from above — the mock for
// consentStore is hoisted before the first import by jest.unstable_mockModule.

describe('parentHandler — POST /api/parent/children/:studentId/revoke-consent', () => {
  beforeEach(() => {
    mockVerifyToken.mockReturnValue(parentDecoded);
    mockRevokeConsent.mockResolvedValue({ consentId: 'consent-abc', status: 'revoked' });
    mockUpdateItem.mockResolvedValue({});
  });

  it('returns 200 and suspends child account on valid revoke', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });

    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`,
        { reason: 'No longer permitted' }, 'parent-token', { studentId: VALID_CHILD_ID }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockRevokeConsent).toHaveBeenCalledWith(
      VALID_CHILD_ID,
      expect.objectContaining({ reason: 'No longer permitted', revokedBy: VALID_PARENT_ID }),
    );
    expect(mockUpdateItem).toHaveBeenCalledWith(
      'users',
      VALID_CHILD_ID,
      expect.objectContaining({ accountStatus: 'suspended' }),
    );
  });

  it('succeeds with no reason field — reason is null', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });

    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`,
        {}, 'parent-token', { studentId: VALID_CHILD_ID }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockRevokeConsent).toHaveBeenCalledWith(
      VALID_CHILD_ID,
      expect.objectContaining({ reason: null }),
    );
  });

  it('returns 401 when no Authorization header', async () => {
    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`, {}),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('returns 403 when caller role is not parent', async () => {
    mockVerifyToken.mockReturnValue({ sub: VALID_STUDENT_ID, role: 'student', email: 'student@test.com' });

    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`,
        {}, 'student-token', { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 CHILD_NOT_LINKED when parent is not linked to that child', async () => {
    mockVerifyParentChildLink.mockRejectedValue(makeChildNotLinkedError());

    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`,
        {}, 'parent-token', { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('CHILD_NOT_LINKED');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const result = await handler(
      makeEvent('POST', '/api/parent/children/bad-id/revoke-consent',
        {}, 'parent-token', { studentId: 'bad-id' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('includes CORS headers on 200 response', async () => {
    mockVerifyParentChildLink.mockResolvedValue({ parentId: VALID_PARENT_ID, childId: VALID_CHILD_ID, status: 'active' });

    const result = await handler(
      makeEvent('POST', `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`,
        {}, 'parent-token', { studentId: VALID_CHILD_ID }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── Auth guard: 401 on all authenticated routes ──────────────────────────────

describe('parentHandler — 401 on missing auth token', () => {
  const unauthCases = [
    ['GET',    '/api/parent/children'],
    ['POST',   '/api/parent/link'],
    ['DELETE', `/api/parent/children/${VALID_CHILD_ID}`],
    ['GET',    `/api/parent/children/${VALID_CHILD_ID}/progress`],
    ['GET',    `/api/parent/children/${VALID_CHILD_ID}/assignments`],
    ['GET',    `/api/parent/children/${VALID_CHILD_ID}/export`],
    ['POST',   `/api/parent/children/${VALID_CHILD_ID}/revoke-consent`],
  ];

  for (const [method, path] of unauthCases) {
    it(`returns 401 with CORS headers for ${method} ${path} when no token`, async () => {
      const result = await handler(makeEvent(method, path, null, null), mockContext);
      expect(result.statusCode).toBe(401);
      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    });
  }
});

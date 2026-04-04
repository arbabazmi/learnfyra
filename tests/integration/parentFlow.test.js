/**
 * @file tests/integration/parentFlow.test.js
 * @description Integration test for the full parent linking lifecycle:
 *   student generates invite → parent consumes → parent views children
 *   → parent views child progress → parent revokes link → verify 403 after revoke.
 *
 * All AWS SDK calls and real DynamoDB interactions are mocked via the DB adapter.
 * No network calls are made.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID  = '55555555-5555-4555-8555-555555555555';

// ─── In-memory data store ─────────────────────────────────────────────────────

let store = {};

function resetStore() {
  store = {
    classes: {},
    memberships: {},
    assignments: {},
    studentassignmentstatus: {},
    worksheets: {},
    users: {},
    parentinvitecodes: {},
    parentchildlinks: {},
    reviewqueueitems: {},
    worksheetattempts: {},
    rewardprofiles: {},
    attempts: {},
  };
}

// ─── Mock functions ───────────────────────────────────────────────────────────

const mockVerifyToken = jest.fn();

function makeStoreAdapter() {
  return {
    putItem: jest.fn(async (table, item) => {
      const key = item.PK || item.id || item.code || item.classId;
      store[table] = store[table] || {};
      store[table][key] = item;
    }),
    getItem: jest.fn(async (table, key) => {
      return (store[table] || {})[key] || null;
    }),
    queryByField: jest.fn(async (table, field, value) => {
      const rows = Object.values(store[table] || {});
      return rows.filter(r => r[field] === value);
    }),
    updateItem: jest.fn(async (table, key, updates) => {
      if (!store[table]) store[table] = {};
      if (!store[table][key]) store[table][key] = {};
      Object.assign(store[table][key], updates);
    }),
  };
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

let currentDbAdapter = null;

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({ verifyToken: mockVerifyToken })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => currentDbAdapter),
}));

jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyTeacherOwnsClass: jest.fn(),
  verifyParentChildLink: jest.fn(async (db, parentId, childId) => {
    const rows = Object.values(store.parentchildlinks || {});
    const link = rows.find(l => l.parentId === parentId && l.childId === childId && l.status === 'active');
    if (!link) {
      const err = new Error('Child not linked to this parent account.');
      err.statusCode = 403;
      err.errorCode = 'CHILD_NOT_LINKED';
      throw err;
    }
    return link;
  }),
}));

// ─── Dynamic import ───────────────────────────────────────────────────────────

const { handler: parentHandler } = await import('../../backend/handlers/parentHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockContext = { callbackWaitsForEmptyEventLoop: true };

const studentDecoded = { sub: STUDENT_ID, email: 'student@test.com', role: 'student' };
const parentDecoded  = { sub: PARENT_ID,  email: 'parent@test.com',  role: 'parent'  };

function postEvent(path, body, token, pathParameters = {}) {
  return { httpMethod: 'POST', path, headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body), pathParameters };
}

function getEvent(path, token, pathParameters = {}) {
  return { httpMethod: 'GET', path, headers: { authorization: `Bearer ${token}` }, body: null, pathParameters };
}

function deleteEvent(path, token, pathParameters = {}) {
  return { httpMethod: 'DELETE', path, headers: { authorization: `Bearer ${token}` }, body: null, pathParameters };
}

// ─── Setup/teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  currentDbAdapter = makeStoreAdapter();
  jest.clearAllMocks();

  // Seed student user record
  store.users[STUDENT_ID] = {
    userId: STUDENT_ID,
    displayName: 'Test Student',
    email: 'student@test.com',
    grade: 4,
    role: 'student',
  };
});

// ─── Parent linking lifecycle ─────────────────────────────────────────────────

describe('parentFlow integration — generate invite → link → view → revoke', () => {

  it('full lifecycle: student generates invite, parent links, views child, then revokes', async () => {

    // ── Step 1: Student generates a parent invite code ───────────────────────
    mockVerifyToken.mockReturnValue(studentDecoded);

    const genResult = await parentHandler(
      postEvent('/api/student/parent-invite', {}, 'student-token'),
      mockContext,
    );
    expect(genResult.statusCode).toBe(201);

    const { inviteCode, expiresAt } = JSON.parse(genResult.body);
    expect(inviteCode).toBeDefined();
    expect(expiresAt).toBeDefined();
    expect(typeof inviteCode).toBe('string');
    expect(inviteCode.length).toBeGreaterThanOrEqual(6);

    // Verify the invite code was written to the store
    const inviteKey = `INVITE#${inviteCode}`;
    const inviteRecord = store.parentinvitecodes[inviteKey];
    expect(inviteRecord).toBeDefined();
    expect(inviteRecord.used).toBe(false);
    expect(inviteRecord.targetStudentId).toBe(STUDENT_ID);
    expect(inviteRecord.linkMethod).toBe('student-invite');

    // ── Step 2: Parent consumes the invite code ──────────────────────────────
    mockVerifyToken.mockReturnValue(parentDecoded);

    const linkResult = await parentHandler(
      postEvent('/api/parent/link', { inviteCode }, 'parent-token'),
      mockContext,
    );
    expect(linkResult.statusCode).toBe(201);

    const linkBody = JSON.parse(linkResult.body);
    expect(linkBody).toHaveProperty('childId', STUDENT_ID);
    expect(linkBody).toHaveProperty('displayName', 'Test Student');
    expect(linkBody).toHaveProperty('parentId', PARENT_ID);

    // Verify link record was written
    const linkRows = Object.values(store.parentchildlinks);
    const linkRecord = linkRows.find(l => l.parentId === PARENT_ID && l.childId === STUDENT_ID);
    expect(linkRecord).toBeDefined();
    expect(linkRecord.status).toBe('active');

    // Verify invite code was marked as used
    // The updateItem call sets used=true on the invite record
    expect(currentDbAdapter.updateItem).toHaveBeenCalledWith(
      'parentinvitecodes',
      inviteKey,
      expect.objectContaining({ used: true }),
    );

    // ── Step 3: Parent views their children ───────────────────────────────────
    const getChildrenResult = await parentHandler(
      getEvent('/api/parent/children', 'parent-token'),
      mockContext,
    );
    expect(getChildrenResult.statusCode).toBe(200);

    const { children } = JSON.parse(getChildrenResult.body);
    expect(Array.isArray(children)).toBe(true);
    expect(children).toHaveLength(1);
    expect(children[0].studentId).toBe(STUDENT_ID);
    expect(children[0].displayName).toBe('Test Student');

    // ── Step 4: Parent views child progress ──────────────────────────────────
    // Seed some attempts for the child
    store.attempts['a1'] = { studentId: STUDENT_ID, createdAt: new Date().toISOString(), percentage: 80, totalScore: 8, totalPoints: 10, timeTaken: 120, topic: 'Fractions' };

    const progressResult = await parentHandler(
      getEvent(`/api/parent/children/${STUDENT_ID}/progress`, 'parent-token',
        { studentId: STUDENT_ID }),
      mockContext,
    );
    expect(progressResult.statusCode).toBe(200);

    const progressBody = JSON.parse(progressResult.body);
    expect(progressBody).toHaveProperty('studentId', STUDENT_ID);
    expect(progressBody).toHaveProperty('last7Days');
    expect(progressBody).toHaveProperty('last30Days');
    expect(progressBody).toHaveProperty('overallAccuracy');
    expect(progressBody).toHaveProperty('needsAttention');

    // ── Step 5: Parent revokes the link ───────────────────────────────────────
    const revokeResult = await parentHandler(
      deleteEvent(`/api/parent/children/${STUDENT_ID}`, 'parent-token',
        { studentId: STUDENT_ID }),
      mockContext,
    );
    expect(revokeResult.statusCode).toBe(200);

    const revokeBody = JSON.parse(revokeResult.body);
    expect(revokeBody).toHaveProperty('status', 'revoked');

    // ── Step 6: Verify 403 after revocation ───────────────────────────────────
    // The verifyParentChildLink mock checks for active status; after revoke it's revoked
    const progressAfterRevoke = await parentHandler(
      getEvent(`/api/parent/children/${STUDENT_ID}/progress`, 'parent-token',
        { studentId: STUDENT_ID }),
      mockContext,
    );
    expect(progressAfterRevoke.statusCode).toBe(403);
    const afterRevokeBody = JSON.parse(progressAfterRevoke.body);
    expect(afterRevokeBody.error).toBe('CHILD_NOT_LINKED');
  });

  it('consuming the same invite code twice returns 409 INVITE_CODE_ALREADY_USED', async () => {

    // Student generates code
    mockVerifyToken.mockReturnValue(studentDecoded);
    const genResult = await parentHandler(
      postEvent('/api/student/parent-invite', {}, 'student-token'),
      mockContext,
    );
    const { inviteCode } = JSON.parse(genResult.body);

    // First parent consumes
    mockVerifyToken.mockReturnValue(parentDecoded);
    const firstLink = await parentHandler(
      postEvent('/api/parent/link', { inviteCode }, 'parent-token'),
      mockContext,
    );
    expect(firstLink.statusCode).toBe(201);

    // Second attempt by same or different parent
    const secondLink = await parentHandler(
      postEvent('/api/parent/link', { inviteCode }, 'parent-token'),
      mockContext,
    );
    expect(secondLink.statusCode).toBe(409);
    const body = JSON.parse(secondLink.body);
    expect(body.error).toBe('INVITE_CODE_ALREADY_USED');
  });

  it('generating a second invite code invalidates the first', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);

    // First invite
    const first = await parentHandler(
      postEvent('/api/student/parent-invite', {}, 'student-token'),
      mockContext,
    );
    const { inviteCode: firstCode } = JSON.parse(first.body);

    // Second invite
    const second = await parentHandler(
      postEvent('/api/student/parent-invite', {}, 'student-token'),
      mockContext,
    );
    expect(second.statusCode).toBe(201);
    const { inviteCode: secondCode } = JSON.parse(second.body);

    expect(secondCode).toBeDefined();
    // The first code should be marked used in the store
    const firstRecord = store.parentinvitecodes[`INVITE#${firstCode}`];
    if (firstRecord) {
      expect(firstRecord.used).toBe(true);
    }
  });

  it('GET /parent/children returns only active links (not revoked)', async () => {
    // Manually seed a revoked link and an active link
    store.parentchildlinks['link1'] = {
      PK: `USER#${PARENT_ID}`,
      parentId: PARENT_ID,
      childId: STUDENT_ID,
      status: 'revoked',
      linkedAt: '2026-01-01T00:00:00Z',
      linkMethod: 'student-invite',
    };

    mockVerifyToken.mockReturnValue(parentDecoded);

    const result = await parentHandler(
      getEvent('/api/parent/children', 'parent-token'),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const { children } = JSON.parse(result.body);
    // Revoked link must not appear
    expect(children.filter(c => c.studentId === STUDENT_ID)).toHaveLength(0);
  });

});

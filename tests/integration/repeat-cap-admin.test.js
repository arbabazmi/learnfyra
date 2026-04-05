/**
 * @file tests/integration/repeat-cap-admin.test.js
 * @description Integration tests for the Repeat Cap admin API
 *   (guardrailsAdminHandler.js — Section B endpoints).
 *
 * Exercises the Lambda handler directly (no real HTTP server) with mock
 * Lambda events, a mocked db adapter, and a mocked auth middleware.
 *
 * Covers AC-01 through AC-05:
 *   AC-01 — GET returns global + overrides
 *   AC-01 — PUT updates global, returns auditId
 *   AC-01 — POST creates override, returns 201
 *   AC-01 — DELETE removes override, returns 200 / 404
 *   AC-03 — Teacher (non-admin) cannot access → 403
 *   AC-01/AC-04 — Validation: value 101, -1, "abc" → 400
 *   AC-05 — Audit log entry created on each mutation
 *
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mocks — must be declared before dynamic imports ─────────────────────────

const mockVerifyToken  = jest.fn();
const mockGetItem      = jest.fn();
const mockPutItem      = jest.fn();
const mockDeleteItem   = jest.fn();
const mockListAll      = jest.fn();
const mockWriteAuditLog = jest.fn();

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem:    mockGetItem,
    putItem:    mockPutItem,
    deleteItem: mockDeleteItem,
    listAll:    mockListAll,
  })),
}));

// writeAuditLog is fire-and-forget; stub it to capture calls
jest.unstable_mockModule('../../src/admin/auditLogger.js', () => ({
  writeAuditLog:    mockWriteAuditLog,
  extractIp:        jest.fn(() => '127.0.0.1'),
  extractUserAgent: jest.fn(() => 'test-agent'),
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/guardrailsAdminHandler.js');

// ─── Event builders ───────────────────────────────────────────────────────────

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'learnfyra-admin-guardrails',
  getRemainingTimeInMillis: () => 30000,
};

function makeEvent({ method = 'GET', path = '/api/admin/repeat-cap', body = null, token = 'test-jwt' } = {}) {
  return {
    httpMethod: method,
    path,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: null,
    pathParameters: null,
  };
}

/** Decoded admin token for SUPER_ADMIN role */
const adminDecoded = { sub: 'admin-user-id', email: 'admin@learnfyra.com', role: 'SUPER_ADMIN' };
/** Decoded token for a teacher (non-admin) */
const teacherDecoded = { sub: 'teacher-user-id', email: 'teacher@school.edu', role: 'TEACHER' };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: valid admin token
  mockVerifyToken.mockReturnValue(adminDecoded);

  // Default: no overrides, no existing config record
  mockGetItem.mockResolvedValue(null);
  mockListAll.mockResolvedValue([]);
  mockPutItem.mockResolvedValue(undefined);
  mockDeleteItem.mockResolvedValue(undefined);
  mockWriteAuditLog.mockResolvedValue('mock-audit-id');
});

// ─── OPTIONS (CORS preflight) ────────────────────────────────────────────────

describe('OPTIONS preflight', () => {
  it('returns 200 with CORS headers for preflight', async () => {
    const event = { ...makeEvent({ method: 'OPTIONS' }), httpMethod: 'OPTIONS' };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ─── GET /api/admin/repeat-cap (AC-01) ───────────────────────────────────────

describe('GET /api/admin/repeat-cap', () => {
  it('returns 200 with global and overrides when no data exists', async () => {
    const result = await handler(makeEvent({ method: 'GET' }), mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('global');
    expect(body).toHaveProperty('overrides');
    expect(Array.isArray(body.overrides)).toBe(true);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns the stored global value from db', async () => {
    mockGetItem.mockImplementation((table, id) => {
      if (table === 'guardrailConfig' && id === 'repeat-cap:global') {
        return Promise.resolve({
          id: 'repeat-cap:global',
          value: 25,
          updatedAt: '2026-04-04T10:00:00Z',
          updatedBy: 'admin-user-id',
        });
      }
      return Promise.resolve(null);
    });

    const result = await handler(makeEvent({ method: 'GET' }), mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.global.value).toBe(25);
  });

  it('returns populated overrides when overrides exist in db', async () => {
    const fakeOverrides = [
      {
        id:        'student:student-uuid-1',
        scope:     'student',
        scopeId:   'student-uuid-1',
        value:     10,
        reason:    'Remedial student',
        expiresAt: null,
        createdAt: '2026-04-04T10:05:00Z',
        updatedBy: 'admin-user-id',
      },
    ];
    mockListAll.mockResolvedValue(fakeOverrides);

    const result = await handler(makeEvent({ method: 'GET' }), mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.overrides).toHaveLength(1);
    expect(body.overrides[0].scope).toBe('student');
    expect(body.overrides[0].value).toBe(10);
  });

  it('returns 403 for non-admin roles (AC-03)', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);

    const result = await handler(makeEvent({ method: 'GET' }), mockContext);

    expect(result.statusCode).toBe(403);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/api/admin/repeat-cap',
      headers: {},
      body: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
  });
});

// ─── PUT /api/admin/repeat-cap (AC-01, AC-05) ───────────────────────────────���─

describe('PUT /api/admin/repeat-cap', () => {
  it('returns 200 and updates global when value and reason are valid', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 25, reason: 'Increasing cap for Science inventory shortage' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.global.value).toBe(25);
    expect(body.auditId).toBeDefined();
  });

  it('creates an audit log entry on successful update (AC-05)', async () => {
    await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 30, reason: 'Audit log test reason here' },
      }),
      mockContext,
    );

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = mockWriteAuditLog.mock.calls[0][0];
    expect(auditCall.actorId).toBe('admin-user-id');
    expect(auditCall.action).toBe('CONFIG_UPDATED');
    expect(auditCall.targetEntityType).toBe('repeat_cap_global');
  });

  it('returns 400 when value is 101 (AC-01 boundary — above max)', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 101, reason: 'Test invalid value' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/0-100/);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 400 when value is -1 (AC-01 boundary — below min)', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: -1, reason: 'Test negative value' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when value is a non-integer string "abc"', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 'abc', reason: 'Test string value' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const result = await handler(
      makeEvent({ method: 'PUT', body: { value: 20 } }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when reason is too short', async () => {
    const result = await handler(
      makeEvent({ method: 'PUT', body: { value: 20, reason: 'ok' } }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 403 for teacher role (AC-03)', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);

    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 25, reason: 'Should be blocked for teachers' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(403);
  });

  it('accepts value = 0 (boundary: no repeats)', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 0, reason: 'Zero repeat cap for all students' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).global.value).toBe(0);
  });

  it('accepts value = 100 (boundary: all repeats allowed)', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 100, reason: 'Disabling repeat restriction temporarily' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).global.value).toBe(100);
  });
});

// ─── POST /api/admin/repeat-cap/override (AC-04) ─────────────────────────────

describe('POST /api/admin/repeat-cap/override', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('returns 201 on successful override creation', async () => {
    // No existing override
    mockGetItem.mockResolvedValue(null);

    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'student',
          scopeId:  VALID_UUID,
          value:    10,
          reason:   'Remedial student needs more question variety',
          expiresAt: null,
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.override.scope).toBe('student');
    expect(body.override.value).toBe(10);
    expect(body.auditId).toBeDefined();
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('creates an audit log entry on override creation (AC-05)', async () => {
    mockGetItem.mockResolvedValue(null);

    await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'parent',
          scopeId:  VALID_UUID,
          value:    15,
          reason:   'Parent requested increased variety for learning style',
        },
      }),
      mockContext,
    );

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = mockWriteAuditLog.mock.calls[0][0];
    expect(auditCall.actorId).toBe('admin-user-id');
    expect(auditCall.targetEntityType).toBe('repeat_cap_override');
  });

  it('returns 409 when override already exists for scope:scopeId', async () => {
    mockGetItem.mockResolvedValue({
      id:      `student:${VALID_UUID}`,
      scope:   'student',
      scopeId: VALID_UUID,
      value:   10,
    });

    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'student',
          scopeId:  VALID_UUID,
          value:    20,
          reason:   'Attempting duplicate creation',
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(409);
  });

  it('returns 400 when scope is invalid', async () => {
    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'principal', // invalid scope
          scopeId:  VALID_UUID,
          value:    10,
          reason:   'Invalid scope test',
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/scope/i);
  });

  it('returns 400 when scopeId is not a valid UUID', async () => {
    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'student',
          scopeId:  'not-a-uuid!!',
          value:    10,
          reason:   'Invalid scopeId test',
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when value is 101', async () => {
    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:   'teacher',
          scopeId: VALID_UUID,
          value:   101,
          reason:  'Invalid value test for override',
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when expiresAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:     'student',
          scopeId:   VALID_UUID,
          value:     10,
          reason:    'Test past expiresAt validation',
          expiresAt: pastDate,
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/future/i);
  });

  it('returns 403 for teacher role (AC-03)', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);

    const result = await handler(
      makeEvent({
        method: 'POST',
        path:   '/api/admin/repeat-cap/override',
        body: {
          scope:    'student',
          scopeId:  VALID_UUID,
          value:    10,
          reason:   'Teacher should be blocked from creating overrides',
        },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(403);
  });
});

// ─── DELETE /api/admin/repeat-cap/override/:scope/:scopeId ───────────────────

describe('DELETE /api/admin/repeat-cap/override/:scope/:scopeId', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('returns 200 on successful deletion', async () => {
    mockGetItem.mockResolvedValue({
      id:      `student:${VALID_UUID}`,
      scope:   'student',
      scopeId: VALID_UUID,
      value:   10,
      reason:  'Test override to delete',
    });

    const result = await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/student/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.deleted.scope).toBe('student');
    expect(body.deleted.scopeId).toBe(VALID_UUID);
    expect(body.auditId).toBeDefined();
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('creates an audit log entry on deletion (AC-05)', async () => {
    mockGetItem.mockResolvedValue({
      id:      `teacher:${VALID_UUID}`,
      scope:   'teacher',
      scopeId: VALID_UUID,
      value:   40,
    });

    await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/teacher/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    const auditCall = mockWriteAuditLog.mock.calls[0][0];
    expect(auditCall.targetEntityType).toBe('repeat_cap_override');
    expect(auditCall.afterState).toBeNull();
  });

  it('returns 404 when override does not exist', async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/student/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(404);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 400 when scope is invalid', async () => {
    const result = await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/unknown/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 403 for teacher role (AC-03)', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);

    const result = await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/student/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(403);
  });
});

// ─── CORS headers on error responses ─────────────────────────────────────────

describe('CORS headers present on all responses including errors', () => {
  it('400 response includes Access-Control-Allow-Origin', async () => {
    const result = await handler(
      makeEvent({
        method: 'PUT',
        body: { value: 999, reason: 'invalid' },
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('403 response includes Access-Control-Allow-Origin', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    const result = await handler(makeEvent({ method: 'GET' }), mockContext);
    expect(result.statusCode).toBe(403);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('404 response includes Access-Control-Allow-Origin', async () => {
    mockGetItem.mockResolvedValue(null);

    const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = await handler(
      makeEvent({
        method: 'DELETE',
        path:   `/api/admin/repeat-cap/override/student/${VALID_UUID}`,
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(404);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

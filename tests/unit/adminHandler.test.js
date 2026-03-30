/**
 * @file tests/unit/adminHandler.test.js
 * @description Unit tests for backend/handlers/adminHandler.js.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const mockVerifyToken = jest.fn();
const mockGetItem = jest.fn();
const mockPutItem = jest.fn();
const mockListAll = jest.fn();

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: mockGetItem,
    putItem: mockPutItem,
    listAll: mockListAll,
  })),
}));

const { handler } = await import('../../backend/handlers/adminHandler.js');

const adminDecoded = {
  sub: ADMIN_ID,
  email: 'admin@test.com',
  role: 'admin',
};

const teacherDecoded = {
  sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'teacher@test.com',
  role: 'teacher',
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockReturnValue(adminDecoded);
  mockPutItem.mockResolvedValue({});
  mockListAll.mockResolvedValue([]);
  mockGetItem.mockImplementation(async (table, id) => {
    if (table === 'adminPolicies' && id === 'global') {
      return {
        id: 'global',
        version: 1,
        modelRouting: {
          defaultMode: 'auto',
          allowPremium: true,
          premiumEscalation: { missingCountThreshold: 15, hardQuestionCountThreshold: 10 },
          fallbackOrder: ['low', 'default', 'premium'],
        },
        budgetUsage: {
          dailyUsdSoftLimit: 100,
          dailyUsdHardLimit: 150,
          monthlyUsdSoftLimit: 2500,
          monthlyUsdHardLimit: 3000,
          softLimitBehavior: 'log-only',
          hardLimitBehavior: 'block-premium',
        },
        validationProfile: {
          name: 'standard',
          strictness: 'balanced',
          rejectOnCountMismatch: true,
          rejectOnSchemaViolation: true,
          allowPartialIfRecoverable: false,
        },
        updatedAt: '2026-03-26T00:00:00.000Z',
        updatedBy: ADMIN_ID,
      };
    }
    return null;
  });
});

describe('adminHandler - OPTIONS', () => {
  it('returns 200 for preflight', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });
});

describe('adminHandler - GET /api/admin/policies', () => {
  it('returns 200 with policy snapshot for admin', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/admin/policies',
        headers: { authorization: 'Bearer admin-token' },
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('modelRouting');
    expect(body).toHaveProperty('budgetUsage');
    expect(body).toHaveProperty('validationProfile');
  });

  it('returns 403 for non-admin role', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/admin/policies',
        headers: { authorization: 'Bearer teacher-token' },
      },
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

describe('adminHandler - PUT /api/admin/policies/model-routing', () => {
  const validBody = {
    defaultMode: 'auto',
    allowPremium: true,
    premiumEscalation: {
      missingCountThreshold: 15,
      hardQuestionCountThreshold: 10,
    },
    fallbackOrder: ['low', 'default', 'premium'],
    reason: 'LF-1234 maintain premium escalation for high complexity requests.',
  };

  it('returns 400 when Idempotency-Key is missing', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/model-routing',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 200 and writes audit and idempotency records', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/model-routing',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'model-route-1',
        },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockPutItem).toHaveBeenCalledWith('adminPolicies', expect.objectContaining({
      id: 'global',
      version: 2,
    }));
    expect(mockPutItem).toHaveBeenCalledWith('adminAuditEvents', expect.objectContaining({
      action: 'update-model-routing',
      actorId: ADMIN_ID,
    }));
    expect(mockPutItem).toHaveBeenCalledWith('adminIdempotency', expect.objectContaining({
      action: 'update-model-routing',
      actorId: ADMIN_ID,
    }));
  });

  it('returns 409 when same idempotency key is reused with different payload', async () => {
    mockGetItem.mockImplementation(async (table, id) => {
      if (table === 'adminPolicies' && id === 'global') {
        return {
          id: 'global',
          version: 1,
          modelRouting: {
            defaultMode: 'auto',
            allowPremium: true,
            premiumEscalation: { missingCountThreshold: 15, hardQuestionCountThreshold: 10 },
            fallbackOrder: ['low', 'default', 'premium'],
          },
          budgetUsage: {
            dailyUsdSoftLimit: 100,
            dailyUsdHardLimit: 150,
            monthlyUsdSoftLimit: 2500,
            monthlyUsdHardLimit: 3000,
            softLimitBehavior: 'log-only',
            hardLimitBehavior: 'block-premium',
          },
          validationProfile: {
            name: 'standard',
            strictness: 'balanced',
            rejectOnCountMismatch: true,
            rejectOnSchemaViolation: true,
            allowPartialIfRecoverable: false,
          },
          updatedAt: '2026-03-26T00:00:00.000Z',
          updatedBy: ADMIN_ID,
        };
      }

      if (table === 'adminIdempotency' && id.includes('model-route-1')) {
        return {
          id,
          requestHash: 'different-hash',
          responseStatusCode: 200,
          responseBody: JSON.stringify({ message: 'ok' }),
        };
      }

      return null;
    });

    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/model-routing',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'model-route-1',
        },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );

    expect(result.statusCode).toBe(409);
  });

  it('returns cached response when same idempotency key is reused with same payload', async () => {
    const requestHash = createHash('sha256')
      .update(JSON.stringify(JSON.stringify(validBody)))
      .digest('hex');
    const cachedBody = JSON.stringify({
      message: 'Model routing policy updated.',
      version: 2,
      appliedAt: '2026-03-26T12:00:00.000Z',
    });

    mockGetItem.mockImplementation(async (table, id) => {
      if (table === 'adminPolicies' && id === 'global') {
        return {
          id: 'global',
          version: 1,
          modelRouting: {
            defaultMode: 'auto',
            allowPremium: true,
            premiumEscalation: { missingCountThreshold: 15, hardQuestionCountThreshold: 10 },
            fallbackOrder: ['low', 'default', 'premium'],
          },
          budgetUsage: {
            dailyUsdSoftLimit: 100,
            dailyUsdHardLimit: 150,
            monthlyUsdSoftLimit: 2500,
            monthlyUsdHardLimit: 3000,
            softLimitBehavior: 'log-only',
            hardLimitBehavior: 'block-premium',
          },
          validationProfile: {
            name: 'standard',
            strictness: 'balanced',
            rejectOnCountMismatch: true,
            rejectOnSchemaViolation: true,
            allowPartialIfRecoverable: false,
          },
          updatedAt: '2026-03-26T00:00:00.000Z',
          updatedBy: ADMIN_ID,
        };
      }
      if (table === 'adminIdempotency' && id.includes('model-route-1')) {
        return {
          id,
          requestHash,
          responseStatusCode: 200,
          responseBody: cachedBody,
        };
      }
      return null;
    });

    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/model-routing',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'model-route-1',
        },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(cachedBody);
  });
});

describe('adminHandler - PUT /api/admin/policies/budget-usage', () => {
  const validBody = {
    dailyUsdSoftLimit: 100,
    dailyUsdHardLimit: 150,
    monthlyUsdSoftLimit: 2500,
    monthlyUsdHardLimit: 3000,
    softLimitBehavior: 'log-only',
    hardLimitBehavior: 'block-premium',
    reason: 'LF-2222 adjust budget controls for next phase.',
  };

  it('returns 200 for valid budget policy update', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/budget-usage',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'budget-1',
        },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 when soft limit exceeds hard limit', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/budget-usage',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'budget-2',
        },
        body: JSON.stringify({ ...validBody, dailyUsdSoftLimit: 200, dailyUsdHardLimit: 150 }),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when block-generation has no ticket in reason', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/budget-usage',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'budget-3',
        },
        body: JSON.stringify({
          ...validBody,
          hardLimitBehavior: 'block-generation',
          reason: 'block everything now',
        }),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });
});

describe('adminHandler - PUT /api/admin/policies/validation-profile', () => {
  const validBody = {
    name: 'strict',
    strictness: 'strict',
    rejectOnCountMismatch: true,
    rejectOnSchemaViolation: true,
    allowPartialIfRecoverable: false,
    reason: 'LF-3333 move validation profile to strict for quality control.',
  };

  it('returns 200 for valid validation profile update', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/validation-profile',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'validation-1',
        },
        body: JSON.stringify(validBody),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for unsafe strictness settings', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/validation-profile',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'validation-2',
        },
        body: JSON.stringify({
          ...validBody,
          rejectOnSchemaViolation: false,
        }),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when strict to lenient downgrade reason is too short', async () => {
    mockGetItem.mockImplementation(async (table, id) => {
      if (table === 'adminPolicies' && id === 'global') {
        return {
          id: 'global',
          version: 1,
          modelRouting: {
            defaultMode: 'auto',
            allowPremium: true,
            premiumEscalation: { missingCountThreshold: 15, hardQuestionCountThreshold: 10 },
            fallbackOrder: ['low', 'default', 'premium'],
          },
          budgetUsage: {
            dailyUsdSoftLimit: 100,
            dailyUsdHardLimit: 150,
            monthlyUsdSoftLimit: 2500,
            monthlyUsdHardLimit: 3000,
            softLimitBehavior: 'log-only',
            hardLimitBehavior: 'block-premium',
          },
          validationProfile: {
            name: 'strict',
            strictness: 'strict',
            rejectOnCountMismatch: true,
            rejectOnSchemaViolation: true,
            allowPartialIfRecoverable: false,
          },
          updatedAt: '2026-03-26T00:00:00.000Z',
          updatedBy: ADMIN_ID,
        };
      }
      return null;
    });

    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/validation-profile',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'validation-3',
        },
        body: JSON.stringify({
          ...validBody,
          name: 'lenient',
          strictness: 'lenient',
          reason: 'short reason',
        }),
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });
});

describe('adminHandler - GET /api/admin/audit/events', () => {
  it('returns paged audit events', async () => {
    mockListAll.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'admin.policy.updated',
        action: 'update-model-routing',
        actorId: ADMIN_ID,
        target: 'adminPolicies.global.modelRouting',
        createdAt: '2026-03-26T10:00:00.000Z',
      },
      {
        id: 'evt-2',
        eventType: 'admin.policy.updated',
        action: 'update-budget-usage',
        actorId: ADMIN_ID,
        target: 'adminPolicies.global.budgetUsage',
        createdAt: '2026-03-26T09:00:00.000Z',
      },
    ]);

    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/admin/audit/events',
        headers: { authorization: 'Bearer admin-token' },
        queryStringParameters: { limit: '1', offset: '0' },
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.events).toHaveLength(1);
    expect(body.pagination.returned).toBe(1);
  });

  it('returns 400 for invalid limit query', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/admin/audit/events',
        headers: { authorization: 'Bearer admin-token' },
        queryStringParameters: { limit: '10.5' },
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });
});

describe('adminHandler - repeat-cap policy endpoints', () => {
  it('returns repeat-cap policy from GET /api/admin/policies/repeat-cap', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/admin/policies/repeat-cap',
        headers: { authorization: 'Bearer admin-token' },
        queryStringParameters: {},
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('repeatCapPolicy');
    expect(Array.isArray(body.overrides)).toBe(true);
  });

  it('updates global repeat-cap policy via PUT /api/admin/policies/repeat-cap', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/repeat-cap',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'repeat-cap-global-1',
        },
        body: JSON.stringify({
          enabled: true,
          defaultPercent: 15,
          reason: 'LF-9001 set default repeat cap for paid plans rollout.',
        }),
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockPutItem).toHaveBeenCalledWith('adminPolicies', expect.objectContaining({
      repeatCapPolicy: expect.objectContaining({
        enabled: true,
        defaultPercent: 15,
      }),
    }));
  });

  it('upserts scoped repeat-cap override via PUT /api/admin/policies/repeat-cap/overrides', async () => {
    const result = await handler(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/repeat-cap/overrides',
        headers: {
          authorization: 'Bearer admin-token',
          'Idempotency-Key': 'repeat-cap-override-1',
        },
        body: JSON.stringify({
          scope: 'student',
          scopeId: 'student-42',
          repeatCapPercent: 0,
          isActive: true,
          reason: 'LF-9002 premium plan no-repeat mode enabled for this student.',
        }),
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockPutItem).toHaveBeenCalledWith('repeatCapOverrides', expect.objectContaining({
      id: 'student:student-42',
      repeatCapPercent: 0,
      scope: 'student',
      scopeId: 'student-42',
    }));
  });
});
/**
 * @file tests/unit/guardrailsAdminHandler.test.js
 * @description Unit tests for backend/handlers/guardrailsAdminHandler.js
 *
 * Covers:
 *   - OPTIONS (CORS preflight) returns 200 with headers
 *   - GET /api/admin/guardrails/policy — returns current config
 *   - PUT /api/admin/guardrails/policy — updates and returns diff; audit log written
 *   - PUT /api/admin/guardrails/policy — invalid guardrailLevel → 400
 *   - PUT /api/admin/guardrails/policy — missing reason → 400
 *   - PUT /api/admin/guardrails/policy — invalid retryLimit → 400
 *   - GET /api/admin/guardrails/templates — returns medium and strict templates
 *   - PUT /api/admin/guardrails/templates/:level — validates placeholders → 400
 *   - PUT /api/admin/guardrails/templates/:level — valid update creates audit log
 *   - POST /api/admin/guardrails/test — dry-run validation
 *   - GET /api/admin/audit/guardrail-events — query with date range
 *   - Non-admin role → 403
 *   - Missing auth header → 401
 *   - All mutating operations create audit log entries
 *   - CORS headers present on all responses including error responses
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Stable IDs ────────────────────────────────────────────────────────────────

const ADMIN_ID   = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// ── Mock function references ──────────────────────────────────────────────────

const mockVerifyToken     = jest.fn();
const mockGetItem         = jest.fn();
const mockPutItem         = jest.fn();
const mockListAll         = jest.fn();
const mockDeleteItem      = jest.fn();
const mockWriteAuditLog   = jest.fn();
const mockExtractIp       = jest.fn().mockReturnValue('127.0.0.1');
const mockExtractUserAgent = jest.fn().mockReturnValue('test-agent');
const mockValidateOutput  = jest.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({ verifyToken: mockVerifyToken })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem:    mockGetItem,
    putItem:    mockPutItem,
    listAll:    mockListAll,
    deleteItem: mockDeleteItem,
  })),
}));

jest.unstable_mockModule('../../src/admin/auditLogger.js', () => ({
  writeAuditLog:    mockWriteAuditLog,
  extractIp:        mockExtractIp,
  extractUserAgent: mockExtractUserAgent,
  VALID_ACTIONS: new Set([
    'CONFIG_UPDATED', 'GENERATION_MODERATION',
    'GUARDRAIL_POLICY_UPDATED', 'GUARDRAIL_TEMPLATE_UPDATED',
  ]),
}));

jest.unstable_mockModule('../../src/ai/validation/outputValidator.js', () => ({
  validateWorksheetOutput: mockValidateOutput,
}));

jest.unstable_mockModule('../../src/ai/guardrails/tokenEstimator.js', () => ({
  estimateTokenCount: (text) => Math.ceil(text.length / 4),
  TOKEN_LIMIT: 120,
}));

// ── Import handler after mocks ────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/guardrailsAdminHandler.js');

// ── Decoded token fixtures ────────────────────────────────────────────────────

const superAdminDecoded = { sub: ADMIN_ID, email: 'admin@test.com', role: 'SUPER_ADMIN' };
const platformAdminDecoded = { sub: ADMIN_ID, email: 'padmin@test.com', role: 'PLATFORM_ADMIN' };
const studentDecoded = { sub: STUDENT_ID, email: 'student@test.com', role: 'STUDENT' };

// ── Context fixture ───────────────────────────────────────────────────────────

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'learnfyra-guardrails-admin-test',
  getRemainingTimeInMillis: () => 15000,
};

// ── Event factory ─────────────────────────────────────────────────────────────

function mockEvent(method, path, body = null, query = null) {
  return {
    httpMethod: method,
    path,
    headers: { Authorization: 'Bearer valid-token', 'User-Agent': 'test-agent' },
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: query,
    pathParameters: null,
    requestContext: {
      requestId: 'req-test',
      identity: { sourceIp: '127.0.0.1' },
    },
  };
}

// ── Default DB state ──────────────────────────────────────────────────────────

const DEFAULT_POLICY_RECORD = {
  value: {
    guardrailLevel: 'medium',
    retryLimit: 3,
    enableAwsComprehend: false,
    comprehToxicityThreshold: 0.75,
    validationFilters: ['profanity', 'sensitiveTopics'],
  },
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const DEFAULT_MEDIUM_TEMPLATE = {
  value: 'You are generating educational worksheets for Grade [grade] students (ages [age]).',
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

const DEFAULT_STRICT_TEMPLATE = {
  value: 'You are generating worksheets for young Grade [grade] students (ages [age]). Keep content safe.',
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'system',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWriteAuditLog.mockResolvedValue('mock-audit-id');

  // Default: decode to super admin
  mockVerifyToken.mockReturnValue(superAdminDecoded);

  // Default DB responses
  mockGetItem.mockImplementation(async (table, key) => {
    if (table === 'guardrailConfig') {
      if (key === 'guardrail:policy')          return DEFAULT_POLICY_RECORD;
      if (key === 'guardrail:medium:template') return DEFAULT_MEDIUM_TEMPLATE;
      if (key === 'guardrail:strict:template') return DEFAULT_STRICT_TEMPLATE;
    }
    return null;
  });

  mockListAll.mockResolvedValue([]);
  mockPutItem.mockResolvedValue({});
  mockDeleteItem.mockResolvedValue({});

  // Default outputValidator: pass
  mockValidateOutput.mockResolvedValue({
    safe: true,
    failureReason: null,
    failureDetails: null,
    validatorsRun: ['profanityFilter', 'sensitiveTopicFilter'],
  });
});

// ── OPTIONS preflight ─────────────────────────────────────────────────────────

describe('handler — OPTIONS preflight', () => {
  it('returns 200 for OPTIONS preflight', async () => {
    const result = await handler(mockEvent('OPTIONS', '/api/admin/guardrails/policy'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('includes CORS headers on OPTIONS response', async () => {
    const result = await handler(mockEvent('OPTIONS', '/api/admin/guardrails/policy'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
  });
});

// ── GET /api/admin/guardrails/policy ─────────────────────────────────────────

describe('GET /api/admin/guardrails/policy', () => {
  it('returns 200 with policy object for SUPER_ADMIN', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('policy');
    expect(body.policy).toHaveProperty('guardrailLevel');
    expect(body.policy).toHaveProperty('retryLimit');
    expect(body.policy).toHaveProperty('validationFilters');
  });

  it('returns 200 with policy object for PLATFORM_ADMIN', async () => {
    mockVerifyToken.mockReturnValue(platformAdminDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.statusCode).toBe(200);
  });

  it('returns 403 for STUDENT role', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const event = mockEvent('GET', '/api/admin/guardrails/policy');
    event.headers = {};
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on successful GET response', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers are present on 403 error response', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ── PUT /api/admin/guardrails/policy ─────────────────────────────────────────

describe('PUT /api/admin/guardrails/policy', () => {
  it('returns 200 and changes diff when guardrailLevel is updated', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'strict',
        reason: 'Tightening for younger audience',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.policy.guardrailLevel).toBe('strict');
    expect(body.changes).toHaveProperty('guardrailLevel');
    expect(body.changes.guardrailLevel.from).toBe('medium');
    expect(body.changes.guardrailLevel.to).toBe('strict');
  });

  it('returns auditId in the response', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'strict',
        reason: 'Tightening now',
      }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('auditId');
    expect(typeof body.auditId).toBe('string');
    expect(body.auditId.length).toBeGreaterThan(0);
  });

  it('calls writeAuditLog once on policy update', async () => {
    await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'strict',
        reason: 'Testing audit',
      }),
      mockContext
    );
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for invalid guardrailLevel value "none"', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'none',
        reason: 'Trying to disable guardrails',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/invalid guardrailLevel/i);
  });

  it('returns 400 for invalid guardrailLevel value "off"', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'off',
        reason: 'Testing bypass attempt',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', { guardrailLevel: 'strict' }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/reason/i);
  });

  it('returns 400 when reason is fewer than 5 characters', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'strict',
        reason: 'ok',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when retryLimit is not an integer', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        retryLimit: 1.5,
        reason: 'Testing invalid retry limit',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/retryLimit/i);
  });

  it('returns 400 when retryLimit exceeds maximum of 5', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        retryLimit: 6,
        reason: 'Testing over-limit retry',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when retryLimit is negative', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        retryLimit: -1,
        reason: 'Testing negative retry limit',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('accepts partial update — only retryLimit without guardrailLevel', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        retryLimit: 2,
        reason: 'Reducing retry attempts for speed',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.policy.retryLimit).toBe(2);
    // guardrailLevel should remain unchanged (medium)
    expect(body.policy.guardrailLevel).toBe('medium');
  });

  it('returns 403 for STUDENT role on PUT', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', {
        guardrailLevel: 'strict',
        reason: 'Unauthorized attempt',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(403);
  });
});

// ── GET /api/admin/guardrails/templates ──────────────────────────────────────

describe('GET /api/admin/guardrails/templates', () => {
  it('returns 200 with both medium and strict templates', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/templates'),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('templates');
    expect(body.templates).toHaveProperty('medium');
    expect(body.templates).toHaveProperty('strict');
  });

  it('each template has content, version, updatedAt, updatedBy fields', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/templates'),
      mockContext
    );
    const body = JSON.parse(result.body);
    const { medium, strict } = body.templates;
    for (const tmpl of [medium, strict]) {
      expect(tmpl).toHaveProperty('content');
      expect(tmpl).toHaveProperty('version');
      expect(tmpl).toHaveProperty('updatedAt');
      expect(tmpl).toHaveProperty('updatedBy');
    }
  });

  it('returns 403 for non-admin role', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/templates'),
      mockContext
    );
    expect(result.statusCode).toBe(403);
  });
});

// ── PUT /api/admin/guardrails/templates/:level ────────────────────────────────

describe('PUT /api/admin/guardrails/templates/:level', () => {
  const validContent = 'You are generating Grade [grade] worksheets (ages [age]). Keep safe.';

  it('returns 200 on valid strict template update', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: validContent,
        reason: 'Adding inclusivity emphasis',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.template.level).toBe('strict');
    expect(body.template.content).toBe(validContent);
  });

  it('returns 200 on valid medium template update', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/medium', {
        content: validContent,
        reason: 'Updating medium template wording',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.template.level).toBe('medium');
  });

  it('increments version on template update', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/medium', {
        content: validContent,
        reason: 'Version increment test',
      }),
      mockContext
    );
    const body = JSON.parse(result.body);
    // existing version is 1 from fixture, so new version should be 2
    expect(body.template.version).toBe(2);
  });

  it('returns 400 when template content is missing [grade] placeholder', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: 'Template without grade marker (ages [age]).',
        reason: 'Missing grade placeholder test',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/\[grade\]/);
  });

  it('returns 400 when template content is missing [age] placeholder', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: 'Template for Grade [grade] students.',
        reason: 'Missing age placeholder test',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/\[age\]/);
  });

  it('returns 400 when template content is missing both placeholders', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: 'Generic template with no placeholders.',
        reason: 'No placeholder test at all here',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when level is not medium or strict', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/easy', {
        content: validContent,
        reason: 'Invalid level attempt',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('calls writeAuditLog on successful template update', async () => {
    await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: validContent,
        reason: 'Audit log test update',
      }),
      mockContext
    );
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for non-admin on template update', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content: validContent,
        reason: 'Unauthorized template update',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(403);
  });
});

// ── POST /api/admin/guardrails/test ──────────────────────────────────────────

describe('POST /api/admin/guardrails/test', () => {
  const sampleWorksheet = {
    grade: 3,
    subject: 'Math',
    questions: [{ number: 1, question: 'What is 2+2?', answer: '4', explanation: '2+2=4' }],
  };

  it('returns 200 with validationResult on safe worksheet', async () => {
    const result = await handler(
      mockEvent('POST', '/api/admin/guardrails/test', {
        worksheet: sampleWorksheet,
        guardrailLevel: 'strict',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('validationResult');
    expect(body.validationResult).toHaveProperty('safe');
    expect(body.validationResult).toHaveProperty('validatorsRun');
  });

  it('returns validationResult.safe=false when outputValidator finds issues', async () => {
    mockValidateOutput.mockResolvedValue({
      safe: false,
      failureReason: 'profanity',
      failureDetails: 'Flagged tokens: shit',
      validatorsRun: ['profanityFilter'],
    });
    const result = await handler(
      mockEvent('POST', '/api/admin/guardrails/test', {
        worksheet: sampleWorksheet,
        guardrailLevel: 'strict',
      }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.validationResult.safe).toBe(false);
    expect(body.validationResult.failureReason).toBe('profanity');
  });

  it('returns 400 when worksheet is missing', async () => {
    const result = await handler(
      mockEvent('POST', '/api/admin/guardrails/test', { guardrailLevel: 'strict' }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when guardrailLevel is invalid', async () => {
    const result = await handler(
      mockEvent('POST', '/api/admin/guardrails/test', {
        worksheet: sampleWorksheet,
        guardrailLevel: 'none',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 403 for non-admin role', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('POST', '/api/admin/guardrails/test', {
        worksheet: sampleWorksheet,
      }),
      mockContext
    );
    expect(result.statusCode).toBe(403);
  });
});

// ── GET /api/admin/audit/guardrail-events ────────────────────────────────────

describe('GET /api/admin/audit/guardrail-events', () => {
  const auditEvents = [
    {
      auditId: 'evt-001',
      timestamp: '2026-04-03T10:00:00Z',
      eventType: 'generation.moderation',
      details: { guardrailLevel: 'medium', validationResult: { safe: false, failureReason: 'PROFANITY' }, retryCount: 1 },
    },
    {
      auditId: 'evt-002',
      timestamp: '2026-04-03T11:00:00Z',
      eventType: 'generation.moderation',
      details: { guardrailLevel: 'strict', validationResult: { safe: true, failureReason: null }, retryCount: 0 },
    },
  ];

  beforeEach(() => {
    mockListAll.mockResolvedValue(auditEvents);
  });

  it('returns 200 with events array', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate: '2026-04-03T00:00:00Z',
        endDate:   '2026-04-04T00:00:00Z',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('events');
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('returns 400 when startDate is missing', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        endDate: '2026-04-04T00:00:00Z',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/startDate/i);
  });

  it('returns 400 when endDate is missing', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate: '2026-04-03T00:00:00Z',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when startDate is after endDate', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate: '2026-04-05T00:00:00Z',
        endDate:   '2026-04-04T00:00:00Z',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid failureReason filter', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate:     '2026-04-03T00:00:00Z',
        endDate:       '2026-04-04T00:00:00Z',
        failureReason: 'BANANA',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
  });

  it('filters events by failureReason when provided', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate:     '2026-04-03T00:00:00Z',
        endDate:       '2026-04-04T00:00:00Z',
        failureReason: 'PROFANITY',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    // Only evt-001 has PROFANITY failureReason
    expect(body.events).toHaveLength(1);
    expect(body.events[0].auditId).toBe('evt-001');
  });

  it('returns 403 for STUDENT role', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/audit/guardrail-events', null, {
        startDate: '2026-04-03T00:00:00Z',
        endDate:   '2026-04-04T00:00:00Z',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(403);
  });
});

// ── CORS headers on all response types ────────────────────────────────────────

describe('CORS headers present on all responses', () => {
  it('CORS headers present on 200 success', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 400 error', async () => {
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/policy', { guardrailLevel: 'none', reason: 'x' }),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 403 error', async () => {
    mockVerifyToken.mockReturnValue(studentDecoded);
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/policy'),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 404 unknown route', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/nonexistent'),
      mockContext
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ── Route not found ───────────────────────────────────────────────────────────

describe('handler — route not found', () => {
  it('returns 404 for unrecognized route', async () => {
    const result = await handler(
      mockEvent('GET', '/api/admin/guardrails/nonexistent'),
      mockContext
    );
    expect(result.statusCode).toBe(404);
  });
});

// ── PUT /api/admin/guardrails/templates/:level — token budget enforcement ─────
//
// TOKEN_LIMIT = 120.  estimateTokenCount(text) = Math.ceil(text.length / 4).
// Boundary character counts:
//   Under limit : <= 479 chars  → ceil(479/4) = 120  ✓ (at limit, still allowed)
//   At limit    : 480 chars     → ceil(480/4) = 120  ✓
//   Over limit  : 481 chars     → ceil(481/4) = 121  ✗
//
// All helper strings include [grade] and [age] so placeholder validation passes.

describe('PUT /api/admin/guardrails/templates/:level — token budget enforcement', () => {
  /** Builds a template string of exactly `targetLength` characters that contains
   *  [grade] and [age] placeholders so it passes placeholder validation. */
  function buildTemplate(targetLength) {
    const base = 'Grade [grade] ages [age] ';
    // Pad with safe repeating filler until we reach targetLength
    let result = base;
    while (result.length < targetLength) {
      result += 'x';
    }
    return result.slice(0, targetLength);
  }

  it('accepts a template under 120 tokens (200)', async () => {
    // 60 chars → ceil(60/4) = 15 tokens — well under limit
    const content = buildTemplate(60);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/medium', {
        content,
        reason: 'Short template under token limit',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('accepts a template at exactly 120 tokens — 480 chars (200)', async () => {
    // 480 chars → ceil(480/4) = 120 tokens — exactly at limit, must be allowed
    const content = buildTemplate(480);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content,
        reason: 'Template exactly at the token limit',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });

  it('rejects a template over 120 tokens — 481 chars (400 TOKEN_LIMIT_EXCEEDED)', async () => {
    // 481 chars → ceil(481/4) = 121 tokens — one over limit
    const content = buildTemplate(481);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/medium', {
        content,
        reason: 'Template one char over the token limit',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('TOKEN_LIMIT_EXCEEDED');
    expect(body.tokenCount).toBe(121);
    expect(body.limit).toBe(120);
  });

  it('rejects a very long template with correct tokenCount and limit in response', async () => {
    // 5000-char template → ceil(5000/4) = 1250 tokens
    const content = buildTemplate(5000);
    const result = await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/strict', {
        content,
        reason: 'Very long admin template submission',
      }),
      mockContext
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('TOKEN_LIMIT_EXCEEDED');
    expect(body.tokenCount).toBe(1250);
    expect(body.limit).toBe(120);
  });

  it('does NOT call writeAuditLog when token limit is exceeded', async () => {
    const content = buildTemplate(481);
    await handler(
      mockEvent('PUT', '/api/admin/guardrails/templates/medium', {
        content,
        reason: 'Over-limit template — audit must not be written',
      }),
      mockContext
    );
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

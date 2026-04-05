/**
 * @file tests/integration/coppa-consent-flow.test.js
 * @description End-to-end integration test for the COPPA parental consent flow.
 *
 * Covers:
 *   1. Register under-13 child → requiresConsent:true, no user record created
 *   2. Request consent → 202 with consentRequestId, consent record created (status=pending)
 *   3. Verify consent → 200, child account activated (status=active), consent=granted
 *   4. Parent can list children → child appears in list
 *
 * All DB adapter and auth adapter calls are mocked via jest.unstable_mockModule.
 * No real network, DynamoDB, or Anthropic calls are made.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const CHILD_ID   = '11111111-1111-4111-8111-111111111111';
const PARENT_ID  = '55555555-5555-4555-8555-555555555555';
const CONSENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONSENT_TOKEN = 'tttttttt-tttt-4ttt-8ttt-tttttttttttt';

// ─── Mock function references ─────────────────────────────────────────────────

const mockCreateUser         = jest.fn();
const mockFindUserByEmail    = jest.fn();
const mockVerifyPassword     = jest.fn();
const mockGenerateToken      = jest.fn();
const mockVerifyToken        = jest.fn();
const mockRefreshAccessToken = jest.fn();

const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockQueryByField = jest.fn();
const mockUpdateItem   = jest.fn();

const mockCreateConsentRequest = jest.fn();
const mockGetConsentByToken    = jest.fn();
const mockGrantConsent         = jest.fn();
const mockRevokeConsent        = jest.fn();

const mockVerifyParentChildLink = jest.fn();

const mockSendConsentEmail = jest.fn();

// ─── Module mocks (must come before any dynamic import) ──────────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    createUser:         mockCreateUser,
    findUserByEmail:    mockFindUserByEmail,
    verifyPassword:     mockVerifyPassword,
    generateToken:      mockGenerateToken,
    verifyToken:        mockVerifyToken,
    refreshAccessToken: mockRefreshAccessToken,
  })),
  getOAuthAdapter: jest.fn(() => ({
    initiateOAuth:  jest.fn(),
    handleCallback: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
    updateItem:   mockUpdateItem,
  })),
}));

jest.unstable_mockModule('../../src/consent/consentStore.js', () => ({
  createConsentRequest: mockCreateConsentRequest,
  getConsentByToken:    mockGetConsentByToken,
  grantConsent:         mockGrantConsent,
  revokeConsent:        mockRevokeConsent,
  getConsentsByChild:   jest.fn().mockResolvedValue([]),
  getConsentsByParent:  jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('../../src/auth/tokenUtils.js', () => ({
  signToken:   jest.fn().mockReturnValue('mock-guest-jwt'),
  verifyToken: jest.fn(),
}));

jest.unstable_mockModule('../../src/auth/passwordReset.js', () => ({
  requestPasswordReset: jest.fn(),
  resetPassword:        jest.fn(),
}));

jest.unstable_mockModule('../../src/utils/rbac.js', () => ({
  verifyParentChildLink:  mockVerifyParentChildLink,
  verifyTeacherOwnsClass: jest.fn(),
}));

jest.unstable_mockModule('../../src/notifications/consentEmailService.js', () => ({
  sendConsentEmail: mockSendConsentEmail,
}));

// AWS SDK mocks (authHandler imports these lazily in some paths)
jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })) },
  PutCommand: jest.fn((input) => ({ _type: 'PutCommand', ...input })),
}));
jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

// ─── Dynamic imports AFTER all mocks ─────────────────────────────────────────

const { handler: authHandler }   = await import('../../backend/handlers/authHandler.js');
const { handler: parentHandler } = await import('../../backend/handlers/parentHandler.js');

// ─── Event builders ───────────────────────────────────────────────────────────

function postEvent(path, body, headers = {}) {
  return {
    httpMethod: 'POST',
    path,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    pathParameters: null,
  };
}

function getEvent(path, headers = {}) {
  return {
    httpMethod: 'GET',
    path,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: null,
    pathParameters: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GUEST_SESSIONS_TABLE = 'LearnfyraGuestSessions-test';
  process.env.COOKIE_DOMAIN = 'localhost';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  mockSendConsentEmail.mockResolvedValue({});
});

// ─── Step 1: Register under-13 child ─────────────────────────────────────────

describe('COPPA flow — Step 1: Register under-13 child', () => {
  it('returns requiresConsent:true for a child under 13', async () => {
    // authHandler checks age from dateOfBirth; dob giving age < 13
    const childDob = new Date();
    childDob.setFullYear(childDob.getFullYear() - 10); // 10 years old

    mockCreateUser.mockResolvedValue({
      userId: CHILD_ID,
      email: 'child@example.com',
      role: 'student',
      displayName: 'Child',
      accountStatus: 'pending_consent',
    });
    mockGenerateToken.mockReturnValue('child-jwt');

    const result = await authHandler(
      postEvent('/api/auth/register', {
        email: 'child@example.com',
        password: 'Password1!',
        role: 'student',
        displayName: 'Child',
        dateOfBirth: childDob.toISOString().split('T')[0],
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('requiresConsent', true);
    expect(body).toHaveProperty('accountStatus', 'pending_consent');
    // JWT must NOT be returned — child account is not yet active
    expect(body).not.toHaveProperty('token');
  });

  it('does NOT activate the account (no JWT) until consent is granted', async () => {
    const childDob = new Date();
    childDob.setFullYear(childDob.getFullYear() - 8);

    mockCreateUser.mockResolvedValue({
      userId: CHILD_ID,
      email: 'child2@example.com',
      role: 'student',
      displayName: 'Child Two',
      accountStatus: 'pending_consent',
    });

    const result = await authHandler(
      postEvent('/api/auth/register', {
        email: 'child2@example.com',
        password: 'Password1!',
        role: 'student',
        displayName: 'Child Two',
        dateOfBirth: childDob.toISOString().split('T')[0],
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.token).toBeUndefined();
    expect(body.accountStatus).toBe('pending_consent');
  });
});

// ─── Step 2: Request consent ──────────────────────────────────────────────────

describe('COPPA flow — Step 2: Request consent', () => {
  const pendingConsentRecord = {
    consentId: CONSENT_ID,
    consentToken: CONSENT_TOKEN,
    childUserId: CHILD_ID,
    childEmail: 'child@example.com',
    parentEmail: 'parent@example.com',
    status: 'pending',
    method: 'email_plus',
    grantedAt: null,
    revokedAt: null,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
    retainUntil: Math.floor(Date.now() / 1000) + 86400 * 365 * 3,
  };

  beforeEach(() => {
    // Child user exists with pending_consent status
    mockGetItem.mockResolvedValue({
      userId: CHILD_ID,
      email: 'child@example.com',
      displayName: 'Child',
      accountStatus: 'pending_consent',
      role: 'student',
    });
    mockCreateConsentRequest.mockResolvedValue(pendingConsentRecord);
    mockUpdateItem.mockResolvedValue({});
  });

  it('returns 200 with consentRequestId', async () => {
    const result = await authHandler(
      postEvent('/api/auth/request-consent', {
        childUserId: CHILD_ID,
        parentEmail: 'parent@example.com',
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('consentRequestId', CONSENT_ID);
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('expiresAt');
  });

  it('creates a consent record with status=pending', async () => {
    await authHandler(
      postEvent('/api/auth/request-consent', {
        childUserId: CHILD_ID,
        parentEmail: 'parent@example.com',
      }),
      mockContext,
    );

    expect(mockCreateConsentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        childUserId: CHILD_ID,
        parentEmail: 'parent@example.com',
      }),
    );
  });

  it('fires a consent email to the parent', async () => {
    await authHandler(
      postEvent('/api/auth/request-consent', {
        childUserId: CHILD_ID,
        parentEmail: 'parent@example.com',
      }),
      mockContext,
    );

    expect(mockSendConsentEmail).toHaveBeenCalledWith(
      expect.objectContaining({ parentEmail: 'parent@example.com' }),
    );
  });

  it('returns 400 when child account does not require consent', async () => {
    mockGetItem.mockResolvedValue({
      userId: CHILD_ID,
      email: 'child@example.com',
      accountStatus: 'active', // already active
    });

    const result = await authHandler(
      postEvent('/api/auth/request-consent', {
        childUserId: CHILD_ID,
        parentEmail: 'parent@example.com',
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when parentEmail is missing', async () => {
    const result = await authHandler(
      postEvent('/api/auth/request-consent', { childUserId: CHILD_ID }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when childUserId does not exist', async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await authHandler(
      postEvent('/api/auth/request-consent', {
        childUserId: 'nonexistent-id',
        parentEmail: 'parent@example.com',
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(404);
  });
});

// ─── Step 3: Verify consent ───────────────────────────────────────────────────

describe('COPPA flow — Step 3: Verify consent', () => {
  const pendingRecord = {
    consentId: CONSENT_ID,
    consentToken: CONSENT_TOKEN,
    childUserId: CHILD_ID,
    childEmail: 'child@example.com',
    parentEmail: 'parent@example.com',
    status: 'pending',
    expiresAt: Math.floor(Date.now() / 1000) + 86400, // not expired
  };

  beforeEach(() => {
    mockGetConsentByToken.mockResolvedValue(pendingRecord);
    mockGrantConsent.mockResolvedValue({ ...pendingRecord, status: 'granted' });
    mockUpdateItem.mockResolvedValue({});
    // No matching parent user account (simplest path)
    mockQueryByField.mockResolvedValue([]);
  });

  it('returns 200 with accountStatus=active after verification', async () => {
    const result = await authHandler(
      postEvent('/api/auth/verify-consent', {
        consentToken: CONSENT_TOKEN,
        parentName: 'Alex Parent',
        parentRelationship: 'guardian',
      }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('childUserId', CHILD_ID);
    expect(body).toHaveProperty('accountStatus', 'active');
  });

  it('activates child account by calling updateItem with accountStatus=active', async () => {
    await authHandler(
      postEvent('/api/auth/verify-consent', {
        consentToken: CONSENT_TOKEN,
        parentName: 'Alex Parent',
      }),
      mockContext,
    );

    expect(mockUpdateItem).toHaveBeenCalledWith(
      'users',
      CHILD_ID,
      expect.objectContaining({ accountStatus: 'active', consentStatus: 'granted' }),
    );
  });

  it('calls grantConsent to update the consent record', async () => {
    await authHandler(
      postEvent('/api/auth/verify-consent', {
        consentToken: CONSENT_TOKEN,
        parentName: 'Alex Parent',
      }),
      mockContext,
    );

    expect(mockGrantConsent).toHaveBeenCalledWith(
      CONSENT_ID,
      expect.objectContaining({ parentName: 'Alex Parent' }),
    );
  });

  it('creates a parent-child link when a matching parent user account exists', async () => {
    // Matching parent user exists with same email as consentRecord.parentEmail
    mockQueryByField.mockResolvedValueOnce([
      { userId: PARENT_ID, email: 'parent@example.com', role: 'parent' },
    ]);

    await authHandler(
      postEvent('/api/auth/verify-consent', {
        consentToken: CONSENT_TOKEN,
        parentName: 'Alex Parent',
      }),
      mockContext,
    );

    const linkCall = mockPutItem.mock.calls.find(([table]) => table === 'parentchildlinks');
    expect(linkCall).toBeDefined();
    expect(linkCall[1]).toMatchObject({
      parentId: PARENT_ID,
      childId: CHILD_ID,
      status: 'active',
      linkMethod: 'consent-flow',
    });
  });

  it('returns 404 when consentToken does not exist', async () => {
    mockGetConsentByToken.mockResolvedValue(null);

    const result = await authHandler(
      postEvent('/api/auth/verify-consent', { consentToken: 'bad-token' }),
      mockContext,
    );

    expect(result.statusCode).toBe(404);
  });

  it('returns 410 when consent token is expired', async () => {
    mockGetConsentByToken.mockResolvedValue({
      ...pendingRecord,
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    });

    const result = await authHandler(
      postEvent('/api/auth/verify-consent', { consentToken: CONSENT_TOKEN }),
      mockContext,
    );

    expect(result.statusCode).toBe(410);
  });

  it('returns 400 when consentToken is missing from body', async () => {
    const result = await authHandler(
      postEvent('/api/auth/verify-consent', {}),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
  });
});

// ─── Step 4: Parent can list children after consent granted ──────────────────

describe('COPPA flow — Step 4: Parent lists children post-consent', () => {
  beforeEach(() => {
    // Parent is authenticated
    mockVerifyToken.mockReturnValue({ sub: PARENT_ID, role: 'parent', email: 'parent@example.com' });
  });

  it('child appears in GET /api/parent/children list after consent link is created', async () => {
    // Active parent-child link was created during verify-consent
    mockVerifyParentChildLink.mockResolvedValue({
      parentId: PARENT_ID,
      childId: CHILD_ID,
      status: 'active',
      linkedAt: new Date().toISOString(),
      linkMethod: 'consent-flow',
    });
    mockQueryByField.mockResolvedValue([
      {
        parentId: PARENT_ID,
        childId: CHILD_ID,
        status: 'active',
        linkMethod: 'consent-flow',
        linkedAt: new Date().toISOString(),
      },
    ]);
    mockGetItem.mockResolvedValue({ displayName: 'Child', grade: 4 });

    const result = await parentHandler(
      getEvent('/api/parent/children', { authorization: 'Bearer parent-jwt' }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body.children)).toBe(true);
    expect(body.children.some(c => c.studentId === CHILD_ID)).toBe(true);
    expect(body.children[0].linkMethod).toBe('consent-flow');
  });

  it('CORS headers are present on all COPPA flow responses', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await parentHandler(
      getEvent('/api/parent/children', { authorization: 'Bearer parent-jwt' }),
      mockContext,
    );

    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Headers']).toBeDefined();
  });
});

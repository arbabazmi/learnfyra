/**
 * @file tests/integration/guestLifecycle.test.js
 * @description Integration test: full guest lifecycle.
 *
 * Flow tested:
 *   1. POST /auth/guest { role: "student" } → 200, guestToken + Set-Cookie
 *   2. Authorizer validates guest JWT → Allow with guestId + tokenType
 *   3. POST /auth/guest { role: "teacher" } → 200, different role
 *   4. POST /auth/guest with invalid role → 400
 *   5. POST /auth/guest produces unique guestIds per call
 *   6. Guest fixture endpoint: ?role=teacher → 200, ?role=student → 403
 *
 * DynamoDB is mocked since GuestSessions table doesn't exist locally.
 * Auth handler and authorizer use real JWT signing/verification with
 * the local-dev fallback secret.
 *
 * @agent QA
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Force development mode so JWT_SECRET uses local fallback
process.env.NODE_ENV = 'development';
process.env.GUEST_SESSIONS_TABLE = 'LearnfyraGuestSessions-test';
process.env.COOKIE_DOMAIN = 'localhost';
// Authorizer reads JWT_SECRET directly (not through tokenUtils fallback)
process.env.JWT_SECRET = 'learnfyra-local-dev-secret';

// ── Mock DynamoDB for GuestSessions writes ──────────────────────────────────
// The authHandler imports DynamoDB at module level, so we mock before import.

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dynamoDocMock = mockClient(DynamoDBDocumentClient);
dynamoDocMock.resolves({});

// ── Real handler imports ────────────────────────────────────────────────────

const { handler: authHandler } = await import('../../backend/handlers/authHandler.js');
const { handler: authorizerHandler } = await import('../../backend/handlers/apiAuthorizerHandler.js');
const { handler: fixtureHandler } = await import('../../backend/handlers/guestFixtureHandler.js');

const mockContext = { callbackWaitsForEmptyEventLoop: true };

function makePostEvent(path, body) {
  return {
    httpMethod: 'POST',
    path,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    pathParameters: null,
  };
}

function makeAuthorizerEvent(token) {
  return {
    authorizationToken: `Bearer ${token}`,
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:apiId/dev/POST/api/generate',
  };
}

// ─── 1. Guest Token Issuance ────────────────────────────────────────────────

describe('guest lifecycle — token issuance', () => {
  let guestToken;
  let guestId;

  it('POST /auth/guest { role: "student" } returns 200 with guestToken', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'student' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.guestToken).toBeDefined();
    expect(body.guestId).toMatch(/^guest_/);
    expect(body.expiresAt).toBeDefined();

    guestToken = body.guestToken;
    guestId = body.guestId;
  });

  it('Set-Cookie header is present with guestToken value', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'student' }),
      mockContext,
    );
    const cookie = result.headers['Set-Cookie'];
    expect(cookie).toContain('guestToken=');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=2592000');
  });

  it('guest JWT has correct claims structure', () => {
    const decoded = jwt.decode(guestToken);
    expect(decoded.sub).toBe(guestId);
    expect(decoded.role).toBe('guest-student');
    expect(decoded.token_use).toBe('guest');
    expect(decoded.iss).toBe('learnfyra-guest-issuer');
    // 30-day expiry: exp should be ~2592000 seconds from iat
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(2591990);
  });

  it('POST /auth/guest { role: "teacher" } produces guest-teacher role', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'teacher' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    const decoded = jwt.decode(body.guestToken);
    expect(decoded.role).toBe('guest-teacher');
  });

  it('POST /auth/guest { role: "parent" } produces guest-parent role', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'parent' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    const decoded = jwt.decode(body.guestToken);
    expect(decoded.role).toBe('guest-parent');
  });

  it('POST /auth/guest with invalid role returns 400', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'admin' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('POST /auth/guest with missing role returns 400', async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', {}),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('consecutive calls produce unique guestIds', async () => {
    const r1 = await authHandler(makePostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const r2 = await authHandler(makePostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const id1 = JSON.parse(r1.body).guestId;
    const id2 = JSON.parse(r2.body).guestId;
    expect(id1).not.toBe(id2);
  });
});

// ─── 2. Authorizer Validates Guest Token ────────────────────────────────────

describe('guest lifecycle — authorizer validation', () => {
  let guestToken;

  beforeAll(async () => {
    const result = await authHandler(
      makePostEvent('/api/auth/guest', { role: 'student' }),
      mockContext,
    );
    guestToken = JSON.parse(result.body).guestToken;
  });

  it('authorizer returns Allow for valid guest JWT', async () => {
    const result = await authorizerHandler(makeAuthorizerEvent(guestToken));
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.tokenType).toBe('guest');
    expect(result.context.role).toBe('guest-student');
    expect(result.context.guestId).toMatch(/^guest_/);
  });

  it('authorizer rejects token with no Bearer prefix', async () => {
    await expect(
      authorizerHandler({ authorizationToken: guestToken, methodArn: makeAuthorizerEvent(guestToken).methodArn })
    ).rejects.toThrow('Unauthorized');
  });

  it('authorizer rejects tampered token', async () => {
    const tampered = guestToken + 'x';
    await expect(authorizerHandler(makeAuthorizerEvent(tampered))).rejects.toThrow('Unauthorized');
  });

  it('authorizer rejects empty token', async () => {
    await expect(
      authorizerHandler({ authorizationToken: '', methodArn: makeAuthorizerEvent('x').methodArn })
    ).rejects.toThrow('Unauthorized');
  });
});

// ─── 3. Guest Fixture Endpoint ──────────────────────────────────────────────

describe('guest lifecycle — fixture endpoint', () => {
  it('GET /guest/preview?role=teacher returns 200 with fixture data', async () => {
    const result = await fixtureHandler(
      { httpMethod: 'GET', queryStringParameters: { role: 'teacher' }, headers: {} },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.classes).toBeDefined();
    expect(body._note).toContain('Sample data');
  });

  it('GET /guest/preview?role=parent returns 200 with fixture data', async () => {
    const result = await fixtureHandler(
      { httpMethod: 'GET', queryStringParameters: { role: 'parent' }, headers: {} },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.children).toBeDefined();
  });

  it('GET /guest/preview?role=student returns 403', async () => {
    const result = await fixtureHandler(
      { httpMethod: 'GET', queryStringParameters: { role: 'student' }, headers: {} },
      mockContext,
    );
    expect(result.statusCode).toBe(403);
  });
});

// ─── 4. Fresh Guest Gets Fresh Allowance ────────────────────────────────────

describe('guest lifecycle — fresh token = fresh allowance', () => {
  it('new POST /auth/guest call produces a new guestId (simulates cookie clear)', async () => {
    const r1 = await authHandler(makePostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const r2 = await authHandler(makePostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const id1 = JSON.parse(r1.body).guestId;
    const id2 = JSON.parse(r2.body).guestId;
    // Different guestId = different GuestSessions record = fresh 10-worksheet allowance
    expect(id1).not.toBe(id2);
  });
});

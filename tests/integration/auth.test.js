/**
 * @file tests/integration/auth.test.js
 * @description Integration test: full register -> login -> token validation -> logout flow.
 * Uses the real mockAuthAdapter and localDbAdapter (data-local/users.json).
 * Creates a unique test user, verifies the full auth flow, then cleans up.
 * No AWS SDK calls are made — this is a local-only integration test.
 * @agent QA
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// ─── Real implementations — no mocks ─────────────────────────────────────────

// NODE_ENV must be 'development' so tokenUtils uses the local-dev fallback
// secret instead of throwing (JWT_SECRET is not set in CI by default).
process.env.NODE_ENV = 'development';

const { handler }        = await import('../../backend/handlers/authHandler.js');
const { localDbAdapter } = await import('../../src/db/localDbAdapter.js');
const { validateToken }  = await import('../../backend/middleware/authMiddleware.js');

// ─── Test user — unique per run to avoid collision with seed data ─────────────

const TEST_EMAIL        = `integration-auth-${Date.now()}@test.learnfyra.local`;
const TEST_PASSWORD     = 'IntegrationPass1!';
const TEST_ROLE         = 'teacher';
const TEST_DISPLAY_NAME = 'Integration Test Teacher';

let registeredUserId;
let accessToken;

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePostEvent(path, body) {
  return {
    httpMethod: 'POST',
    path,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    pathParameters: null,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  if (registeredUserId) {
    await localDbAdapter.deleteItem('users', registeredUserId);
  }
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe('auth integration — register', () => {

  it('registers a new user and returns 200 with userId and token', async () => {
    const result = await handler(
      makePostEvent('/api/auth/register', {
        email:       TEST_EMAIL,
        password:    TEST_PASSWORD,
        role:        TEST_ROLE,
        displayName: TEST_DISPLAY_NAME,
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('token');
    expect(body.email).toBe(TEST_EMAIL);
    expect(body.role).toBe(TEST_ROLE);
    registeredUserId = body.userId;
    accessToken      = body.token;
  });

  it('returns 409 when registering the same email twice', async () => {
    const result = await handler(
      makePostEvent('/api/auth/register', {
        email:       TEST_EMAIL,
        password:    TEST_PASSWORD,
        role:        TEST_ROLE,
        displayName: TEST_DISPLAY_NAME,
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
  });

});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('auth integration — login', () => {

  it('logs in with valid credentials and returns 200 with a token', async () => {
    const result = await handler(
      makePostEvent('/api/auth/login', {
        email:    TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('token');
    expect(body.userId).toBe(registeredUserId);
    accessToken = body.token; // refresh reference for token-validation suite
  });

  it('returns 401 for wrong password', async () => {
    const result = await handler(
      makePostEvent('/api/auth/login', {
        email:    TEST_EMAIL,
        password: 'WrongPassword!',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const result = await handler(
      makePostEvent('/api/auth/login', {
        email:    'nobody-integration@test.learnfyra.local',
        password: TEST_PASSWORD,
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

});

// ─── Token validation on a protected route ───────────────────────────────────

describe('auth integration — token validation on a protected route', () => {

  it('issued JWT is accepted by validateToken middleware', async () => {
    const event   = { headers: { Authorization: `Bearer ${accessToken}` } };
    const decoded = await validateToken(event);
    expect(decoded).toHaveProperty('sub', registeredUserId);
    expect(decoded).toHaveProperty('email', TEST_EMAIL);
    expect(decoded).toHaveProperty('role', TEST_ROLE);
  });

  it('validateToken rejects a tampered token with statusCode 401', async () => {
    const parts  = accessToken.split('.');
    parts[1]     = Buffer.from(JSON.stringify({ sub: 'hacker', role: 'admin' })).toString('base64url');
    const tampered = parts.join('.');
    const event  = { headers: { authorization: `Bearer ${tampered}` } };
    try {
      await validateToken(event);
      throw new Error('Expected validateToken to throw');
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

  it('validateToken rejects a missing token with statusCode 401', async () => {
    const event = { headers: {} };
    try {
      await validateToken(event);
      throw new Error('Expected validateToken to throw');
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('auth integration — logout', () => {

  it('logout returns 200 with { message: "Logged out." }', async () => {
    const result = await handler(
      makePostEvent('/api/auth/logout', {}),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ message: 'Logged out.' });
  });

});

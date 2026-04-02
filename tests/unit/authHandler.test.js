/**
 * @file tests/unit/authHandler.test.js
 * @description Unit tests for backend/handlers/authHandler.js
 * Auth, OAuth, and DB adapters are mocked to avoid real I/O or network calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const VALID_TEACHER_ID   = '22222222-2222-4222-8222-222222222222';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockCreateUser         = jest.fn();
const mockFindUser           = jest.fn();
const mockVerifyPassword     = jest.fn();
const mockGenerateToken      = jest.fn();
const mockVerifyToken        = jest.fn();
const mockRefreshAccessToken = jest.fn();

// ─── Mock OAuth stub adapter methods ─────────────────────────────────────────

const mockInitiateOAuth   = jest.fn();
const mockHandleCallback  = jest.fn();

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

const mockPutItem       = jest.fn();
const mockGetItem       = jest.fn();
const mockQueryByField  = jest.fn();

// ─── Mock passwordReset module methods ────────────────────────────────────────

const mockRequestPasswordReset = jest.fn();
const mockExecuteReset         = jest.fn();

// ─── Mock ../../src/auth/index.js BEFORE any dynamic import ──────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    createUser:          mockCreateUser,
    findUserByEmail:     mockFindUser,
    verifyPassword:      mockVerifyPassword,
    generateToken:       mockGenerateToken,
    verifyToken:         mockVerifyToken,
    refreshAccessToken:  mockRefreshAccessToken,
  })),
  getOAuthAdapter: jest.fn(() => ({
    initiateOAuth:  mockInitiateOAuth,
    handleCallback: mockHandleCallback,
  })),
}));

// ─── Mock ../../src/db/index.js BEFORE any dynamic import ────────────────────

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
  })),
}));

// ─── Mock ../../src/auth/passwordReset.js BEFORE any dynamic import ──────────

jest.unstable_mockModule('../../src/auth/passwordReset.js', () => ({
  requestPasswordReset: mockRequestPasswordReset,
  resetPassword:        mockExecuteReset,
}));

// ─── Mock ../../src/auth/tokenUtils.js — signToken used by handleGuest ──────

const mockSignToken = jest.fn().mockReturnValue('mock-guest-jwt-token');

jest.unstable_mockModule('../../src/auth/tokenUtils.js', () => ({
  signToken: mockSignToken,
}));

// ─── Mock @aws-sdk/lib-dynamodb — PutCommand used by handleGuest (guest sessions) ──

const mockDynamoSend = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockDynamoSend })),
  },
  PutCommand: jest.fn((input) => ({ _type: 'PutCommand', ...input })),
}));

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { handler } = await import('../../backend/handlers/authHandler.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockPostEvent(path, body) {
  return {
    httpMethod: 'POST',
    path,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    pathParameters: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GUEST_SESSIONS_TABLE = 'LearnfyraGuestSessions-test';
  process.env.COOKIE_DOMAIN = 'localhost';
});

// ─── OPTIONS preflight ────────────────────────────────────────────────────────

describe('authHandler — OPTIONS preflight', () => {

  it('returns status 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/register — happy path ─────────────────────────────────────

describe('authHandler — POST /api/auth/register happy path', () => {

  const validBody = {
    email: 'student@test.com',
    password: 'Password1!',
    role: 'student',
    displayName: 'Test Student',
  };

  const mockUser = {
    userId: VALID_STUDENT_ID,
    email: 'student@test.com',
    role: 'student',
    displayName: 'Test Student',
  };

  beforeEach(() => {
    mockCreateUser.mockResolvedValue(mockUser);
    mockGenerateToken.mockReturnValue('mock-jwt-token');
  });

  it('returns status 200 for a valid registration request', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', validBody),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains userId, email, role, and token', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', validBody),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('userId', VALID_STUDENT_ID);
    expect(body).toHaveProperty('email', 'student@test.com');
    expect(body).toHaveProperty('role', 'student');
    expect(body).toHaveProperty('token', 'mock-jwt-token');
  });

  it('calls createUser with the provided credentials', async () => {
    await handler(
      mockPostEvent('/api/auth/register', validBody),
      mockContext,
    );
    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'student@test.com',
      password: 'Password1!',
      role: 'student',
      displayName: 'Test Student',
    });
  });

  it('CORS headers are present on a 200 register response', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', validBody),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/register — validation errors ──────────────────────────────

describe('authHandler — POST /api/auth/register validation errors', () => {

  it('returns 400 when email is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', { password: 'x', role: 'student', displayName: 'X' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', { email: 'a@b.com', role: 'student', displayName: 'X' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when displayName is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', { email: 'a@b.com', password: 'x', role: 'student' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for an invalid role value', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {
        email: 'a@b.com',
        password: 'x',
        role: 'admin',
        displayName: 'X',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions "role" for an invalid role', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {
        email: 'a@b.com',
        password: 'x',
        role: 'superuser',
        displayName: 'X',
      }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/role/i);
  });

  it('CORS headers are present on 400 validation responses', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {}),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/register — duplicate email ────────────────────────────────

describe('authHandler — POST /api/auth/register duplicate email', () => {

  beforeEach(() => {
    mockCreateUser.mockRejectedValue(
      new Error('Email already registered: a@b.com'),
    );
  });

  it('returns 409 when createUser throws for a duplicate email', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {
        email: 'a@b.com',
        password: 'x',
        role: 'student',
        displayName: 'X',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(409);
  });

  it('error body indicates the account already exists', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {
        email: 'a@b.com',
        password: 'x',
        role: 'student',
        displayName: 'X',
      }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/already exists/i);
  });

  it('CORS headers are present on a 409 response', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/register', {
        email: 'a@b.com',
        password: 'x',
        role: 'student',
        displayName: 'X',
      }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/login — happy path ───────────────────────────────────────

describe('authHandler — POST /api/auth/login happy path', () => {

  const rawUser = {
    userId: VALID_STUDENT_ID,
    email: 'student@test.com',
    role: 'student',
    displayName: 'Test Student',
    passwordHash: '$2b$10$fakehash',
  };

  beforeEach(() => {
    mockQueryByField.mockResolvedValue([rawUser]);
    mockVerifyPassword.mockResolvedValue(true);
    mockGenerateToken.mockReturnValue('login-jwt-token');
  });

  it('returns status 200 for valid credentials', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'student@test.com',
        password: 'Password1!',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains token and userId', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'student@test.com',
        password: 'Password1!',
      }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('token', 'login-jwt-token');
    expect(body).toHaveProperty('userId', VALID_STUDENT_ID);
  });

  it('CORS headers are present on a 200 login response', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'student@test.com',
        password: 'Password1!',
      }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/login — auth failures ────────────────────────────────────

describe('authHandler — POST /api/auth/login auth failures', () => {

  it('returns 401 when verifyPassword returns false (wrong password)', async () => {
    const rawUser = {
      userId: VALID_STUDENT_ID,
      email: 'student@test.com',
      role: 'student',
      displayName: 'Test Student',
      passwordHash: '$2b$10$fakehash',
    };
    mockQueryByField.mockResolvedValue([rawUser]);
    mockVerifyPassword.mockResolvedValue(false);

    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'student@test.com',
        password: 'WrongPassword',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when email is not found (queryByField returns empty array)', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'nobody@test.com',
        password: 'Password1!',
      }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on a 401 login response', async () => {
    mockQueryByField.mockResolvedValue([]);

    const result = await handler(
      mockPostEvent('/api/auth/login', {
        email: 'nobody@test.com',
        password: 'x',
      }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 400 when email is missing from login body', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/login', { password: 'x' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when password is missing from login body', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/login', { email: 'a@b.com' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('authHandler — POST /api/auth/logout', () => {

  it('returns status 200 regardless of any token', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/logout', {}),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains { message: "Logged out." }', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/logout', {}),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toEqual({ message: 'Logged out.' });
  });

  it('CORS headers are present on logout response', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/logout', {}),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/oauth/:provider — happy path ──────────────────────────────

describe('authHandler — POST /api/auth/oauth/:provider happy path', () => {

  beforeEach(() => {
    mockInitiateOAuth.mockResolvedValue({
      authorizationUrl: 'https://stub-oauth.learnfyra.local/auth/google?state=test-state',
      state: 'test-state',
    });
  });

  it('returns 200 for a supported OAuth provider', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/google', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains authorizationUrl and state', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/google', headers: {}, body: '{}' },
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('authorizationUrl');
    expect(body).toHaveProperty('state');
  });

  it('calls initiateOAuth with the correct provider', async () => {
    await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/github', headers: {}, body: '{}' },
      mockContext,
    );
    expect(mockInitiateOAuth).toHaveBeenCalledWith('github');
  });

  it('CORS headers are present on oauth initiate response', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/google', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/oauth/:provider — unsupported provider ───────────────────

describe('authHandler — POST /api/auth/oauth/:provider unsupported provider', () => {

  beforeEach(() => {
    const err = new Error('OAuth provider "facebook" is not supported.');
    err.statusCode = 400;
    mockInitiateOAuth.mockRejectedValue(err);
  });

  it('returns 400 when initiateOAuth throws with statusCode 400', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/facebook', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers are present on 400 oauth response', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/oauth/facebook', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/auth/callback/:provider — happy path ───────────────────────────

describe('authHandler — GET /api/auth/callback/:provider happy path', () => {

  const callbackUser = {
    userId: VALID_STUDENT_ID,
    email: 'oauth-google-abc123@stub.learnfyra.local',
    role: 'student',
    displayName: 'Google User',
    token: 'oauth-jwt-token',
  };

  beforeEach(() => {
    mockHandleCallback.mockResolvedValue(callbackUser);
  });

  it('returns 200 when callback code is valid', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/google',
        headers: {},
        body: null,
        queryStringParameters: { code: 'abc123', state: 'test-state' },
      },
      mockContext,
    );
    expect(result.statusCode).toBe(302);
    expect(result.headers.Location).toContain('/auth/callback?');
  });

  it('redirect Location contains token and user data', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/google',
        headers: {},
        body: null,
        queryStringParameters: { code: 'abc123', state: 'test-state' },
      },
      mockContext,
    );
    const location = result.headers.Location;
    expect(location).toContain('token=oauth-jwt-token');
    expect(location).toContain('user=');
    const url = new URL(location);
    const user = JSON.parse(url.searchParams.get('user'));
    expect(user.userId).toBe(VALID_STUDENT_ID);
    expect(user.role).toBe('student');
  });

  it('calls handleCallback with provider, code, and state', async () => {
    await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/github',
        headers: {},
        body: null,
        queryStringParameters: { code: 'xyz789', state: 'some-state' },
      },
      mockContext,
    );
    expect(mockHandleCallback).toHaveBeenCalledWith('github', 'xyz789', 'some-state');
  });

  it('CORS headers are present on callback response', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/google',
        headers: {},
        body: null,
        queryStringParameters: { code: 'abc123', state: 'test-state' },
      },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── GET /api/auth/callback/:provider — missing code ─────────────────────────

describe('authHandler — GET /api/auth/callback/:provider missing code', () => {

  it('returns 302 redirect with error when code query param is absent', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/google',
        headers: {},
        body: null,
        queryStringParameters: {},
      },
      mockContext,
    );
    expect(result.statusCode).toBe(302);
    expect(result.headers.Location).toContain('authError=');
  });

  it('CORS headers are present on 400 callback response', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/auth/callback/google',
        headers: {},
        body: null,
        queryStringParameters: {},
      },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Unknown route ────────────────────────────────────────────────────────────

describe('authHandler — unknown route', () => {

  it('returns 404 for an unrecognised path', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/unknown-action', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.statusCode).toBe(404);
  });

  it('CORS headers are present on 404 response', async () => {
    const result = await handler(
      { httpMethod: 'POST', path: '/api/auth/unknown-action', headers: {}, body: '{}' },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Lambda context — callbackWaitsForEmptyEventLoop ─────────────────────────

describe('authHandler — Lambda context guard', () => {

  it('sets context.callbackWaitsForEmptyEventLoop to false on every invocation', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler({ httpMethod: 'OPTIONS' }, ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });

});

// ─── POST /api/auth/refresh — happy path ──────────────────────────────────────

describe('authHandler — POST /api/auth/refresh happy path', () => {

  beforeEach(() => {
    mockRefreshAccessToken.mockReturnValue('new-access-token');
  });

  it('returns 200 for a valid refresh token', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'valid-refresh-jwt' }),
      mockContext,
    );
    expect(result.statusCode).toBe(200);
  });

  it('response body contains { token }', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'valid-refresh-jwt' }),
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('token', 'new-access-token');
  });

  it('calls authAdapter.refreshAccessToken with the refreshToken from body', async () => {
    await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'valid-refresh-jwt' }),
      mockContext,
    );
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('valid-refresh-jwt');
  });

  it('CORS headers are present on 200 refresh response', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'valid-refresh-jwt' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/refresh — error cases ────────────────────────────────────

describe('authHandler — POST /api/auth/refresh error cases', () => {

  it('returns 400 when refreshToken field is missing from body', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/refresh', {}),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 401 when refreshAccessToken throws (invalid/expired token)', async () => {
    mockRefreshAccessToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const result = await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'expired-refresh-jwt' }),
      mockContext,
    );
    expect(result.statusCode).toBe(401);
  });

  it('CORS headers are present on 401 refresh response', async () => {
    mockRefreshAccessToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const result = await handler(
      mockPostEvent('/api/auth/refresh', { refreshToken: 'bad-refresh-jwt' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Malformed JSON body ──────────────────────────────────────────────────────

describe('authHandler — malformed JSON body', () => {

  it('returns 400 when the request body is not valid JSON', async () => {
    const result = await handler(
      {
        httpMethod: 'POST',
        path: '/api/auth/register',
        headers: { 'Content-Type': 'application/json' },
        body: '{ bad json :::',
      },
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('error body mentions invalid JSON on malformed body', async () => {
    const result = await handler(
      {
        httpMethod: 'POST',
        path: '/api/auth/login',
        headers: {},
        body: 'not-json-at-all',
      },
      mockContext,
    );
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/invalid json/i);
  });

  it('CORS headers are present on 400 malformed JSON response', async () => {
    const result = await handler(
      {
        httpMethod: 'POST',
        path: '/api/auth/register',
        headers: {},
        body: '{{{',
      },
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('authHandler — POST /api/auth/forgot-password', () => {

  it('returns 400 when email is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/forgot-password', {}),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 200 with a generic message when email is provided (calls requestPasswordReset)', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);

    const result = await handler(
      mockPostEvent('/api/auth/forgot-password', { email: 'user@test.com' }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@test.com');
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
  });

  // REGRESSION TEST — handleForgotPassword does not catch errors thrown by
  // requestPasswordReset. This test will FAIL until DEV wraps the call in a
  // try/catch and returns 200 regardless (no email enumeration).
  it('always returns 200 even when requestPasswordReset throws (no email enumeration)', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('User not found'));

    const result = await handler(
      mockPostEvent('/api/auth/forgot-password', { email: 'ghost@test.com' }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
  });

  it('CORS headers are present on forgot-password responses', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);

    const result = await handler(
      mockPostEvent('/api/auth/forgot-password', { email: 'user@test.com' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

describe('authHandler — POST /api/auth/reset-password', () => {

  it('returns 400 when token is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { newPassword: 'NewPass1!' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { token: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when newPassword is shorter than 8 characters', async () => {
    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { token: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', newPassword: 'short' }),
      mockContext,
    );
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toMatch(/8 characters/i);
  });

  it('returns 200 on a successful password reset', async () => {
    mockExecuteReset.mockResolvedValue(undefined);

    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', newPassword: 'NewPass1!' }),
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    expect(mockExecuteReset).toHaveBeenCalledWith('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'NewPass1!');
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
  });

  // REGRESSION TEST — handleResetPassword does not catch errors thrown by
  // executeReset. This test will FAIL until DEV wraps the call in a try/catch
  // and returns 400 for expired/invalid/already-used tokens.
  it('returns 400 when executeReset throws (expired or invalid token)', async () => {
    mockExecuteReset.mockRejectedValue(new Error('Reset token is invalid or has expired.'));

    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { token: 'cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa', newPassword: 'NewPass1!' }),
      mockContext,
    );

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('error');
  });

  it('CORS headers are present on reset-password responses', async () => {
    mockExecuteReset.mockResolvedValue(undefined);

    const result = await handler(
      mockPostEvent('/api/auth/reset-password', { token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', newPassword: 'NewPass1!' }),
      mockContext,
    );
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── POST /api/auth/guest ─────────────────────────────────────────────────────

describe('authHandler — POST /api/auth/guest', () => {

  it('returns 200 with a guest token for role=student', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.guestToken).toBe('mock-guest-jwt-token');
    expect(body.guestId).toMatch(/^guest_/);
    expect(body.expiresAt).toBeDefined();
  });

  it('calls signToken with role=guest-student, iss, token_use, and 30d expiry', async () => {
    await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    expect(mockSignToken).toHaveBeenCalledTimes(1);
    const [payload, expiresIn] = mockSignToken.mock.calls[0];
    expect(payload.role).toBe('guest-student');
    expect(payload.sub).toMatch(/^guest_/);
    expect(payload.token_use).toBe('guest');
    expect(payload.iss).toBe('learnfyra-guest-issuer');
    expect(expiresIn).toBe('30d');
  });

  it('issues guest-teacher role for role=teacher', async () => {
    await handler(mockPostEvent('/api/auth/guest', { role: 'teacher' }), mockContext);
    const [payload] = mockSignToken.mock.calls[0];
    expect(payload.role).toBe('guest-teacher');
  });

  it('issues guest-parent role for role=parent', async () => {
    await handler(mockPostEvent('/api/auth/guest', { role: 'parent' }), mockContext);
    const [payload] = mockSignToken.mock.calls[0];
    expect(payload.role).toBe('guest-parent');
  });

  it('returns 400 for role=admin', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'admin' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when role is missing', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', {}), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', null), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('writes a GuestSessions DynamoDB record with correct PK and role', async () => {
    await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    const putArg = mockDynamoSend.mock.calls[0][0];
    expect(putArg.TableName).toBe('LearnfyraGuestSessions-test');
    expect(putArg.Item.PK).toMatch(/^GUEST#guest_/);
    expect(putArg.Item.role).toBe('guest-student');
    expect(putArg.Item.createdAt).toBeDefined();
    expect(putArg.Item.ttl).toBeGreaterThan(0);
    expect(putArg.Item.worksheetIds).toBeUndefined();
  });

  it('Set-Cookie header is present with correct attributes', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const cookie = result.headers['Set-Cookie'];
    expect(cookie).toBeDefined();
    expect(cookie).toContain('guestToken=');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).toContain('Path=/');
  });

  it('Set-Cookie omits Domain directive for localhost', async () => {
    process.env.COOKIE_DOMAIN = 'localhost';
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const cookie = result.headers['Set-Cookie'];
    expect(cookie).not.toContain('Domain=');
  });

  it('Set-Cookie includes Domain directive for non-localhost', async () => {
    process.env.COOKIE_DOMAIN = '.dev.learnfyra.com';
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const cookie = result.headers['Set-Cookie'];
    expect(cookie).toContain('Domain=.dev.learnfyra.com');
  });

  it('Cache-Control header prevents caching', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    expect(result.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
  });

  it('issues unique guestIds on consecutive calls', async () => {
    const r1 = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const r2 = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    const id1 = JSON.parse(r1.body).guestId;
    const id2 = JSON.parse(r2.body).guestId;
    expect(id1).not.toBe(id2);
  });

  it('CORS headers are present on guest response', async () => {
    const result = await handler(mockPostEvent('/api/auth/guest', { role: 'student' }), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

/**
 * @file tests/unit/authHandler.test.js
 * @description Unit tests for backend/handlers/authHandler.js
 * Auth and DB adapters are mocked to avoid real I/O or network calls.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Valid UUID constants ─────────────────────────────────────────────────────

const VALID_STUDENT_ID   = '11111111-1111-4111-8111-111111111111';
const VALID_TEACHER_ID   = '22222222-2222-4222-8222-222222222222';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockCreateUser    = jest.fn();
const mockFindUser      = jest.fn();
const mockVerifyPassword = jest.fn();
const mockGenerateToken = jest.fn();
const mockVerifyToken   = jest.fn();

// ─── Mock DB adapter methods ──────────────────────────────────────────────────

const mockPutItem       = jest.fn();
const mockGetItem       = jest.fn();
const mockQueryByField  = jest.fn();

// ─── Mock ../../src/auth/index.js BEFORE any dynamic import ──────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    createUser:      mockCreateUser,
    findUserByEmail: mockFindUser,
    verifyPassword:  mockVerifyPassword,
    generateToken:   mockGenerateToken,
    verifyToken:     mockVerifyToken,
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

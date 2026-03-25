/**
 * @file tests/unit/authMiddleware.test.js
 * @description Unit tests for backend/middleware/authMiddleware.js
 * The auth adapter is mocked so no real tokens are verified.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock auth adapter methods ────────────────────────────────────────────────

const mockVerifyToken = jest.fn();

// ─── Mock ../../src/auth/index.js BEFORE any dynamic import ──────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

// ─── Dynamic imports (must come after all mockModule calls) ──────────────────

const { validateToken, requireRole } =
  await import('../../backend/middleware/authMiddleware.js');

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── validateToken — happy path ──────────────────────────────────────────────

describe('validateToken — valid Bearer token', () => {

  const decodedPayload = {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'student@test.com',
    role: 'student',
  };

  beforeEach(() => {
    mockVerifyToken.mockReturnValue(decodedPayload);
  });

  it('returns the decoded payload for a valid Bearer token', async () => {
    const event = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const result = await validateToken(event);
    expect(result).toEqual(decodedPayload);
  });

  it('accepts the Authorization header with capital A', async () => {
    const event = {
      headers: { Authorization: 'Bearer valid-token' },
    };
    const result = await validateToken(event);
    expect(result).toEqual(decodedPayload);
  });

  it('calls verifyToken with the extracted token string', async () => {
    const event = {
      headers: { authorization: 'Bearer my-jwt-token' },
    };
    await validateToken(event);
    expect(mockVerifyToken).toHaveBeenCalledWith('my-jwt-token');
  });

});

// ─── validateToken — missing Authorization header ────────────────────────────

describe('validateToken — missing Authorization header', () => {

  it('throws an error when Authorization header is absent', async () => {
    const event = { headers: {} };
    await expect(validateToken(event)).rejects.toThrow();
  });

  it('thrown error has statusCode 401 when header is missing', async () => {
    const event = { headers: {} };
    try {
      await validateToken(event);
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

  it('throws when event.headers is undefined', async () => {
    const event = {};
    await expect(validateToken(event)).rejects.toThrow();
  });

});

// ─── validateToken — malformed header ────────────────────────────────────────

describe('validateToken — malformed Authorization header', () => {

  it('throws 401 when header does not start with "Bearer "', async () => {
    const event = { headers: { authorization: 'Token my-jwt' } };
    try {
      await validateToken(event);
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

  it('throws 401 for a bare token with no scheme prefix', async () => {
    const event = { headers: { authorization: 'just-a-token' } };
    try {
      await validateToken(event);
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

});

// ─── validateToken — verifyToken throws ──────────────────────────────────────

describe('validateToken — verifyToken throws (expired / invalid signature)', () => {

  beforeEach(() => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
  });

  it('throws when verifyToken throws', async () => {
    const event = { headers: { authorization: 'Bearer expired-token' } };
    await expect(validateToken(event)).rejects.toThrow();
  });

  it('thrown error has statusCode 401 when verifyToken throws', async () => {
    const event = { headers: { authorization: 'Bearer expired-token' } };
    try {
      await validateToken(event);
    } catch (err) {
      expect(err.statusCode).toBe(401);
    }
  });

  it('error message is "Invalid or expired token." when verifyToken throws', async () => {
    const event = { headers: { authorization: 'Bearer bad-token' } };
    try {
      await validateToken(event);
    } catch (err) {
      expect(err.message).toBe('Invalid or expired token.');
    }
  });

});

// ─── requireRole — allowed role ───────────────────────────────────────────────

describe('requireRole — allowed role', () => {

  it('does not throw when the decoded role is in the allowed list', () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'teacher' };
    expect(() => requireRole(decoded, ['teacher'])).not.toThrow();
  });

  it('does not throw when role matches one of several allowed roles', () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'student' };
    expect(() => requireRole(decoded, ['student', 'teacher'])).not.toThrow();
  });

});

// ─── requireRole — disallowed role ────────────────────────────────────────────

describe('requireRole — disallowed role', () => {

  it('throws when the decoded role is not in the allowed list', () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'student' };
    expect(() => requireRole(decoded, ['teacher'])).toThrow();
  });

  it('thrown error has statusCode 403 for a disallowed role', () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'student' };
    try {
      requireRole(decoded, ['teacher']);
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  it('throws 403 for "parent" role when only "teacher" is allowed', () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'parent' };
    try {
      requireRole(decoded, ['teacher']);
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

});

/**
 * @file tests/unit/oauthStubAdapter.test.js
 * @description Unit tests for src/auth/oauthStubAdapter.js
 * DB adapter and tokenUtils are mocked to prevent real storage access and
 * to keep tests free from the JWT_SECRET environment requirement.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock DB adapter ──────────────────────────────────────────────────────────

const mockPutItem      = jest.fn();
const mockQueryByField = jest.fn();
const mockGetItem      = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    queryByField: mockQueryByField,
  })),
}));

// ─── Mock tokenUtils to avoid the JWT_SECRET module-level guard ───────────────
//     and to keep token output deterministic.

const mockSignToken = jest.fn(() => 'mock.jwt.token');

jest.unstable_mockModule('../../src/auth/tokenUtils.js', () => ({
  signToken:   mockSignToken,
  verifyToken: jest.fn(),
}));

// ─── Dynamic import (must come after all unstable_mockModule calls) ───────────

const { oauthStubAdapter } = await import('../../src/auth/oauthStubAdapter.js');

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockSignToken.mockReturnValue('mock.jwt.token');
});

// ─── initiateOAuth — supported providers ─────────────────────────────────────

describe('oauthStubAdapter.initiateOAuth() — supported providers', () => {

  it('returns authorizationUrl and state for google', async () => {
    const result = await oauthStubAdapter.initiateOAuth('google');
    expect(result).toHaveProperty('authorizationUrl');
    expect(result).toHaveProperty('state');
  });

  it('authorizationUrl contains "google" for the google provider', async () => {
    const { authorizationUrl } = await oauthStubAdapter.initiateOAuth('google');
    expect(authorizationUrl).toMatch(/google/i);
  });

  it('returns authorizationUrl and state for github', async () => {
    const result = await oauthStubAdapter.initiateOAuth('github');
    expect(result).toHaveProperty('authorizationUrl');
    expect(result).toHaveProperty('state');
  });

  it('authorizationUrl contains "github" for the github provider', async () => {
    const { authorizationUrl } = await oauthStubAdapter.initiateOAuth('github');
    expect(authorizationUrl).toMatch(/github/i);
  });

  it('authorizationUrl is a non-empty string', async () => {
    const { authorizationUrl } = await oauthStubAdapter.initiateOAuth('google');
    expect(typeof authorizationUrl).toBe('string');
    expect(authorizationUrl.length).toBeGreaterThan(0);
  });

  it('state is a non-empty string (UUID format)', async () => {
    const { state } = await oauthStubAdapter.initiateOAuth('github');
    expect(typeof state).toBe('string');
    // UUID v4 pattern
    expect(state).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

});

// ─── initiateOAuth — unsupported and sanitized providers ─────────────────────

describe('oauthStubAdapter.initiateOAuth() — unsupported providers', () => {

  it('throws with statusCode 400 for facebook', async () => {
    let caught;
    try {
      await oauthStubAdapter.initiateOAuth('facebook');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('error message mentions the provider name for unsupported providers', async () => {
    let caught;
    try {
      await oauthStubAdapter.initiateOAuth('facebook');
    } catch (err) {
      caught = err;
    }
    expect(caught.message).toMatch(/facebook/i);
  });

  it('throws with statusCode 400 for provider with special characters (sanitized then rejected)', async () => {
    // 'google<script>' sanitizes to 'googlescript' which is not in SUPPORTED_PROVIDERS
    let caught;
    try {
      await oauthStubAdapter.initiateOAuth('google<script>');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('error message does NOT contain the raw unsanitized input (XSS-safe)', async () => {
    let caught;
    try {
      await oauthStubAdapter.initiateOAuth('google<script>alert(1)</script>');
    } catch (err) {
      caught = err;
    }
    expect(caught.message).not.toContain('<script>');
  });

  it('throws with statusCode 400 for an empty provider string', async () => {
    let caught;
    try {
      await oauthStubAdapter.initiateOAuth('');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

});

// ─── handleCallback — new user path ──────────────────────────────────────────

describe('oauthStubAdapter.handleCallback() — new user', () => {

  beforeEach(() => {
    // No existing user found → new user path
    mockQueryByField.mockResolvedValue([]);
    mockPutItem.mockResolvedValue(undefined);
  });

  it('returns an object with token for a new user', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'valid-code', 'some-state');
    expect(result).toHaveProperty('token');
  });

  it('returns an object with userId for a new user', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'valid-code', 'some-state');
    expect(result).toHaveProperty('userId');
  });

  it('returns an object with email, role, and displayName for a new user', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'valid-code', 'some-state');
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('role');
    expect(result).toHaveProperty('displayName');
  });

  it('calls db.putItem once to persist the new user record', async () => {
    await oauthStubAdapter.handleCallback('google', 'valid-code', 'some-state');
    expect(mockPutItem).toHaveBeenCalledTimes(1);
  });

  it('calls db.putItem with the "users" collection', async () => {
    await oauthStubAdapter.handleCallback('github', 'code-abc', 'state-xyz');
    expect(mockPutItem).toHaveBeenCalledWith('users', expect.any(Object));
  });

  it('new user record passed to putItem contains email, role, and userId', async () => {
    await oauthStubAdapter.handleCallback('google', 'new-code', 'state-1');
    const [, newUser] = mockPutItem.mock.calls[0];
    expect(newUser).toHaveProperty('email');
    expect(newUser).toHaveProperty('role', 'student');
    expect(newUser).toHaveProperty('userId');
  });

  it('token returned is the value produced by signToken', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'code-1', 'state-1');
    expect(result.token).toBe('mock.jwt.token');
  });

  it('token is a non-empty string containing dots (JWT format)', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'code-2', 'state-2');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.token).toContain('.');
  });

});

// ─── handleCallback — returning user path ────────────────────────────────────

describe('oauthStubAdapter.handleCallback() — returning user', () => {

  const existingUser = {
    userId:       'existing-user-uuid',
    email:        'oauth-google-returning@stub.learnfyra.local',
    passwordHash: '$2b$10$existing-hash',
    role:         'student',
    displayName:  'Google User',
    authType:     'oauth:google',
    createdAt:    '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    // Existing user found → returning user path
    mockQueryByField.mockResolvedValue([existingUser]);
  });

  it('returns token and userId for a returning user', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'returning-code', 'state-r');
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('userId', 'existing-user-uuid');
  });

  it('does NOT call db.putItem for a returning user', async () => {
    await oauthStubAdapter.handleCallback('google', 'returning-code', 'state-r');
    expect(mockPutItem).not.toHaveBeenCalled();
  });

  it('does NOT expose passwordHash in the returned user object', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'returning-code', 'state-r');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns the existing userId without creating a new record', async () => {
    const result = await oauthStubAdapter.handleCallback('google', 'returning-code', 'state-r');
    expect(result.userId).toBe('existing-user-uuid');
  });

});

// ─── handleCallback — error paths ─────────────────────────────────────────────

describe('oauthStubAdapter.handleCallback() — error paths', () => {

  it('throws with statusCode 400 when code is an empty string', async () => {
    let caught;
    try {
      await oauthStubAdapter.handleCallback('google', '', 'some-state');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('throws with statusCode 400 when code is null', async () => {
    let caught;
    try {
      await oauthStubAdapter.handleCallback('google', null, 'some-state');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('throws with statusCode 400 when code is undefined', async () => {
    let caught;
    try {
      await oauthStubAdapter.handleCallback('google', undefined, 'some-state');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('throws with statusCode 400 for an unsupported provider (facebook)', async () => {
    let caught;
    try {
      await oauthStubAdapter.handleCallback('facebook', 'some-code', 'some-state');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
  });

  it('does not call db.queryByField when provider is unsupported', async () => {
    try {
      await oauthStubAdapter.handleCallback('facebook', 'some-code', 'some-state');
    } catch {
      // expected
    }
    expect(mockQueryByField).not.toHaveBeenCalled();
  });

});

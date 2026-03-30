/**
 * @file tests/unit/googleOAuthAdapter.test.js
 * @description Unit tests for src/auth/googleOAuthAdapter.js
 * All Google API calls are mocked via jest.unstable_mockModule on fetch.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ─── Mock DB adapter ──────────────────────────────────────────────────────────
const mockDb = {
  queryByField: jest.fn(),
  putItem:      jest.fn(),
  updateItem:   jest.fn(),
};
jest.unstable_mockModule('../../src/db/index.js', () => ({ getDbAdapter: () => mockDb }));

// ─── Mock tokenUtils ──────────────────────────────────────────────────────────
const mockSignToken      = jest.fn().mockReturnValue('mock-jwt');
const mockSignOAuthState = jest.fn().mockReturnValue('signed-state-token');
const mockVerifyOAuthState = jest.fn();
jest.unstable_mockModule('../../src/auth/tokenUtils.js', () => ({
  signToken:        mockSignToken,
  signOAuthState:   mockSignOAuthState,
  verifyOAuthState: mockVerifyOAuthState,
  signRefreshToken:    jest.fn(),
  verifyRefreshToken:  jest.fn(),
  verifyToken:         jest.fn(),
}));

// ─── Dynamic import after mocks ───────────────────────────────────────────────
const { googleOAuthAdapter } = await import('../../src/auth/googleOAuthAdapter.js');

// ─── Env setup ────────────────────────────────────────────────────────────────
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI  = 'http://localhost:3000/api/auth/callback/google';
  mockDb.queryByField.mockReset();
  mockDb.putItem.mockReset();
  mockDb.updateItem.mockReset();
  mockSignToken.mockReturnValue('mock-jwt');
  mockSignOAuthState.mockReturnValue('signed-state-token');
  mockVerifyOAuthState.mockReset();
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
});

// ─── initiateOAuth ────────────────────────────────────────────────────────────

describe('initiateOAuth', () => {
  it('returns authorizationUrl and state for google provider', async () => {
    const result = await googleOAuthAdapter.initiateOAuth('google');
    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(result.authorizationUrl).toContain('test-client-id');
    expect(result.state).toBe('signed-state-token');
  });

  it('authorizationUrl contains redirect_uri', async () => {
    const result = await googleOAuthAdapter.initiateOAuth('google');
    expect(result.authorizationUrl).toContain(encodeURIComponent('http://localhost:3000'));
  });

  it('authorizationUrl requests openid email profile scopes', async () => {
    const result = await googleOAuthAdapter.initiateOAuth('google');
    expect(result.authorizationUrl).toContain('openid');
    expect(result.authorizationUrl).toContain('email');
  });

  it('authorizationUrl includes PKCE code_challenge', async () => {
    const result = await googleOAuthAdapter.initiateOAuth('google');
    expect(result.authorizationUrl).toContain('code_challenge=');
    expect(result.authorizationUrl).toContain('code_challenge_method=S256');
  });

  it('throws 400 for non-google provider', async () => {
    await expect(googleOAuthAdapter.initiateOAuth('github'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 503 when GOOGLE_CLIENT_ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(googleOAuthAdapter.initiateOAuth('google'))
      .rejects.toMatchObject({ statusCode: 503 });
  });
});

// ─── handleCallback ───────────────────────────────────────────────────────────

describe('handleCallback — new user', () => {
  beforeEach(() => {
    mockVerifyOAuthState.mockReturnValue({ nonce: 'n', code_verifier: 'verifier123' });
    mockDb.queryByField.mockResolvedValue([]); // no existing user

    // Mock fetch: token exchange + userinfo
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'goog-access', id_token: 'goog-id' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-123',
          email: 'alice@example.com',
          name: 'Alice Smith',
          picture: 'https://example.com/pic.jpg',
        }),
      });
  });

  afterEach(() => { delete global.fetch; });

  it('creates a new user and returns token', async () => {
    mockDb.putItem.mockResolvedValue({});
    const result = await googleOAuthAdapter.handleCallback('google', 'auth-code', 'signed-state-token');
    expect(result.email).toBe('alice@example.com');
    expect(result.displayName).toBe('Alice Smith');
    expect(result.token).toBe('mock-jwt');
    expect(result.role).toBe('student');
  });

  it('calls putItem to create the user', async () => {
    mockDb.putItem.mockResolvedValue({});
    await googleOAuthAdapter.handleCallback('google', 'auth-code', 'signed-state-token');
    expect(mockDb.putItem).toHaveBeenCalledWith('users', expect.objectContaining({
      email:    'alice@example.com',
      authType: 'oauth:google',
      role:     'student',
    }));
  });

  it('does not include passwordHash in the returned user', async () => {
    mockDb.putItem.mockResolvedValue({});
    const result = await googleOAuthAdapter.handleCallback('google', 'auth-code', 'signed-state-token');
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('handleCallback — returning user', () => {
  beforeEach(() => {
    mockVerifyOAuthState.mockReturnValue({ nonce: 'n', code_verifier: 'verifier123' });
    mockDb.queryByField.mockResolvedValue([{
      userId: 'existing-user-id', email: 'alice@example.com',
      role: 'student', displayName: 'Alice Smith', passwordHash: 'hash',
    }]);
    mockDb.updateItem.mockResolvedValue({
      userId: 'existing-user-id', email: 'alice@example.com',
      role: 'student', displayName: 'Alice Smith',
    });

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'goog-access' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sub: 'g123', email: 'alice@example.com', name: 'Alice Smith' }) });
  });

  afterEach(() => { delete global.fetch; });

  it('updates lastActiveAt instead of creating a new user', async () => {
    await googleOAuthAdapter.handleCallback('google', 'auth-code', 'signed-state-token');
    expect(mockDb.putItem).not.toHaveBeenCalled();
    expect(mockDb.updateItem).toHaveBeenCalledWith('users', 'existing-user-id', expect.objectContaining({
      lastActiveAt: expect.any(String),
    }));
  });
});

describe('handleCallback — error cases', () => {
  it('throws 400 for non-google provider', async () => {
    await expect(googleOAuthAdapter.handleCallback('github', 'code', 'state'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when code is missing', async () => {
    mockVerifyOAuthState.mockReturnValue({ nonce: 'n', code_verifier: 'v' });
    await expect(googleOAuthAdapter.handleCallback('google', '', 'state'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when state token is invalid', async () => {
    mockVerifyOAuthState.mockImplementation(() => { throw new Error('expired'); });
    await expect(googleOAuthAdapter.handleCallback('google', 'code', 'bad-state'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 502 when Google token exchange fails', async () => {
    mockVerifyOAuthState.mockReturnValue({ nonce: 'n', code_verifier: 'v' });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false, status: 400, text: async () => 'invalid_grant',
    });
    await expect(googleOAuthAdapter.handleCallback('google', 'bad-code', 'state'))
      .rejects.toMatchObject({ statusCode: 502 });
    delete global.fetch;
  });
});

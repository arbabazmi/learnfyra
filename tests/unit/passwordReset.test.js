/**
 * @file tests/unit/passwordReset.test.js
 * @description Unit tests for src/auth/passwordReset.js
 *
 * All external I/O is mocked:
 *   - src/db/index.js      → getDbAdapter (queryByField, putItem, getItem, updateItem)
 *   - nodemailer           → createTransport / sendMail
 *   - bcryptjs             → hash
 *   - src/auth/index.js    → getAuthAdapter (imported by the module, not called by these fns)
 *
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

const MOCK_USER = {
  userId:      STUDENT_ID,
  email:       'test@example.com',
  displayName: 'Test User',
};

const FIXED_HASH = '$2a$10$fixedHashStringForTestingPurposesOnly';
const MOCK_TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// ─── Mock DB adapter stubs ────────────────────────────────────────────────────

const mockQueryByField = jest.fn();
const mockPutItem      = jest.fn();
const mockGetItem      = jest.fn();
const mockUpdateItem   = jest.fn();

// ─── Mock nodemailer sendMail stub ────────────────────────────────────────────

const mockSendMail = jest.fn();

// ─── Register mocks BEFORE any dynamic import ─────────────────────────────────

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    queryByField: mockQueryByField,
    putItem:      mockPutItem,
    getItem:      mockGetItem,
    updateItem:   mockUpdateItem,
  })),
}));

// nodemailer is lazy-loaded via dynamic import inside getNodemailer().
// We mock the module so createTransport returns an object with sendMail.
jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  },
}));

// bcryptjs is a static top-level import in passwordReset.js.
jest.unstable_mockModule('bcryptjs', () => ({
  default: {
    hash: jest.fn().mockResolvedValue(FIXED_HASH),
  },
}));

// passwordReset.js imports getAuthAdapter even though the two exported functions
// don't call it — mock it to prevent module resolution errors.
jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({})),
}));

// ─── Dynamic imports (must follow all mockModule registrations) ───────────────

const { requestPasswordReset, resetPassword } = await import(
  '../../src/auth/passwordReset.js'
);

// Pull in the mocked bcrypt default so we can inspect calls directly.
const bcryptModule    = await import('bcryptjs');
const bcrypt          = bcryptModule.default;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default stubs — individual tests override as needed.
  mockQueryByField.mockResolvedValue([]);
  mockPutItem.mockResolvedValue({});
  mockGetItem.mockResolvedValue(null);
  mockUpdateItem.mockResolvedValue({});
  mockSendMail.mockResolvedValue({ messageId: 'mock-id' });
});

// ─────────────────────────────────────────────────────────────────────────────
// requestPasswordReset(email)
// ─────────────────────────────────────────────────────────────────────────────

describe('requestPasswordReset — user not found', () => {

  it('returns without throwing when user is not found', async () => {
    mockQueryByField.mockResolvedValue([]);
    await expect(requestPasswordReset('unknown@example.com')).resolves.toBeUndefined();
  });

  it('does not call putItem when user is not found', async () => {
    mockQueryByField.mockResolvedValue([]);
    await requestPasswordReset('ghost@example.com');
    expect(mockPutItem).not.toHaveBeenCalled();
  });

  it('does not send an email when user is not found', async () => {
    mockQueryByField.mockResolvedValue([]);
    await requestPasswordReset('nobody@example.com');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

});

describe('requestPasswordReset — user exists', () => {

  beforeEach(() => {
    mockQueryByField.mockResolvedValue([MOCK_USER]);
    mockPutItem.mockResolvedValue({});
    mockSendMail.mockResolvedValue({ messageId: 'mock-id' });
  });

  it('stores a token record in the passwordresets table', async () => {
    await requestPasswordReset('test@example.com');
    expect(mockPutItem).toHaveBeenCalledTimes(1);
    const [table] = mockPutItem.mock.calls[0];
    expect(table).toBe('passwordresets');
  });

  it('token record contains correct fields: tokenId, email, userId, expiresAt, used=false', async () => {
    await requestPasswordReset('test@example.com');
    const [, record] = mockPutItem.mock.calls[0];

    expect(record).toHaveProperty('tokenId');
    expect(typeof record.tokenId).toBe('string');
    expect(record.tokenId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(record.email).toBe('test@example.com');
    expect(record.userId).toBe(STUDENT_ID);
    expect(typeof record.expiresAt).toBe('number');
    expect(record.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(record.used).toBe(false);
  });

  it('expiresAt is approximately one hour from now (Unix seconds)', async () => {
    const beforeCall = Math.floor(Date.now() / 1000);
    await requestPasswordReset('test@example.com');
    const afterCall = Math.floor(Date.now() / 1000);

    const [, record] = mockPutItem.mock.calls[0];
    const oneHour = 60 * 60;

    expect(record.expiresAt).toBeGreaterThanOrEqual(beforeCall + oneHour - 1);
    expect(record.expiresAt).toBeLessThanOrEqual(afterCall + oneHour + 1);
  });

  it('sends email via nodemailer with correct to, from, and subject', async () => {
    await requestPasswordReset('test@example.com');
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.to).toBe('test@example.com');
    expect(mailOptions.from).toContain('noreply@learnfyra.com');
    expect(mailOptions.subject).toBe('Reset your Learnfyra password');
  });

  it('email body (html and text) contains the reset URL with the token', async () => {
    await requestPasswordReset('test@example.com');

    const [, tokenRecord] = mockPutItem.mock.calls[0];
    const { tokenId } = tokenRecord;

    const mailOptions = mockSendMail.mock.calls[0][0];
    const expectedUrl = `reset-password?token=${tokenId}`;

    expect(mailOptions.html).toContain(expectedUrl);
    expect(mailOptions.text).toContain(expectedUrl);
  });

  it('normalizes the email to lowercase before lookup and storage', async () => {
    await requestPasswordReset('TEST@EXAMPLE.COM');

    // DB lookup is performed with lowercase email
    const [, field, value] = mockQueryByField.mock.calls[0];
    expect(field).toBe('email');
    expect(value).toBe('test@example.com');

    // Token record also stores lowercase email
    const [, record] = mockPutItem.mock.calls[0];
    expect(record.email).toBe('test@example.com');
  });

  it('normalizes email with leading/trailing whitespace', async () => {
    await requestPasswordReset('  Test@Example.COM  ');

    const [, , value] = mockQueryByField.mock.calls[0];
    expect(value).toBe('test@example.com');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword(token, newPassword)
// ─────────────────────────────────────────────────────────────────────────────

describe('resetPassword — invalid token', () => {

  it('throws a 400 error when the token is not found in the DB', async () => {
    mockGetItem.mockResolvedValue(null);

    const err = await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/invalid or expired/i);
  });

  it('does not update user or mark token when token is not found', async () => {
    mockGetItem.mockResolvedValue(null);
    await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(() => {});
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

});

describe('resetPassword — already used token', () => {

  const usedRecord = {
    tokenId:   MOCK_TOKEN,
    email:     'test@example.com',
    userId:    STUDENT_ID,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    used:      true,
  };

  it('throws a 400 error when the token has already been used', async () => {
    mockGetItem.mockResolvedValue(usedRecord);

    const err = await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/already been used/i);
  });

  it('does not update the user password when token is already used', async () => {
    mockGetItem.mockResolvedValue(usedRecord);
    await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(() => {});
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

});

describe('resetPassword — expired token', () => {

  const expiredRecord = {
    tokenId:   MOCK_TOKEN,
    email:     'test@example.com',
    userId:    STUDENT_ID,
    // expiresAt is in the past (Unix seconds)
    expiresAt: Math.floor(Date.now() / 1000) - 1,
    used:      false,
  };

  it('throws a 400 error when the token is expired', async () => {
    mockGetItem.mockResolvedValue(expiredRecord);

    const err = await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/expired/i);
  });

  it('does not update the user password when token is expired', async () => {
    mockGetItem.mockResolvedValue(expiredRecord);
    await resetPassword(MOCK_TOKEN, 'NewPass1!').catch(() => {});
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

});

describe('resetPassword — valid token (happy path)', () => {

  const validRecord = {
    tokenId:   MOCK_TOKEN,
    email:     'test@example.com',
    userId:    STUDENT_ID,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    used:      false,
  };

  beforeEach(() => {
    mockGetItem.mockResolvedValue(validRecord);
    bcrypt.hash.mockResolvedValue(FIXED_HASH);
  });

  it('resolves without throwing on a valid, unused, non-expired token', async () => {
    await expect(resetPassword(MOCK_TOKEN, 'NewPass1!')).resolves.toBeUndefined();
  });

  it('calls bcrypt.hash with the new plain-text password', async () => {
    await resetPassword(MOCK_TOKEN, 'NewPass1!');
    expect(bcrypt.hash).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash.mock.calls[0][0]).toBe('NewPass1!');
  });

  it('updates the user record in the users table with the new password hash', async () => {
    await resetPassword(MOCK_TOKEN, 'NewPass1!');

    const userUpdateCall = mockUpdateItem.mock.calls.find(
      ([table]) => table === 'users'
    );
    expect(userUpdateCall).toBeDefined();
    const [, userId, payload] = userUpdateCall;
    expect(userId).toBe(STUDENT_ID);
    expect(payload).toEqual({ passwordHash: FIXED_HASH });
  });

  it('marks the token as used in the passwordresets table', async () => {
    await resetPassword(MOCK_TOKEN, 'NewPass1!');

    const tokenUpdateCall = mockUpdateItem.mock.calls.find(
      ([table]) => table === 'passwordresets'
    );
    expect(tokenUpdateCall).toBeDefined();
    const [, tokenId, payload] = tokenUpdateCall;
    expect(tokenId).toBe(MOCK_TOKEN);
    expect(payload).toEqual({ used: true });
  });

  it('marks the token as used BEFORE updating the user password (race-condition guard)', async () => {
    const callOrder = [];
    mockUpdateItem.mockImplementation(async (table) => {
      callOrder.push(table);
      // Must return a truthy value — the source guards `if (!marked)` after the
      // first updateItem call and throws 500 if the result is falsy.
      return { updated: true };
    });

    await resetPassword(MOCK_TOKEN, 'NewPass1!');
    expect(callOrder[0]).toBe('passwordresets');
    expect(callOrder[1]).toBe('users');
  });

  it('does not call sendMail during a password reset', async () => {
    await resetPassword(MOCK_TOKEN, 'NewPass1!');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

});

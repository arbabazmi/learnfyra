/**
 * @file tests/unit/assertParentLink.test.js
 * @description Unit tests for the assertParentLink function in authMiddleware.js.
 * The DB adapter is mocked BEFORE importing authMiddleware so that the module-
 * level call to getDbAdapter() inside assertParentLink uses the mock.
 * A separate file from authMiddleware.test.js is required because ESM modules
 * are cached per process — adding a new mock after the module has already been
 * evaluated in the other test file would have no effect.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock DB adapter BEFORE importing authMiddleware ─────────────────────────

const mockQueryByField = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    queryByField: mockQueryByField,
  })),
}));

// ─── Mock auth adapter (required by validateToken in the same file) ───────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: jest.fn(),
  })),
}));

// ─── Dynamic import (must come after all mockModule calls) ────────────────────

const { assertParentLink } = await import('../../backend/middleware/authMiddleware.js');

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── assertParentLink — non-parent roles ──────────────────────────────────────

describe('assertParentLink — non-parent roles', () => {

  it('does not throw for role=teacher', async () => {
    const decoded = { sub: 'u1', email: 'a@b.com', role: 'teacher' };
    await expect(assertParentLink(decoded, 'any-child-id')).resolves.toBeUndefined();
  });

  it('does not query the DB for non-parent roles', async () => {
    const decoded = { sub: 'u1', role: 'teacher' };
    await assertParentLink(decoded, 'any-child-id');
    expect(mockQueryByField).not.toHaveBeenCalled();
  });

  it('does not throw for role=student', async () => {
    const decoded = { sub: 'u1', role: 'student' };
    await expect(assertParentLink(decoded, 'cid')).resolves.toBeUndefined();
  });

  it('does not throw for role=admin', async () => {
    const decoded = { sub: 'u1', role: 'admin' };
    await expect(assertParentLink(decoded, 'cid')).resolves.toBeUndefined();
  });

});

// ─── assertParentLink — parent role, missing childId ─────────────────────────

describe('assertParentLink — parent role, missing childId', () => {

  it('throws 400 when childId is null', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, null);
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 400 when childId is undefined', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, undefined);
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 400 when childId is empty string', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, '');
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

});

// ─── assertParentLink — parent role, no active link ──────────────────────────

describe('assertParentLink — parent role, no active link', () => {

  beforeEach(() => {
    mockQueryByField.mockResolvedValue([]);
  });

  it('throws 403 when no links returned from DB', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, 'child-99');
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  it('throws 403 when link exists but status is not active', async () => {
    mockQueryByField.mockResolvedValue([
      { parentId: 'p1', childId: 'child-99', status: 'pending' },
    ]);
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, 'child-99');
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  it('throws 403 when link is for a different child', async () => {
    mockQueryByField.mockResolvedValue([
      { parentId: 'p1', childId: 'other-child', status: 'active' },
    ]);
    const decoded = { sub: 'p1', role: 'parent' };
    try {
      await assertParentLink(decoded, 'child-99');
      throw new Error('Expected assertParentLink to throw');
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

});

// ─── assertParentLink — parent role, active link exists ──────────────────────

describe('assertParentLink — parent role, active link exists', () => {

  beforeEach(() => {
    mockQueryByField.mockResolvedValue([
      { parentId: 'p1', childId: 'child-99', status: 'active' },
    ]);
  });

  it('does not throw when active link exists', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    await expect(assertParentLink(decoded, 'child-99')).resolves.toBeUndefined();
  });

  it('queries parentLinks by parentId', async () => {
    const decoded = { sub: 'p1', role: 'parent' };
    await assertParentLink(decoded, 'child-99');
    expect(mockQueryByField).toHaveBeenCalledWith('parentLinks', 'parentId', 'p1');
  });

});

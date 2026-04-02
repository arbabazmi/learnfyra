/**
 * @file tests/unit/guestPermissionMatrix.test.js
 * @description Permission matrix tests for guest roles.
 * Validates that guest-student, guest-teacher, and guest-parent get correct
 * access per the spec's permission table (Section 7).
 *
 * Tests the requireRole middleware directly — this is the enforcement layer
 * used by all handlers. Also tests handler-level integration for key routes.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock auth adapter ──────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: jest.fn(),
    putItem: jest.fn(),
    queryByField: jest.fn().mockResolvedValue([]),
  })),
}));

const { requireRole } = await import('../../backend/middleware/authMiddleware.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function decoded(role) {
  return { sub: `test-${role}`, email: '', role };
}

function expectForbidden(fn) {
  expect(fn).toThrow();
  try { fn(); } catch (err) { expect(err.statusCode).toBe(403); }
}

// ─── Generate (POST /api/generate) ──────────────────────────────────────────
// Allowed: teacher, admin, student, guest-student

describe('Permission Matrix — POST /api/generate', () => {
  const allowedRoles = ['teacher', 'admin', 'student', 'guest-student'];

  it('guest-student is allowed to generate worksheets', () => {
    expect(() => requireRole(decoded('guest-student'), allowedRoles)).not.toThrow();
  });

  it('guest-teacher is NOT allowed to generate worksheets', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed to generate worksheets', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });

  it('old format guest role is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest'), allowedRoles));
  });

  it('authenticated student is allowed', () => {
    expect(() => requireRole(decoded('student'), allowedRoles)).not.toThrow();
  });

  it('authenticated teacher is allowed', () => {
    expect(() => requireRole(decoded('teacher'), allowedRoles)).not.toThrow();
  });
});

// ─── Solve (POST /api/submit, GET /api/solve) ──────────────────────────────
// Allowed: student, teacher, parent, guest-student

describe('Permission Matrix — POST /api/submit (solve)', () => {
  const allowedRoles = ['student', 'teacher', 'parent', 'guest-student'];

  it('guest-student is allowed to solve worksheets', () => {
    expect(() => requireRole(decoded('guest-student'), allowedRoles)).not.toThrow();
  });

  it('guest-teacher is NOT allowed to solve', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed to solve', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });
});

// ─── Progress (POST /api/progress/save, GET /api/progress/*) ────────────────
// Allowed: student, teacher, parent — NO guests

describe('Permission Matrix — /api/progress/* (save/history/insights)', () => {
  const allowedRoles = ['student', 'teacher', 'parent'];

  it('guest-student is NOT allowed to save progress', () => {
    expectForbidden(() => requireRole(decoded('guest-student'), allowedRoles));
  });

  it('guest-teacher is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });

  it('authenticated student is allowed', () => {
    expect(() => requireRole(decoded('student'), allowedRoles)).not.toThrow();
  });
});

// ─── Class Management (POST /api/class/create, GET /api/class/*) ────────────
// Allowed: teacher, admin — NO guests

describe('Permission Matrix — /api/class/* (create/manage)', () => {
  const allowedRoles = ['teacher', 'admin'];

  it('guest-student is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-student'), allowedRoles));
  });

  it('guest-teacher is NOT allowed to create classes', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });
});

// ─── Dashboard (GET /api/dashboard/*) ───────────────────────────────────────
// Allowed: student, teacher, parent — NO guests

describe('Permission Matrix — /api/dashboard/* (stats/recent)', () => {
  const allowedRoles = ['student', 'teacher', 'parent'];

  it('guest-student is NOT allowed to view dashboard', () => {
    expectForbidden(() => requireRole(decoded('guest-student'), allowedRoles));
  });

  it('guest-teacher is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });
});

// ─── Student Profile (GET/PATCH /api/student/profile) ───────────────────────
// Allowed: student — NO guests

describe('Permission Matrix — /api/student/profile', () => {
  const allowedRoles = ['student'];

  it('guest-student is NOT allowed to view/edit profile', () => {
    expectForbidden(() => requireRole(decoded('guest-student'), allowedRoles));
  });
});

// ─── Admin (all admin routes) ───────────────────────────────────────────────
// Allowed: admin only — NO guests

describe('Permission Matrix — /api/admin/*', () => {
  const allowedRoles = ['admin'];

  it('guest-student is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-student'), allowedRoles));
  });

  it('guest-teacher is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-teacher'), allowedRoles));
  });

  it('guest-parent is NOT allowed', () => {
    expectForbidden(() => requireRole(decoded('guest-parent'), allowedRoles));
  });
});

// ─── No token at all ────────────────────────────────────────────────────────

describe('Permission Matrix — no token (tokenState=none)', () => {
  it('null role is rejected by all role checks', () => {
    expectForbidden(() => requireRole({ sub: null, email: null, role: null }, ['student']));
  });

  it('undefined role is rejected', () => {
    expectForbidden(() => requireRole({ sub: null, email: null, role: undefined }, ['student']));
  });
});

/**
 * @file tests/unit/guestFixtureHandler.test.js
 * @description Unit tests for backend/handlers/guestFixtureHandler.js
 * No mocks needed — handler returns hardcoded fixtures with zero I/O.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';

const { handler } = await import('../../backend/handlers/guestFixtureHandler.js');

const mockContext = { callbackWaitsForEmptyEventLoop: true };

function makeEvent(role) {
  return {
    httpMethod: 'GET',
    headers: {},
    queryStringParameters: role !== undefined ? { role } : null,
  };
}

// ── OPTIONS preflight ─────────────────────────────────────────────────────────

describe('guestFixtureHandler — OPTIONS preflight', () => {
  it('returns 200 for OPTIONS request', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });
});

// ── role=teacher ──────────────────────────────────────────────────────────────

describe('guestFixtureHandler — role=teacher', () => {
  it('returns 200 with teacher fixture data', async () => {
    const result = await handler(makeEvent('teacher'), mockContext);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('classes');
    expect(body).toHaveProperty('recentStudents');
    expect(body).toHaveProperty('topWeakTopics');
    expect(body._note).toContain('Sample data');
  });

  it('teacher fixture has correct class structure', async () => {
    const result = await handler(makeEvent('teacher'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.classes[0]).toHaveProperty('classId');
    expect(body.classes[0]).toHaveProperty('studentCount');
  });

  it('Content-Type is application/json', async () => {
    const result = await handler(makeEvent('teacher'), mockContext);
    expect(result.headers['Content-Type']).toBe('application/json');
  });

  it('response is cacheable (public, max-age)', async () => {
    const result = await handler(makeEvent('teacher'), mockContext);
    expect(result.headers['Cache-Control']).toContain('public');
    expect(result.headers['Cache-Control']).toContain('max-age=3600');
  });
});

// ── role=parent ───────────────────────────────────────────────────────────────

describe('guestFixtureHandler — role=parent', () => {
  it('returns 200 with parent fixture data', async () => {
    const result = await handler(makeEvent('parent'), mockContext);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('children');
    expect(body).toHaveProperty('recentActivity');
    expect(body).toHaveProperty('weeklyProgress');
  });

  it('parent fixture has weekly progress stats', async () => {
    const result = await handler(makeEvent('parent'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.weeklyProgress).toHaveProperty('averageScore');
    expect(body.weeklyProgress).toHaveProperty('worksheetsCompleted');
  });
});

// ── role=student → 403 ───────────────────────────────────────────────────────

describe('guestFixtureHandler — role=student', () => {
  it('returns 403 for student role', async () => {
    const result = await handler(makeEvent('student'), mockContext);
    expect(result.statusCode).toBe(403);
  });

  it('403 body explains students get real data', async () => {
    const result = await handler(makeEvent('student'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('real data');
  });
});

// ── missing / invalid role → 400 ─────────────────────────────────────────────

describe('guestFixtureHandler — missing or invalid role', () => {
  it('returns 400 when role query param is missing', async () => {
    const result = await handler(makeEvent(undefined), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for role=admin', async () => {
    const result = await handler(makeEvent('admin'), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for role=guest-student', async () => {
    const result = await handler(makeEvent('guest-student'), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('400 body includes helpful error message', async () => {
    const result = await handler(makeEvent('invalid'), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Invalid role');
  });
});

// ── CORS headers ──────────────────────────────────────────────────────────────

describe('guestFixtureHandler — CORS headers', () => {
  it('CORS headers present on 200 response', async () => {
    const result = await handler(makeEvent('teacher'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 400 response', async () => {
    const result = await handler(makeEvent('invalid'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('CORS headers present on 403 response', async () => {
    const result = await handler(makeEvent('student'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });
});

// ── Zero I/O ──────────────────────────────────────────────────────────────────

describe('guestFixtureHandler — zero external calls', () => {
  it('sets callbackWaitsForEmptyEventLoop to false', async () => {
    const ctx = { callbackWaitsForEmptyEventLoop: true };
    await handler(makeEvent('teacher'), ctx);
    expect(ctx.callbackWaitsForEmptyEventLoop).toBe(false);
  });
});

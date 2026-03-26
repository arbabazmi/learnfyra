/**
 * @file tests/integration/intHardeningFlow.test.js
 * @description Cross-module integration smoke tests for INT-BE-02 hardening.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-integration-secret';
process.env.AUTH_MODE = 'mock';

const { signToken } = await import('../../src/auth/tokenUtils.js');
const { getDbAdapter } = await import('../../src/db/index.js');
const { handler: classHandler } = await import('../../backend/handlers/classHandler.js');
const { handler: studentHandler } = await import('../../backend/handlers/studentHandler.js');
const { handler: progressHandler } = await import('../../backend/handlers/progressHandler.js');

const db = getDbAdapter();

const teacherId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const parentId = '33333333-3333-4333-8333-333333333333';

const teacherToken = signToken({ sub: teacherId, email: 'teacher@test.com', role: 'teacher' });
const studentToken = signToken({ sub: studentId, email: 'student@test.com', role: 'student' });
const parentToken = signToken({ sub: parentId, email: 'parent@test.com', role: 'parent' });

const mockContext = { callbackWaitsForEmptyEventLoop: true };

let createdClassId = null;

beforeAll(async () => {
  await db.putItem('users', {
    userId: teacherId,
    email: 'teacher@test.com',
    role: 'teacher',
    displayName: 'Teacher One',
    authType: 'local:email',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });

  await db.putItem('users', {
    userId: studentId,
    email: 'student@test.com',
    role: 'student',
    displayName: 'Student One',
    authType: 'local:email',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });

  await db.putItem('users', {
    userId: parentId,
    email: 'parent@test.com',
    role: 'parent',
    displayName: 'Parent One',
    authType: 'local:email',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
});

afterAll(async () => {
  if (createdClassId) {
    await db.deleteItem('classes', createdClassId);
    await db.deleteItem('memberships', `${createdClassId}#${studentId}`);
  }

  await db.deleteItem('parentLinks', `${parentId}#${studentId}`);
  await db.deleteItem('users', teacherId);
  await db.deleteItem('users', studentId);
  await db.deleteItem('users', parentId);
});

describe('INT hardening flow - class, membership, and parent scope', () => {
  it('supports teacher create -> student join -> teacher roster flow', async () => {
    const createResult = await classHandler(
      {
        httpMethod: 'POST',
        path: '/api/class/create',
        headers: { authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({ className: 'Grade 4 Math A', grade: 4, subject: 'Math' }),
      },
      mockContext,
    );

    expect(createResult.statusCode).toBe(201);
    const created = JSON.parse(createResult.body);
    expect(created).toHaveProperty('classId');
    expect(created).toHaveProperty('inviteCode');
    createdClassId = created.classId;

    const joinResult = await studentHandler(
      {
        httpMethod: 'POST',
        path: '/api/student/join-class',
        headers: { authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({ inviteCode: created.inviteCode.toLowerCase() }),
      },
      mockContext,
    );

    expect(joinResult.statusCode).toBe(200);

    const rosterResult = await classHandler(
      {
        httpMethod: 'GET',
        path: `/api/class/${createdClassId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
        pathParameters: { id: createdClassId },
        body: null,
      },
      mockContext,
    );

    expect(rosterResult.statusCode).toBe(200);
    const rosterBody = JSON.parse(rosterResult.body);
    expect(rosterBody.students.some((row) => row.userId === studentId)).toBe(true);
  });

  it('enforces active parent link for parent scoped progress route', async () => {
    await db.putItem('parentLinks', {
      id: `${parentId}#${studentId}`,
      parentId,
      childId: studentId,
      status: 'active',
      linkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const parentResult = await progressHandler(
      {
        httpMethod: 'GET',
        path: `/api/progress/parent/${studentId}`,
        headers: { authorization: `Bearer ${parentToken}` },
        pathParameters: { childId: studentId },
        queryStringParameters: {},
      },
      mockContext,
    );

    expect(parentResult.statusCode).toBe(200);

    const nonLinkedResult = await progressHandler(
      {
        httpMethod: 'GET',
        path: '/api/progress/parent/44444444-4444-4444-8444-444444444444',
        headers: { authorization: `Bearer ${parentToken}` },
        pathParameters: { childId: '44444444-4444-4444-8444-444444444444' },
        queryStringParameters: {},
      },
      mockContext,
    );

    expect(nonLinkedResult.statusCode).toBe(403);
  });
});
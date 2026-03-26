/**
 * @file tests/unit/certificatesHandler.test.js
 * @description Unit tests for backend/handlers/certificatesHandler.js
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const CERT_ID = '22222222-2222-4222-8222-222222222222';

const mockVerifyToken = jest.fn();
const mockListAll = jest.fn();
const mockGetItem = jest.fn();

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    listAll: mockListAll,
    getItem: mockGetItem,
  })),
}));

const { handler } = await import('../../backend/handlers/certificatesHandler.js');

const studentDecoded = {
  sub: STUDENT_ID,
  email: 'student@test.com',
  role: 'student',
};

const teacherDecoded = {
  sub: '33333333-3333-4333-8333-333333333333',
  email: 'teacher@test.com',
  role: 'teacher',
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  mockVerifyToken.mockReturnValue(studentDecoded);
  mockListAll.mockResolvedValue([
    {
      id: CERT_ID,
      studentId: STUDENT_ID,
      worksheetId: '44444444-4444-4444-8444-444444444444',
      subject: 'Math',
      topic: 'Fractions',
      grade: 4,
      score: 9,
      totalPoints: 10,
      percentage: 90,
      issuedAt: '2026-03-25T10:00:00.000Z',
      createdAt: '2026-03-25T10:00:00.000Z',
    },
  ]);
  mockGetItem.mockImplementation(async (table, id) => {
    if (table === 'certificates' && id === CERT_ID) {
      return {
        id: CERT_ID,
        studentId: STUDENT_ID,
        worksheetId: '44444444-4444-4444-8444-444444444444',
        subject: 'Math',
        topic: 'Fractions',
        grade: 4,
        percentage: 90,
        issuedAt: '2026-03-25T10:00:00.000Z',
      };
    }

    if (table === 'users' && id === STUDENT_ID) {
      return {
        userId: STUDENT_ID,
        displayName: 'Alex Student',
      };
    }

    return null;
  });
});

describe('certificatesHandler — OPTIONS', () => {
  it('returns 200 for preflight', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' }, mockContext);
    expect(result.statusCode).toBe(200);
  });
});

describe('certificatesHandler — GET /api/certificates', () => {
  it('returns student certificates with download tokens', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/certificates',
        headers: { authorization: 'Bearer token' },
        queryStringParameters: {},
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.studentId).toBe(STUDENT_ID);
    expect(body.certificates).toHaveLength(1);
    expect(body.certificates[0].downloadToken).toBeTruthy();
  });

  it('returns 403 for non-student role', async () => {
    mockVerifyToken.mockReturnValue(teacherDecoded);
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/api/certificates',
        headers: { authorization: 'Bearer token' },
        queryStringParameters: {},
      },
      mockContext,
    );

    expect(result.statusCode).toBe(403);
  });
});

describe('certificatesHandler — GET /api/certificates/:id/download', () => {
  it('returns html content for valid token', async () => {
    const listResult = await handler(
      {
        httpMethod: 'GET',
        path: '/api/certificates',
        headers: { authorization: 'Bearer token' },
        queryStringParameters: {},
      },
      mockContext,
    );

    const token = JSON.parse(listResult.body).certificates[0].downloadToken;

    const result = await handler(
      {
        httpMethod: 'GET',
        path: `/api/certificates/${CERT_ID}/download`,
        headers: { authorization: 'Bearer token' },
        pathParameters: { id: CERT_ID },
        queryStringParameters: { token },
      },
      mockContext,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.certificateId).toBe(CERT_ID);
    expect(body.htmlContent).toMatch(/Certificate of Completion/i);
  });

  it('returns 401 for invalid token', async () => {
    const result = await handler(
      {
        httpMethod: 'GET',
        path: `/api/certificates/${CERT_ID}/download`,
        headers: { authorization: 'Bearer token' },
        pathParameters: { id: CERT_ID },
        queryStringParameters: { token: 'invalid-token' },
      },
      mockContext,
    );

    expect(result.statusCode).toBe(401);
  });
});

/**
 * @file tests/unit/downloadHandler.test.js
 * @description Unit tests for backend/handlers/downloadHandler.js.
 *   All AWS SDK calls are mocked with aws-sdk-client-mock.
 *   @aws-sdk/s3-request-presigner is mocked with jest.unstable_mockModule.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ─── S3 mock ──────────────────────────────────────────────────────────────────

const s3Mock = mockClient(S3Client);

// ─── Module mocks (must all appear before any dynamic import()) ───────────────

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

// ─── Dynamic imports (must come after ALL mockModule calls) ───────────────────

const { handler } = await import('../../backend/handlers/downloadHandler.js');
const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(key, method = 'GET') {
  return {
    httpMethod: method,
    queryStringParameters: key ? { key } : null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

const VALID_KEY = 'worksheets/2026/03/22/test-uuid-1234/worksheet.pdf';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  s3Mock.reset();
  jest.clearAllMocks();

  // Restore default presigner mock after clearAllMocks
  getSignedUrl.mockResolvedValue('https://s3.example.com/presigned-url');
});

// ─── CORS preflight ───────────────────────────────────────────────────────────

describe('downloadHandler — OPTIONS preflight', () => {

  it('returns 200 for OPTIONS request', async () => {
    const result = await handler(mockEvent(VALID_KEY, 'OPTIONS'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler(mockEvent(VALID_KEY, 'OPTIONS'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Methods']).toMatch(/OPTIONS/);
  });

});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('downloadHandler — valid key', () => {

  beforeEach(() => {
    s3Mock.on(HeadObjectCommand).resolves({});
  });

  it('returns 200 for a valid key', async () => {
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body contains downloadUrl', async () => {
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('downloadUrl');
  });

  it('downloadUrl matches the mocked presigned URL', async () => {
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    const { downloadUrl } = JSON.parse(result.body);
    expect(downloadUrl).toBe('https://s3.example.com/presigned-url');
  });

  it('CORS headers present on 200 response', async () => {
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('calls HeadObjectCommand to verify object existence', async () => {
    await handler(mockEvent(VALID_KEY), mockContext);
    const headCalls = s3Mock.commandCalls(HeadObjectCommand);
    expect(headCalls).toHaveLength(1);
  });

  it('calls getSignedUrl with a GetObjectCommand', async () => {
    await handler(mockEvent(VALID_KEY), mockContext);
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const [, command] = getSignedUrl.mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
  });

});

// ─── Missing / empty key (400) ────────────────────────────────────────────────

describe('downloadHandler — 400 missing or empty key', () => {

  it('returns 400 when key query param is absent', async () => {
    const result = await handler(mockEvent(null), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns an error message when key is absent', async () => {
    const result = await handler(mockEvent(null), mockContext);
    expect(JSON.parse(result.body).error).toBeTruthy();
  });

  it('returns 400 when key is an empty string', async () => {
    const result = await handler(mockEvent(''), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when key is only whitespace', async () => {
    const result = await handler(mockEvent('   '), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers present on 400 missing-key response', async () => {
    const result = await handler(mockEvent(null), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── File not found (404) ─────────────────────────────────────────────────────

describe('downloadHandler — 404 file not found', () => {

  it('returns 404 when HeadObject returns NotFound', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('Not Found'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      })
    );
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('response body contains "not found" message for 404', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('Not Found'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      })
    );
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error.toLowerCase()).toContain('not found');
  });

  it('returns 404 when $metadata.httpStatusCode is 404 (non-NotFound name)', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('NoSuchKey'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      })
    );
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('CORS headers present on 404 response', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('Not Found'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      })
    );
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── HeadObject generic error (500) ──────────────────────────────────────────

describe('downloadHandler — 500 HeadObject error', () => {

  it('returns 500 when HeadObject throws a generic error', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('S3 connection refused'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('response body has an error field on HeadObject 500', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('S3 connection refused'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(JSON.parse(result.body).error).toBeTruthy();
  });

  it('CORS headers present on HeadObject 500 response', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('S3 connection refused'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── getSignedUrl error (500) ─────────────────────────────────────────────────

describe('downloadHandler — 500 getSignedUrl error', () => {

  beforeEach(() => {
    // HeadObject succeeds so we reach the presigner step
    s3Mock.on(HeadObjectCommand).resolves({});
  });

  it('returns 500 when getSignedUrl throws', async () => {
    getSignedUrl.mockRejectedValueOnce(new Error('Presigner internal error'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('response body has an error field on getSignedUrl 500', async () => {
    getSignedUrl.mockRejectedValueOnce(new Error('Presigner internal error'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(JSON.parse(result.body).error).toBeTruthy();
  });

  it('CORS headers present on getSignedUrl 500 response', async () => {
    getSignedUrl.mockRejectedValueOnce(new Error('Presigner internal error'));
    const result = await handler(mockEvent(VALID_KEY), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

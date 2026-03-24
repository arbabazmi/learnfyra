/**
 * @file tests/unit/generateHandler.test.js
 * @description Unit tests for backend/handlers/generateHandler.js.
 *   All AWS SDK calls are mocked with aws-sdk-client-mock.
 *   All src/ dependencies are mocked with jest.unstable_mockModule.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ─── Load fixture synchronously (must happen before any async mocks) ──────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── AWS SDK mocks ────────────────────────────────────────────────────────────

const s3Mock  = mockClient(S3Client);
const ssmMock = mockClient(SSMClient);

// ─── Module mocks (must all appear before any dynamic import()) ───────────────

jest.unstable_mockModule('../../src/ai/generator.js', () => ({
  generateWorksheet: jest.fn().mockResolvedValue(sampleWorksheet),
}));

jest.unstable_mockModule('../../src/exporters/index.js', () => ({
  exportWorksheet: jest.fn().mockResolvedValue(['/tmp/worksheet.pdf']),
}));

jest.unstable_mockModule('../../src/exporters/answerKey.js', () => ({
  exportAnswerKey: jest.fn().mockResolvedValue(['/tmp/answer-key.pdf']),
}));

// Mock fs so readFileSync (used inside uploadToS3) returns a fake buffer
jest.unstable_mockModule('fs', () => ({
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-file-content')),
}));

// Mock crypto so randomUUID returns a deterministic value
jest.unstable_mockModule('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

// ─── Dynamic imports (must come after ALL mockModule calls) ───────────────────

const { handler } = await import('../../backend/handlers/generateHandler.js');
const { generateWorksheet } = await import('../../src/ai/generator.js');
const { exportWorksheet } = await import('../../src/exporters/index.js');
const { exportAnswerKey } = await import('../../src/exporters/answerKey.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(body, method = 'POST') {
  return {
    httpMethod: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    queryStringParameters: null,
  };
}

const mockContext = { callbackWaitsForEmptyEventLoop: true };

const validBody = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
  format: 'PDF',
  includeAnswerKey: true,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  s3Mock.reset();
  ssmMock.reset();
  jest.clearAllMocks();

  // Set ANTHROPIC_API_KEY directly so loadApiKey() short-circuits without SSM
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

  // Restore default mock implementations after clearAllMocks
  generateWorksheet.mockResolvedValue(sampleWorksheet);
  exportWorksheet.mockResolvedValue(['/tmp/worksheet.pdf']);
  exportAnswerKey.mockResolvedValue(['/tmp/answer-key.pdf']);
});

// ─── CORS preflight ───────────────────────────────────────────────────────────

describe('generateHandler — OPTIONS preflight', () => {

  it('returns 200 for OPTIONS request', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns CORS headers on OPTIONS response', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Methods']).toMatch(/OPTIONS/);
  });

  it('returns empty body on OPTIONS response', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.body).toBe('');
  });

});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('generateHandler — valid request', () => {

  beforeEach(() => {
    s3Mock.on(PutObjectCommand).resolves({});
  });

  it('returns 200 for a valid request', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body has success: true', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(true);
  });

  it('response body contains worksheetKey', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('worksheetKey');
  });

  it('response body contains answerKeyKey', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('answerKeyKey');
  });

  it('response body contains metadata', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('metadata');
  });

  it('worksheetKey contains worksheet.pdf', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { worksheetKey } = JSON.parse(result.body);
    expect(worksheetKey).toContain('worksheet.pdf');
  });

  it('answerKeyKey contains answer-key.pdf when includeAnswerKey is true', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { answerKeyKey } = JSON.parse(result.body);
    expect(answerKeyKey).toContain('answer-key.pdf');
  });

  it('answerKeyKey is null when includeAnswerKey is false', async () => {
    const body = { ...validBody, includeAnswerKey: false };
    const result = await handler(mockEvent(body), mockContext);
    const { answerKeyKey } = JSON.parse(result.body);
    expect(answerKeyKey).toBeNull();
  });

  it('metadata contains the correct grade', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.grade).toBe(3);
  });

  it('metadata contains the correct subject', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.subject).toBe('Math');
  });

  it('metadata contains the correct topic', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.topic).toBe('Multiplication Facts (1–10)');
  });

  it('metadata contains the correct difficulty', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.difficulty).toBe('Medium');
  });

  it('metadata contains the correct questionCount', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.questionCount).toBe(10);
  });

  it('metadata contains generatedAt ISO timestamp', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('metadata contains expiresAt ISO timestamp', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('CORS headers present on 200 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── S3 upload call counts ────────────────────────────────────────────────────

describe('generateHandler — S3 upload call counts', () => {

  beforeEach(() => {
    s3Mock.on(PutObjectCommand).resolves({});
  });

  it('calls PutObjectCommand twice when includeAnswerKey is true', async () => {
    await handler(mockEvent(validBody), mockContext);
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(2);
  });

  it('calls PutObjectCommand once when includeAnswerKey is false', async () => {
    const body = { ...validBody, includeAnswerKey: false };
    await handler(mockEvent(body), mockContext);
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
  });

  it('first S3 upload key contains worksheet.pdf', async () => {
    await handler(mockEvent(validBody), mockContext);
    const firstCall = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(firstCall.args[0].input.Key).toContain('worksheet.pdf');
  });

  it('second S3 upload key contains answer-key.pdf', async () => {
    await handler(mockEvent(validBody), mockContext);
    const secondCall = s3Mock.commandCalls(PutObjectCommand)[1];
    expect(secondCall.args[0].input.Key).toContain('answer-key.pdf');
  });

});

// ─── Validation errors (400) ──────────────────────────────────────────────────

describe('generateHandler — 400 validation errors', () => {

  it('returns 400 for grade 0', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns success: false for grade 0', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('returns an error message for grade 0', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(JSON.parse(result.body).error).toBeTruthy();
  });

  it('returns 400 for grade 11', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 11 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for questionCount 4 (below minimum)', async () => {
    const result = await handler(mockEvent({ ...validBody, questionCount: 4 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for questionCount 31 (above maximum)', async () => {
    const result = await handler(mockEvent({ ...validBody, questionCount: 31 }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid subject', async () => {
    const result = await handler(mockEvent({ ...validBody, subject: 'Art' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid format', async () => {
    const result = await handler(mockEvent({ ...validBody, format: 'TXT' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('CORS headers present on 400 response', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Malformed JSON body (400) ────────────────────────────────────────────────

describe('generateHandler — 400 malformed JSON', () => {

  it('returns 400 for malformed JSON body', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns success: false for malformed JSON', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('CORS headers present on malformed JSON 400 response', async () => {
    const event = {
      httpMethod: 'POST',
      body: '<<<invalid>>>',
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

// ─── Generator error (500) ────────────────────────────────────────────────────

describe('generateHandler — 500 generator error', () => {

  it('returns 500 when generateWorksheet throws', async () => {
    generateWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('returns success: false when generateWorksheet throws', async () => {
    generateWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('does NOT expose the raw error message in the 500 response', async () => {
    const internalMessage = 'Claude API unavailable — secret key invalid';
    generateWorksheet.mockRejectedValueOnce(new Error(internalMessage));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).not.toContain(internalMessage);
  });

  it('returns a generic user-facing error message on 500', async () => {
    generateWorksheet.mockRejectedValueOnce(new Error('network failure'));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBeTruthy();
    expect(typeof body.error).toBe('string');
  });

  it('CORS headers present on 500 response', async () => {
    generateWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

});

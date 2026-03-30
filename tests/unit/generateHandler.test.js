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

// Auth middleware — returns a teacher token by default; individual tests can override
const mockValidateToken = jest.fn().mockResolvedValue({
  sub: 'teacher-user-123',
  email: 'teacher@learnfyra.com',
  role: 'teacher',
});
const mockAssertRole = jest.fn(); // no-op (passes) by default
const mockDbGetItem = jest.fn();
const mockDbListAll = jest.fn();
const mockDbPutItem = jest.fn();

const mockBuildStudentKey = jest.fn().mockReturnValue('student:test-student-1');
const mockResolveEffectiveRepeatCap = jest.fn().mockResolvedValue({
  capPercent: 10,
  appliedBy: 'default',
  sourceId: null,
});
const mockGetSeenQuestionSignatures = jest.fn().mockResolvedValue(new Set());
const mockRecordExposureHistory = jest.fn().mockResolvedValue(0);

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: mockValidateToken,
  assertRole: mockAssertRole,
}));

jest.unstable_mockModule('../../src/ai/assembler.js', () => ({
  assembleWorksheet: jest.fn().mockResolvedValue({
    worksheet: sampleWorksheet,
    bankStats: { fromBank: 0, generated: 10, totalStored: 10 },
    provenance: {
      mode: 'bank-first',
      level: 'summary',
      usedBank: false,
      usedGeneration: true,
      selectedBankCount: 0,
      generatedCount: 10,
      storedGeneratedCount: 10,
      bankedQuestionIds: [],
      generatedByModels: ['claude-haiku-4-5-20251001'],
    },
  }),
}));

jest.unstable_mockModule('../../src/exporters/index.js', () => ({
  exportWorksheet: jest.fn().mockResolvedValue(['/tmp/worksheet.pdf']),
}));

jest.unstable_mockModule('../../src/exporters/answerKey.js', () => ({
  exportAnswerKey: jest.fn().mockResolvedValue(['/tmp/answer-key.pdf']),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: mockDbGetItem,
    listAll: mockDbListAll,
    putItem: mockDbPutItem,
  })),
}));

jest.unstable_mockModule('../../src/ai/repeatCapPolicy.js', () => ({
  buildStudentKey: mockBuildStudentKey,
  resolveEffectiveRepeatCap: mockResolveEffectiveRepeatCap,
  getSeenQuestionSignatures: mockGetSeenQuestionSignatures,
  recordExposureHistory: mockRecordExposureHistory,
}));

// Mock fs so readFileSync (used inside uploadToS3) returns a fake buffer
jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-file-content')),
  },
}));

// Mock crypto so randomUUID returns a deterministic value
jest.unstable_mockModule('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

// ─── Dynamic imports (must come after ALL mockModule calls) ───────────────────

const { handler } = await import('../../backend/handlers/generateHandler.js');
const { assembleWorksheet } = await import('../../src/ai/assembler.js');
const { exportWorksheet } = await import('../../src/exporters/index.js');
const { exportAnswerKey } = await import('../../src/exporters/answerKey.js');
const { validateToken, assertRole } = await import('../../backend/middleware/authMiddleware.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEvent(body, method = 'POST', headers = {}) {
  return {
    httpMethod: method,
    headers: { 'Content-Type': 'application/json', ...headers },
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
  studentName: 'Ava Johnson',
  worksheetDate: '2026-03-24',
  teacherName: 'Ms. Carter',
  period: '2nd',
  className: 'Algebra Readiness',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  s3Mock.reset();
  ssmMock.reset();
  jest.clearAllMocks();

  // Set ANTHROPIC_API_KEY directly so loadApiKey() short-circuits without SSM
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

  // Required by uploadToS3 — W5 fix reads BUCKET lazily inside the function
  // and throws if it is missing, so the env var must be present in tests.
  process.env.WORKSHEET_BUCKET_NAME = 'test-bucket';

  // Restore default auth mock — teacher passes through
  validateToken.mockResolvedValue({ sub: 'teacher-user-123', email: 'teacher@learnfyra.com', role: 'teacher' });
  assertRole.mockImplementation(() => {}); // passes

  // Restore default mock implementations after clearAllMocks
  assembleWorksheet.mockResolvedValue({
    worksheet: sampleWorksheet,
    bankStats: { fromBank: 0, generated: 10, totalStored: 10 },
    provenance: {
      mode: 'bank-first',
      level: 'summary',
      usedBank: false,
      usedGeneration: true,
      selectedBankCount: 0,
      generatedCount: 10,
      storedGeneratedCount: 10,
      bankedQuestionIds: [],
      generatedByModels: ['claude-haiku-4-5-20251001'],
    },
  });
  exportWorksheet.mockResolvedValue(['/tmp/worksheet.pdf']);
  exportAnswerKey.mockResolvedValue(['/tmp/answer-key.pdf']);
  mockBuildStudentKey.mockReturnValue('student:test-student-1');
  mockResolveEffectiveRepeatCap.mockResolvedValue({ capPercent: 10, appliedBy: 'default', sourceId: null });
  mockGetSeenQuestionSignatures.mockResolvedValue(new Set());
  mockRecordExposureHistory.mockResolvedValue(0);
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

  it('exposes diagnostic headers on OPTIONS response', async () => {
    const result = await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(result.headers['Access-Control-Expose-Headers']).toBe('x-request-id,x-client-request-id');
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

  it('response body contains request diagnostics', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.requestId).toBeTruthy();
    expect(result.headers['x-request-id']).toBe(body.requestId);
  });

  it('echoes the client request id when provided', async () => {
    const result = await handler(
      mockEvent(validBody, 'POST', { 'x-client-request-id': 'client-test-123' }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.clientRequestId).toBe('client-test-123');
    expect(result.headers['x-client-request-id']).toBe('client-test-123');
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

  it('metadata contains optional student details object', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.studentDetails).toMatchObject({
      studentName: 'Ava Johnson',
      worksheetDate: '2026-03-24',
      teacherName: 'Ms. Carter',
      period: '2nd',
      className: 'Algebra Readiness',
    });
  });

  it('CORS headers present on 200 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('exposes diagnostic headers on 200 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Expose-Headers']).toBe('x-request-id,x-client-request-id');
  });

  it('passes optional student details into worksheet export options', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(exportWorksheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        studentName: 'Ava Johnson',
        worksheetDate: '2026-03-24',
        teacherName: 'Ms. Carter',
        period: '2nd',
        className: 'Algebra Readiness',
      })
    );
  });

  it('metadata contains bankStats with fromBank/generated/totalStored', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats).toMatchObject({
      fromBank: expect.any(Number),
      generated: expect.any(Number),
      totalStored: expect.any(Number),
    });
  });

  it('metadata includes additive provenanceSummary when assembler returns provenance', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary).toMatchObject({
      mode: 'bank-first',
      level: 'summary',
      usedGeneration: true,
      generatedByModels: ['claude-haiku-4-5-20251001'],
    });
  });

  it('passes generationMode and provenanceLevel through to assembleWorksheet', async () => {
    const body = {
      ...validBody,
      generationMode: 'bank-first',
      provenanceLevel: 'full',
    };
    await handler(mockEvent(body), mockContext);
    expect(assembleWorksheet).toHaveBeenCalledWith(expect.objectContaining({
      generationMode: 'bank-first',
      provenanceLevel: 'full',
    }));
  });

  it('omits provenanceSummary when assembler does not return provenance', async () => {
    assembleWorksheet.mockResolvedValueOnce({
      worksheet: sampleWorksheet,
      bankStats: { fromBank: 10, generated: 0, totalStored: 0 },
    });
    const result = await handler(mockEvent({ ...validBody, provenanceLevel: 'none' }), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary).toBeUndefined();
  });

});

// ─── S3 upload call counts ────────────────────────────────────────────────────

describe('generateHandler — S3 upload call counts', () => {

  beforeEach(() => {
    s3Mock.on(PutObjectCommand).resolves({});
  });

  it('calls PutObjectCommand three times when includeAnswerKey is true (worksheet + solve-data + answer-key)', async () => {
    await handler(mockEvent(validBody), mockContext);
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(3);
  });

  it('calls PutObjectCommand twice when includeAnswerKey is false (worksheet + solve-data)', async () => {
    const body = { ...validBody, includeAnswerKey: false };
    await handler(mockEvent(body), mockContext);
    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(2);
  });

  it('first S3 upload key contains worksheet.pdf', async () => {
    await handler(mockEvent(validBody), mockContext);
    const firstCall = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(firstCall.args[0].input.Key).toContain('worksheet.pdf');
  });

  it('second S3 upload key is solve-data.json', async () => {
    await handler(mockEvent(validBody), mockContext);
    const secondCall = s3Mock.commandCalls(PutObjectCommand)[1];
    expect(secondCall.args[0].input.Key).toContain('solve-data.json');
  });

  it('solve-data.json S3 upload has application/json content type', async () => {
    await handler(mockEvent(validBody), mockContext);
    const solveDataCall = s3Mock.commandCalls(PutObjectCommand)[1];
    expect(solveDataCall.args[0].input.ContentType).toBe('application/json');
  });

  it('third S3 upload key contains answer-key.pdf', async () => {
    await handler(mockEvent(validBody), mockContext);
    const thirdCall = s3Mock.commandCalls(PutObjectCommand)[2];
    expect(thirdCall.args[0].input.Key).toContain('answer-key.pdf');
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

  it('returns 400 for invalid generationMode', async () => {
    const result = await handler(mockEvent({ ...validBody, generationMode: 'legacy' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid provenanceLevel', async () => {
    const result = await handler(mockEvent({ ...validBody, provenanceLevel: 'debug' }), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns WG_INVALID_REQUEST code for validation failures', async () => {
    const result = await handler(mockEvent({ ...validBody, generationMode: 'legacy' }), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_INVALID_REQUEST');
  });

  it('CORS headers present on 400 response', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('exposes diagnostic headers on 400 response', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    expect(result.headers['Access-Control-Expose-Headers']).toBe('x-request-id,x-client-request-id');
  });

  it('returns diagnostic fields on 400 validation response', async () => {
    const result = await handler(mockEvent({ ...validBody, grade: 0 }), mockContext);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.errorStage).toBe('request:validate-body');
    expect(body.requestId).toBeTruthy();
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

  it('returns WG_INVALID_REQUEST code for malformed JSON', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_INVALID_REQUEST');
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

  it('returns invalid JSON diagnostics on malformed JSON response', async () => {
    const event = {
      httpMethod: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
      queryStringParameters: null,
    };
    const result = await handler(event, mockContext);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_JSON');
    expect(body.errorStage).toBe('request:parse-body');
    expect(body.requestId).toBeTruthy();
  });

});

// ─── Generator error (500) ────────────────────────────────────────────────────

describe('generateHandler — 500 assembler error', () => {

  it('returns 500 when assembleWorksheet throws', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('returns success: false when assembleWorksheet throws', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('does NOT expose the raw error message in the 500 response', async () => {
    const internalMessage = 'Claude API unavailable — secret key invalid';
    assembleWorksheet.mockRejectedValueOnce(new Error(internalMessage));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).not.toContain(internalMessage);
  });

  it('returns a generic user-facing error message on 500', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('network failure'));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).toBeTruthy();
    expect(typeof body.error).toBe('string');
  });

  it('returns an additive machine-readable code on 500 responses', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API returned an empty response.'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_GENERATION_EMPTY_RESPONSE');
  });

  it('returns diagnostic fields on 500 response', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('GENERATION_FAILED');
    expect(body.errorStage).toBe('worksheet:generate');
    expect(body.requestId).toBeTruthy();
    expect(result.headers['x-request-id']).toBe(body.requestId);
  });

  it('CORS headers present on 500 response', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 500 when WORKSHEET_BUCKET_NAME env var is missing', async () => {
    // Remove the bucket env var so uploadToS3 throws the guard error
    const original = process.env.WORKSHEET_BUCKET_NAME;
    delete process.env.WORKSHEET_BUCKET_NAME;
    s3Mock.on(PutObjectCommand).resolves({});
    const result = await handler(mockEvent(validBody), mockContext);
    // Restore before assertion so subsequent tests are not affected
    process.env.WORKSHEET_BUCKET_NAME = original;
    expect(result.statusCode).toBe(500);
  });

  it('returns CORS headers when WORKSHEET_BUCKET_NAME env var is missing', async () => {
    const original = process.env.WORKSHEET_BUCKET_NAME;
    delete process.env.WORKSHEET_BUCKET_NAME;
    s3Mock.on(PutObjectCommand).resolves({});
    const result = await handler(mockEvent(validBody), mockContext);
    process.env.WORKSHEET_BUCKET_NAME = original;
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('exposes diagnostic headers on 500 response', async () => {
    assembleWorksheet.mockRejectedValueOnce(new Error('Claude API unavailable'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Expose-Headers']).toBe('x-request-id,x-client-request-id');
  });

});

// ─── Auth enforcement (TASK-GEN-001) ─────────────────────────────────────────

describe('generateHandler — auth enforcement', () => {

  it('returns 401 when Authorization header is missing', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    validateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('returns success: false on 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    validateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('returns WG_UNAUTHORIZED code on 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    validateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_UNAUTHORIZED');
  });

  it('returns 403 when role is not teacher or admin', async () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    assertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(403);
  });

  it('returns WG_FORBIDDEN code on 403', async () => {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    assertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_FORBIDDEN');
  });

  it('returns CORS headers on 401 response', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    validateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('does not call assembleWorksheet when auth fails', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    validateToken.mockRejectedValueOnce(err);
    await handler(mockEvent(validBody), mockContext);
    expect(assembleWorksheet).not.toHaveBeenCalled();
  });

});

// ─── teacherId and solve-data.json (TASK-GEN-002 + TASK-GEN-004) ─────────────

describe('generateHandler — teacherId and solve-data.json', () => {

  beforeEach(() => {
    s3Mock.on(PutObjectCommand).resolves({});
  });

  it('metadata contains teacherId from the JWT sub claim', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.teacherId).toBe('teacher-user-123');
  });

  it('solve-data.json S3 upload body contains worksheetId', async () => {
    await handler(mockEvent(validBody), mockContext);
    const solveDataCall = s3Mock.commandCalls(PutObjectCommand).find(
      (c) => c.args[0].input.Key.includes('solve-data.json')
    );
    const uploaded = JSON.parse(solveDataCall.args[0].input.Body);
    expect(uploaded).toHaveProperty('worksheetId');
  });

  it('solve-data.json body contains teacherId', async () => {
    await handler(mockEvent(validBody), mockContext);
    const solveDataCall = s3Mock.commandCalls(PutObjectCommand).find(
      (c) => c.args[0].input.Key.includes('solve-data.json')
    );
    const uploaded = JSON.parse(solveDataCall.args[0].input.Body);
    expect(uploaded.teacherId).toBe('teacher-user-123');
  });

  it('solve-data.json body contains questions array', async () => {
    await handler(mockEvent(validBody), mockContext);
    const solveDataCall = s3Mock.commandCalls(PutObjectCommand).find(
      (c) => c.args[0].input.Key.includes('solve-data.json')
    );
    const uploaded = JSON.parse(solveDataCall.args[0].input.Body);
    expect(Array.isArray(uploaded.questions)).toBe(true);
  });

  it('solve-data.json S3 key is under the same base path as the worksheet', async () => {
    await handler(mockEvent(validBody), mockContext);
    const calls = s3Mock.commandCalls(PutObjectCommand);
    const worksheetKey = calls[0].args[0].input.Key;
    const solveDataKey = calls[1].args[0].input.Key;
    // Both should share the same worksheets/{date}/{uuid}/ prefix
    const prefix = worksheetKey.replace('/worksheet.pdf', '');
    expect(solveDataKey).toContain(prefix);
  });

});

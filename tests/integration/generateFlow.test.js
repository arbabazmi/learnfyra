/**
 * @file tests/integration/generateFlow.test.js
 * @description Integration tests: full POST /api/generate flow through the handler.
 * All AWS SDK calls, AI client, and question bank are mocked.
 * Tests cover: bank-first assembly, auth enforcement, solve-data.json upload, teacherId.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ─── Load fixture synchronously (before any async mocks) ──────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── AWS SDK mocks ─────────────────────────────────────────────────────────────

const s3Mock  = mockClient(S3Client);
const ssmMock = mockClient(SSMClient);
const dynamoDocMock = mockClient(DynamoDBDocumentClient);

// ─── Module-level jest.fn() stubs (created before mockModule factories) ───────

// Auth middleware stubs
const mockValidateToken = jest.fn();
const mockAssertRole    = jest.fn();
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

// Assembler stub — controls which bank-first scenario the handler sees
const mockAssembleWorksheet = jest.fn();

// Exporter stubs
const mockExportWorksheet = jest.fn();
const mockExportAnswerKey = jest.fn();

// fs.promises stub — keeps uploadToS3 off the real filesystem
const mockReadFile = jest.fn();

// crypto stub — deterministic UUID simplifies key assertions
const mockRandomUUID = jest.fn();

// ─── Module mocks (ALL before dynamic import()) ───────────────────────────────

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: mockValidateToken,
  assertRole:    mockAssertRole,
}));

jest.unstable_mockModule('../../src/ai/assembler.js', () => ({
  assembleWorksheet: mockAssembleWorksheet,
}));

jest.unstable_mockModule('../../src/exporters/index.js', () => ({
  exportWorksheet: mockExportWorksheet,
}));

jest.unstable_mockModule('../../src/exporters/answerKey.js', () => ({
  exportAnswerKey: mockExportAnswerKey,
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

jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: mockReadFile,
  },
}));

jest.unstable_mockModule('crypto', () => ({
  randomUUID: mockRandomUUID,
}));

// ─── Dynamic imports (after ALL mockModule calls) ─────────────────────────────

const { handler } = await import('../../backend/handlers/generateHandler.js');

// ─── Shared test fixtures ─────────────────────────────────────────────────────

/**
 * Builds a mock API Gateway event for POST /api/generate.
 * @param {Object} body - Request body to serialize as JSON
 * @param {string} [method='POST'] - HTTP method
 * @param {Object} [extraHeaders={}] - Additional request headers
 * @returns {Object} Mock API Gateway event
 */
function mockEvent(body, method = 'POST', extraHeaders = {}) {
  return {
    httpMethod: method,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    pathParameters: null,
    queryStringParameters: null,
  };
}

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'learnfyra-generate',
  awsRequestId: 'test-aws-request-id',
  getRemainingTimeInMillis: () => 60000,
};

/**
 * Minimal valid request body — passes all validator rules.
 */
const validBody = {
  grade: 3,
  subject: 'Math',
  topic: 'Multiplication Facts (1–10)',
  difficulty: 'Medium',
  questionCount: 10,
  format: 'PDF',
  includeAnswerKey: true,
};

/**
 * Builds a full bankStats / provenance shape for a given bank-first scenario.
 * @param {'full'|'partial'|'empty'} scenario
 * @param {number} requested - Total questions requested
 * @returns {{ bankStats: Object, provenance: Object }}
 */
function scenarioMeta(scenario, requested = 10) {
  if (scenario === 'full') {
    return {
      bankStats: {
        fromBank:     requested,
        generated:    0,
        totalStored:  0,
      },
      provenance: {
        mode:                 'bank-first',
        level:                'summary',
        usedBank:             true,
        usedGeneration:       false,
        selectedBankCount:    requested,
        generatedCount:       0,
        storedGeneratedCount: 0,
        bankedQuestionIds:    Array.from({ length: requested }, (_, i) => `qid-bank-${i + 1}`),
        generatedByModels:    [],
      },
    };
  }
  if (scenario === 'partial') {
    const fromBank  = 6;
    const generated = requested - fromBank;
    return {
      bankStats: {
        fromBank,
        generated,
        totalStored: generated,
      },
      provenance: {
        mode:                 'bank-first',
        level:                'summary',
        usedBank:             true,
        usedGeneration:       true,
        selectedBankCount:    fromBank,
        generatedCount:       generated,
        storedGeneratedCount: generated,
        bankedQuestionIds:    Array.from({ length: fromBank }, (_, i) => `qid-bank-${i + 1}`),
        generatedByModels:    ['claude-haiku-4-5-20251001'],
      },
    };
  }
  // empty — all AI
  return {
    bankStats: {
      fromBank:     0,
      generated:    requested,
      totalStored:  requested,
    },
    provenance: {
      mode:                 'bank-first',
      level:                'summary',
      usedBank:             false,
      usedGeneration:       true,
      selectedBankCount:    0,
      generatedCount:       requested,
      storedGeneratedCount: requested,
      bankedQuestionIds:    [],
      generatedByModels:    ['claude-haiku-4-5-20251001'],
    },
  };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  s3Mock.reset();
  ssmMock.reset();
  dynamoDocMock.reset();
  jest.clearAllMocks();

  // Env vars — handler reads these lazily so they must be set before invocation
  process.env.ANTHROPIC_API_KEY     = 'sk-ant-test';
  process.env.WORKSHEET_BUCKET_NAME = 'test-integration-bucket';
  process.env.WORKSHEETS_TABLE_NAME = 'LearnfyraWorksheets-test';
  process.env.GUEST_SESSIONS_TABLE  = 'LearnfyraGuestSessions-test';
  process.env.NODE_ENV              = 'test';

  // Default: S3 accepts every PutObject without error
  s3Mock.on(PutObjectCommand).resolves({});

  // Default auth: valid teacher token
  mockValidateToken.mockResolvedValue({
    sub:   'teacher-user-123',
    email: 'teacher@learnfyra.com',
    role:  'teacher',
  });
  mockAssertRole.mockImplementation(() => {}); // passes — no throw

  // Default assembler: all-AI assembly (empty bank scenario)
  mockAssembleWorksheet.mockResolvedValue({
    worksheet: sampleWorksheet,
    ...scenarioMeta('empty'),
  });

  // Default exporters
  mockExportWorksheet.mockResolvedValue(['/tmp/worksheet.pdf']);
  mockExportAnswerKey.mockResolvedValue(['/tmp/answer-key.pdf']);
  mockBuildStudentKey.mockReturnValue('student:test-student-1');
  mockResolveEffectiveRepeatCap.mockResolvedValue({ capPercent: 10, appliedBy: 'default', sourceId: null });
  mockGetSeenQuestionSignatures.mockResolvedValue(new Set());
  mockRecordExposureHistory.mockResolvedValue(0);

  // Default fs.readFile — returns a non-empty buffer for every path
  mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content'));

  // Default UUID — deterministic for key path assertions
  mockRandomUUID.mockReturnValue('test-uuid-5678');
});

// ─── 1. Full bank coverage — assembler skips AI ───────────────────────────────

describe('generateFlow — full bank coverage (no AI call)', () => {

  beforeEach(() => {
    const { bankStats, provenance } = scenarioMeta('full');
    mockAssembleWorksheet.mockResolvedValue({
      worksheet: sampleWorksheet,
      bankStats,
      provenance,
    });
  });

  it('returns 200 when the bank supplies all questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body has success: true', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(true);
  });

  it('metadata.bankStats.fromBank equals questionCount when bank is fully used', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.fromBank).toBe(10);
  });

  it('metadata.bankStats.generated is 0 when bank covers all questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.generated).toBe(0);
  });

  it('provenanceSummary.usedBank is true when all questions come from the bank', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedBank).toBe(true);
  });

  it('provenanceSummary.usedGeneration is false when bank supplies all questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedGeneration).toBe(false);
  });

  it('assembleWorksheet is called exactly once', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockAssembleWorksheet).toHaveBeenCalledTimes(1);
  });

  it('assembleWorksheet receives the correct grade, subject, topic, difficulty, questionCount', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockAssembleWorksheet).toHaveBeenCalledWith(expect.objectContaining({
      grade:         3,
      subject:       'Math',
      topic:         'Multiplication Facts (1–10)',
      difficulty:    'Medium',
      questionCount: 10,
    }));
  });

});

// ─── 2. Partial bank coverage — assembler calls AI for the remainder ──────────

describe('generateFlow — partial bank coverage (AI gap fill)', () => {

  beforeEach(() => {
    const { bankStats, provenance } = scenarioMeta('partial');
    mockAssembleWorksheet.mockResolvedValue({
      worksheet: sampleWorksheet,
      bankStats,
      provenance,
    });
  });

  it('returns 200 when the bank supplies some questions and AI fills the gap', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('metadata.bankStats.fromBank reflects questions sourced from the bank', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.fromBank).toBe(6);
  });

  it('metadata.bankStats.generated reflects AI-generated gap-fill count', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.generated).toBe(4);
  });

  it('provenanceSummary.usedBank is true when some questions are from bank', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedBank).toBe(true);
  });

  it('provenanceSummary.usedGeneration is true when AI fills the gap', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedGeneration).toBe(true);
  });

  it('provenanceSummary.generatedByModels lists the model used for gap fill', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.generatedByModels).toContain('claude-haiku-4-5-20251001');
  });

  it('worksheetKey and answerKeyKey are both present in the response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('worksheetKey');
    expect(body).toHaveProperty('answerKeyKey');
    expect(body.worksheetKey).toBeTruthy();
    expect(body.answerKeyKey).toBeTruthy();
  });

});

// ─── 3. Empty bank — assembler calls AI for all questions ─────────────────────

describe('generateFlow — empty bank (all AI)', () => {

  // Default beforeEach already sets scenarioMeta('empty') — no additional setup needed.

  it('returns 200 when the bank is empty and AI generates all questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('metadata.bankStats.fromBank is 0 when bank is empty', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.fromBank).toBe(0);
  });

  it('metadata.bankStats.generated equals questionCount when bank is empty', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.bankStats.generated).toBe(10);
  });

  it('provenanceSummary.usedBank is false when bank returns 0 questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedBank).toBe(false);
  });

  it('provenanceSummary.usedGeneration is true when AI generates all questions', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.provenanceSummary.usedGeneration).toBe(true);
  });

  it('response shape includes success, worksheetKey, answerKeyKey, metadata', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('worksheetKey');
    expect(body).toHaveProperty('answerKeyKey');
    expect(body).toHaveProperty('metadata');
  });

});

// ─── 4. Auth enforcement — no Authorization header → 401 ─────────────────────

describe('generateFlow — auth enforcement (401)', () => {

  it('returns 401 when validateToken throws a 401 error', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(401);
  });

  it('response body has success: false on 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('returns WG_UNAUTHORIZED error code on 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_UNAUTHORIZED');
  });

  it('CORS headers are present on 401 response', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('does not call assembleWorksheet when auth fails with 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    await handler(mockEvent(validBody), mockContext);
    expect(mockAssembleWorksheet).not.toHaveBeenCalled();
  });

  it('does not call S3 PutObjectCommand when auth fails with 401', async () => {
    const err = new Error('Missing or invalid Authorization header.');
    err.statusCode = 401;
    mockValidateToken.mockRejectedValueOnce(err);
    await handler(mockEvent(validBody), mockContext);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

});

// ─── 5. Role enforcement — assertRole throws 403 ─────────────────────────────

describe('generateFlow — role enforcement (403)', () => {

  it('returns 403 when assertRole throws a 403 error', async () => {
    const err = new Error('Forbidden: insufficient role.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(403);
  });

  it('response body has success: false on 403', async () => {
    const err = new Error('Forbidden: insufficient role.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('returns WG_FORBIDDEN error code on 403', async () => {
    const err = new Error('Forbidden: insufficient role.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).code).toBe('WG_FORBIDDEN');
  });

  it('CORS headers are present on 403 response', async () => {
    const err = new Error('Forbidden: insufficient role.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('does not call assembleWorksheet when role check fails with 403', async () => {
    const err = new Error('Forbidden: insufficient role.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    await handler(mockEvent(validBody), mockContext);
    expect(mockAssembleWorksheet).not.toHaveBeenCalled();
  });

  it('student role is rejected with 403', async () => {
    // validateToken returns a student token; assertRole enforces the rule
    mockValidateToken.mockResolvedValueOnce({
      sub:   'student-user-456',
      email: 'student@learnfyra.com',
      role:  'student',
    });
    const err = new Error('Forbidden: role student is not allowed.');
    err.statusCode = 403;
    mockAssertRole.mockImplementationOnce(() => { throw err; });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(403);
  });

});

// ─── 6. Worksheet data written to DynamoDB (replaces S3 solve-data.json) ─────

describe('generateFlow — worksheet DynamoDB write', () => {

  it('writes worksheet data to DynamoDB Worksheets table', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut).toBeDefined();
  });

  it('DynamoDB record contains worksheetId', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item).toHaveProperty('worksheetId');
  });

  it('DynamoDB record contains createdAt ISO timestamp', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('DynamoDB record contains questions array', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    const questions = worksheetPut.args[0].input.Item.questions;
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('DynamoDB record contains grade, subject, topic, difficulty', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const item = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test').args[0].input.Item;
    expect(item.grade).toBe(3);
    expect(item.subject).toBe('Math');
    expect(item.topic).toBeDefined();
    expect(item.difficulty).toBe('Medium');
  });

  it('DynamoDB record contains slug for SEO-friendly solve URL', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item).toHaveProperty('slug');
  });

  it('DynamoDB record contains expiresAt TTL', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item).toHaveProperty('expiresAt');
    expect(typeof worksheetPut.args[0].input.Item.expiresAt).toBe('number');
  });

  it('DynamoDB record contains createdBy matching JWT sub', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item.createdBy).toBe('teacher-user-123');
  });

  it('no solve-data.json uploaded to S3', async () => {
    await handler(mockEvent(validBody), mockContext);
    const s3Keys = s3Mock.commandCalls(PutObjectCommand).map(c => c.args[0].input.Key);
    expect(s3Keys.some(k => k.includes('solve-data.json'))).toBe(false);
  });

});

// ─── 7. teacherId in response metadata ────────────────────────────────────────

describe('generateFlow — teacherId from JWT sub', () => {

  it('metadata.teacherId matches the sub claim from the decoded JWT', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.teacherId).toBe('teacher-user-123');
  });

  it('DynamoDB worksheet record contains createdBy from the JWT sub claim', async () => {
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item.createdBy).toBe('teacher-user-123');
  });

  it('metadata.teacherId updates when a different teacher JWT is used', async () => {
    mockValidateToken.mockResolvedValueOnce({
      sub:   'teacher-user-999',
      email: 'otheteacher@learnfyra.com',
      role:  'teacher',
    });
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.teacherId).toBe('teacher-user-999');
  });

  it('DynamoDB createdBy updates when a different teacher JWT is used', async () => {
    mockValidateToken.mockResolvedValueOnce({
      sub:   'teacher-user-999',
      email: 'otherteacher@learnfyra.com',
      role:  'teacher',
    });
    await handler(mockEvent(validBody), mockContext);
    const putCalls = dynamoDocMock.commandCalls(PutCommand);
    const worksheetPut = putCalls.find(c => c.args[0].input.TableName === 'LearnfyraWorksheets-test');
    expect(worksheetPut.args[0].input.Item.createdBy).toBe('teacher-user-999');
  });

  it('admin role is accepted and teacherId is set to admin JWT sub', async () => {
    mockValidateToken.mockResolvedValueOnce({
      sub:   'admin-user-001',
      email: 'admin@learnfyra.com',
      role:  'admin',
    });
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.teacherId).toBe('admin-user-001');
  });

});

// ─── 8. Backward compatibility — response shape ───────────────────────────────

describe('generateFlow — backward-compatible response shape', () => {

  it('response body always contains the success field', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('success');
  });

  it('response body always contains worksheetKey', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('worksheetKey');
  });

  it('response body always contains answerKeyKey (may be null)', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('answerKeyKey');
  });

  it('response body always contains metadata', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body)).toHaveProperty('metadata');
  });

  it('answerKeyKey is null when includeAnswerKey is false', async () => {
    const result = await handler(mockEvent({ ...validBody, includeAnswerKey: false }), mockContext);
    expect(JSON.parse(result.body).answerKeyKey).toBeNull();
  });

  it('answerKeyKey contains answer-key.pdf when includeAnswerKey is true', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).answerKeyKey).toContain('answer-key.pdf');
  });

  it('worksheetKey contains worksheet.pdf for PDF format', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).worksheetKey).toContain('worksheet.pdf');
  });

  it('worksheetKey contains worksheet.docx for Word format', async () => {
    mockExportWorksheet.mockResolvedValueOnce(['/tmp/worksheet.docx']);
    const result = await handler(mockEvent({ ...validBody, format: 'Word (.docx)' }), mockContext);
    expect(JSON.parse(result.body).worksheetKey).toContain('worksheet.docx');
  });

  it('worksheetKey contains worksheet.html for HTML format', async () => {
    mockExportWorksheet.mockResolvedValueOnce(['/tmp/worksheet.html']);
    const result = await handler(mockEvent({ ...validBody, format: 'HTML' }), mockContext);
    expect(JSON.parse(result.body).worksheetKey).toContain('worksheet.html');
  });

  it('metadata contains solveUrl with slug and solveUrlUuid with worksheetId', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.solveUrl).toMatch(/^\/solve\//);
    expect(metadata.solveUrlUuid).toBe(`/solve/${metadata.id}`);
  });

  it('metadata.id matches the worksheetId embedded in the worksheetKey path', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.worksheetKey).toContain(body.metadata.id);
  });

  it('two S3 uploads are made when includeAnswerKey is true (worksheet + answer-key)', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(2);
  });

  it('one S3 upload is made when includeAnswerKey is false (worksheet only)', async () => {
    await handler(mockEvent({ ...validBody, includeAnswerKey: false }), mockContext);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });

  it('CORS headers are present on every 200 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers['Access-Control-Allow-Methods']).toBeDefined();
  });

  it('x-request-id header is present on 200 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['x-request-id']).toBeTruthy();
  });

});

// ─── 9. S3 upload failure → 500 ───────────────────────────────────────────────

describe('generateFlow — S3 upload failure returns 500', () => {

  it('returns 500 when S3 rejects the worksheet PutObjectCommand', async () => {
    s3Mock.on(PutObjectCommand).rejects(new Error('S3 write failed'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('response body has success: false on S3 upload failure', async () => {
    s3Mock.on(PutObjectCommand).rejects(new Error('S3 write failed'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('CORS headers are present on 500 S3-failure response', async () => {
    s3Mock.on(PutObjectCommand).rejects(new Error('S3 write failed'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('500 response contains a machine-readable errorCode', async () => {
    s3Mock.on(PutObjectCommand).rejects(new Error('S3 write failed'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).errorCode).toBeTruthy();
  });

  it('500 response body does not expose the raw internal S3 error message', async () => {
    const internalMsg = 'S3 write failed — AccessDenied on bucket test-integration-bucket';
    s3Mock.on(PutObjectCommand).rejects(new Error(internalMsg));
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.error).not.toContain(internalMsg);
  });

  it('returns 500 when WORKSHEET_BUCKET_NAME env var is missing', async () => {
    const original = process.env.WORKSHEET_BUCKET_NAME;
    delete process.env.WORKSHEET_BUCKET_NAME;
    const result = await handler(mockEvent(validBody), mockContext);
    process.env.WORKSHEET_BUCKET_NAME = original;
    expect(result.statusCode).toBe(500);
  });

  it('CORS headers are present when WORKSHEET_BUCKET_NAME env var is missing', async () => {
    const original = process.env.WORKSHEET_BUCKET_NAME;
    delete process.env.WORKSHEET_BUCKET_NAME;
    const result = await handler(mockEvent(validBody), mockContext);
    process.env.WORKSHEET_BUCKET_NAME = original;
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('returns 500 when assembleWorksheet throws mid-flow', async () => {
    mockAssembleWorksheet.mockRejectedValueOnce(new Error('Anthropic API timeout'));
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(500);
  });

  it('does not make any S3 calls when assembleWorksheet throws', async () => {
    mockAssembleWorksheet.mockRejectedValueOnce(new Error('Anthropic API timeout'));
    await handler(mockEvent(validBody), mockContext);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });

});

// ─── OPTIONS preflight (CORS) ─────────────────────────────────────────────────

describe('generateFlow — OPTIONS preflight', () => {

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

  it('does not call assembleWorksheet for OPTIONS', async () => {
    await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(mockAssembleWorksheet).not.toHaveBeenCalled();
  });

  it('does not validate auth for OPTIONS preflight', async () => {
    await handler(mockEvent({}, 'OPTIONS'), mockContext);
    expect(mockValidateToken).not.toHaveBeenCalled();
  });

});

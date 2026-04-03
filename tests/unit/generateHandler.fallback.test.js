/**
 * @file tests/unit/generateHandler.fallback.test.js
 * @description Unit tests for fallback handling in backend/handlers/generateHandler.js
 *   Tier 3 (none): assembler returns fallbackMode:'none' → HTTP 400, WG_NO_QUESTIONS_AVAILABLE
 *   Tier 2 (partial): assembler returns fallbackMode:'partial' → HTTP 200, metadata.fallbackMode:'partial'
 *   Normal: assembler returns fallbackMode:null → HTTP 200, no fallback fields
 *
 *   Uses the identical mock setup as tests/unit/generateHandler.test.js.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ─── Load fixture ─────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── AWS SDK mocks ────────────────────────────────────────────────────────────

const s3Mock       = mockClient(S3Client);
const ssmMock      = mockClient(SSMClient);
const dynamoDocMock = mockClient(DynamoDBDocumentClient);

// ─── Module mocks (all before any dynamic import) ────────────────────────────

const mockValidateToken  = jest.fn().mockResolvedValue({
  sub: 'teacher-user-123',
  email: 'teacher@learnfyra.com',
  role: 'teacher',
});
const mockAssertRole = jest.fn();
const mockDbGetItem  = jest.fn();
const mockDbListAll  = jest.fn();
const mockDbPutItem  = jest.fn();

const mockBuildStudentKey            = jest.fn().mockReturnValue('student:test-student-1');
const mockResolveEffectiveRepeatCap  = jest.fn().mockResolvedValue({
  capPercent: 10,
  appliedBy: 'default',
  sourceId: null,
});
const mockGetSeenQuestionSignatures  = jest.fn().mockResolvedValue(new Set());
const mockRecordExposureHistory      = jest.fn().mockResolvedValue(0);

// Mock assembleWorksheet — controlled per test
const mockAssembleWorksheet = jest.fn();

// Mock alertService — sendFallbackAlert is fire-and-forget
const mockSendFallbackAlert = jest.fn();

// Mock topicSuggester
const mockSuggestAlternativeTopics = jest.fn().mockResolvedValue([]);

jest.unstable_mockModule('../../backend/middleware/authMiddleware.js', () => ({
  validateToken: mockValidateToken,
  assertRole:    mockAssertRole,
}));

jest.unstable_mockModule('../../src/ai/assembler.js', () => ({
  assembleWorksheet: mockAssembleWorksheet,
}));

jest.unstable_mockModule('../../src/exporters/index.js', () => ({
  exportWorksheet: jest.fn().mockResolvedValue(['/tmp/worksheet.pdf']),
}));

jest.unstable_mockModule('../../src/exporters/answerKey.js', () => ({
  exportAnswerKey: jest.fn().mockResolvedValue(['/tmp/answer-key.pdf']),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem:  mockDbGetItem,
    listAll:  mockDbListAll,
    putItem:  mockDbPutItem,
  })),
}));

jest.unstable_mockModule('../../src/ai/repeatCapPolicy.js', () => ({
  buildStudentKey:             mockBuildStudentKey,
  resolveEffectiveRepeatCap:   mockResolveEffectiveRepeatCap,
  getSeenQuestionSignatures:   mockGetSeenQuestionSignatures,
  recordExposureHistory:       mockRecordExposureHistory,
}));

jest.unstable_mockModule('../../src/notifications/alertService.js', () => ({
  sendFallbackAlert: mockSendFallbackAlert,
}));

jest.unstable_mockModule('../../src/questionBank/topicSuggester.js', () => ({
  suggestAlternativeTopics: mockSuggestAlternativeTopics,
}));

// Mock fs so readFileSync inside uploadToS3 returns a fake buffer
jest.unstable_mockModule('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-file-content')),
  },
}));

// Mock crypto for deterministic UUID
jest.unstable_mockModule('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('fallback-test-uuid-1234'),
}));

// Mock slugify
jest.unstable_mockModule('../../src/utils/slugify.js', () => ({
  generateWorksheetSlug: jest.fn().mockReturnValue('grade-3-math-multiplication-medium-fallback'),
}));

// ─── Dynamic imports ──────────────────────────────────────────────────────────

const { handler } = await import('../../backend/handlers/generateHandler.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  grade:          3,
  subject:        'Math',
  topic:          'Multiplication Facts (1–10)',
  difficulty:     'Medium',
  questionCount:  10,
  format:         'PDF',
  includeAnswerKey: true,
  studentName:    'Ava Johnson',
  worksheetDate:  '2026-03-24',
  teacherName:    'Ms. Carter',
  period:         '2nd',
  className:      'Algebra Readiness',
};

// Builds a worksheet object with given fallbackMode for the assembler mock
function makeFallbackWorksheet(fallbackMode, questionCount = 0) {
  const questions = fallbackMode === 'partial'
    ? Array.from({ length: questionCount }, (_, i) => ({
        number: i + 1, type: 'fill-in-the-blank', question: `Q${i + 1}`,
        answer: 'A', explanation: 'E', points: 1,
      }))
    : [];

  return {
    ...sampleWorksheet,
    fallbackMode: fallbackMode,
    fallbackReason: fallbackMode ? 'Claude returned empty response.' : null,
    requestedCount: 10,
    actualCount: questions.length,
    questions,
    totalPoints: questions.length,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  s3Mock.reset();
  ssmMock.reset();
  dynamoDocMock.reset();
  jest.clearAllMocks();

  process.env.ANTHROPIC_API_KEY  = 'sk-ant-test-key';
  process.env.WORKSHEET_BUCKET_NAME = 'test-bucket';
  process.env.GUEST_SESSIONS_TABLE  = 'LearnfyraGuestSessions-test';

  // Default: normal path (no fallback)
  mockAssembleWorksheet.mockResolvedValue({
    worksheet: { ...sampleWorksheet, fallbackMode: null, fallbackReason: null, requestedCount: 10, actualCount: 10 },
    bankStats: { fromBank: 0, generated: 10, totalStored: 10, fallbackUsed: false },
    provenance: {
      mode: 'bank-first', level: 'summary',
      usedBank: false, usedGeneration: true,
      selectedBankCount: 0, generatedCount: 10, storedGeneratedCount: 10,
      bankedQuestionIds: [], generatedByModels: ['claude-haiku-4-5-20251001'],
    },
  });

  mockValidateToken.mockResolvedValue({
    sub: 'teacher-user-123', email: 'teacher@learnfyra.com', role: 'teacher',
  });
  mockAssertRole.mockImplementation(() => {});
  mockBuildStudentKey.mockReturnValue('student:test-student-1');
  mockResolveEffectiveRepeatCap.mockResolvedValue({ capPercent: 10, appliedBy: 'default', sourceId: null });
  mockGetSeenQuestionSignatures.mockResolvedValue(new Set());
  mockRecordExposureHistory.mockResolvedValue(0);
  mockSuggestAlternativeTopics.mockResolvedValue(['Addition', 'Division', 'Fractions']);
  mockSendFallbackAlert.mockImplementation(() => undefined);

  s3Mock.on(PutObjectCommand).resolves({});
  dynamoDocMock.on(PutCommand).resolves({});
});

// ─── Normal path ──────────────────────────────────────────────────────────────

describe('generateHandler — normal path (no fallback)', () => {

  it('returns HTTP 200 when assembler returns fallbackMode null', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body has success: true on normal path', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(true);
  });

  it('metadata does not include fallbackMode on normal path', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.fallbackMode).toBeUndefined();
  });

  it('does not call sendFallbackAlert on normal path', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockSendFallbackAlert).not.toHaveBeenCalled();
  });

  it('does not call suggestAlternativeTopics on normal path', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockSuggestAlternativeTopics).not.toHaveBeenCalled();
  });

});

// ─── Tier 3: fallbackMode none ────────────────────────────────────────────────

describe('generateHandler — Tier 3 fallback (fallbackMode: none)', () => {

  beforeEach(() => {
    mockAssembleWorksheet.mockResolvedValue({
      worksheet: makeFallbackWorksheet('none', 0),
      bankStats: { fromBank: 0, generated: 0, totalStored: 0, fallbackUsed: true },
      provenance: {
        mode: 'bank-first', level: 'summary',
        usedBank: false, usedGeneration: false,
        selectedBankCount: 0, generatedCount: 0, storedGeneratedCount: 0,
        bankedQuestionIds: [], generatedByModels: [],
      },
    });
  });

  it('returns HTTP 400 when fallbackMode is none', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('response body has success: false on Tier 3', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(false);
  });

  it('response body includes code WG_NO_QUESTIONS_AVAILABLE on Tier 3', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).toBe('WG_NO_QUESTIONS_AVAILABLE');
  });

  it('response body includes fallbackMode: none', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.fallbackMode).toBe('none');
  });

  it('metadata.similarTopics is populated with suggestions on Tier 3', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(Array.isArray(metadata.similarTopics)).toBe(true);
    expect(metadata.similarTopics.length).toBeGreaterThan(0);
  });

  it('suggestAlternativeTopics is called with correct grade, subject, topic', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockSuggestAlternativeTopics).toHaveBeenCalledWith(3, 'Math', 'Multiplication Facts (1–10)');
  });

  it('sendFallbackAlert is called for Tier 3', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockSendFallbackAlert).toHaveBeenCalledTimes(1);
  });

  it('sendFallbackAlert is called with correct context fields', async () => {
    await handler(mockEvent(validBody), mockContext);
    const [alertCtx] = mockSendFallbackAlert.mock.calls[0];
    expect(alertCtx.grade).toBe(3);
    expect(alertCtx.subject).toBe('Math');
    expect(alertCtx.topic).toBe('Multiplication Facts (1–10)');
    expect(alertCtx.difficulty).toBe('Medium');
    expect(alertCtx.fallbackMode).toBe('none');
  });

  it('metadata.questionCount is 0 on Tier 3', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.questionCount).toBe(0);
  });

  it('metadata.requestedCount reflects the original request on Tier 3', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.requestedCount).toBe(10);
  });

  it('CORS headers are present on Tier 3 (400) response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('metadata.adminNotified is true when sendFallbackAlert fires without error', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.adminNotified).toBe(true);
  });

  it('response still returns 400 when topic suggestion throws', async () => {
    mockSuggestAlternativeTopics.mockRejectedValueOnce(new Error('Suggester down'));

    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('similarTopics defaults to empty array when topic suggestion throws', async () => {
    mockSuggestAlternativeTopics.mockRejectedValueOnce(new Error('Suggester down'));

    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(Array.isArray(metadata.similarTopics)).toBe(true);
    expect(metadata.similarTopics).toHaveLength(0);
  });

  it('response includes requestId in Tier 3 body', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.requestId).toBeTruthy();
  });

});

// ─── Tier 2: fallbackMode partial ────────────────────────────────────────────

describe('generateHandler — Tier 2 fallback (fallbackMode: partial)', () => {

  beforeEach(() => {
    mockAssembleWorksheet.mockResolvedValue({
      worksheet: makeFallbackWorksheet('partial', 3),
      bankStats: { fromBank: 3, generated: 0, totalStored: 0, fallbackUsed: true },
      provenance: {
        mode: 'bank-first', level: 'summary',
        usedBank: true, usedGeneration: false,
        selectedBankCount: 3, generatedCount: 0, storedGeneratedCount: 0,
        bankedQuestionIds: ['bq-1', 'bq-2', 'bq-3'], generatedByModels: [],
      },
    });
  });

  it('returns HTTP 200 when fallbackMode is partial', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('response body has success: true on Tier 2', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(JSON.parse(result.body).success).toBe(true);
  });

  it('metadata.fallbackMode is partial on Tier 2 response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.fallbackMode).toBe('partial');
  });

  it('CORS headers are present on Tier 2 (200) response', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
  });

  it('sendFallbackAlert is called for Tier 2 as well', async () => {
    await handler(mockEvent(validBody), mockContext);
    expect(mockSendFallbackAlert).toHaveBeenCalledTimes(1);
    const [alertCtx] = mockSendFallbackAlert.mock.calls[0];
    expect(alertCtx.fallbackMode).toBe('partial');
  });

  it('response contains worksheetKey and answerKeyKey on Tier 2', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('worksheetKey');
    expect(body).toHaveProperty('answerKeyKey');
  });

  it('metadata includes fallbackReason string on Tier 2', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(typeof metadata.fallbackReason).toBe('string');
    expect(metadata.fallbackReason.length).toBeGreaterThan(0);
  });

  it('response includes requestedCount and similarTopics in metadata on Tier 2', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata).toHaveProperty('requestedCount');
    expect(metadata).toHaveProperty('similarTopics');
  });

  it('does not return code WG_NO_QUESTIONS_AVAILABLE on Tier 2', async () => {
    const result = await handler(mockEvent(validBody), mockContext);
    const body = JSON.parse(result.body);
    expect(body.code).not.toBe('WG_NO_QUESTIONS_AVAILABLE');
  });

});

// ─── Alert and suggestion failure isolation ───────────────────────────────────

describe('generateHandler — fallback resilience', () => {

  beforeEach(() => {
    mockAssembleWorksheet.mockResolvedValue({
      worksheet: makeFallbackWorksheet('none', 0),
      bankStats: { fromBank: 0, generated: 0, totalStored: 0, fallbackUsed: true },
      provenance: {
        mode: 'bank-first', level: 'summary',
        usedBank: false, usedGeneration: false,
        selectedBankCount: 0, generatedCount: 0, storedGeneratedCount: 0,
        bankedQuestionIds: [], generatedByModels: [],
      },
    });
  });

  it('Tier 3 returns valid 400 response even when sendFallbackAlert throws synchronously', async () => {
    mockSendFallbackAlert.mockImplementation(() => { throw new Error('Alert boom'); });

    const result = await handler(mockEvent(validBody), mockContext);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).code).toBe('WG_NO_QUESTIONS_AVAILABLE');
  });

  it('Tier 3 metadata.adminNotified is false when sendFallbackAlert throws', async () => {
    mockSendFallbackAlert.mockImplementation(() => { throw new Error('Alert boom'); });

    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.adminNotified).toBe(false);
  });

  it('Tier 3 returns empty similarTopics array when suggestion fails', async () => {
    mockSuggestAlternativeTopics.mockRejectedValue(new Error('Suggester unavailable'));

    const result = await handler(mockEvent(validBody), mockContext);
    const { metadata } = JSON.parse(result.body);
    expect(metadata.similarTopics).toEqual([]);
  });

});

/**
 * @file backend/handlers/generateHandler.js
 * @description Lambda handler — POST /api/generate
 *
 * Flow:
 *   1. Validate request body
 *   2. Call generateWorksheet() → worksheet JSON
 *   3. Write exported file(s) to /tmp
 *   4. Upload worksheet file to S3
 *   5. Upload answer key file to S3 (if requested)
 *   6. Return S3 keys + metadata
 *
 * Cold-start optimisation: all heavy imports are lazy (inside the handler or
 * inside helper functions) so the module itself loads instantly.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { validateGenerateBody } from '../middleware/validator.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// Lazy AWS client getters — instantiated on first invocation, not at module
// scope, to keep cold-start overhead minimal and match the project pattern (W4).
let _s3, _ssm;
function getS3()  { if (!_s3)  _s3  = new S3Client({});  return _s3;  }
function getSsm() { if (!_ssm) _ssm = new SSMClient({}); return _ssm; }

const DIAGNOSTIC_HEADERS = 'x-request-id,x-client-request-id';

// Promise singleton — resolves once per cold start, concurrent callers share
// the same in-flight request instead of racing to fetch the parameter.
let _apiKeyPromise;

/**
 * Fetches the Anthropic API key from SSM Parameter Store on first invocation
 * and sets it as process.env.ANTHROPIC_API_KEY so client.js can read it.
 * Skipped when the env var is already set (local dev / unit tests).
 * Concurrent callers share the same Promise so SSM is only called once.
 */
async function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return;
  if (_apiKeyPromise) return _apiKeyPromise;
  _apiKeyPromise = (async () => {
    const paramName = process.env.SSM_PARAM_NAME;
    if (!paramName) {
      throw new Error('SSM_PARAM_NAME env var is not set.');
    }
    const { Parameter } = await getSsm().send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    }));
    process.env.ANTHROPIC_API_KEY = Parameter.Value;
  })();
  return _apiKeyPromise;
}

// Lazy import helpers — only loaded on first real invocation
let _validateToken;
let _assertRole;
let _assembleWorksheet;
let _exportWorksheet;
let _exportAnswerKey;
let _getDbAdapter;
let _buildStudentKey;
let _resolveEffectiveRepeatCap;
let _getSeenQuestionSignatures;
let _recordExposureHistory;

/**
 * Returns validateToken and assertRole from authMiddleware, importing on first call.
 * @returns {Promise<{ validateToken: Function, assertRole: Function }>}
 */
async function getAuthMiddleware() {
  if (!_validateToken) {
    const mod = await import('../middleware/authMiddleware.js');
    _validateToken = mod.validateToken;
    _assertRole    = mod.assertRole;
  }
  return { validateToken: _validateToken, assertRole: _assertRole };
}

/**
 * Returns the assembleWorksheet function (M03 bank-first pipeline),
 * importing it on first call.
 * @returns {Promise<Function>}
 */
async function getAssembleWorksheet() {
  if (!_assembleWorksheet) {
    const mod = await import('../../src/ai/assembler.js');
    _assembleWorksheet = mod.assembleWorksheet;
  }
  return _assembleWorksheet;
}

/**
 * Returns the exportWorksheet function, importing it on first call.
 * @returns {Promise<Function>}
 */
async function getExportWorksheet() {
  if (!_exportWorksheet) {
    const mod = await import('../../src/exporters/index.js');
    _exportWorksheet = mod.exportWorksheet;
  }
  return _exportWorksheet;
}

/**
 * Returns the exportAnswerKey function, importing it on first call.
 * @returns {Promise<Function>}
 */
async function getExportAnswerKey() {
  if (!_exportAnswerKey) {
    const mod = await import('../../src/exporters/answerKey.js');
    _exportAnswerKey = mod.exportAnswerKey;
  }
  return _exportAnswerKey;
}

/**
 * Returns the DB adapter factory, importing on first call.
 * @returns {Promise<Function>}
 */
async function getDbAdapterFactory() {
  if (!_getDbAdapter) {
    const mod = await import('../../src/db/index.js');
    _getDbAdapter = mod.getDbAdapter;
  }
  return _getDbAdapter;
}

/**
 * Returns repeat-cap helpers, importing on first call.
 * @returns {Promise<Object>}
 */
async function getRepeatCapHelpers() {
  if (!_buildStudentKey) {
    const mod = await import('../../src/ai/repeatCapPolicy.js');
    _buildStudentKey = mod.buildStudentKey;
    _resolveEffectiveRepeatCap = mod.resolveEffectiveRepeatCap;
    _getSeenQuestionSignatures = mod.getSeenQuestionSignatures;
    _recordExposureHistory = mod.recordExposureHistory;
  }

  return {
    buildStudentKey: _buildStudentKey,
    resolveEffectiveRepeatCap: _resolveEffectiveRepeatCap,
    getSeenQuestionSignatures: _getSeenQuestionSignatures,
    recordExposureHistory: _recordExposureHistory,
  };
}

/** Maps user-facing format names to file extensions */
const FORMAT_EXT = {
  'PDF': 'pdf',
  'Word (.docx)': 'docx',
  'HTML': 'html',
};

/**
 * Uploads a local /tmp file to S3 and returns the S3 key.
 * BUCKET is read inside this function (not at module scope) so Lambda does not
 * fail at cold-start when the env var has not yet been injected (W5).
 * @param {string} localPath - Absolute path to the file in /tmp
 * @param {string} s3Key - Destination S3 key
 * @param {string} contentType - MIME type for the object
 * @returns {Promise<string>} The S3 key that was written
 */
async function uploadToS3(localPath, s3Key, contentType) {
  const bucket = process.env.WORKSHEET_BUCKET_NAME;
  if (!bucket) throw new Error('WORKSHEET_BUCKET_NAME environment variable is not set.');
  const body = await fs.readFile(localPath);
  await getS3().send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: body,
    ContentType: contentType,
  }));
  return s3Key;
}

/**
 * Serialises a JSON object and uploads it directly to S3 (no local temp file).
 * Used for solve-data.json which is built in memory rather than exported to /tmp.
 * @param {string} s3Key - Destination S3 key
 * @param {Object} data  - JSON-serialisable object
 * @returns {Promise<string>} The S3 key that was written
 */
async function uploadJsonToS3(s3Key, data) {
  const bucket = process.env.WORKSHEET_BUCKET_NAME;
  if (!bucket) throw new Error('WORKSHEET_BUCKET_NAME environment variable is not set.');
  await getS3().send(new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
  return s3Key;
}

/**
 * Returns the MIME type for a given file extension.
 * @param {string} ext - File extension (pdf | docx | html)
 * @returns {string} MIME type string
 */
function mimeType(ext) {
  switch (ext) {
    case 'pdf':  return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'html': return 'text/html';
    default:     return 'application/octet-stream';
  }
}

/**
 * Maps thrown errors to stable machine-readable error codes.
 * @param {Error & { code?: string }} err
 * @returns {string}
 */
function mapGenerationErrorCode(err) {
  if (err?.code) return err.code;
  const message = String(err?.message || '').toLowerCase();
  if (message.includes('empty response')) return 'WG_GENERATION_EMPTY_RESPONSE';
  if (message.includes('max_tokens') || message.includes('truncated')) return 'WG_GENERATION_TRUNCATED';
  if (message.includes('expected exactly')) return 'WG_GENERATION_COUNT_MISMATCH';
  if (message.includes('refused')) return 'WG_GENERATION_REFUSED';
  if (message.includes('validation')) return 'WG_VALIDATION_FAILED';
  if (message.includes('repeat cap')) return 'WG_REPEAT_CAP_CONSTRAINT';
  if (message.includes('bucket') || message.includes('upload')) return 'WG_UPLOAD_FAILED';
  return 'WG_GENERATION_FAILED';
}

function getHeader(headers, key) {
  if (!headers) return null;

  const target = key.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() === target) {
      return headerValue;
    }
  }

  return null;
}

function buildHeaders(requestId, clientRequestId) {
  return {
    ...corsHeaders,
    'Access-Control-Expose-Headers': DIAGNOSTIC_HEADERS,
    'x-request-id': requestId,
    ...(clientRequestId ? { 'x-client-request-id': clientRequestId } : {}),
  };
}

function logEvent(level, message, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...details,
  };

  console[level](JSON.stringify(entry));
}

function serializeError(err) {
  const error = err instanceof Error ? err : new Error(String(err));
  const out = { name: error.name, message: error.message };
  if (process.env.NODE_ENV !== 'production') {
    out.stack = error.stack;
  }
  return out;
}

function createErrorResponse({ requestId, clientRequestId, statusCode, error, errorCode, code, stage }) {
  return {
    statusCode,
    headers: buildHeaders(requestId, clientRequestId),
    body: JSON.stringify({
      success: false,
      error,
      errorCode,
      ...(code ? { code } : {}),
      errorStage: stage,
      requestId,
      clientRequestId,
    }),
  };
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const requestStart = Date.now();
  const requestId = event?.requestContext?.requestId || context?.awsRequestId || randomUUID();
  const rawClientRequestId = getHeader(event?.headers, 'x-client-request-id');
  const clientRequestId = (typeof rawClientRequestId === 'string')
    ? rawClientRequestId.replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 64) || null
    : null;
  let stage = 'request:start';

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: buildHeaders(requestId, clientRequestId), body: '' };
  }

  try {
    logEvent('info', 'generateHandler request started', {
      requestId,
      clientRequestId,
      stage,
      httpMethod: event?.httpMethod,
      path: event?.path || event?.resource,
    });

    // 0a. Auth enforcement — teacher or admin JWT required
    let decoded;
    try {
      stage = 'auth:validate-token';
      const { validateToken: doValidate, assertRole: doAssertRole } = await getAuthMiddleware();
      decoded = await doValidate(event);
      doAssertRole(decoded, ['teacher', 'admin', 'student']);
    } catch (err) {
      return createErrorResponse({
        requestId,
        clientRequestId,
        statusCode: err.statusCode || 401,
        error: err.message,
        errorCode: err.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        code: err.statusCode === 403 ? 'WG_FORBIDDEN' : 'WG_UNAUTHORIZED',
        stage,
      });
    }
    const teacherId = decoded.sub;
    if (typeof teacherId !== 'string' || !/^[\w\-]{1,128}$/.test(teacherId)) {
      return createErrorResponse({
        requestId,
        clientRequestId,
        statusCode: 401,
        error: 'Invalid token subject.',
        errorCode: 'UNAUTHORIZED',
        code: 'WG_UNAUTHORIZED',
        stage,
      });
    }

    // 0b. Ensure API key is available (fetches from SSM on first cold start)
    stage = 'auth:load-api-key';
    await loadApiKey();
    logEvent('info', 'generateHandler api key ready', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
    });

    // 1. Parse and validate request body
    let body;
    try {
      stage = 'request:parse-body';
      body = JSON.parse(event.body || '{}');
    } catch {
      logEvent('warn', 'generateHandler invalid JSON body', {
        requestId,
        clientRequestId,
        stage,
      });
      return createErrorResponse({
        requestId,
        clientRequestId,
        statusCode: 400,
        error: 'Invalid JSON in request body.',
        errorCode: 'INVALID_JSON',
        code: 'WG_INVALID_REQUEST',
        stage,
      });
    }

    let validated;
    try {
      stage = 'request:validate-body';
      validated = validateGenerateBody(body);
    } catch (err) {
      logEvent('warn', 'generateHandler request validation failed', {
        requestId,
        clientRequestId,
        stage,
        error: serializeError(err),
      });
      return createErrorResponse({
        requestId,
        clientRequestId,
        statusCode: 400,
        error: err.message,
        errorCode: 'VALIDATION_ERROR',
        code: 'WG_INVALID_REQUEST',
        stage,
      });
    }

    const {
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      includeAnswerKey,
      generationMode,
      provenanceLevel,
      studentName,
      worksheetDate,
      teacherName,
      period,
      className,
      studentId,
      parentId,
    } = validated;
    const ext = FORMAT_EXT[format];
    const uuid = randomUUID();
    const now = new Date();
    const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
    const baseKey = `worksheets/${datePath}/${uuid}`;
    const outputDir = '/tmp';

    logEvent('info', 'generateHandler request validated', {
      requestId,
      clientRequestId,
      stage,
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      includeAnswerKey,
      generationMode,
      provenanceLevel,
      hasStudentKeyInput: Boolean(studentId || studentName),
    });

    // 1.5 Resolve repeat-cap policy and history context before assembly.
    const getDbAdapter = await getDbAdapterFactory();
    const db = getDbAdapter();
    const {
      buildStudentKey,
      resolveEffectiveRepeatCap,
      getSeenQuestionSignatures,
      recordExposureHistory,
    } = await getRepeatCapHelpers();

    const studentKey = buildStudentKey({ studentId, studentName, teacherId });
    const repeatPolicy = await resolveEffectiveRepeatCap({
      db,
      studentId,
      parentId,
      teacherId,
    });

    const seenQuestionSignatures = await getSeenQuestionSignatures({
      db,
      studentKey,
      grade,
      difficulty,
    });

        // 2. Assemble worksheet JSON via M03 bank-first pipeline
    stage = 'worksheet:generate';
        const assembleWorksheet = await getAssembleWorksheet();
        const { worksheet, bankStats, provenance } = await assembleWorksheet({
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      generationMode,
      provenanceLevel,
      repeatCapPercent: repeatPolicy.capPercent,
      seenQuestionSignatures,
        });
    logEvent('info', 'generateHandler worksheet generated', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      totalPoints: worksheet.totalPoints,
      questionCount: Array.isArray(worksheet.questions) ? worksheet.questions.length : null,
    });

    // 3. Export worksheet file to /tmp
    stage = 'worksheet:export';
    const exportWorksheet = await getExportWorksheet();
    const worksheetPaths = await exportWorksheet(worksheet, {
      grade, subject, topic, difficulty,
      format,
      includeAnswerKey: false, // answer key handled separately below
      studentName,
      worksheetDate,
      teacherName,
      period,
      className,
      outputDir,
    });
    const worksheetLocalPath = worksheetPaths[0];
    logEvent('info', 'generateHandler worksheet exported', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      worksheetFilename: worksheetLocalPath.split(/[\\/]/).pop(),
    });

    // 4. Upload worksheet to S3
    stage = 'worksheet:upload';
    const worksheetKey = `${baseKey}/worksheet.${ext}`;
    await uploadToS3(worksheetLocalPath, worksheetKey, mimeType(ext));
    logEvent('info', 'generateHandler worksheet uploaded', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      worksheetKey,
      bucket: process.env.WORKSHEET_BUCKET_NAME,
    });

    // 5. Upload solve-data.json to S3 — full worksheet with answers for online scoring
    stage = 'solve-data:upload';
    const solveData = {
      worksheetId: uuid,
      generatedAt: now.toISOString(),
      teacherId,
      studentId: studentId || null,
      parentId: parentId || null,
      studentKey,
      repeatCapPolicy: {
        effectiveCapPercent: repeatPolicy.capPercent,
        appliedBy: repeatPolicy.appliedBy,
        sourceId: repeatPolicy.sourceId,
      },
      ...worksheet,
    };
    const solveDataKey = `${baseKey}/solve-data.json`;
    await uploadJsonToS3(solveDataKey, solveData);
    logEvent('info', 'generateHandler solve-data uploaded', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      solveDataKey,
    });

    // 7. Export and upload answer key (if requested)
    let answerKeyKey = null;
    if (includeAnswerKey) {
      stage = 'answer-key:export';
      const exportAnswerKey = await getExportAnswerKey();
      const answerKeyPaths = await exportAnswerKey(worksheet, {
        grade, subject, topic, difficulty,
        format,
        studentName,
        worksheetDate,
        teacherName,
        period,
        className,
        outputDir,
      });
      if (answerKeyPaths.length > 0) {
        stage = 'answer-key:upload';
        answerKeyKey = `${baseKey}/answer-key.${ext}`;
        await uploadToS3(answerKeyPaths[0], answerKeyKey, mimeType(ext));
        logEvent('info', 'generateHandler answer key uploaded', {
          requestId,
          clientRequestId,
          stage,
          elapsedMs: Date.now() - requestStart,
          answerKeyKey,
          bucket: process.env.WORKSHEET_BUCKET_NAME,
        });
      }
    }

    // 8. Build metadata and return
    stage = 'response:success';

    // Record exposure only after successful generation and storage writes.
    // Best-effort: generation success should not be rolled back if history write fails.
    try {
      await recordExposureHistory({
        db,
        studentKey,
        grade,
        difficulty,
        teacherId,
        parentId,
        worksheetId: uuid,
        questions: worksheet.questions,
      });
    } catch (historyErr) {
      logEvent('warn', 'generateHandler exposure history write failed', {
        requestId,
        clientRequestId,
        stage,
        error: serializeError(historyErr),
      });
    }

    const metadata = {
      id: uuid,
      solveUrl: `/solve/${uuid}`,
      generatedAt: now.toISOString(),
      teacherId,
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      bankStats,
      repeatCapPolicy: {
        effectiveCapPercent: repeatPolicy.capPercent,
        appliedBy: repeatPolicy.appliedBy,
        sourceId: repeatPolicy.sourceId,
        studentTracked: Boolean(studentKey),
      },
      ...(provenance ? { provenanceSummary: provenance } : {}),
      studentDetails: {
        studentName,
        studentId,
        parentId,
        worksheetDate,
        teacherName,
        period,
        className,
      },
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return {
      statusCode: 200,
      headers: buildHeaders(requestId, clientRequestId),
      body: JSON.stringify({
        success: true,
        worksheetKey,
        answerKeyKey,
        metadata,
        requestId,
        clientRequestId,
      }),
    };
  } catch (err) {
    logEvent('error', 'generateHandler request failed', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      error: serializeError(err),
    });

    const isDebug = process.env.DEBUG_MODE === 'true';
    const errResponse = createErrorResponse({
      requestId,
      clientRequestId,
      statusCode: 500,
      error: isDebug ? err.message : 'Worksheet generation failed. Please try again.',
      errorCode: 'GENERATION_FAILED',
      code: mapGenerationErrorCode(err),
      stage,
    });
    if (isDebug) {
      const parsedBody = JSON.parse(errResponse.body);
      parsedBody._debug = { stack: err.stack, handler: 'generateHandler', statusCode: 500, timestamp: new Date().toISOString() };
      errResponse.body = JSON.stringify(parsedBody);
    }
    return errResponse;
  }
};

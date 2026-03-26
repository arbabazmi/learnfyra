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

// Cache the API key in module scope so it is only fetched once per cold start.
let _apiKeyLoaded = false;

/**
 * Fetches the Anthropic API key from SSM Parameter Store on first invocation
 * and sets it as process.env.ANTHROPIC_API_KEY so client.js can read it.
 * Skipped when the env var is already set (local dev / unit tests).
 */
async function loadApiKey() {
  if (_apiKeyLoaded || process.env.ANTHROPIC_API_KEY) {
    _apiKeyLoaded = true;
    return;
  }
  const paramName = process.env.SSM_PARAM_NAME;
  if (!paramName) {
    throw new Error('SSM_PARAM_NAME env var is not set.');
  }
  const { Parameter } = await getSsm().send(new GetParameterCommand({
    Name: paramName,
    WithDecryption: true,
  }));
  process.env.ANTHROPIC_API_KEY = Parameter.Value;
  _apiKeyLoaded = true;
}

// Lazy import helpers — only loaded on first real invocation
let _assembleWorksheet;
let _exportWorksheet;
let _exportAnswerKey;

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
  if (message.includes('bucket') || message.includes('upload')) return 'WG_UPLOAD_FAILED';
  return 'WG_GENERATION_FAILED';
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // 0. Ensure API key is available (fetches from SSM on first cold start)
    await loadApiKey();

    // 1. Parse and validate request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body.',
          code: 'WG_INVALID_REQUEST',
        }),
      };
    }

    let validated;
    try {
      validated = validateGenerateBody(body);
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: err.message,
          code: 'WG_INVALID_REQUEST',
        }),
      };
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
    } = validated;
    const ext = FORMAT_EXT[format];
    const uuid = randomUUID();
    const now = new Date();
    const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
    const baseKey = `worksheets/${datePath}/${uuid}`;
    const outputDir = '/tmp';

    // 2. Assemble worksheet JSON via M03 bank-first pipeline
    const assembleWorksheet = await getAssembleWorksheet();
    const { worksheet, bankStats, provenance } = await assembleWorksheet({
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      generationMode,
      provenanceLevel,
    });

    // 3. Export worksheet file to /tmp
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

    // 4. Upload worksheet to S3
    const worksheetKey = `${baseKey}/worksheet.${ext}`;
    await uploadToS3(worksheetLocalPath, worksheetKey, mimeType(ext));

    // 5. Export and upload answer key (if requested)
    let answerKeyKey = null;
    if (includeAnswerKey) {
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
        answerKeyKey = `${baseKey}/answer-key.${ext}`;
        await uploadToS3(answerKeyPaths[0], answerKeyKey, mimeType(ext));
      }
    }

    // 6. Build metadata and return
    const metadata = {
      id: uuid,
      generatedAt: now.toISOString(),
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      bankStats,
      ...(provenance ? { provenanceSummary: provenance } : {}),
      studentDetails: {
        studentName,
        worksheetDate,
        teacherName,
        period,
        className,
      },
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        worksheetKey,
        answerKeyKey,
        metadata,
      }),
    };
  } catch (err) {
    console.error('generateHandler error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Worksheet generation failed. Please try again.',
        code: mapGenerationErrorCode(err),
      }),
    };
  }
};

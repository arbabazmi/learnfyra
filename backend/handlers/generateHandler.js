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
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { validateGenerateBody } from '../middleware/validator.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const s3   = new S3Client({});
const ssm  = new SSMClient({});
const BUCKET = process.env.WORKSHEET_BUCKET_NAME;

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
  const { Parameter } = await ssm.send(new GetParameterCommand({
    Name: paramName,
    WithDecryption: true,
  }));
  process.env.ANTHROPIC_API_KEY = Parameter.Value;
  _apiKeyLoaded = true;
}

// Lazy import helpers — only loaded on first real invocation
let _generateWorksheet;
let _exportWorksheet;
let _exportAnswerKey;

/**
 * Returns the generateWorksheet function, importing it on first call.
 * @returns {Promise<Function>}
 */
async function getGenerateWorksheet() {
  if (!_generateWorksheet) {
    const mod = await import('../../src/ai/generator.js');
    _generateWorksheet = mod.generateWorksheet;
  }
  return _generateWorksheet;
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
 * @param {string} localPath - Absolute path to the file in /tmp
 * @param {string} s3Key - Destination S3 key
 * @param {string} contentType - MIME type for the object
 * @returns {Promise<string>} The S3 key that was written
 */
async function uploadToS3(localPath, s3Key, contentType) {
  const body = readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
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
        body: JSON.stringify({ success: false, error: 'Invalid JSON in request body.' }),
      };
    }

    let validated;
    try {
      validated = validateGenerateBody(body);
    } catch (err) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: err.message }),
      };
    }

    const { grade, subject, topic, difficulty, questionCount, format, includeAnswerKey } = validated;
    const ext = FORMAT_EXT[format];
    const uuid = randomUUID();
    const now = new Date();
    const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
    const baseKey = `worksheets/${datePath}/${uuid}`;
    const outputDir = '/tmp';

    // 2. Generate worksheet JSON via Claude API
    const generateWorksheet = await getGenerateWorksheet();
    const worksheet = await generateWorksheet({ grade, subject, topic, difficulty, questionCount });

    // 3. Export worksheet file to /tmp
    const exportWorksheet = await getExportWorksheet();
    const worksheetPaths = await exportWorksheet(worksheet, {
      grade, subject, topic, difficulty,
      format,
      includeAnswerKey: false, // answer key handled separately below
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
      }),
    };
  }
};

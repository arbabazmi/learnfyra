/**
 * @file backend/handlers/submitHandler.js
 * @description Lambda-compatible handler for POST /api/submit.
 * Reads the stored solve-data.json, scores the student's answers, and returns
 * a full per-question result breakdown.
 *
 * Local dev:  reads worksheets-local/{worksheetId}/solve-data.json
 * Lambda/AWS: S3 integration to be wired in the CDK stack (Phase 5)
 */

import { promises as fs } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

// __dirname is not available in Lambda CJS bundle; use process.cwd() for root
const __dirname = process.cwd();

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const WORKSHEET_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the submitted answers array without rejecting valid partial submissions.
 * @param {unknown[]} answers
 * @returns {string|null}
 */
function validateAnswersArray(answers) {
  const seenNumbers = new Set();
  for (const entry of answers) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return 'Each answers entry must be an object.';
    }

    const number = Number(entry.number);
    if (!Number.isInteger(number) || number < 1) {
      return 'Each answers entry must include a positive integer number.';
    }

    if (seenNumbers.has(number)) {
      return 'answers must not contain duplicate question numbers.';
    }
    seenNumbers.add(number);
  }

  return null;
}

/**
 * Ensures a resolved child directory remains inside the base directory.
 * Uses case-insensitive comparison on Windows.
 * @param {string} baseDir
 * @param {string} childDir
 * @returns {boolean}
 */
function isWithinBaseDir(baseDir, childDir) {
  const normalize = process.platform === 'win32'
    ? (value) => value.toLowerCase()
    : (value) => value;
  const base = normalize(baseDir);
  const child = normalize(childDir);
  return child.startsWith(base + sep);
}

// Lazy-load resultBuilder to keep module load time fast
let _buildResult;
async function getBuildResult() {
  if (!_buildResult) {
    const mod = await import('../../src/solve/resultBuilder.js');
    _buildResult = mod.buildResult;
  }
  return _buildResult;
}

/**
 * Lambda handler — POST /api/submit
 *
 * Request body:
 *   { worksheetId, studentName?, answers: [{number, answer}], timeTaken, timed }
 *
 * @param {Object} event - API Gateway event or Express-shaped mock event
 * @param {Object} [context] - Lambda context (optional in local dev)
 * @returns {Promise<{statusCode: number, headers: Object, body: string}>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid JSON in request body.',
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    const { worksheetId, answers, timeTaken, timed } = body;
    const studentName = typeof body.studentName === 'string'
      ? body.studentName.trim().slice(0, 100)
      : '';

    if (!worksheetId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'worksheetId is required.',
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    // Guard against path traversal: worksheetId must be a v4 UUID
    if (!WORKSHEET_ID_REGEX.test(worksheetId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid worksheetId format.',
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    if (!Array.isArray(answers)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'answers must be an array.',
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    const answersValidationError = validateAnswersArray(answers);
    if (answersValidationError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: answersValidationError,
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    // Local dev: process.cwd() is already the project root
    const baseDir = resolve(join(__dirname, 'worksheets-local'));
    const localDir = resolve(join(baseDir, worksheetId));

    // Ensure the resolved path stays within the worksheets-local directory
    if (!isWithinBaseDir(baseDir, localDir)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid worksheetId format.',
          code: 'SUBMIT_INVALID_REQUEST',
        }),
      };
    }

    const filePath = join(localDir, 'solve-data.json');

    let worksheet;
    try {
      worksheet = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Worksheet not found.',
          code: 'SUBMIT_NOT_FOUND',
        }),
      };
    }

    const buildResult = await getBuildResult();
    const result = buildResult(
      worksheet,
      answers,
      typeof timeTaken === 'number' && isFinite(timeTaken) ? Math.max(0, timeTaken) : 0,
      Boolean(timed),
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('submitHandler error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error.',
        code: 'SUBMIT_INTERNAL_ERROR',
      }),
    };
  }
};

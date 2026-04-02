/**
 * @file backend/handlers/solveHandler.js
 * @description Lambda-compatible handler for GET /api/solve/{worksheetId}.
 * Returns the worksheet questions without answers or explanations so students
 * can solve the worksheet interactively.
 *
 * Local dev:  reads worksheets-local/{worksheetId}/solve-data.json
 * Lambda/AWS: S3 integration to be wired in the CDK stack (Phase 5)
 */

import { promises as fs } from 'fs';
import path, { join, resolve } from 'path';

// __dirname is not available in Lambda CJS bundle; use process.cwd() for root
const __dirname = process.cwd();

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const WORKSHEET_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_QUESTION_FIELDS = [
  'number',
  'type',
  'question',
  'options',
  'points',
  'prompt',
  'pairs',
  'leftItems',
  'rightItems',
];

/**
 * Returns a solve-safe question payload that excludes answer and internal metadata.
 * @param {Object} question
 * @returns {Object}
 */
function toPublicQuestion(question) {
  const publicQuestion = {};
  for (const field of PUBLIC_QUESTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(question, field)) {
      publicQuestion[field] = question[field];
    }
  }
  return publicQuestion;
}

/**
 * Ensures a resolved child directory remains inside the base directory.
 * Uses case-insensitive comparison on Windows.
 * @param {string} baseDir
 * @param {string} childDir
 * @returns {boolean}
 */
function isWithinBaseDir(baseDir, childPath) {
  const rel = path.relative(baseDir, childPath);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Lambda handler — GET /api/solve/{worksheetId}
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
    const worksheetId =
      (event.pathParameters && (event.pathParameters.worksheetId || event.pathParameters.id)) ||
      null;

    if (!worksheetId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Missing worksheetId.',
          code: 'SOLVE_MISSING_WORKSHEET_ID',
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
          code: 'SOLVE_INVALID_WORKSHEET_ID',
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
          code: 'SOLVE_INVALID_WORKSHEET_ID',
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
          code: 'SOLVE_NOT_FOUND',
        }),
      };
    }

    // Whitelist only render-safe question fields before sending to the client.
    const publicQuestions = (worksheet.questions || []).map(toPublicQuestion);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        worksheetId: worksheet.worksheetId,
        grade: worksheet.grade,
        subject: worksheet.subject,
        topic: worksheet.topic,
        difficulty: worksheet.difficulty,
        estimatedTime: worksheet.estimatedTime,
        timerSeconds: worksheet.timerSeconds,
        totalPoints: worksheet.totalPoints,
        questions: publicQuestions,
      }),
    };
  } catch (err) {
    console.error('solveHandler error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error.',
        code: 'SOLVE_INTERNAL_ERROR',
      }),
    };
  }
};

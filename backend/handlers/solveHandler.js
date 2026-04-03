/**
 * @file backend/handlers/solveHandler.js
 * @description Lambda-compatible handler for GET /api/solve/{worksheetId}.
 * Returns the worksheet questions without answers or explanations so students
 * can solve the worksheet interactively.
 *
 * Local dev:  reads worksheets-local/{worksheetId}/solve-data.json
 * Lambda/AWS: reads from DynamoDB (WORKSHEETS_TABLE_NAME env var).
 *             Accepts both v4 UUIDs (PK lookup) and SEO slugs (slug-index GSI).
 */

import { promises as fs } from 'fs';
import path, { join, resolve } from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// __dirname is not available in Lambda CJS bundle; use process.cwd() for root
const __dirname = process.cwd();

const isAws = process.env.APP_RUNTIME === 'aws';

let _dynamo, _docClient;
/**
 * Returns a singleton DynamoDBDocumentClient. Instantiated on first call.
 * @returns {DynamoDBDocumentClient}
 */
function getDocClient() {
  if (!_docClient) {
    _dynamo = new DynamoDBClient({});
    _docClient = DynamoDBDocumentClient.from(_dynamo);
  }
  return _docClient;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const WORKSHEET_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{8,78}[a-z0-9]$/;

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
 * Fetches a worksheet item from DynamoDB by UUID (primary key) or slug (GSI).
 * @param {string} identifier - v4 UUID or SEO slug
 * @returns {Promise<Object>} DynamoDB item representing the worksheet
 * @throws {Error} With .statusCode = 404 if not found, 500 if table name missing
 */
async function fetchFromDynamo(identifier) {
  const tableName = process.env.WORKSHEETS_TABLE_NAME;
  if (!tableName) {
    const e = new Error('WORKSHEETS_TABLE_NAME not set.');
    e.statusCode = 500;
    throw e;
  }
  const docClient = getDocClient();
  let item;
  if (WORKSHEET_ID_REGEX.test(identifier)) {
    const res = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { worksheetId: identifier },
    }));
    item = res.Item;
  } else {
    const res = await docClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'slug-index',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': identifier },
      Limit: 1,
    }));
    item = res.Items?.[0];
  }
  if (!item) {
    const e = new Error('Worksheet not found.');
    e.statusCode = 404;
    throw e;
  }
  return item;
}

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
 * @param {string} baseDir
 * @param {string} childDir
 * @returns {boolean}
 */
function isWithinBaseDir(baseDir, childPath) {
  const rel = path.relative(baseDir, childPath);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Lambda handler - GET /api/solve/{worksheetId}
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

    const isUuid = WORKSHEET_ID_REGEX.test(worksheetId);
    const isSlug = SLUG_REGEX.test(worksheetId);
    if (!isUuid && !isSlug) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid worksheetId format.',
          code: 'SOLVE_INVALID_WORKSHEET_ID',
        }),
      };
    }

    let worksheet;
    if (isAws) {
      try {
        worksheet = await fetchFromDynamo(worksheetId);
      } catch (dbErr) {
        return {
          statusCode: dbErr.statusCode || 404,
          headers: corsHeaders,
          body: JSON.stringify({
            error: dbErr.message || 'Worksheet not found.',
            code: 'SOLVE_NOT_FOUND',
          }),
        };
      }
    } else {
      const baseDir = resolve(join(__dirname, 'worksheets-local'));

      // Resolve slug to UUID via local slug index if needed
      let dirName = worksheetId;
      if (isSlug) {
        try {
          const indexPath = join(baseDir, 'slug-index.json');
          const slugIndex = JSON.parse(await fs.readFile(indexPath, 'utf8'));
          if (slugIndex[worksheetId]) {
            dirName = slugIndex[worksheetId];
          }
        } catch {
          // No slug index yet — fall through, will 404 naturally
        }
      }

      const localDir = resolve(join(baseDir, dirName));

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
    }

    const publicQuestions = (worksheet.questions || []).map(toPublicQuestion);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        worksheetId: worksheet.worksheetId,
        title: worksheet.title || `Grade ${worksheet.grade} ${worksheet.subject}: ${worksheet.topic}`,
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
    const isDebug = process.env.DEBUG_MODE === 'true';
    const solveBody = {
      error: isDebug ? err.message : 'Internal server error.',
      code: 'SOLVE_INTERNAL_ERROR',
    };
    if (isDebug) {
      solveBody._debug = { stack: err.stack, handler: 'solveHandler', statusCode: 500, timestamp: new Date().toISOString() };
    }
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify(solveBody) };
  }
};

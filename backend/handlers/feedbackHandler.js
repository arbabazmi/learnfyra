/**
 * @file backend/handlers/feedbackHandler.js
 * @description Lambda-compatible handler for POST /api/feedback.
 * Stores user feedback about worksheet scoring/answers in DynamoDB.
 *
 * Local dev:  writes to worksheets-local/feedback/{uuid}.json
 * Lambda/AWS: writes to DynamoDB (FEEDBACK_TABLE_NAME env var).
 */

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const isAws = process.env.APP_RUNTIME === 'aws';

let _docClient;
function getDocClient() {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return _docClient;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event, context) => {
  if (context) context.callbackWaitsForEmptyEventLoop = false;

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
        body: JSON.stringify({ error: 'Invalid JSON in request body.' }),
      };
    }

    const { worksheetId, feedback, page, userAgent, score, percentage, questionCount } = body;

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Feedback text is required.' }),
      };
    }

    if (feedback.trim().length > 2000) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Feedback must be 2000 characters or fewer.' }),
      };
    }

    const feedbackId = randomUUID();
    const now = new Date().toISOString();

    // Extract user identity from Authorization header (if present)
    let userId = 'anonymous';
    let userRole = 'unknown';
    try {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const tokenStr = authHeader.replace(/^Bearer\s+/i, '');
      if (tokenStr) {
        const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString());
        userId = payload.sub || 'anonymous';
        userRole = payload.role || 'unknown';
      }
    } catch {
      // Ignore decode errors — userId stays 'anonymous'
    }

    const item = {
      feedbackId,
      createdAt: now,
      feedback: feedback.trim(),
      worksheetId: worksheetId || null,
      page: page || 'solve',
      userId,
      userRole,
      userAgent: userAgent || null,
      score: score ?? null,
      percentage: percentage ?? null,
      questionCount: questionCount ?? null,
    };

    if (isAws) {
      const tableName = process.env.FEEDBACK_TABLE_NAME;
      if (!tableName) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'FEEDBACK_TABLE_NAME not configured.' }),
        };
      }
      await getDocClient().send(new PutCommand({ TableName: tableName, Item: item }));
    } else {
      // Local dev — write to file
      const dir = join(process.cwd(), 'worksheets-local', 'feedback');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(join(dir, `${feedbackId}.json`), JSON.stringify(item, null, 2));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ feedbackId, message: 'Thank you for your feedback!' }),
    };
  } catch (err) {
    console.error('feedbackHandler error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save feedback.' }),
    };
  }
};

/**
 * @file src/ai/exposure/exposureTracker.js
 * @description Tracks which question IDs have been served to each student,
 * enabling the assembler to prefer unseen questions within the admin-configured
 * repeat cap.
 *
 * Runtime strategy:
 *   - AWS (APP_RUNTIME=aws): reads/writes LearnfyraQuestionExposure-{env} DynamoDB table.
 *   - Local dev (default):   reads/writes data-local/questionExposure.json (JSON file).
 *
 * Exposure writes are fire-and-forget: errors are logged but never propagated
 * to callers so a write failure never blocks worksheet generation.
 */

import { randomUUID } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fallback default if DYNAMO_ENV / NODE_ENV is unset */
const ENV_SUFFIX = process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local';

/** Table name for AWS runtime */
function resolveExposureTable() {
  return (
    process.env.QUESTION_EXPOSURE_TABLE_NAME ||
    `LearnfyraQuestionExposure-${ENV_SUFFIX}`
  );
}

/** Local JSON file path for dev mode */
async function resolveLocalFilePath() {
  const { join } = await import('path');
  return join(process.cwd(), 'data-local', 'questionExposure.json');
}

// ─── Runtime detection ────────────────────────────────────────────────────────

function isAwsRuntime() {
  const rt = process.env.APP_RUNTIME;
  return rt === 'aws' || rt === 'dynamodb';
}

// ─── Lazy DynamoDB client ─────────────────────────────────────────────────────

let _docClient = null;

async function getDocClient() {
  if (!_docClient) {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
    const config = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      config.endpoint = endpoint;
      config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
    }
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

// ─── Local JSON adapter helpers ───────────────────────────────────────────────

/**
 * Reads the local exposure JSON file. Returns an empty object on ENOENT.
 * @returns {Promise<Object>}
 */
async function readLocalStore() {
  const { readFileSync } = await import('fs');
  const filePath = await resolveLocalFilePath();
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Writes the updated exposure data to the local JSON file.
 * Creates the data-local directory if it does not exist.
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function writeLocalStore(data) {
  const { writeFileSync, mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  const filePath = await resolveLocalFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Builds the composite store key for local dev storage.
 * @param {string} userId
 * @param {number|string} grade
 * @param {string} subject
 * @param {string} topic
 * @returns {string}
 */
function localStoreKey(userId, grade, subject, topic) {
  return `${userId}|${grade}|${subject}|${topic}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the Set of questionIds that have already been served to this user
 * for a given grade + subject + topic combination.
 *
 * On failure (DynamoDB error, corrupt local file) returns an empty Set so the
 * assembler treats all bank questions as unseen — a safe, conservative fallback.
 *
 * @param {string} userId       - Authenticated userId (or guest session ID)
 * @param {number|string} grade - Grade level 1–10
 * @param {string} subject      - Subject name
 * @param {string} topic        - Topic within subject
 * @returns {Promise<Set<string>>} Set of seen questionIds
 */
export async function getExposedQuestionIds(userId, grade, subject, topic) {
  if (!userId) return new Set();

  try {
    if (isAwsRuntime()) {
      const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
      const docClient = await getDocClient();
      const skPrefix = `${grade}#${subject}#${topic}#`;
      const result = await docClient.send(new QueryCommand({
        TableName: resolveExposureTable(),
        KeyConditionExpression: 'userId = :uid AND begins_with(exposureKey, :skPrefix)',
        ExpressionAttributeValues: {
          ':uid': userId,
          ':skPrefix': skPrefix,
        },
        ProjectionExpression: 'questionId',
      }));
      const ids = new Set();
      for (const item of result.Items || []) {
        if (typeof item.questionId === 'string' && item.questionId.trim()) {
          ids.add(item.questionId.trim());
        }
      }
      return ids;
    }

    // Local JSON dev path
    const store = await readLocalStore();
    const key = localStoreKey(userId, grade, subject, topic);
    const entry = store[key];
    if (!entry || !Array.isArray(entry.questionIds)) return new Set();
    return new Set(entry.questionIds.filter((id) => typeof id === 'string' && id.trim()));
  } catch (err) {
    console.error('getExposedQuestionIds failed (non-fatal, treating all as unseen):', err.message);
    return new Set();
  }
}

/**
 * Records that a set of questionIds were served to a user for a topic.
 * Fire-and-forget: returns immediately; errors are logged but never thrown.
 *
 * For AWS runtime, uses DynamoDB BatchWriteItem to atomically upsert exposure
 * records (PutItem only — increments servedCount on existing items).
 *
 * For local dev, appends to data-local/questionExposure.json.
 *
 * @param {string} userId        - Authenticated userId (or guest session ID)
 * @param {number|string} grade  - Grade level 1–10
 * @param {string} subject       - Subject name
 * @param {string} topic         - Topic within subject
 * @param {string[]} questionIds - Array of questionIds to record as served
 * @returns {void}               Fire-and-forget — no return value awaited by callers
 */
export function recordExposure(userId, grade, subject, topic, questionIds) {
  if (!userId || !Array.isArray(questionIds) || questionIds.length === 0) return;
  const validIds = questionIds.filter((id) => typeof id === 'string' && id.trim());
  if (validIds.length === 0) return;

  // Intentionally not awaited — fire-and-forget
  _recordExposureAsync(userId, grade, subject, topic, validIds).catch((err) => {
    console.error('recordExposure failed (non-fatal):', err.message);
  });
}

/**
 * Internal async implementation of recordExposure.
 * @param {string} userId
 * @param {number|string} grade
 * @param {string} subject
 * @param {string} topic
 * @param {string[]} validIds
 * @returns {Promise<void>}
 */
async function _recordExposureAsync(userId, grade, subject, topic, validIds) {
  const nowIso = new Date().toISOString();

  if (isAwsRuntime()) {
    const { BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb');
    const docClient = await getDocClient();
    const tableName = resolveExposureTable();

    // DynamoDB BatchWriteItem accepts at most 25 items per call
    const BATCH_SIZE = 25;
    for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
      const batch = validIds.slice(i, i + BATCH_SIZE);
      const putRequests = batch.map((questionId) => ({
        PutRequest: {
          Item: {
            userId,
            exposureKey: `${grade}#${subject}#${topic}#${questionId}`,
            questionId,
            servedAt: nowIso,
            servedCount: 1,
          },
        },
      }));
      await docClient.send(new BatchWriteCommand({
        RequestItems: { [tableName]: putRequests },
      }));
    }
    return;
  }

  // Local JSON dev path
  const store = await readLocalStore();
  const key = localStoreKey(userId, grade, subject, topic);
  const existing = store[key] || { userId, grade, subject, topic, questionIds: [], updatedAt: nowIso };
  const existingSet = new Set(existing.questionIds);
  for (const id of validIds) {
    existingSet.add(id.trim());
  }
  store[key] = {
    ...existing,
    questionIds: Array.from(existingSet),
    updatedAt: nowIso,
  };
  await writeLocalStore(store);
}

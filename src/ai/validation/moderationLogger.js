/**
 * @file src/ai/validation/moderationLogger.js
 * @description Per-question moderation logging for COPPA-09 compliance.
 *
 *   Writes one log row per question to the LearnfyraModerationLog table.
 *   Each row carries a 3-year TTL (94,608,000 seconds from write time) so
 *   S3/DynamoDB lifecycle rules can automatically purge records after the
 *   COPPA retention window closes.
 *
 *   Storage:
 *     AWS (APP_RUNTIME=aws|dynamodb) → DynamoDB via dynamoDbAdapter
 *     Local dev (default)            → data-local/moderationLog.json
 *       (falls back to localDbAdapter which writes to that path)
 *
 *   All writes are fire-and-forget.  Any error is logged at WARN level and
 *   swallowed — this function MUST NOT block or reject worksheet delivery.
 *
 *   DynamoDB batch size: 25 items per BatchWriteItem call (AWS hard limit).
 *
 * @agent DEV
 */

import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** COPPA 3-year retention in seconds (3 × 365.25 days). */
const TTL_SECONDS = 94_608_000;

/** Maximum items per DynamoDB BatchWriteItem call. */
const DYNAMO_BATCH_SIZE = 25;

// ─── Table name resolution ────────────────────────────────────────────────────

/**
 * Returns the DynamoDB table name for the moderation log.
 * Priority: MODERATION_LOG_TABLE_NAME env var → default name with env suffix.
 * @returns {string}
 */
function getModerationLogTableName() {
  if (process.env.MODERATION_LOG_TABLE_NAME) {
    return process.env.MODERATION_LOG_TABLE_NAME;
  }
  const env = process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local';
  return `LearnfyraModerationLog-${env}`;
}

// ─── DB adapter (lazy) ────────────────────────────────────────────────────────

/**
 * Lazily resolves the active DB adapter so tests can set APP_RUNTIME before
 * this module is fully initialised.
 * @returns {import('../../db/localDbAdapter.js').localDbAdapter | import('../../db/dynamoDbAdapter.js').dynamoDbAdapter}
 */
async function getAdapter() {
  const { getDbAdapter } = await import('../../db/index.js');
  return getDbAdapter();
}

// ─── DynamoDB batch-write helper ──────────────────────────────────────────────

/**
 * Writes items in batches of DYNAMO_BATCH_SIZE using the DynamoDB DocumentClient
 * directly (BatchWriteItem).  Falls back to individual putItem calls when the
 * adapter does not expose a batchWrite method (e.g. localDbAdapter).
 *
 * @param {Object[]} items - Moderation log rows to persist
 * @param {string} tableName - Resolved DynamoDB table name
 * @returns {Promise<void>}
 */
async function batchPersist(items, tableName) {
  const adapter = await getAdapter();

  // localDbAdapter: no batchWrite — call putItem sequentially.
  // The logical table name used here is 'moderationlog'; localDbAdapter maps
  // it to data-local/moderationlog.json.
  if (typeof adapter.batchWrite !== 'function') {
    for (const item of items) {
      await adapter.putItem('moderationlog', item);
    }
    return;
  }

  // DynamoDB adapter: send batches of up to 25.
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb');

  const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    };
  }
  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig), {
    marshallOptions: { removeUndefinedValues: true },
  });

  for (let i = 0; i < items.length; i += DYNAMO_BATCH_SIZE) {
    const batch = items.slice(i, i + DYNAMO_BATCH_SIZE);
    const requestItems = {
      [tableName]: batch.map((item) => ({ PutRequest: { Item: item } })),
    };
    await docClient.send(new BatchWriteCommand({ RequestItems: requestItems }));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ModerationLogInput
 * @property {string}   worksheetId       - UUID of the worksheet
 * @property {number}   grade             - Grade level 1-10
 * @property {string}   subject           - Subject name (e.g. 'Math')
 * @property {Object[]} questions         - Array of question objects from worksheet JSON
 * @property {Object}   validationResults - Result object from validateWorksheetOutput()
 * @property {'strict'|'medium'} gradeBand - Resolved guardrail level
 * @property {string}   [service]         - Originating service label (default: 'outputValidator')
 */

/**
 * Logs one moderation row per question to the moderation log store.
 * Fire-and-forget — never throws. All errors are caught and logged at WARN.
 *
 * Each row schema:
 * ```json
 * {
 *   "logId":          "uuid-v4",
 *   "worksheetId":    "string",
 *   "questionNumber": 1,
 *   "gradeBand":      "strict|medium",
 *   "flagged":        false,
 *   "categories":     [],
 *   "action":         "passed|rejected|retried",
 *   "scannedAt":      "ISO-8601",
 *   "ttl":            <epoch seconds + 94608000>
 * }
 * ```
 *
 * @param {ModerationLogInput} params
 * @returns {Promise<void>} Always resolves; never rejects
 */
export async function logModerationResults({
  worksheetId,
  grade,
  subject,
  questions,
  validationResults,
  gradeBand,
  service = 'outputValidator',
}) {
  // Guard: nothing to log if questions is empty or not an array
  if (!Array.isArray(questions) || questions.length === 0) {
    logger.warn('moderationLogger: no questions provided — skipping log write');
    return;
  }

  try {
    const tableName = getModerationLogTableName();
    const scannedAt = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

    // Determine worksheet-level flag state and categories from validationResults
    const worksheetFlagged = validationResults?.safe === false;
    const failureReason = validationResults?.failureReason ?? null;
    const action = worksheetFlagged ? 'rejected' : 'passed';

    // Build one log row per question
    const rows = questions.map((q) => ({
      logId: randomUUID(),
      worksheetId: worksheetId ?? 'unknown',
      questionNumber: q.number ?? null,
      grade: grade ?? null,
      subject: subject ?? null,
      gradeBand: gradeBand ?? 'medium',
      flagged: worksheetFlagged,
      categories: failureReason ? [failureReason] : [],
      action,
      service,
      scannedAt,
      ttl,
    }));

    logger.info(
      `moderationLogger: writing ${rows.length} moderation log rows ` +
      `for worksheetId=${worksheetId} (action=${action})`
    );

    await batchPersist(rows, tableName);
  } catch (err) {
    // Fire-and-forget: WARN and return — never surface to caller
    logger.warn(`moderationLogger: failed to write moderation log — ${err.message}`);
  }
}

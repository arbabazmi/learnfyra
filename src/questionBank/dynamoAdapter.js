/**
 * @file src/questionBank/dynamoAdapter.js
 * @description DynamoDB adapter for the question bank.
 *
 * Implements the same interface as localQuestionBankAdapter.js so callers can
 * swap adapters with no changes to consumer code.
 *
 * Table name resolution:
 *   1. QB_TABLE_NAME env var (explicit override)
 *   2. LearnfyraQuestionBank-{DYNAMO_ENV}
 *      where DYNAMO_ENV = process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'
 *
 * GSI layout expected on the DynamoDB table:
 *   GSI-1  (name: "lookupKey-typeDifficulty-index")
 *     HASH  — lookupKey     : "{grade}|{subject}|{topic}"      (all lowercase)
 *     RANGE — typeDifficulty: "{type}|{difficulty}"            (all lowercase)
 *   GSI-2  (name: "dedupeHash-index")
 *     HASH  — dedupeHash    : SHA-256 hex of canonical fields  KEYS_ONLY projection
 *
 * Local dev: set DYNAMODB_ENDPOINT=http://localhost:8000 to hit DynamoDB Local.
 * AWS Lambda: leave DYNAMODB_ENDPOINT unset — the SDK uses the regional endpoint.
 */

import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { computeDedupeHash } from './utils.js';

// ---------------------------------------------------------------------------
// DynamoDB client — lazy singleton, mirrors src/db/dynamoDbAdapter.js pattern
// ---------------------------------------------------------------------------

let _docClient = null;

/**
 * Builds a DynamoDBDocumentClient.
 * Uses DYNAMODB_ENDPOINT for local dev; falls back to regional endpoint on AWS.
 * @returns {DynamoDBDocumentClient}
 */
function buildDocClient() {
  const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };

  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.credentials = {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    };
  }

  const base = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

function getDocClient() {
  if (!_docClient) _docClient = buildDocClient();
  return _docClient;
}

// ---------------------------------------------------------------------------
// Table name resolution
// ---------------------------------------------------------------------------

const getTableName = () =>
  process.env.QB_TABLE_NAME ||
  `LearnfyraQuestionBank-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;

// GSI names — must match the DynamoDB table definition in scripts/bootstrap-local-db.js
const GSI_LOOKUP        = 'GSI-1';               // HASH: lookupKey, RANGE: typeDifficulty
const GSI_DEDUPE        = 'dedupeHash-index';     // HASH: dedupeHash, KEYS_ONLY

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the composite lookupKey field.
 * @param {number|string} grade
 * @param {string} subject
 * @param {string} topic
 * @returns {string}
 */
function buildLookupKey(grade, subject, topic) {
  return `${grade}|${String(subject).trim().toLowerCase()}|${String(topic).trim().toLowerCase()}`;
}

/**
 * Builds the composite typeDifficulty field.
 * @param {string} type
 * @param {string} difficulty
 * @returns {string}
 */
function buildTypeDifficulty(type, difficulty) {
  return `${String(type).trim().toLowerCase()}|${String(difficulty).trim().toLowerCase()}`;
}

/**
 * Enriches a question with the derived fields that DynamoDB GSIs rely on.
 * Does NOT overwrite questionId or createdAt if they are already set.
 *
 * @param {Object} question
 * @returns {Object} Question with questionId, createdAt, lookupKey, typeDifficulty, dedupeHash
 */
function enrichQuestion(question) {
  const q = { ...question };

  if (!q.questionId) q.questionId = randomUUID();
  if (!q.createdAt)  q.createdAt  = new Date().toISOString();
  if (typeof q.reuseCount !== 'number') q.reuseCount = 0;

  q.lookupKey     = buildLookupKey(q.grade, q.subject, q.topic);
  q.typeDifficulty = buildTypeDifficulty(q.type, q.difficulty);
  q.dedupeHash    = computeDedupeHash(q);

  return q;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Stores a question in DynamoDB.
 * If the question already has a questionId it is preserved; otherwise a new UUID
 * is generated. Always sets createdAt, lookupKey, typeDifficulty, and dedupeHash.
 *
 * @param {Object} question - Partial or full question object
 * @returns {Promise<Object>} The stored question with all generated fields
 */
export async function addQuestion(question) {
  const stored = enrichQuestion(question);
  await getDocClient().send(new PutCommand({
    TableName: getTableName(),
    Item: stored,
  }));
  return { ...stored };
}

/**
 * Atomically checks for a duplicate (via dedupeHash GSI) and, if none is found,
 * stores the question.
 *
 * Note: this is a two-step check-then-insert (not a DynamoDB ConditionExpression).
 * Under concurrent writes there is a small TOCTOU window; acceptable for the
 * current write volume. Switch to a ConditionExpression if write contention
 * becomes a concern.
 *
 * @param {Object} candidate   - Dedupe key (grade, subject, topic, type, question text)
 * @param {Object} newQuestion - Full question to store when no duplicate exists
 * @returns {Promise<{ stored: Object|null, duplicate: boolean }>}
 */
export async function addIfNotExists(candidate, newQuestion) {
  const exists = await questionExists(candidate);
  if (exists) {
    return { stored: null, duplicate: true };
  }
  const stored = await addQuestion(newQuestion);
  return { stored, duplicate: false };
}

/**
 * Retrieves a single question by its questionId.
 *
 * @param {string} questionId
 * @returns {Promise<Object|null>} The question, or null if not found
 */
export async function getQuestion(questionId) {
  const result = await getDocClient().send(new GetCommand({
    TableName: getTableName(),
    Key: { questionId },
  }));
  return result.Item ?? null;
}

/**
 * Returns questions matching the provided filters (AND-ed).
 *
 * Lookup strategy:
 *   - grade + subject + topic provided → GSI-1 query (efficient)
 *     - If type and/or difficulty also provided → use RANGE key on GSI-1
 *   - Otherwise → table Scan with FilterExpression (full scan, dev/fallback only)
 *
 * Supported filters: grade, subject, topic, difficulty, type
 *
 * @param {Object} [filters={}]
 * @returns {Promise<Object[]>}
 */
export async function listQuestions(filters = {}) {
  const { grade, subject, topic, difficulty, type } = filters;

  const tableName = getTableName();

  // ── Fast path: GSI-1 query when grade + subject + topic are all present ──
  if (grade !== undefined && grade !== null && subject && topic) {
    const lookupKey = buildLookupKey(grade, subject, topic);

    const params = {
      TableName:              tableName,
      IndexName:              GSI_LOOKUP,
      KeyConditionExpression: '#lk = :lk',
      ExpressionAttributeNames:  { '#lk': 'lookupKey' },
      ExpressionAttributeValues: { ':lk': lookupKey },
    };

    // Narrow further by type + difficulty via the RANGE key when both are present
    if (type && difficulty) {
      const td = buildTypeDifficulty(type, difficulty);
      params.KeyConditionExpression += ' AND #td = :td';
      params.ExpressionAttributeNames['#td']  = 'typeDifficulty';
      params.ExpressionAttributeValues[':td'] = td;
    } else if (type) {
      // begins_with on the RANGE key to filter by type prefix only
      const typePrefix = String(type).trim().toLowerCase() + '|';
      params.KeyConditionExpression += ' AND begins_with(#td, :tdprefix)';
      params.ExpressionAttributeNames['#td']       = 'typeDifficulty';
      params.ExpressionAttributeValues[':tdprefix'] = typePrefix;
    } else if (difficulty) {
      // Difficulty without type — cannot use RANGE key efficiently; add a
      // post-query filter to keep results consistent with the Scan path.
      params.FilterExpression = '#diff = :diff';
      params.ExpressionAttributeNames['#diff']  = 'difficulty';
      params.ExpressionAttributeValues[':diff'] = String(difficulty).trim().toLowerCase();
    }

    const items = [];
    let lastKey;
    do {
      if (lastKey) params.ExclusiveStartKey = lastKey;
      const result = await getDocClient().send(new QueryCommand(params));
      if (result.Items) items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  // ── Slow path: Scan + FilterExpression for partial filter sets ──
  const filterParts  = [];
  const exprNames    = {};
  const exprValues   = {};

  if (grade !== undefined && grade !== null) {
    filterParts.push('#grade = :grade');
    exprNames['#grade']  = 'grade';
    exprValues[':grade'] = Number(grade);
  }
  if (subject) {
    // subject is stored with original casing (e.g. "Math") — do NOT lowercase
    filterParts.push('#subject = :subject');
    exprNames['#subject']  = 'subject';
    exprValues[':subject'] = String(subject).trim();
  }
  if (topic) {
    // topic is stored with original casing — do NOT lowercase
    filterParts.push('#topic = :topic');
    exprNames['#topic']  = 'topic';
    exprValues[':topic'] = String(topic).trim();
  }
  if (difficulty) {
    // difficulty is stored with original casing (e.g. "Medium") — do NOT lowercase
    filterParts.push('#difficulty = :difficulty');
    exprNames['#difficulty']  = 'difficulty';
    exprValues[':difficulty'] = String(difficulty).trim();
  }
  if (type) {
    // type enum values are already lowercase (e.g. "multiple-choice") — trim only
    filterParts.push('#type = :type');
    exprNames['#type']  = 'type';
    exprValues[':type'] = String(type).trim();
  }

  const scanParams = { TableName: tableName };
  if (filterParts.length > 0) {
    scanParams.FilterExpression         = filterParts.join(' AND ');
    scanParams.ExpressionAttributeNames  = exprNames;
    scanParams.ExpressionAttributeValues = exprValues;
  }

  const items = [];
  let lastKey;
  do {
    if (lastKey) scanParams.ExclusiveStartKey = lastKey;
    const result = await getDocClient().send(new ScanCommand(scanParams));
    if (result.Items) items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

/**
 * Returns true if a question with the same canonical fingerprint already exists
 * in the bank.
 *
 * Uses the KEYS_ONLY dedupeHash-index GSI for a lightweight, cost-efficient check.
 * The GSI returns only the key fields — no need to read the full item.
 *
 * @param {Object} candidate - Must contain grade, subject, topic, type, question
 * @returns {Promise<boolean>}
 */
export async function questionExists(candidate) {
  const hash = computeDedupeHash(candidate);

  const result = await getDocClient().send(new QueryCommand({
    TableName:              getTableName(),
    IndexName:              GSI_DEDUPE,
    KeyConditionExpression: '#dh = :dh',
    ExpressionAttributeNames:  { '#dh': 'dedupeHash' },
    ExpressionAttributeValues: { ':dh': hash },
    Limit: 1,
    Select: 'COUNT',
  }));

  return (result.Count ?? 0) > 0;
}

/**
 * Increments the reuseCount of a question by 1 using an atomic ADD expression.
 * Returns the full updated question, or null if the questionId does not exist.
 *
 * @param {string} questionId
 * @returns {Promise<Object|null>} Updated question attributes, or null if not found
 */
export async function incrementReuseCount(questionId) {
  try {
    const result = await getDocClient().send(new UpdateCommand({
      TableName:                 getTableName(),
      Key:                       { questionId },
      UpdateExpression:          'ADD reuseCount :one',
      ConditionExpression:       'attribute_exists(questionId)',
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues:              'ALL_NEW',
    }));
    return result.Attributes ?? null;
  } catch (err) {
    // ConditionalCheckFailedException means the item does not exist
    if (err.name === 'ConditionalCheckFailedException') {
      return null;
    }
    throw err;
  }
}

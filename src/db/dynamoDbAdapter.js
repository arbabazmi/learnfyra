/**
 * @file src/db/dynamoDbAdapter.js
 * @description DynamoDB adapter — implements the same interface as localDbAdapter.
 * Works with DynamoDB local (dev) and AWS DynamoDB (prod/staging).
 *
 * Local dev:  DYNAMODB_ENDPOINT=http://localhost:8000, APP_RUNTIME=dynamodb
 * AWS Lambda: APP_RUNTIME=aws (no endpoint override needed)
 *
 * Table name resolution per logical name:
 *   1. Check the per-table env var (e.g. CERTIFICATES_TABLE_NAME)
 *   2. Fall back to Learnfyra{Suffix}-{DYNAMO_ENV}
 *      where DYNAMO_ENV = process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

/**
 * Builds a DynamoDBDocumentClient using env-configured endpoint (for local dev)
 * or the default AWS regional endpoint (for Lambda).
 * @returns {DynamoDBDocumentClient}
 */
function buildDocumentClient() {
  const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };

  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    // DynamoDB local requires dummy credentials
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    };
  }

  const baseClient = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// Lazy singleton — created on first use so tests can set env vars before import
let _docClient = null;
function getDocClient() {
  if (!_docClient) _docClient = buildDocumentClient();
  return _docClient;
}

// ---------------------------------------------------------------------------
// Table name resolution
// ---------------------------------------------------------------------------

// Resolved at call time (not module-load time) so tests can set env vars after import
const getDynamoEnv = () => process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local';

/**
 * Config for each logical table name used by handlers.
 *   envVar  — env var that overrides the resolved DynamoDB table name
 *   suffix  — used to build default: Learnfyra{suffix}-{DYNAMO_ENV}
 *   pk      — HASH key attribute name
 *   sk      — RANGE key attribute name (undefined if no sort key)
 */
const TABLE_CONFIG = {
  users:              { envVar: 'USERS_TABLE_NAME',               suffix: 'Users',              pk: 'userId'      },
  attempts:           { envVar: 'ATTEMPTS_TABLE_NAME',            suffix: 'Attempts',           pk: 'attemptId'   },
  worksheetattempts:  { envVar: 'ATTEMPTS_TABLE_NAME',            suffix: 'Attempts',           pk: 'attemptId'   },
  aggregates:         { envVar: 'AGGREGATES_TABLE_NAME',          suffix: 'Aggregates',         pk: 'id'          },
  certificates:       { envVar: 'CERTIFICATES_TABLE_NAME',        suffix: 'Certificates',       pk: 'id'          },
  rewardprofiles:     { envVar: 'REWARD_PROFILES_TABLE_NAME',     suffix: 'RewardProfiles',     pk: 'id'          },
  classes:            { envVar: 'CLASSES_TABLE_NAME',             suffix: 'Classes',            pk: 'classId'     },
  memberships:        { envVar: 'MEMBERSHIPS_TABLE_NAME',         suffix: 'Memberships',        pk: 'id'          },
  classmemberships:   { envVar: 'MEMBERSHIPS_TABLE_NAME',         suffix: 'Memberships',        pk: 'id'          },
  questionbank:       { envVar: 'QB_TABLE_NAME',                  suffix: 'QuestionBank',       pk: 'questionId'  },
  generationlog:      { envVar: 'GENLOG_TABLE_NAME',              suffix: 'GenerationLog',      pk: 'worksheetId' },
  config:             { envVar: 'CONFIG_TABLE_NAME',              suffix: 'Config',             pk: 'configKey'   },
  modelconfig:        { envVar: 'MODEL_CONFIG_TABLE_NAME',        suffix: 'ModelConfig',        pk: 'id'          },
  modelauditlog:      { envVar: 'MODEL_AUDIT_LOG_TABLE_NAME',     suffix: 'ModelAuditLog',      pk: 'id'          },
  questionexposurehistory: { envVar: 'QUESTION_EXPOSURE_HISTORY_TABLE_NAME', suffix: 'QuestionExposureHistory', pk: 'id' },
  passwordresets:     { envVar: 'PWRESET_TABLE_NAME',             suffix: 'PasswordResets',     pk: 'tokenId'     },
  parentlinks:        { envVar: 'PARENT_LINKS_TABLE_NAME',        suffix: 'ParentLinks',        pk: 'id'          },
  adminpolicies:      { envVar: 'ADMIN_POLICIES_TABLE_NAME',      suffix: 'AdminPolicies',      pk: 'id'          },
  adminauditevents:   { envVar: 'ADMIN_AUDIT_EVENTS_TABLE_NAME',  suffix: 'AdminAuditEvents',   pk: 'id'          },
  adminidempotency:   { envVar: 'ADMIN_IDEMPOTENCY_TABLE_NAME',   suffix: 'AdminIdempotency',   pk: 'id'          },
  repeatcapoverrides: { envVar: 'REPEAT_CAP_OVERRIDES_TABLE_NAME', suffix: 'RepeatCapOverrides', pk: 'id'         },
};

/**
 * Resolves the DynamoDB table name for a logical table key.
 * Falls back to Learnfyra{Suffix}-{DYNAMO_ENV} if no env override is set.
 * @param {string} logicalName - Lowercase logical name (e.g. 'certificates')
 * @returns {{ tableName: string, pk: string, sk: string|undefined }}
 */
function resolveTable(logicalName) {
  const key = logicalName.toLowerCase();
  const config = TABLE_CONFIG[key];
  if (!config) {
    throw new Error(`Unknown logical table: "${logicalName}". Add it to TABLE_CONFIG in dynamoDbAdapter.js`);
  }
  const tableName = process.env[config.envVar] || `Learnfyra${config.suffix}-${getDynamoEnv()}`;
  return { tableName, pk: config.pk, sk: config.sk };
}

// ---------------------------------------------------------------------------
// Helper: build a DynamoDB UpdateExpression from a plain updates object
// ---------------------------------------------------------------------------

/**
 * Builds UpdateExpression components for a partial update.
 * @param {Object} updates - Key/value pairs to merge into the item
 * @param {string} pkField - PK field name (excluded from update)
 * @param {string|undefined} skField - SK field name (excluded from update)
 * @returns {{ UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues }}
 */
function buildUpdateExpression(updates, pkField, skField) {
  const names = {};
  const values = {};
  const setClauses = [];

  for (const [k, v] of Object.entries(updates)) {
    if (k === pkField || k === skField) continue; // never overwrite key fields
    const nameToken = `#${k}`;
    const valueToken = `:${k}`;
    names[nameToken] = k;
    values[valueToken] = v;
    setClauses.push(`${nameToken} = ${valueToken}`);
  }

  if (setClauses.length === 0) {
    return null;
  }

  return {
    UpdateExpression: `SET ${setClauses.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const dynamoDbAdapter = {
  /**
   * Upserts an item into the table (full item replace).
   * @param {string} table - Logical table name
   * @param {Object} item - Item to store; must contain the table's PK (and SK if applicable)
   * @returns {Promise<Object>} The stored item
   */
  async putItem(table, item) {
    const { tableName } = resolveTable(table);
    await getDocClient().send(new PutCommand({ TableName: tableName, Item: item }));
    return item;
  },

  /**
   * Retrieves a single item by its primary key value.
   * For composite-key tables (pk + sk), queries by PK and returns the first result.
   * @param {string} table - Logical table name
   * @param {string} id - PK value
   * @returns {Promise<Object|null>} The item or null if not found
   */
  async getItem(table, id) {
    const { tableName, pk, sk } = resolveTable(table);

    if (!sk) {
      // Simple single-key table — use GetItem for O(1) lookup
      const result = await getDocClient().send(new GetCommand({
        TableName: tableName,
        Key: { [pk]: id },
      }));
      return result.Item ?? null;
    }

    // Composite-key table — query by PK and return the first result
    const result = await getDocClient().send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pkval',
      ExpressionAttributeNames: { '#pk': pk },
      ExpressionAttributeValues: { ':pkval': id },
      Limit: 1,
    }));
    return (result.Items && result.Items.length > 0) ? result.Items[0] : null;
  },

  /**
   * Removes an item by its primary key value.
   * For composite-key tables, deletes all items with the given PK value.
   * @param {string} table - Logical table name
   * @param {string} id - PK value
   * @returns {Promise<boolean>} True if at least one item was deleted
   */
  async deleteItem(table, id) {
    const { tableName, pk, sk } = resolveTable(table);

    if (!sk) {
      // Single-key table — attempt GetItem first to check existence
      const existing = await this.getItem(table, id);
      if (!existing) return false;
      await getDocClient().send(new DeleteCommand({
        TableName: tableName,
        Key: { [pk]: id },
      }));
      return true;
    }

    // Composite-key table — query all items for this PK, then delete each
    const result = await getDocClient().send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pkval',
      ExpressionAttributeNames: { '#pk': pk },
      ExpressionAttributeValues: { ':pkval': id },
    }));

    if (!result.Items || result.Items.length === 0) return false;

    for (const item of result.Items) {
      await getDocClient().send(new DeleteCommand({
        TableName: tableName,
        Key: { [pk]: item[pk], [sk]: item[sk] },
      }));
    }
    return true;
  },

  /**
   * Returns all items where item[fieldName] strictly equals value.
   * Uses a table Scan with FilterExpression.
   * For high-throughput production use, prefer GSI-based queries.
   * @param {string} table - Logical table name
   * @param {string} fieldName - Attribute to filter on
   * @param {*} value - Value to match
   * @returns {Promise<Object[]>} Matching items
   */
  async queryByField(table, fieldName, value) {
    const { tableName } = resolveTable(table);
    const items = [];
    let lastKey;

    do {
      const result = await getDocClient().send(new ScanCommand({
        TableName: tableName,
        FilterExpression: '#field = :val',
        ExpressionAttributeNames: { '#field': fieldName },
        ExpressionAttributeValues: { ':val': value },
        ExclusiveStartKey: lastKey,
      }));
      if (result.Items) items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  },

  /**
   * Returns every item in the table (paginated scan).
   * @param {string} table - Logical table name
   * @returns {Promise<Object[]>} All items
   */
  async listAll(table) {
    const { tableName } = resolveTable(table);
    const items = [];
    let lastKey;

    do {
      const result = await getDocClient().send(new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }));
      if (result.Items) items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  },

  /**
   * Merges updates into an existing item.
   * The PK (and SK if present) are never overwritten.
   * Returns null if the item does not exist.
   * @param {string} table - Logical table name
   * @param {string} id - PK value
   * @param {Object} updates - Partial fields to merge
   * @returns {Promise<Object|null>} The updated item or null if not found
   */
  async updateItem(table, id, updates) {
    const { tableName, pk, sk } = resolveTable(table);

    // Build the key for the UpdateItem call
    let key;
    if (!sk) {
      key = { [pk]: id };
    } else {
      // For composite-key tables, we need the SK value — look it up first
      const existing = await this.getItem(table, id);
      if (!existing) return null;
      key = { [pk]: existing[pk], [sk]: existing[sk] };
    }

    const expr = buildUpdateExpression(updates, pk, sk);
    if (!expr) {
      // Nothing to update — return the existing item
      return this.getItem(table, id);
    }

    const result = await getDocClient().send(new UpdateCommand({
      TableName: tableName,
      Key: key,
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));

    return result.Attributes ?? null;
  },

  // ---------------------------------------------------------------------------
  // DynamoDB-specific helpers not in the base interface
  // ---------------------------------------------------------------------------

  /**
   * Queries a table using a PK condition. For use with composite-key tables
   * or when callers need to query by the hash key with optional filters.
   * @param {string} table - Logical table name
   * @param {string} pkValue - Hash key value
   * @param {Object} [options]
   * @param {string} [options.indexName] - GSI or LSI name
   * @param {string} [options.filterExpr] - Additional FilterExpression
   * @param {Object} [options.filterNames] - ExpressionAttributeNames additions
   * @param {Object} [options.filterValues] - ExpressionAttributeValues additions
   * @param {boolean} [options.scanForward=true] - ScanIndexForward
   * @returns {Promise<Object[]>}
   */
  async queryByPk(table, pkValue, options = {}) {
    const { tableName, pk } = resolveTable(table);
    const items = [];
    let lastKey;

    const params = {
      TableName: tableName,
      KeyConditionExpression: '#pk = :pkval',
      ExpressionAttributeNames: { '#pk': pk, ...(options.filterNames || {}) },
      ExpressionAttributeValues: { ':pkval': pkValue, ...(options.filterValues || {}) },
      ScanIndexForward: options.scanForward !== false,
    };

    if (options.indexName) params.IndexName = options.indexName;
    if (options.filterExpr) params.FilterExpression = options.filterExpr;

    do {
      params.ExclusiveStartKey = lastKey;
      const result = await getDocClient().send(new QueryCommand(params));
      if (result.Items) items.push(...result.Items);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  },
};

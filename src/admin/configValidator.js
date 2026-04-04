/**
 * @file src/admin/configValidator.js
 * @description Type validation for Config table writes.
 * Validates values against CONFIG#SCHEMA definitions.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

let _docClient = null;
function getDocClient() {
  if (!_docClient) {
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

function getConfigTable() {
  return process.env.CONFIG_TABLE_NAME || `LearnfyraConfig-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;
}

/**
 * Fetches the schema definition for a config key.
 * @param {string} configType
 * @returns {Promise<{type: string, allowedValues?: string[]}|null>}
 */
async function getSchemaForKey(configType) {
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: getConfigTable(),
      Key: { configKey: 'CONFIG#SCHEMA' },
    }));
    const schema = result.Item?.value;
    if (!schema) return null;
    const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;
    return parsed[configType] || null;
  } catch {
    return null;
  }
}

/**
 * Fetches the allowed models list.
 * @returns {Promise<string[]>}
 */
async function getAllowedModels() {
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: getConfigTable(),
      Key: { configKey: 'CONFIG#ALLOWED_MODELS' },
    }));
    const value = result.Item?.value;
    if (!value) return [];
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return [];
  }
}

/**
 * Validates a config value against its schema type.
 *
 * @param {string} configType - Config key
 * @param {any} value - Proposed value
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateConfigValue(configType, value) {
  const schema = await getSchemaForKey(configType);

  // If no schema defined, allow the write (open schema)
  if (!schema) {
    return { valid: true };
  }

  const { type, allowedValues } = schema;

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected type 'string', got '${typeof value}'` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { valid: false, error: `Expected type 'number', got '${typeof value}'` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Expected type 'boolean', got '${typeof value}'` };
      }
      break;

    case 'string-enum':
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected type 'string', got '${typeof value}'` };
      }
      if (allowedValues && !allowedValues.includes(value)) {
        return { valid: false, error: `Value must be one of: ${allowedValues.join(', ')}` };
      }
      break;

    case 'string-array':
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        return { valid: false, error: `Expected an array of strings` };
      }
      break;

    default:
      // Unknown type in schema — allow the write
      break;
  }

  // Special rule: AI model must be in allowed models list
  if (configType === 'ai/activeModel' || configType === 'CONFIG#AI_MODEL') {
    const allowedModels = await getAllowedModels();
    if (allowedModels.length > 0 && !allowedModels.includes(value)) {
      return { valid: false, error: `Model '${value}' is not in the allowed models list` };
    }
  }

  return { valid: true };
}

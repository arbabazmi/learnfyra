/**
 * @file src/db/index.js
 * @description Database adapter factory. Returns the correct adapter based on
 * APP_RUNTIME environment variable.
 *
 * Local dev (JSON files): APP_RUNTIME=local (or unset) → localDbAdapter
 * Local dev (DynamoDB):   APP_RUNTIME=dynamodb          → dynamoDbAdapter (DYNAMODB_ENDPOINT=http://localhost:8000)
 * AWS Lambda:             APP_RUNTIME=aws               → dynamoDbAdapter (AWS DynamoDB)
 */

import { localDbAdapter } from './localDbAdapter.js';
import { dynamoDbAdapter } from './dynamoDbAdapter.js';

/**
 * Returns the active database adapter for the current runtime environment.
 *
 * @returns {typeof localDbAdapter | typeof dynamoDbAdapter} The database adapter instance
 */
export function getDbAdapter() {
  const runtime = process.env.APP_RUNTIME;
  if (runtime === 'dynamodb' || runtime === 'aws') {
    return dynamoDbAdapter;
  }
  return localDbAdapter;
}

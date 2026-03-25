/**
 * @file src/db/index.js
 * @description Database adapter factory. Returns the correct adapter based on
 * APP_RUNTIME environment variable.
 *
 * Local dev:  APP_RUNTIME=local (or unset) → localDbAdapter (JSON files in data-local/)
 * AWS Lambda: APP_RUNTIME=aws              → DynamoDB adapter (not yet implemented)
 */

import { localDbAdapter } from './localDbAdapter.js';

/**
 * Returns the active database adapter for the current runtime environment.
 *
 * @returns {typeof localDbAdapter} The database adapter instance
 * @throws {Error} When APP_RUNTIME=aws (DynamoDB adapter not yet implemented)
 */
export function getDbAdapter() {
  if (process.env.APP_RUNTIME === 'aws') {
    throw new Error(
      'DynamoDB adapter not yet implemented — set APP_RUNTIME=local for local dev'
    );
  }

  return localDbAdapter;
}

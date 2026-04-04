/**
 * @file backend/utils/responseUtils.js
 * @description Standard HTTP response helpers for Lambda handlers.
 *
 * All handlers must include CORS headers on every response, including error
 * responses and OPTIONS preflight responses. These helpers ensure consistent
 * header and body shape across all M05 (and future) handlers.
 */

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

/**
 * CORS headers applied to every Lambda response.
 * ALLOWED_ORIGIN is injected by CDK at deploy time; falls back to '*' for
 * local development (server.js does not set ALLOWED_ORIGIN).
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

/**
 * Builds a successful Lambda response.
 *
 * @param {number} statusCode - HTTP status code (2xx)
 * @param {Object|Array|null} body - Response payload, serialised to JSON
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
export function success(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body ?? null),
  };
}

/**
 * Builds an error Lambda response.
 *
 * The errorCode is a machine-readable string (e.g. NOT_CLASS_OWNER) that
 * clients can match programmatically. The message is a human-readable string
 * suitable for display in the UI.
 *
 * @param {number} statusCode - HTTP status code (4xx or 5xx)
 * @param {string} errorCode - Machine-readable error identifier
 * @param {string} message - Human-readable description of the error
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
export function error(statusCode, errorCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: errorCode, message }),
  };
}

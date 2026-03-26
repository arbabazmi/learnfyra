/**
 * @file backend/handlers/certificatesHandler.js
 * @description Lambda-compatible handler for student certificate list/download endpoints.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { validateToken, requireRole } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';
import { buildCertificateHtml } from '../../src/templates/certificate.html.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Builds a standard error response.
 * @param {number} statusCode
 * @param {string} message
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Parses and validates a bounded integer query parameter.
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {{ value: number, error: string|null }}
 */
function parseIntParam(value, fallback, min, max) {
  if (value == null || value === '') return { value: fallback, error: null };
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return { value: fallback, error: `Value must be an integer between ${min} and ${max}.` };
  }
  return { value: parsed, error: null };
}

/**
 * Returns configured signing secret for download tokens.
 * @returns {string}
 */
function getSigningSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for certificate download tokens.');
  }
  return secret;
}

/**
 * Creates a signed short-lived certificate download token.
 * @param {string} certificateId
 * @param {string} studentId
 * @returns {string}
 */
function signDownloadToken(certificateId, studentId) {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + (15 * 60 * 1000);
  const payload = `${certificateId}:${studentId}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');
}

/**
 * Verifies a signed download token.
 * @param {string} token
 * @returns {{ certificateId: string, studentId: string, expiresAt: number }}
 */
function verifyDownloadToken(token) {
  const secret = getSigningSecret();
  const raw = Buffer.from(token, 'base64url').toString('utf8');
  const lastDot = raw.lastIndexOf('.');
  if (lastDot < 1) {
    throw new Error('malformed');
  }

  const payload = raw.slice(0, lastDot);
  const signature = raw.slice(lastDot + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const lhs = Buffer.from(signature, 'utf8');
  const rhs = Buffer.from(expected, 'utf8');
  if (lhs.length !== rhs.length || !timingSafeEqual(lhs, rhs)) {
    throw new Error('signature');
  }

  const [certificateId, studentId, expiresAtRaw] = payload.split(':');
  const expiresAt = Number(expiresAtRaw);
  if (!certificateId || !studentId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new Error('expired');
  }

  return { certificateId, studentId, expiresAt };
}

/**
 * Lists certificates for authenticated student.
 * @param {Object} decoded
 * @param {Object} queryStringParameters
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleList(decoded, queryStringParameters) {
  const qs = queryStringParameters || {};
  const limitParsed = parseIntParam(qs.limit, 20, 1, 100);
  if (limitParsed.error) {
    return errorResponse(400, 'limit must be an integer between 1 and 100.');
  }

  const offsetParsed = parseIntParam(qs.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  if (offsetParsed.error) {
    return errorResponse(400, 'offset must be an integer greater than or equal to 0.');
  }

  const db = getDbAdapter();
  const allCertificates = await db.listAll('certificates');
  const mine = allCertificates
    .filter((item) => item.studentId === decoded.sub)
    .sort((a, b) => new Date(b.issuedAt || b.createdAt).getTime() - new Date(a.issuedAt || a.createdAt).getTime());

  const page = mine.slice(offsetParsed.value, offsetParsed.value + limitParsed.value);
  const certificates = page.map((item) => ({
    certificateId: item.id,
    worksheetId: item.worksheetId,
    subject: item.subject,
    topic: item.topic,
    grade: item.grade,
    score: item.score,
    totalPoints: item.totalPoints,
    percentage: item.percentage,
    issuedAt: item.issuedAt,
    downloadToken: signDownloadToken(item.id, decoded.sub),
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      studentId: decoded.sub,
      certificates,
      total: mine.length,
      pagination: {
        limit: limitParsed.value,
        offset: offsetParsed.value,
        returned: certificates.length,
      },
    }),
  };
}

/**
 * Downloads certificate content for authenticated student.
 * @param {Object} decoded
 * @param {string} certificateId
 * @param {Object} queryStringParameters
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
async function handleDownload(decoded, certificateId, queryStringParameters) {
  if (!certificateId || !UUID_REGEX.test(certificateId)) {
    return errorResponse(400, 'Certificate ID is required.');
  }

  const token = queryStringParameters && queryStringParameters.token;
  if (!token || typeof token !== 'string') {
    return errorResponse(400, 'token query parameter is required.');
  }

  let parsed;
  try {
    parsed = verifyDownloadToken(token);
  } catch {
    return errorResponse(401, 'Download token is invalid or expired.');
  }

  if (parsed.certificateId !== certificateId || parsed.studentId !== decoded.sub) {
    return errorResponse(401, 'Download token is invalid or expired.');
  }

  const db = getDbAdapter();
  const certificate = await db.getItem('certificates', certificateId);
  if (!certificate) {
    return errorResponse(404, 'Certificate not found.');
  }

  if (certificate.studentId !== decoded.sub) {
    return errorResponse(403, 'Forbidden.');
  }

  const user = await db.getItem('users', decoded.sub);
  const displayName = user?.displayName || user?.name || user?.fullName || user?.email || 'Student';

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      certificateId: certificate.id,
      studentId: certificate.studentId,
      displayName,
      subject: certificate.subject,
      topic: certificate.topic,
      grade: certificate.grade,
      percentage: certificate.percentage,
      issuedAt: certificate.issuedAt,
      htmlContent: buildCertificateHtml({
        displayName,
        subject: certificate.subject,
        topic: certificate.topic,
        grade: certificate.grade,
        percentage: certificate.percentage,
        issuedAt: certificate.issuedAt,
      }),
    }),
  };
}

/**
 * Lambda handler.
 * Routes:
 *   GET /api/certificates
 *   GET /api/certificates/:id/download
 *
 * @param {Object} event
 * @param {Object} context
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    requireRole(decoded, ['student']);

    const path = event.path || event.routeKey || '';

    if (event.httpMethod === 'GET' && path.endsWith('/api/certificates')) {
      return await handleList(decoded, event.queryStringParameters || {});
    }

    const downloadMatch = path.match(/\/api\/certificates\/([^/]+)\/download$/);
    if (event.httpMethod === 'GET' && downloadMatch) {
      const certificateId =
        (event.pathParameters && event.pathParameters.id) || downloadMatch[1];
      return await handleDownload(decoded, certificateId, event.queryStringParameters || {});
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('certificatesHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode < 500 ? err.message : 'Internal server error.';
    return errorResponse(statusCode, message);
  }
};

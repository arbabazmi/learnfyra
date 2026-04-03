/**
 * @file backend/handlers/apiAuthorizerHandler.js
 * @description API Gateway TOKEN authorizer for Bearer JWT validation.
 *
 * Supports two token issuers:
 *   1. Cognito/app-issued tokens (existing) — no iss claim or any non-guest iss
 *   2. Guest tokens — iss: "learnfyra-guest-issuer", token_use: "guest"
 *
 * Routing strategy: decode first (no verify) to read iss, then verify with
 * the appropriate validation rules. Fail closed on any error.
 */

import jwt from 'jsonwebtoken';

const GUEST_ISSUER = 'learnfyra-guest-issuer';

/**
 * Reads the JWT secret from the environment.
 * Shared between guest and Cognito paths for MVP (no separate guest secret).
 * @returns {string}
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return secret;
}

/**
 * Builds an IAM policy response for API Gateway custom authorizers.
 *
 * @param {string} principalId
 * @param {'Allow' | 'Deny'} effect
 * @param {string} resource
 * @param {Record<string, string>} [context]
 * @returns {object}
 */
function buildPolicy(principalId, effect, resource, context = {}) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}

/**
 * Builds a wildcard ARN so the cached policy applies to ALL API methods.
 * @param {string} methodArn
 * @returns {string}
 */
function wildcardArn(methodArn) {
  const parts = methodArn.split('/');
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}/*/*` : methodArn;
}

/**
 * Lambda TOKEN authorizer handler.
 *
 * @param {{ authorizationToken?: string, methodArn?: string }} event
 * @returns {Promise<object>}
 */
export const handler = async (event) => {
  const tokenHeader = event?.authorizationToken || '';
  const methodArn = event?.methodArn || '*';
  const resource = wildcardArn(methodArn);

  const match = tokenHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Unauthorized');
  }

  const token = match[1];

  try {
    // Step 1: Decode without verification — for routing only, not trust
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Unauthorized');
    }

    const secret = getJwtSecret();

    // Step 2: Route by iss claim
    if (decoded.iss === GUEST_ISSUER) {
      // ── GUEST PATH ──────────────────────────────────────────────────────
      const verified = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: GUEST_ISSUER,
      });

      // Reject if token_use is not exactly "guest"
      if (verified.token_use !== 'guest') {
        throw new Error('Unauthorized');
      }

      return buildPolicy(verified.sub, 'Allow', resource, {
        sub: verified.sub || '',
        email: '',
        role: verified.role || '',
        guestId: verified.sub || '',
        tokenType: 'guest',
      });
    }

    // ── COGNITO / APP PATH (existing behaviour) ───────────────────────────
    const verified = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });

    return buildPolicy(verified.sub || 'unknown', 'Allow', resource, {
      sub: verified.sub || '',
      email: verified.email || '',
      role: verified.role || '',
      tokenType: 'cognito',
    });
  } catch {
    // Fail closed — any verification failure results in Deny
    throw new Error('Unauthorized');
  }
};

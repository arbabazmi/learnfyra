/**
 * @file backend/handlers/apiAuthorizerHandler.js
 * @description API Gateway TOKEN authorizer for Bearer JWT validation.
 */

import { getAuthAdapter } from '../../src/auth/index.js';

/**
 * Builds an IAM policy response for API Gateway custom authorizers.
 *
 * @param {string} principalId
 * @param {'Allow' | 'Deny'} effect
 * @param {string} resource
 * @param {{ sub?: string, email?: string, role?: string }} [claims]
 * @returns {{ principalId: string, policyDocument: { Version: string, Statement: Array<{ Action: string, Effect: string, Resource: string }> }, context: Record<string, string> }}
 */
function buildPolicy(principalId, effect, resource, claims = {}) {
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
    context: {
      sub: claims.sub || '',
      email: claims.email || '',
      role: claims.role || '',
    },
  };
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

  const match = tokenHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Unauthorized');
  }

  try {
    const authAdapter = getAuthAdapter();
    const decoded = authAdapter.verifyToken(match[1]);
    const principalId = decoded?.sub || 'unknown';
    return buildPolicy(principalId, 'Allow', methodArn, {
      sub: decoded?.sub,
      email: decoded?.email,
      role: decoded?.role,
    });
  } catch {
    throw new Error('Unauthorized');
  }
};

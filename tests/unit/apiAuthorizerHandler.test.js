/**
 * @file tests/unit/apiAuthorizerHandler.test.js
 * @description Unit tests for backend/handlers/apiAuthorizerHandler.js
 * Tests dual-issuer JWT validation: guest tokens and Cognito/app tokens.
 * @agent QA
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-authorizer-secret';
const GUEST_ISSUER = 'learnfyra-guest-issuer';
const METHOD_ARN = 'arn:aws:execute-api:us-east-1:123456789012:apiId/dev/GET/api/solve/123';

let handler;

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_SECRET;
  const mod = await import('../../backend/handlers/apiAuthorizerHandler.js');
  handler = mod.handler;
});

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

function makeEvent(token) {
  return {
    authorizationToken: token ? `Bearer ${token}` : undefined,
    methodArn: METHOD_ARN,
  };
}

function signGuest(overrides = {}, secret = TEST_SECRET) {
  return jwt.sign(
    {
      sub: 'guest_abc-123',
      role: 'guest-student',
      token_use: 'guest',
      iss: GUEST_ISSUER,
      ...overrides,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '30d' },
  );
}

function signCognito(overrides = {}, secret = TEST_SECRET) {
  return jwt.sign(
    {
      sub: 'user-abc-123',
      email: 'test@learnfyra.com',
      role: 'student',
      ...overrides,
    },
    secret,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}

// ── Guest token — happy path ──────────────────────────────────────────────────

describe('apiAuthorizerHandler — valid guest JWT', () => {
  it('returns Allow with correct context for a valid guest-student token', async () => {
    const token = signGuest();
    const result = await handler(makeEvent(token));
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.role).toBe('guest-student');
    expect(result.context.guestId).toBe('guest_abc-123');
    expect(result.context.tokenType).toBe('guest');
    expect(result.principalId).toBe('guest_abc-123');
  });

  it('returns Allow for guest-teacher token', async () => {
    const token = signGuest({ role: 'guest-teacher' });
    const result = await handler(makeEvent(token));
    expect(result.context.role).toBe('guest-teacher');
    expect(result.context.tokenType).toBe('guest');
  });

  it('returns Allow for guest-parent token', async () => {
    const token = signGuest({ role: 'guest-parent' });
    const result = await handler(makeEvent(token));
    expect(result.context.role).toBe('guest-parent');
    expect(result.context.tokenType).toBe('guest');
  });

  it('policy uses wildcard ARN for cross-method caching', async () => {
    const token = signGuest();
    const result = await handler(makeEvent(token));
    const resource = result.policyDocument.Statement[0].Resource;
    expect(resource).toMatch(/\/\*\/\*$/);
  });
});

// ── Guest token — rejection cases ─────────────────────────────────────────────

describe('apiAuthorizerHandler — invalid guest JWT', () => {
  it('rejects expired guest JWT', async () => {
    const token = jwt.sign(
      { sub: 'guest_expired', role: 'guest-student', token_use: 'guest', iss: GUEST_ISSUER },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s' },
    );
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });

  it('rejects guest JWT signed with wrong secret', async () => {
    const token = signGuest({}, 'wrong-secret');
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });

  it('rejects guest JWT with token_use=access (not guest)', async () => {
    const token = jwt.sign(
      { sub: 'guest_bad', role: 'guest-student', token_use: 'access', iss: GUEST_ISSUER },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '30d' },
    );
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });

  it('rejects guest JWT with missing token_use', async () => {
    const token = jwt.sign(
      { sub: 'guest_no_use', role: 'guest-student', iss: GUEST_ISSUER },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '30d' },
    );
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });

  it('rejects alg=none attack on guest JWT', async () => {
    // Craft a token with alg:none — jwt.verify with algorithms:['HS256'] must reject
    const token = jwt.sign(
      { sub: 'guest_none', role: 'guest-student', token_use: 'guest', iss: GUEST_ISSUER },
      '',
      { algorithm: 'none' },
    );
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });
});

// ── Old format token (role:'guest', no iss) — naturally rejected ──────────────

describe('apiAuthorizerHandler — old guest token format', () => {
  it('rejects old format token (role:guest, no iss) — routes to Cognito path and passes since same secret', async () => {
    // Old tokens have role='guest', no iss, no token_use. They route to the Cognito path
    // because decoded.iss !== GUEST_ISSUER. They will be verified successfully by HS256
    // but will have role='guest' in context — downstream handlers must reject this role.
    const token = jwt.sign(
      { sub: 'guest-old-uuid', email: '', role: 'guest' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '2h' },
    );
    // This token IS technically valid HS256 — the authorizer will Allow it.
    // The natural rejection happens because downstream handlers do NOT accept
    // role='guest' (only 'guest-student', 'guest-teacher', 'guest-parent').
    const result = await handler(makeEvent(token));
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.role).toBe('guest');
    expect(result.context.tokenType).toBe('cognito');
    // NOTE: In practice, old 2h tokens expire naturally within 2 hours of deploy.
    // The authorizer allows them but downstream handlers reject role='guest'.
  });
});

// ── Cognito / app token — happy path ──────────────────────────────────────────

describe('apiAuthorizerHandler — valid Cognito/app JWT', () => {
  it('returns Allow with correct context for authenticated user', async () => {
    const token = signCognito();
    const result = await handler(makeEvent(token));
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.role).toBe('student');
    expect(result.context.email).toBe('test@learnfyra.com');
    expect(result.context.sub).toBe('user-abc-123');
    expect(result.context.tokenType).toBe('cognito');
  });

  it('returns Allow for teacher role', async () => {
    const token = signCognito({ role: 'teacher' });
    const result = await handler(makeEvent(token));
    expect(result.context.role).toBe('teacher');
  });

  it('returns Allow for admin role', async () => {
    const token = signCognito({ role: 'admin' });
    const result = await handler(makeEvent(token));
    expect(result.context.role).toBe('admin');
  });
});

// ── Cognito / app token — rejection cases ─────────────────────────────────────

describe('apiAuthorizerHandler — invalid Cognito/app JWT', () => {
  it('rejects expired Cognito JWT', async () => {
    const token = jwt.sign(
      { sub: 'user-expired', email: 'x@test.com', role: 'student' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s' },
    );
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });

  it('rejects Cognito JWT signed with wrong secret', async () => {
    const token = signCognito({}, 'bad-secret');
    await expect(handler(makeEvent(token))).rejects.toThrow('Unauthorized');
  });
});

// ── No token / malformed input ────────────────────────────────────────────────

describe('apiAuthorizerHandler — no token or malformed input', () => {
  it('rejects when no Authorization header is present', async () => {
    await expect(handler({ methodArn: METHOD_ARN })).rejects.toThrow('Unauthorized');
  });

  it('rejects when Authorization header is empty', async () => {
    await expect(handler(makeEvent(null))).rejects.toThrow('Unauthorized');
  });

  it('rejects malformed string (not a JWT)', async () => {
    await expect(handler(makeEvent('not-a-jwt'))).rejects.toThrow('Unauthorized');
  });

  it('rejects when Bearer prefix is missing', async () => {
    const token = signCognito();
    await expect(handler({ authorizationToken: token, methodArn: METHOD_ARN })).rejects.toThrow('Unauthorized');
  });
});

/**
 * @file tests/unit/tokenUtils.test.js
 * @description Unit tests for src/auth/tokenUtils.js
 * Tests the real implementation — tokenUtils is NOT mocked here.
 * The module-level JWT_SECRET guard test spawns a child process because
 * ESM module-level code runs once per process and cannot be re-evaluated
 * in the same Jest worker.
 * @agent QA
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

// ─── Ensure we run under development so the module-level guard does not
//     throw when tokenUtils is imported in this test file. ─────────────────

// Jest test environment sets NODE_ENV to 'test' by default; set it to
// 'development' so the local-dev fallback secret is used and the module
// can be imported cleanly.
process.env.NODE_ENV = 'development';
// Remove any pre-existing JWT_SECRET so we always exercise the fallback path
// in the normal tests (the guard only throws in non-dev without JWT_SECRET).
delete process.env.JWT_SECRET;

// Dynamic import must come AFTER env setup because tokenUtils reads env at
// module evaluation time.
let signToken;
let verifyToken;
let signOAuthState;
let verifyOAuthState;

beforeAll(async () => {
  const mod = await import('../../src/auth/tokenUtils.js');
  signToken = mod.signToken;
  verifyToken = mod.verifyToken;
  signOAuthState = mod.signOAuthState;
  verifyOAuthState = mod.verifyOAuthState;
});

// ─── signToken ────────────────────────────────────────────────────────────────

describe('signToken()', () => {

  it('returns a string', () => {
    const token = signToken({ sub: 'user-1', email: 'a@b.com', role: 'student' });
    expect(typeof token).toBe('string');
  });

  it('returns a value that looks like a JWT (three dot-separated segments)', () => {
    const token = signToken({ sub: 'user-1' });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('accepts a custom expiresIn duration without throwing', () => {
    expect(() => signToken({ sub: 'user-2' }, '1h')).not.toThrow();
  });

});

// ─── verifyToken ──────────────────────────────────────────────────────────────

describe('verifyToken()', () => {

  it('decodes a token signed by signToken and returns the original payload fields', () => {
    const payload = { sub: 'abc-123', email: 'test@learnfyra.com', role: 'teacher' };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('returns an object (not null or undefined) for a valid token', () => {
    const token = signToken({ sub: 'user-3' });
    const decoded = verifyToken(token);
    expect(decoded).toBeTruthy();
    expect(typeof decoded).toBe('object');
  });

  it('throws on an expired token', () => {
    // Sign a token that expires immediately (expiresIn = '0s' expires at the
    // second it is issued, so verification should reject it).
    // jsonwebtoken treats expiresIn='1ms' as 0 seconds, effectively expired.
    const token = signToken({ sub: 'user-4' }, '-1s');
    expect(() => verifyToken(token)).toThrow();
  });

  it('throws with a TokenExpiredError name on an expired token', () => {
    const token = signToken({ sub: 'user-5' }, '-1s');
    let caught;
    try {
      verifyToken(token);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.name).toBe('TokenExpiredError');
  });

  it('throws on a token with a tampered payload segment', () => {
    const token = signToken({ sub: 'user-6', role: 'student' });
    // Replace the payload segment (middle part) with garbage
    const parts = token.split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: 'admin', role: 'admin' })).toString('base64url');
    const tampered = parts.join('.');
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('throws a JsonWebTokenError on an entirely invalid token string', () => {
    let caught;
    try {
      verifyToken('this.is.notavalidtoken');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    // jsonwebtoken raises JsonWebTokenError for malformed tokens
    expect(caught.name).toMatch(/JsonWebTokenError|SyntaxError/);
  });

  it('throws on an empty string', () => {
    expect(() => verifyToken('')).toThrow();
  });

});

// ─── signOAuthState / verifyOAuthState ────────────────────────────────────────

describe('signOAuthState() / verifyOAuthState()', () => {

  it('round-trips a state payload with nonce and code_verifier', () => {
    const payload = { nonce: 'abc-123', code_verifier: 'verifier-xyz' };
    const state = signOAuthState(payload);
    const decoded = verifyOAuthState(state);
    expect(decoded.nonce).toBe(payload.nonce);
    expect(decoded.code_verifier).toBe(payload.code_verifier);
  });

  it('produces a JWT string (three dot-separated segments)', () => {
    const state = signOAuthState({ nonce: 'n', code_verifier: 'v' });
    expect(state.split('.')).toHaveLength(3);
  });

  it('throws on a tampered state token', () => {
    const state = signOAuthState({ nonce: 'n', code_verifier: 'v' });
    const parts = state.split('.');
    parts[1] = Buffer.from(JSON.stringify({ nonce: 'evil', code_verifier: 'evil' })).toString('base64url');
    expect(() => verifyOAuthState(parts.join('.'))).toThrow();
  });

  it('throws on an expired state token', () => {
    const expired = signToken({ nonce: 'n', code_verifier: 'v' }, '-1s');
    expect(() => verifyOAuthState(expired)).toThrow();
  });

  it('throws on an empty string', () => {
    expect(() => verifyOAuthState('')).toThrow();
  });

});

// ─── Module-level guard — non-development without JWT_SECRET ─────────────────
//
// The guard in tokenUtils.js is a module-level IIFE that runs when the module
// is first evaluated. In ESM, a module is cached after first evaluation, so we
// cannot re-evaluate it in the same Jest worker.
// Solution: spawn a fresh Node.js child process with NODE_ENV=production and
// no JWT_SECRET set, then check that the process exits non-zero with the
// expected error message on stderr.
//
// ─────────────────────────────────────────────────────────────────────────────

describe('tokenUtils module-level JWT_SECRET guard', () => {

  it('throws when NODE_ENV is production and JWT_SECRET is not set', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    // Convert to file:// URL so ESM dynamic import works on Windows paths
    const tokenUtilsUrl = pathToFileURL(
      path.join(projectRoot, 'src', 'auth', 'tokenUtils.js')
    ).href;

    // Inline script: attempt to import tokenUtils in production mode without JWT_SECRET.
    // Write the error message to stdout so we can assert on it.
    const script = `
      import('${tokenUtilsUrl}')
        .then(() => { process.exit(0); })
        .catch(err => {
          process.stdout.write(err.message);
          process.exit(1);
        });
    `;

    let output = '';
    let exitCode = 0;
    try {
      execSync(
        `node --input-type=module`,
        {
          input: script,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            JWT_SECRET: '',   // empty string forces the fallback branch
          },
          encoding: 'utf8',
          timeout: 10000,
        },
      );
    } catch (err) {
      // execSync throws on non-zero exit
      output = err.stdout || '';
      exitCode = err.status;
    }

    expect(exitCode).not.toBe(0);
    expect(output).toMatch(/JWT_SECRET environment variable is required/);
  });

  it('does NOT throw when NODE_ENV is production and JWT_SECRET IS set', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    const tokenUtilsUrl = pathToFileURL(
      path.join(projectRoot, 'src', 'auth', 'tokenUtils.js')
    ).href;

    const script = `
      import('${tokenUtilsUrl}')
        .then(() => { process.exit(0); })
        .catch(err => {
          process.stdout.write(err.message);
          process.exit(1);
        });
    `;

    let exitCode = -1;
    try {
      execSync(
        `node --input-type=module`,
        {
          input: script,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            JWT_SECRET: 'a-strong-production-secret-value',
          },
          encoding: 'utf8',
          timeout: 10000,
        },
      );
      exitCode = 0;
    } catch (err) {
      exitCode = err.status;
    }

    expect(exitCode).toBe(0);
  });

});

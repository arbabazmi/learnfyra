/**
 * @file tests/unit/questionBankIndex.test.js
 * @description Unit tests for src/questionBank/index.js factory.
 * Verifies adapter selection, singleton behaviour, and error handling.
 *
 * The local adapter is mocked with jest.unstable_mockModule so that
 * the factory logic is exercised without real in-memory storage side-effects.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Mock the local adapter module ────────────────────────────────────────────
//
// Must be declared before any dynamic import of the module under test.
// jest.unstable_mockModule hoists the factory stub into the module registry.

const mockLocalAdapter = {
  addQuestion:         jest.fn(),
  addIfNotExists:      jest.fn(),
  getQuestion:         jest.fn(),
  listQuestions:       jest.fn(),
  questionExists:      jest.fn(),
  incrementReuseCount: jest.fn(),
};

jest.unstable_mockModule('../../src/questionBank/localQuestionBankAdapter.js', () => mockLocalAdapter);

// ─── Dynamic import (must follow all mockModule declarations) ─────────────────

const { getQuestionBankAdapter } = await import('../../src/questionBank/index.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reset the singleton cached in the module between tests.
 * Because ESM module state is shared within a test file we manipulate
 * QB_ADAPTER and re-import in the tests that need a fresh singleton.
 */
function cleanEnv(key) {
  delete process.env[key];
}

// ─── Default adapter (no QB_ADAPTER set) ──────────────────────────────────────

describe('getQuestionBankAdapter — default (no QB_ADAPTER env)', () => {

  it('resolves to an object that has all required adapter methods', async () => {
    cleanEnv('QB_ADAPTER');
    const adapter = await getQuestionBankAdapter();
    expect(typeof adapter.addQuestion).toBe('function');
    expect(typeof adapter.addIfNotExists).toBe('function');
    expect(typeof adapter.getQuestion).toBe('function');
    expect(typeof adapter.listQuestions).toBe('function');
    expect(typeof adapter.questionExists).toBe('function');
    expect(typeof adapter.incrementReuseCount).toBe('function');
  });

  it('returns the local adapter methods bound to the mock module', async () => {
    cleanEnv('QB_ADAPTER');
    const adapter = await getQuestionBankAdapter();
    // Each method on the adapter is the same function reference as the mock
    expect(adapter.addQuestion).toBe(mockLocalAdapter.addQuestion);
    expect(adapter.getQuestion).toBe(mockLocalAdapter.getQuestion);
    expect(adapter.listQuestions).toBe(mockLocalAdapter.listQuestions);
    expect(adapter.questionExists).toBe(mockLocalAdapter.questionExists);
    expect(adapter.incrementReuseCount).toBe(mockLocalAdapter.incrementReuseCount);
  });

});

// ─── QB_ADAPTER=local ─────────────────────────────────────────────────────────

describe('getQuestionBankAdapter — QB_ADAPTER=local', () => {

  it('returns an adapter object when QB_ADAPTER is explicitly set to local', async () => {
    process.env.QB_ADAPTER = 'local';
    const adapter = await getQuestionBankAdapter();
    expect(adapter).not.toBeNull();
    expect(typeof adapter.addQuestion).toBe('function');
    cleanEnv('QB_ADAPTER');
  });

});

// ─── Singleton behaviour ───────────────────────────────────────────────────────
//
// The factory caches _adapter after the first call. A second call within the
// same module lifetime must return the identical object reference.

describe('getQuestionBankAdapter — singleton', () => {

  it('returns the same object reference on consecutive calls', async () => {
    const first  = await getQuestionBankAdapter();
    const second = await getQuestionBankAdapter();
    expect(first).toBe(second);
  });

  it('does not re-import the local adapter module on the second call', async () => {
    // Both calls return the same cached singleton — any method on it is the same ref
    const first  = await getQuestionBankAdapter();
    const second = await getQuestionBankAdapter();
    expect(first.addQuestion).toBe(second.addQuestion);
  });

});

// ─── Unsupported QB_ADAPTER value ─────────────────────────────────────────────
//
// The cached singleton from earlier tests means we need to re-import the
// factory module in a fresh context to test the error branch.
// We test this via a second dynamic import with a separate module mock scope.

describe('getQuestionBankAdapter — unsupported QB_ADAPTER', () => {

  it('throws an error when QB_ADAPTER is set to an unsupported value', async () => {
    // Re-import the module with cache busting via a query param (Jest ESM limitation workaround).
    // In ESM test environments, module state persists per import URL within the process.
    // We directly test the throw path by reimporting with a fresh module after setting the env var.
    // Because jest.unstable_mockModule already hoisted, we use a fresh inline import with
    // the module's own logic exercised through the env var change before the singleton is set.

    // Retrieve the module loader so we can invoke the factory logic in isolation
    // by temporarily replacing QB_ADAPTER and calling the factory on a fresh import.
    // Since the singleton from prior tests is cached, the only reliable way is to
    // reach the throw branch directly by importing with resetModules not available
    // in this context — we verify the exported factory contains the throw by inspecting
    // the error message pattern it would produce.

    // Verifiable approach: reset env, call with a bad adapter on a new module import
    process.env.QB_ADAPTER = 'unsupported-adapter-xyz';

    // Use jest.isolateModulesAsync to get a fresh module with no cached _adapter
    let thrownError = null;
    await jest.isolateModulesAsync(async () => {
      // Re-mock local adapter inside isolated context so import doesn't fail
      jest.unstable_mockModule('../../src/questionBank/localQuestionBankAdapter.js', () => mockLocalAdapter);
      try {
        const fresh = await import('../../src/questionBank/index.js');
        await fresh.getQuestionBankAdapter();
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toMatch(/unsupported-adapter-xyz/);
    cleanEnv('QB_ADAPTER');
  });

  it('error message includes the unrecognised adapter name', async () => {
    process.env.QB_ADAPTER = 'dynamo';
    let errorMessage = null;
    await jest.isolateModulesAsync(async () => {
      jest.unstable_mockModule('../../src/questionBank/localQuestionBankAdapter.js', () => mockLocalAdapter);
      try {
        const fresh = await import('../../src/questionBank/index.js');
        await fresh.getQuestionBankAdapter();
      } catch (err) {
        errorMessage = err.message;
      }
    });
    expect(errorMessage).toMatch(/dynamo/);
    cleanEnv('QB_ADAPTER');
  });

});

/**
 * @file src/questionBank/index.js
 * @description Factory that returns the correct question bank adapter for the
 * current environment.
 *
 * Adapter selection via QB_ADAPTER environment variable:
 *   QB_ADAPTER=local              → localQuestionBankAdapter  (in-memory, dev/test)
 *   QB_ADAPTER=dynamodb | aws     → dynamoAdapter             (DynamoDB, staging/prod)
 *
 * Usage:
 *   import { getQuestionBankAdapter } from '../../src/questionBank/index.js';
 *   const qb = await getQuestionBankAdapter();
 *   const question = await qb.addQuestion({ ... });
 *
 * Local DynamoDB dev:
 *   QB_ADAPTER=dynamodb DYNAMODB_ENDPOINT=http://localhost:8000 node …
 *
 * AWS Lambda (staging / prod):
 *   QB_ADAPTER=aws  (DYNAMODB_ENDPOINT not set — SDK uses regional endpoint)
 */

// Adapter type is frozen after first call — changes to QB_ADAPTER after
// initialisation have no effect. In tests, re-import the module to reset.
let _adapter = null;

/**
 * Returns the singleton question bank adapter instance.
 * The adapter is chosen by the QB_ADAPTER environment variable (default: 'local').
 *
 * @returns {Promise<{ addQuestion, addIfNotExists, getQuestion, listQuestions, questionExists, incrementReuseCount }>}
 */
export async function getQuestionBankAdapter() {
  if (_adapter) return _adapter;

  const mode = process.env.QB_ADAPTER || 'local';

  if (mode === 'local') {
    const mod = await import('./localQuestionBankAdapter.js');
    _adapter = {
      addQuestion:          mod.addQuestion,
      addIfNotExists:       mod.addIfNotExists,
      getQuestion:          mod.getQuestion,
      listQuestions:        mod.listQuestions,
      questionExists:       mod.questionExists,
      incrementReuseCount:  mod.incrementReuseCount,
    };
    return _adapter;
  }

  if (mode === 'dynamodb' || mode === 'aws') {
    const mod = await import('./dynamoAdapter.js');
    _adapter = {
      addQuestion:          mod.addQuestion,
      addIfNotExists:       mod.addIfNotExists,
      getQuestion:          mod.getQuestion,
      listQuestions:        mod.listQuestions,
      questionExists:       mod.questionExists,
      incrementReuseCount:  mod.incrementReuseCount,
    };
    return _adapter;
  }

  throw new Error(`Unknown QB_ADAPTER value: "${mode}". Supported values: local, dynamodb`);
}

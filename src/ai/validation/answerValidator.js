/**
 * @file src/ai/validation/answerValidator.js
 * @description Validates generated answers using Claude Sonnet.
 * Always runs on Sonnet (accuracy is critical here).
 */

import { getAnthropicClient } from '../client.js';
import { buildValidationPrompt } from '../prompts/validationPrompts.js';
import { withRetry } from '../../utils/retryUtils.js';
import { MODEL_SONNET } from '../routing/modelRouter.js';

const MAX_TOKENS = 512;

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} is_correct
 * @property {number}  confidence  - 0.0 to 1.0
 * @property {string}  corrected_answer
 * @property {string}  validation_notes
 */

/**
 * Validates a generated answer using Claude Sonnet.
 *
 * @param {Object} params
 * @param {number|string} params.grade
 * @param {string} params.subject
 * @param {string} params.questionType
 * @param {string} params.question
 * @param {string} params.answer
 * @param {string[]} [params.options]
 * @returns {Promise<ValidationResult>}
 */
export async function validateAnswer({ grade, subject, questionType, question, answer, options }) {
  const { system, user } = buildValidationPrompt({ grade, subject, questionType, question, answer, options });

  const result = await withRetry(
    async () => {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: MODEL_SONNET,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const text = response.content?.[0]?.text ?? '';
      if (!text) throw new Error('Empty validation response from Claude');

      return _parseValidationResponse(text);
    },
    { maxRetries: 2, baseDelayMs: 500 }
  );

  return result;
}

/**
 * Parses and validates the JSON response from the validation step.
 * @param {string} raw
 * @returns {ValidationResult}
 */
function _parseValidationResponse(raw) {
  // Strip optional markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Validation response is not valid JSON: ${raw.slice(0, 200)}`);
  }

  if (typeof parsed.is_correct !== 'boolean') {
    throw new Error(`Validation response missing is_correct boolean: ${raw.slice(0, 200)}`);
  }
  if (typeof parsed.corrected_answer !== 'string') {
    throw new Error(`Validation response missing corrected_answer string: ${raw.slice(0, 200)}`);
  }

  return {
    is_correct: parsed.is_correct,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 1.0,
    corrected_answer: parsed.corrected_answer,
    validation_notes: parsed.validation_notes ?? '',
  };
}

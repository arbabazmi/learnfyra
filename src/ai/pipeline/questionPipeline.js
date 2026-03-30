/**
 * @file src/ai/pipeline/questionPipeline.js
 * @description 4-step question generation pipeline:
 *   1. generate  — Haiku or Sonnet (per modelRouter)
 *   2. answer    — same model as generate
 *   3. validate  — always Sonnet
 *   4. explain   — always Haiku
 *
 * Includes retry + escalation logic:
 *   - Up to 2 validation retries, re-generating each time
 *   - On 2nd retry, escalates generate step to Sonnet
 *   - Corrects answer if validator flags it
 */

import { getAnthropicClient } from '../client.js';
import { selectModel, MODEL_HAIKU, MODEL_SONNET } from '../routing/modelRouter.js';
import { buildQuestionPrompt } from '../prompts/questionPrompts.js';
import { buildExplanationPrompt } from '../prompts/explanationPrompts.js';
import { validateAnswer } from '../validation/answerValidator.js';
import { withRetry } from '../../utils/retryUtils.js';

const GENERATE_MAX_TOKENS = 1024;
const EXPLAIN_MAX_TOKENS  = 512;
const MAX_VALIDATION_ATTEMPTS = 3; // 1 initial + 2 retries

/**
 * @typedef {Object} PipelineQuestion
 * @property {string} type
 * @property {string} question
 * @property {string[]} [options]
 * @property {string} answer
 * @property {string} explanation
 * @property {number} points
 * @property {Object} _meta
 * @property {string} _meta.generateModel
 * @property {string} _meta.explainModel
 * @property {boolean} _meta.wasEscalated
 * @property {number}  _meta.validationAttempts
 * @property {Object}  _meta.usage  - { inputTokens, outputTokens }
 */

/**
 * Runs the full 4-step pipeline for a single question.
 *
 * @param {Object} params
 * @param {number|string} params.grade
 * @param {string} params.subject
 * @param {string} params.topic
 * @param {string} params.difficulty
 * @param {string} params.questionType
 * @returns {Promise<PipelineQuestion>}
 */
export async function runQuestionPipeline({ grade, subject, topic, difficulty, questionType }) {
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  let wasEscalated = false;

  // ── Step 1 & 2: Generate question (with validation retry loop) ────────────
  let generated = null;
  let validationResult = null;

  for (let attempt = 0; attempt < MAX_VALIDATION_ATTEMPTS; attempt++) {
    const step = attempt >= 2 ? 'escalated-generate' : 'generate';
    const { model: generateModel } = selectModel({ grade, subject, questionType, difficulty, step });
    if (step === 'escalated-generate') wasEscalated = true;

    // Step 1: Generate
    generated = await _generateQuestion({
      grade, subject, topic, difficulty, questionType,
      model: generateModel,
      attempt,
    });
    totalInputTokens  += generated._usage.inputTokens;
    totalOutputTokens += generated._usage.outputTokens;

    // Step 3: Validate
    validationResult = await validateAnswer({
      grade,
      subject,
      questionType: generated.type,
      question: generated.question,
      answer: generated.answer,
      options: generated.options,
    });

    if (validationResult.is_correct || validationResult.confidence >= 0.9) {
      // Accept — apply any correction
      if (!validationResult.is_correct) {
        generated.answer = validationResult.corrected_answer;
      }
      break;
    }

    // Validation failed — apply correction and retry generation on next loop
    generated.answer = validationResult.corrected_answer;

    if (attempt === MAX_VALIDATION_ATTEMPTS - 1) {
      // Last attempt — use whatever we have (corrected answer is still better than nothing)
      break;
    }
  }

  const finalGenerateModel = wasEscalated ? MODEL_SONNET : selectModel({ grade, subject, questionType, difficulty }).model;

  // ── Step 4: Explain (always Haiku) ───────────────────────────────────────
  const explanation = await _generateExplanation({
    grade, subject,
    questionType: generated.type,
    question: generated.question,
    answer: generated.answer,
    options: generated.options,
  });
  totalInputTokens  += explanation._usage.inputTokens;
  totalOutputTokens += explanation._usage.outputTokens;

  // ── Assemble final question ───────────────────────────────────────────────
  const question = {
    type: generated.type,
    question: generated.question,
    answer: generated.answer,
    explanation: explanation.text,
    points: generated.points ?? 1,
    _meta: {
      generateModel: finalGenerateModel,
      explainModel: MODEL_HAIKU,
      wasEscalated,
      validationAttempts: validationResult ? 1 : 0,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    },
  };

  if (generated.options) {
    question.options = generated.options;
  }

  return question;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Calls Claude to generate a single question object.
 * @private
 */
async function _generateQuestion({ grade, subject, topic, difficulty, questionType, model, attempt }) {
  const { system, user } = buildQuestionPrompt({ grade, subject, topic, difficulty, questionType, attempt });

  const response = await withRetry(
    async () => {
      const client = getAnthropicClient();
      return client.messages.create({
        model,
        max_tokens: GENERATE_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });
    },
    { maxRetries: 2, baseDelayMs: 500 }
  );

  const text = response.content?.[0]?.text ?? '';
  if (!text) throw new Error('Empty generation response from Claude');

  const parsed = _parseQuestionResponse(text, questionType);
  parsed._usage = {
    inputTokens:  response.usage?.input_tokens  ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
  return parsed;
}

/**
 * Calls Haiku to generate a student-facing explanation.
 * @private
 */
async function _generateExplanation({ grade, subject, questionType, question, answer, options }) {
  const { system, user } = buildExplanationPrompt({ grade, subject, questionType, question, answer, options });

  const response = await withRetry(
    async () => {
      const client = getAnthropicClient();
      return client.messages.create({
        model: MODEL_HAIKU,
        max_tokens: EXPLAIN_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });
    },
    { maxRetries: 2, baseDelayMs: 300 }
  );

  const raw = response.content?.[0]?.text ?? '';
  let explanationText = '';
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    explanationText = parsed.explanation ?? raw;
  } catch {
    explanationText = raw; // fallback to raw text
  }

  return {
    text: explanationText,
    _usage: {
      inputTokens:  response.usage?.input_tokens  ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Parses the raw Claude response into a question object.
 * @private
 */
function _parseQuestionResponse(raw, expectedType) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Find JSON object
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object in generation response: ${raw.slice(0, 200)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error(`Generation response is not valid JSON: ${raw.slice(0, 200)}`);
  }

  if (!parsed.question || typeof parsed.question !== 'string') {
    throw new Error(`Generation response missing "question" field: ${raw.slice(0, 200)}`);
  }
  if (!parsed.answer || typeof parsed.answer !== 'string') {
    throw new Error(`Generation response missing "answer" field: ${raw.slice(0, 200)}`);
  }

  return {
    type:     parsed.type    ?? expectedType,
    question: parsed.question,
    options:  Array.isArray(parsed.options) ? parsed.options : undefined,
    answer:   parsed.answer,
    points:   typeof parsed.points === 'number' ? parsed.points : 1,
  };
}

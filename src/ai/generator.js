/**
 * @file src/ai/generator.js
 * @description Calls Anthropic Claude API, extracts and validates the worksheet JSON,
 *   and retries with exponential backoff + escalating prompts on failure.
 *
 *   Retry strategy:
 *     attempt 0  → normal prompt (buildUserPrompt)
 *     attempt 1+ → strict prompt (buildStrictUserPrompt) with CRITICAL JSON warning
 *
 *   Validation pipeline per attempt:
 *     1. extractJSON()           — finds outermost { … } block robustly
 *     2. JSON.parse()            — throws on malformed JSON → retry
 *     3. coerceTypes()           — normalizes grade/points to integers
 *     4. validateTopLevel()      — checks required top-level fields
 *     5. validateQuestions()     — checks each question object
 *     6. validateQuestionCount() — exact count must match requested count
 *     7. validateWorksheetOutput() — content safety guardrail scan (NEW)
 *        → FAIL: escalate guardrailLevel and retry (up to policy.retryLimit)
 *
 *   Bank-first assembly (when QB_ADAPTER is set and not 'off'):
 *     - Attempts to serve questions from the question bank first
 *     - Falls back to Claude AI for any shortfall
 *     - Stores every new AI-generated question back into the bank
 *     - Records reuse of every banked question used
 *     - Returns generationMode ('ai-only' | 'mixed' | 'bank-only') and
 *       provenanceLevel array (one entry per question: 'bank' | 'ai')
 *
 *   Guardrail injection (NEW):
 *     - buildGuardrailSuffix() appended to system prompt before every Claude call
 *     - On content safety failure: escalate to 'strict' level and retry
 *     - All attempts logged via auditLogger as 'generation.moderation' events
 * @agent DEV
 */

import { createHash } from 'crypto';
import { anthropic, CLAUDE_MODEL, MAX_TOKENS } from './client.js';
import { buildSystemPrompt, buildUserPrompt, buildStrictUserPrompt } from './promptBuilder.js';
import { withRetry } from '../utils/retryUtils.js';
import { validateGrade, validateQuestionCount, validateSubject } from '../cli/validator.js';
import { logger } from '../utils/logger.js';
import { mockGenerateWorksheet } from './mockAi.js';
import { recordQuestionReuse } from '../questionBank/reuseHook.js';

// ─── Guardrail imports (lazy for Lambda cold start optimization) ──────────────

/** @type {Function|null} */
let _buildGuardrailSuffix = null;

/**
 * Lazily loads buildGuardrailSuffix to avoid loading DynamoDB SDK on cold starts
 * when guardrails are not needed.
 * @returns {Promise<Function>}
 */
async function getGuardrailSuffixBuilder() {
  if (!_buildGuardrailSuffix) {
    const mod = await import('./guardrails/guardrailsBuilder.js');
    _buildGuardrailSuffix = mod.buildGuardrailSuffix;
  }
  return _buildGuardrailSuffix;
}

/** @type {Function|null} */
let _validateWorksheetOutput = null;

/**
 * Lazily loads validateWorksheetOutput.
 * @returns {Promise<Function>}
 */
async function getOutputValidator() {
  if (!_validateWorksheetOutput) {
    const mod = await import('./validation/outputValidator.js');
    _validateWorksheetOutput = mod.validateWorksheetOutput;
  }
  return _validateWorksheetOutput;
}

/** @type {Function|null} */
let _getGuardrailPolicy = null;

/**
 * Lazily loads getGuardrailPolicy.
 * @returns {Promise<Function>}
 */
async function getGuardrailPolicyLoader() {
  if (!_getGuardrailPolicy) {
    const mod = await import('./guardrails/guardrailsPolicy.js');
    _getGuardrailPolicy = mod.getGuardrailPolicy;
  }
  return _getGuardrailPolicy;
}

/** @type {Function|null} */
let _writeAuditLog = null;

/**
 * Lazily loads writeAuditLog from auditLogger.
 * @returns {Promise<Function>}
 */
async function getAuditLogger() {
  if (!_writeAuditLog) {
    const mod = await import('../admin/auditLogger.js');
    _writeAuditLog = mod.writeAuditLog;
  }
  return _writeAuditLog;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** All required top-level fields in the worksheet JSON */
const REQUIRED_TOP_LEVEL = [
  'title', 'grade', 'subject', 'topic', 'difficulty',
  'instructions', 'totalPoints', 'questions',
];

/** All required fields on every question object */
const REQUIRED_QUESTION_FIELDS = ['number', 'type', 'question', 'answer', 'points'];

/** Valid question type values */
const VALID_QUESTION_TYPES = new Set([
  'multiple-choice',
  'fill-in-the-blank',
  'short-answer',
  'true-false',
  'matching',
  'show-your-work',
  'word-problem',
]);

// ─── JSON extraction ──────────────────────────────────────────────────────────

/**
 * Robustly extracts a JSON object from a Claude response string.
 *
 * Handles:
 *   - Bare JSON (ideal case)
 *   - JSON wrapped in markdown fences (```json … ```)
 *   - JSON preceded or followed by explanatory text
 *   - Nested braces inside string values (tracked via depth counter)
 *
 * @param {string} rawText - Raw text from Claude API response
 * @returns {string} The extracted JSON substring
 * @throws {Error} If no valid JSON object boundary can be found
 */
export function extractJSON(rawText) {
  const text = rawText.trim();

  // Fast path: entire response is already valid JSON
  if (text.startsWith('{')) {
    return text;
  }

  // Strip markdown fences if present
  const fenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (fenced.startsWith('{')) {
    return fenced;
  }

  // Scan for the first { and track depth to find the matching }
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error(
    'Claude response contained no JSON object. ' +
    `Response preview: "${text.slice(0, 120).replace(/\n/g, ' ')}…"`
  );
}

// ─── Type coercion ────────────────────────────────────────────────────────────

/**
 * Normalizes field types in the parsed worksheet object to match the canonical schema.
 * Modifies the object in-place and returns it.
 *
 * @param {Object} data - Parsed worksheet object (mutated)
 * @returns {Object} The same object with normalized types
 */
export function coerceTypes(data) {
  // grade and totalPoints must be integers
  if (data.grade !== undefined)       data.grade       = Number(data.grade);
  if (data.totalPoints !== undefined) data.totalPoints = Number(data.totalPoints);

  if (Array.isArray(data.questions)) {
    for (const q of data.questions) {
      if (q.number !== undefined) q.number = Number(q.number);
      if (q.points !== undefined) q.points = Number(q.points);

      // Ensure answer is always a string
      if (q.answer !== undefined && typeof q.answer !== 'string') {
        q.answer = String(q.answer);
      }
    }
  }

  return data;
}

// ─── Answer normalization ─────────────────────────────────────────────────────

/**
 * Normalizes and validates the answer field based on question type.
 * Fixes common AI output issues to match the scoring engine's expectations.
 * Mutates the question object in-place.
 *
 * @param {Object} question - A single question object (already coerced by coerceTypes)
 * @returns {void}
 */
function normalizeAnswer(question) {
  const { type, answer } = question;

  // Skip normalization if answer is missing — let validation catch it
  if (answer === undefined || answer === null) return;

  switch (type) {
    case 'multiple-choice': {
      // Extract just the letter from answers like "B. 42" or "B"
      if (typeof answer === 'string') {
        const match = answer.trim().match(/^([A-Da-d])/);
        if (match) {
          question.answer = match[1].toUpperCase();
        }
      }
      break;
    }

    case 'true-false': {
      // Normalize to "True" or "False"
      const norm = String(answer).trim().toLowerCase();
      if (norm === 't' || norm === 'true' || norm === 'yes') {
        question.answer = 'True';
      } else if (norm === 'f' || norm === 'false' || norm === 'no') {
        question.answer = 'False';
      }
      break;
    }

    case 'fill-in-the-blank': {
      // Trim whitespace, ensure it's a string
      question.answer = String(answer).trim();
      break;
    }

    case 'short-answer': {
      // Ensure answer is a string of keywords
      question.answer = String(answer).trim();
      break;
    }

    case 'matching': {
      // Validate it's an array of {left, right} objects
      if (Array.isArray(answer)) {
        question.answer = answer.map(pair => ({
          left:  String(pair.left  || '').trim(),
          right: String(pair.right || '').trim(),
        }));
      }
      break;
    }

    case 'show-your-work':
    case 'word-problem': {
      // Ensure answer is just the final answer string
      question.answer = String(answer).trim();
      break;
    }
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates required top-level fields of the worksheet JSON.
 * @param {Object} data - Coerced worksheet object
 * @throws {Error} If any required field is missing or the questions field is not an array
 */
function validateTopLevel(data) {
  for (const field of REQUIRED_TOP_LEVEL) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Worksheet JSON missing required top-level field: "${field}"`);
    }
  }

  if (!Array.isArray(data.questions)) {
    throw new Error('Worksheet JSON "questions" field must be an array');
  }
}

/**
 * Validates a single question object.
 * Exported so the M03 assembler can reuse this logic before storing AI-generated
 * questions to the bank.
 *
 * @param {Object} q - Question object
 * @param {number} idx - Zero-based index in questions array (for error messages)
 * @throws {Error} If the question is invalid
 */
export function validateQuestion(q, idx) {
  const label = `Question at index ${idx}`;

  for (const field of REQUIRED_QUESTION_FIELDS) {
    if (q[field] === undefined || q[field] === null || q[field] === '') {
      throw new Error(`${label} is missing required field: "${field}"`);
    }
  }

  if (!VALID_QUESTION_TYPES.has(q.type)) {
    throw new Error(
      `${label} has invalid type "${q.type}". ` +
      `Must be one of: ${[...VALID_QUESTION_TYPES].join(', ')}`
    );
  }

  if (typeof q.question !== 'string' || !q.question.trim()) {
    throw new Error(`${label} "question" must be a non-empty string`);
  }

  if (isNaN(q.number) || q.number < 1) {
    throw new Error(`${label} "number" must be a positive integer, got: ${q.number}`);
  }

  if (isNaN(q.points) || q.points < 0) {
    throw new Error(`${label} "points" must be a non-negative integer, got: ${q.points}`);
  }

  // Multiple-choice must have exactly 4 options labeled A/B/C/D
  if (q.type === 'multiple-choice') {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(
        `${label} is type "multiple-choice" but "options" must be an array of exactly 4 strings`
      );
    }
  } else if (q.options !== undefined) {
    // Non-multiple-choice questions must not have options
    // (treat as a warning — delete the field rather than failing)
    delete q.options;
  }
}

/**
 * Validates all questions and the exact count match.
 * @param {Object} data - Coerced worksheet object
 * @param {number} expectedCount - Expected number of questions
 * @throws {Error} If any question is invalid or count does not match
 */
function validateQuestions(data, expectedCount) {
  if (data.questions.length !== expectedCount) {
    throw new Error(
      `Expected exactly ${expectedCount} questions, got ${data.questions.length}. ` +
      'Claude must return the exact requested count.'
    );
  }

  for (let i = 0; i < data.questions.length; i++) {
    validateQuestion(data.questions[i], i);
  }
}

// ─── Bank-first helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the question bank integration is enabled.
 * Disabled when QB_ADAPTER is unset or explicitly set to 'off'.
 * @returns {boolean}
 */
function isBankEnabled() {
  const val = process.env.QB_ADAPTER;
  return Boolean(val) && val !== 'off';
}

/**
 * Fisher-Yates in-place shuffle.
 * @param {Array} arr
 * @returns {Array} The same array, shuffled
 */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Attempts to fetch candidate questions from the question bank for the given
 * worksheet parameters. Returns an empty array on any error so a bank failure
 * never prevents worksheet generation.
 *
 * @param {{ grade, subject, topic, difficulty }} options
 * @returns {Promise<Object[]>} Bank questions (may be empty)
 */
async function fetchBankQuestions(options) {
  try {
    const { getQuestionBankAdapter } = await import('../questionBank/index.js');
    const qb = await getQuestionBankAdapter();
    return await qb.listQuestions({
      grade:      options.grade,
      subject:    options.subject,
      topic:      options.topic,
      difficulty: options.difficulty,
    });
  } catch (err) {
    logger.warn(`Question bank lookup failed — falling back to ai-only: ${err.message}`);
    return [];
  }
}

/**
 * Stores AI-generated questions back into the question bank.
 * Errors are swallowed so a bank-write failure never breaks worksheet delivery.
 *
 * @param {Object[]} questions - Validated AI-generated question objects
 * @returns {Promise<void>}
 */
async function storeToBankSilently(questions) {
  try {
    const { getQuestionBankAdapter } = await import('../questionBank/index.js');
    const qb = await getQuestionBankAdapter();
    for (const q of questions) {
      await qb.addIfNotExists(q, q);
    }
  } catch (err) {
    logger.warn(`Question bank write failed (non-fatal): ${err.message}`);
  }
}

// ─── Moderation audit helper ──────────────────────────────────────────────────

/**
 * Writes a generation.moderation audit event. Fire-and-forget — never throws.
 *
 * @param {Object} params
 * @param {number} params.grade
 * @param {string} params.subject
 * @param {string} params.guardrailLevel
 * @param {string} params.promptHashSha256
 * @param {Object} params.validationResult
 * @param {number} params.retryCount
 * @param {string} params.modelUsed
 * @param {string} params.actorId
 * @returns {Promise<void>}
 */
async function _logModerationEvent({
  grade,
  subject,
  guardrailLevel,
  promptHashSha256,
  validationResult,
  retryCount,
  modelUsed,
  actorId,
}) {
  try {
    const writeAuditLog = await getAuditLogger();
    await writeAuditLog({
      actorId,
      actorRole:        'system',
      action:           'GENERATION_MODERATION',
      targetEntityType: 'worksheet',
      targetEntityId:   'pending',
      afterState: {
        eventType:       'generation.moderation',
        grade,
        subject,
        guardrailLevel,
        promptHashSha256,
        validationResult,
        retryCount,
        modelUsed,
      },
      ipAddress: 'system',
      userAgent: 'generator.js',
    });
  } catch {
    // Fire-and-forget — audit failure must never break worksheet generation
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a worksheet by calling the Claude API with retry and escalating prompts.
 *
 * When QB_ADAPTER is set and not 'off', the bank-first pipeline is active:
 *   - 'bank-only'  — all questions served from the bank (no Claude call)
 *   - 'mixed'      — some from bank, remainder from Claude
 *   - 'ai-only'    — bank empty / disabled; full Claude generation
 *
 * Additional fields on the returned worksheet:
 *   generationMode   {string}   — 'ai-only' | 'mixed' | 'bank-only'
 *   provenanceLevel  {string[]} — parallel to questions; 'bank' | 'ai' per question
 *
 * @param {Object} options - Worksheet generation options
 * @param {number}  options.grade         - Grade level 1–10
 * @param {string}  options.subject       - Subject name (Math | ELA | Science | Social Studies | Health)
 * @param {string}  options.topic         - Specific topic within subject
 * @param {string}  options.difficulty    - Easy | Medium | Hard | Mixed
 * @param {number}  options.questionCount - Number of questions (5–10)
 * @returns {Promise<Object>} Parsed, coerced, and validated worksheet object
 * @throws {Error} If validation fails after all retry attempts
 */
export async function generateWorksheet(options) {
  if (process.env.MOCK_AI === 'true') {
    return mockGenerateWorksheet(options);
  }

  const { grade, subject, topic, difficulty, questionCount } = options;
  const isLambdaRuntime = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const anthropicRequestTimeoutMs = parseInt(
    process.env.ANTHROPIC_REQUEST_TIMEOUT_MS || (isLambdaRuntime ? '22000' : '60000'),
    10
  );

  // Validate inputs before touching the API or bank
  validateGrade(grade);
  validateSubject(subject);
  validateQuestionCount(questionCount);

  // ── Bank-first assembly ──────────────────────────────────────────────────
  let bankPool    = [];
  let bankEnabled = isBankEnabled();

  if (bankEnabled) {
    bankPool = await fetchBankQuestions({ grade, subject, topic, difficulty });
    shuffleInPlace(bankPool);
  }

  const bankQuestions = bankPool.slice(0, questionCount);
  const bankCount     = bankQuestions.length;
  const aiNeeded      = questionCount - bankCount;

  let generationMode;
  let aiQuestions = [];

  // ── Moderation accumulator — hoisted so bank-only/mixed paths can reference it ─
  /** @type {{ questionsScanned: number, questionsRejected: number, questionsRetried: number, anyFlagged: boolean }} */
  const moderationAccumulator = {
    questionsScanned:  0,
    questionsRejected: 0,
    questionsRetried:  0,
    anyFlagged:        false,
  };

  if (bankCount >= questionCount) {
    generationMode = 'bank-only';
    logger.debug(`Bank-first: serving all ${questionCount} questions from bank.`);
  } else if (bankCount > 0) {
    generationMode = 'mixed';
    logger.debug(`Bank-first: ${bankCount} from bank, ${aiNeeded} from Claude.`);
  } else {
    generationMode = 'ai-only';
    logger.debug('Bank-first: bank empty — full Claude generation.');
  }

  // ── Claude generation (ai-only or mixed) ────────────────────────────────
  if (aiNeeded > 0) {
    const aiOptions        = { ...options, questionCount: aiNeeded };
    const baseSystemPrompt = buildSystemPrompt();
    let attemptNumber      = 0;

    // ── Load guardrail policy once per generation call ─────────────────────
    let policy = { guardrailLevel: 'medium', retryLimit: 3, validationFilters: ['profanity', 'sensitiveTopics'] };
    try {
      const loadPolicy = await getGuardrailPolicyLoader();
      policy = await loadPolicy();
    } catch (err) {
      logger.warn(`generator: could not load guardrail policy — using default. ${err.message}`);
    }

    const guardrailRetryLimit = Math.max(
      0,
      Math.min(5, parseInt(process.env.GUARDRAIL_RETRY_LIMIT || String(policy.retryLimit), 10))
    );

    // Tracks guardrail-specific retry count (separate from JSON-parse retries)
    let guardrailAttempt     = 0;
    // Escalated to 'strict' on first guardrail failure
    let activeGuardrailLevel = policy.guardrailLevel;

    const callClaude = async () => {
      // Build guardrail-injected system prompt
      let systemPrompt = baseSystemPrompt;
      try {
        const buildSuffix = await getGuardrailSuffixBuilder();
        const suffix      = await buildSuffix({
          grade,
          subject,
          guardrailLevel: activeGuardrailLevel,
        });
        if (suffix) systemPrompt = `${baseSystemPrompt}\n\n${suffix}`;
      } catch (err) {
        logger.warn(`generator: guardrail suffix build failed — proceeding without it. ${err.message}`);
      }

      const userPrompt = attemptNumber === 0
        ? buildUserPrompt(aiOptions)
        : buildStrictUserPrompt(aiOptions);

      logger.debug(
        `Claude API call (attempt ${attemptNumber + 1}, guardrailLevel=${activeGuardrailLevel})…`
      );

      const promptHashSha256 = createHash('sha256')
        .update(systemPrompt + userPrompt)
        .digest('hex');

      const message = await anthropic.messages.create(
        {
          model:      CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        { timeout: anthropicRequestTimeoutMs }
      );

      if (message.stop_reason === 'max_tokens') {
        throw new Error(
          `Claude response was truncated (hit max_tokens=${MAX_TOKENS}). ` +
          'Try reducing the question count.'
        );
      }

      const rawText = message.content[0]?.text ?? '';

      if (!rawText.trim()) {
        throw new Error('Claude API returned an empty response.');
      }

      if (
        rawText.length < 200 &&
        /\b(cannot|can't|sorry|unable|inappropriate|policy)\b/i.test(rawText)
      ) {
        throw new Error(
          `Claude refused to generate content: "${rawText.trim().slice(0, 120)}". ` +
          'Try a different topic or rephrase.'
        );
      }

      const jsonStr = extractJSON(rawText);
      const parsed  = JSON.parse(jsonStr);
      const coerced = coerceTypes(parsed);

      if (Array.isArray(coerced.questions)) {
        for (const q of coerced.questions) {
          normalizeAnswer(q);
        }
      }

      validateTopLevel(coerced);
      // Validate question count matches what we asked Claude for
      validateQuestions(coerced, aiNeeded);

      // ── Content safety validation ────────────────────────────────────────
      let validationResult = { safe: true, failureReason: null, failureDetails: null, validatorsRun: [] };
      try {
        const validate      = await getOutputValidator();
        validationResult    = await validate(coerced, {
          grade,
          subject,
          guardrailLevel:     activeGuardrailLevel,
          validationFilters:  policy.validationFilters,
        });
      } catch (err) {
        logger.warn(`generator: outputValidator threw — skipping safety check. ${err.message}`);
      }

      // ── Accumulate moderation stats for this attempt ─────────────────────
      const scannedCount = Array.isArray(coerced.questions) ? coerced.questions.length : 0;
      moderationAccumulator.questionsScanned += scannedCount;

      if (!validationResult.safe) {
        moderationAccumulator.questionsRejected += scannedCount;
        moderationAccumulator.anyFlagged         = true;
      }

      // ── Audit log this attempt (fire-and-forget) ─────────────────────────
      _logModerationEvent({
        grade,
        subject,
        guardrailLevel:  activeGuardrailLevel,
        promptHashSha256,
        validationResult,
        retryCount:      guardrailAttempt,
        modelUsed:       process.env.CLAUDE_MODEL || CLAUDE_MODEL,
        actorId:         options.actorId || 'system',
      }).catch(() => {}); // fire-and-forget

      if (!validationResult.safe) {
        guardrailAttempt++;
        moderationAccumulator.questionsRetried++;

        if (guardrailAttempt <= guardrailRetryLimit) {
          // Escalate to strict for the next attempt
          activeGuardrailLevel = 'strict';
          logger.warn(
            `generator: content safety check failed (${validationResult.failureReason}) ` +
            `— retrying with strict guardrail (guardrail attempt ${guardrailAttempt}/${guardrailRetryLimit})`
          );
          throw new Error(
            `Content safety validation failed: ${validationResult.failureDetails}. ` +
            `Retrying with stricter guardrail (attempt ${guardrailAttempt}/${guardrailRetryLimit}).`
          );
        }

        // All guardrail retries exhausted
        throw new Error(
          `Content safety validation failed after ${guardrailAttempt} attempt(s). ` +
          `Reason: ${validationResult.failureDetails}. ` +
          'Please try a different topic or contact support.'
        );
      }

      return coerced;
    };

    const aiWorksheet = await withRetry(
      async () => {
        try {
          return await callClaude();
        } finally {
          attemptNumber++;
        }
      },
      {
        maxRetries: parseInt(
          process.env.MAX_RETRIES || (isLambdaRuntime ? '0' : String(guardrailRetryLimit + 2)),
          10
        ),
        baseDelayMs: 1000,
        onRetry: (attempt, err) => {
          logger.warn(`Retry ${attempt}: ${err.message}`);
        },
      }
    );

    aiQuestions = aiWorksheet.questions;

    // Store new AI questions back into the bank (best-effort, non-blocking)
    if (bankEnabled) {
      await storeToBankSilently(aiQuestions);
    }

    // For ai-only, return the full AI worksheet enriched with bank metadata
    if (generationMode === 'ai-only') {
      return {
        ...aiWorksheet,
        generationMode:  'ai-only',
        provenanceLevel: Array(aiWorksheet.questions.length).fill('ai'),
        aiDisclosure: {
          generated: true,
          model:     process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
          provider:  'Anthropic',
          label:     'Questions generated with AI assistance',
        },
        moderationSummary: _buildModerationSummary(moderationAccumulator),
      };
    }
  }

  /**
   * Builds the final moderationSummary object from the accumulated stats.
   * Defined as an inner helper so it is reachable from all return paths.
   * @param {{ questionsScanned: number, questionsRejected: number, questionsRetried: number, anyFlagged: boolean }} acc
   * @returns {Object}
   */
  function _buildModerationSummary(acc) {
    return {
      flagged:           acc.anyFlagged,
      questionsScanned:  acc.questionsScanned,
      questionsRejected: acc.questionsRejected,
      questionsRetried:  acc.questionsRetried,
      anyFlagged:        acc.anyFlagged,
      service:           'custom',
    };
  }

  // ── bank-only: return the banked worksheet structure ─────────────────────
  if (generationMode === 'bank-only') {
    // Renumber questions 1..N
    const questions = bankQuestions.map((q, i) => ({ ...q, number: i + 1 }));

    const bankIds = bankQuestions.map(q => q.questionId).filter(Boolean);
    await recordQuestionReuse(bankIds);

    // Reconstruct a worksheet-shaped object from the first banked question's metadata
    const sample = bankQuestions[0];
    return {
      title:           `${sample.subject} Worksheet — ${sample.topic}`,
      grade,
      subject,
      topic:           topic || sample.topic,
      difficulty:      difficulty || sample.difficulty,
      standards:       sample.standards || [],
      estimatedTime:   sample.estimatedTime || '',
      instructions:    sample.instructions || '',
      totalPoints:     questions.reduce((s, q) => s + (q.points || 0), 0),
      questions,
      generationMode:  'bank-only',
      provenanceLevel: Array(questions.length).fill('bank'),
      aiDisclosure: {
        generated: true,
        model:     process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        provider:  'Anthropic',
        label:     'Questions generated with AI assistance',
      },
      moderationSummary: _buildModerationSummary(moderationAccumulator),
    };
  }

  // ── mixed: merge bank + AI questions ────────────────────────────────────
  const mergedQuestions = [
    ...bankQuestions.map(q => ({ ...q, _provenance: 'bank' })),
    ...aiQuestions.map(q => ({ ...q, _provenance: 'ai'   })),
  ];

  // Renumber 1..N
  mergedQuestions.forEach((q, i) => { q.number = i + 1; });

  const provenanceLevel = mergedQuestions.map(q => q._provenance);
  mergedQuestions.forEach(q => { delete q._provenance; });

  // Record reuse for banked questions
  const bankIds = bankQuestions.map(q => q.questionId).filter(Boolean);
  await recordQuestionReuse(bankIds);

  // Use AI worksheet top-level fields as the base (they match the requested options)
  // We need the AI worksheet fields — retrieve via the aiQuestions already stored above.
  // For mixed mode we only have aiQuestions array; reconstruct top-level from options.
  const sample = bankQuestions[0];
  return {
    title:           `${subject} Worksheet — ${topic}`,
    grade,
    subject,
    topic,
    difficulty,
    standards:       sample.standards || [],
    estimatedTime:   sample.estimatedTime || '',
    instructions:    sample.instructions || '',
    totalPoints:     mergedQuestions.reduce((s, q) => s + (q.points || 0), 0),
    questions:       mergedQuestions,
    generationMode:  'mixed',
    provenanceLevel,
    aiDisclosure: {
      generated: true,
      model:     process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      provider:  'Anthropic',
      label:     'Questions generated with AI assistance',
    },
    moderationSummary: _buildModerationSummary(moderationAccumulator),
  };
}

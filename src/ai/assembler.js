/**
 * @file src/ai/assembler.js
 * @description M03 — bank-first worksheet assembly pipeline.
 *
 * Pipeline:
 *   1. Query question bank with grade/subject/topic/difficulty filters
 *   2. Randomly select up to questionCount banked questions
 *   3. If bank covers full count → return assembled worksheet (no AI call)
 *   4. If bank partially covers → generate only the missing count via AI
 *   5. Validate each AI-generated question using validateQuestion
 *   6. Store each valid new question to bank via addIfNotExists
 *   7. Call recordQuestionReuse for all banked question IDs used
 *   8. Merge banked + generated questions, renumber 1..N, return worksheet object
 *
 * Model selection:
 *   missingCount ≤ 5                       → LOW_COST_MODEL  (haiku-tier)
 *   missingCount 6–15                       → CLAUDE_MODEL    (mid-tier, default)
 *   missingCount > 15 OR Hard difficulty
 *     with count > 10                       → PREMIUM_MODEL   (high-tier)
 *
 * @agent DEV
 */

import { CLAUDE_MODEL, MAX_TOKENS, anthropic } from './client.js';
import { buildSystemPrompt, buildUserPrompt, buildStrictUserPrompt } from './promptBuilder.js';
import { validateQuestion, extractJSON, coerceTypes } from './generator.js';
import { withRetry } from '../utils/retryUtils.js';
import { getQuestionBankAdapter } from '../questionBank/index.js';
import { recordQuestionReuse } from '../questionBank/reuseHook.js';
import { logger } from '../utils/logger.js';
import { buildQuestionSignature } from './repeatCapPolicy.js';

// ─── Model tiers ──────────────────────────────────────────────────────────────

/** Low-cost model for small gap fills (≤ 5 missing questions) */
const LOW_COST_MODEL =
  process.env.LOW_COST_MODEL || 'claude-haiku-4-5-20251001';

/** Premium model for large or hard requests (> 15 missing, or Hard + count > 10) */
const PREMIUM_MODEL =
  process.env.PREMIUM_MODEL || CLAUDE_MODEL;

/**
 * Picks the appropriate model based on how many questions need to be generated,
 * the total requested count, and the difficulty level.
 *
 * @param {number} missingCount   - Number of questions not covered by the bank
 * @param {number} questionCount  - Total questions requested (used for Hard threshold)
 * @param {string} difficulty     - Worksheet difficulty (Easy | Medium | Hard | Mixed)
 * @returns {string} Model identifier string
 */
export function pickModel(missingCount, questionCount, difficulty) {
  if (missingCount > 15 || (difficulty === 'Hard' && questionCount > 10)) {
    return PREMIUM_MODEL;
  }
  if (missingCount <= 5) {
    return LOW_COST_MODEL;
  }
  return CLAUDE_MODEL;
}

// ─── Internal: generate a batch of questions via Claude ──────────────────────

/**
 * Calls the Claude API to generate exactly `missingCount` questions for the
 * given worksheet options, using the specified model.
 *
 * Returns the raw questions array (not a full worksheet object). The caller is
 * responsible for merging with banked questions and renumbering.
 *
 * @param {Object} options         - Worksheet options (grade/subject/topic/difficulty)
 * @param {number} missingCount    - Exact number of questions to generate
 * @param {string} model           - Claude model identifier to use
 * @returns {Promise<Object[]>}    Array of validated question objects
 */
async function generateMissingQuestions(options, missingCount, model) {
  const { grade, subject, topic, difficulty } = options;
  const systemPrompt = buildSystemPrompt();
  let attemptNumber = 0;

  const callClaude = async () => {
    const genOptions = { ...options, questionCount: missingCount };
    const userPrompt = attemptNumber === 0
      ? buildUserPrompt(genOptions)
      : buildStrictUserPrompt(genOptions);

    logger.debug(
      `Assembler — Claude API call (model: ${model}, count: ${missingCount}, attempt: ${attemptNumber + 1})`
    );

    const message = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

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

    if (!Array.isArray(coerced.questions)) {
      throw new Error('Claude response did not contain a "questions" array.');
    }
    if (coerced.questions.length !== missingCount) {
      throw new Error(
        `Expected exactly ${missingCount} questions from Claude, got ${coerced.questions.length}.`
      );
    }

    // Validate each question before returning
    for (let i = 0; i < coerced.questions.length; i++) {
      validateQuestion(coerced.questions[i], i);
    }

    return coerced.questions;
  };

  return withRetry(
    async () => {
      try {
        return await callClaude();
      } finally {
        attemptNumber++;
      }
    },
    {
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      baseDelayMs: 1000,
      onRetry: (attempt, err) => {
        logger.warn(`Assembler retry ${attempt}: ${err.message}`);
      },
    }
  );
}

// ─── Internal: shuffle helper ─────────────────────────────────────────────────

/**
 * Returns a new array containing up to `n` randomly sampled elements from `arr`
 * (Fisher-Yates partial shuffle). Does not mutate the original array.
 *
 * @template T
 * @param {T[]} arr
 * @param {number} n
 * @returns {T[]}
 */
function sampleN(arr, n) {
  const copy = arr.slice();
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function shuffled(arr) {
  return sampleN(arr, arr.length);
}

/**
 * Selects up to questionCount candidates while enforcing repeat allowance.
 * @param {Object[]} candidates
 * @param {number} questionCount
 * @param {Set<string>} seenSignatures
 * @param {number} maxRepeatQuestions
 * @returns {{ selected: Object[], repeatUsed: number }}
 */
function selectWithRepeatCap(candidates, questionCount, seenSignatures, maxRepeatQuestions) {
  const selected = [];
  let repeatUsed = 0;

  const inOrder = shuffled(candidates);
  for (const q of inOrder) {
    if (selected.length >= questionCount) break;

    const sig = buildQuestionSignature(q);
    const isSeen = seenSignatures.has(sig);
    if (!isSeen) {
      selected.push(q);
      continue;
    }

    if (repeatUsed < maxRepeatQuestions) {
      selected.push(q);
      repeatUsed += 1;
    }
  }

  return { selected, repeatUsed };
}

/**
 * Returns whether full per-question provenance should be attached.
 * @param {string} provenanceLevel
 * @returns {boolean}
 */
function shouldAttachQuestionProvenance(provenanceLevel) {
  return provenanceLevel === 'full';
}

/**
 * Builds per-question provenance for a banked question.
 * @param {Object} question
 * @param {boolean} reuseRecorded
 * @returns {Object}
 */
function buildBankQuestionProvenance(question, reuseRecorded) {
  return {
    source: 'bank',
    questionId: question.questionId || null,
    reuseRecorded,
    modelUsed: null,
    storedToBank: false,
  };
}

/**
 * Builds per-question provenance for a generated question.
 * @param {string} model
 * @param {Object|null} stored
 * @returns {Object}
 */
function buildGeneratedQuestionProvenance(model, stored) {
  return {
    source: 'generated',
    questionId: stored?.questionId || null,
    reuseRecorded: false,
    modelUsed: model,
    storedToBank: Boolean(stored),
  };
}

/**
 * Builds worksheet-level provenance summary.
 * @param {Object} input
 * @returns {Object}
 */
function buildProvenanceSummary({
  provenanceLevel,
  fromBank,
  missingCount,
  totalStored,
  bankedIds,
  model,
}) {
  return {
    mode: 'bank-first',
    level: provenanceLevel,
    usedBank: fromBank > 0,
    usedGeneration: missingCount > 0,
    selectedBankCount: fromBank,
    generatedCount: missingCount,
    storedGeneratedCount: totalStored,
    bankedQuestionIds: bankedIds,
    generatedByModels: model ? [model] : [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assembles a worksheet using the M03 bank-first pipeline.
 *
 * Returned object matches the canonical worksheet schema so `exportWorksheet`
 * and `exportAnswerKey` work without modification.
 *
 * @param {Object} options
 * @param {number}  options.grade          - Grade level 1–10
 * @param {string}  options.subject        - Subject (Math | ELA | Science | Social Studies | Health)
 * @param {string}  options.topic          - Topic within subject
 * @param {string}  options.difficulty     - Easy | Medium | Hard | Mixed
 * @param {number}  options.questionCount  - Total questions requested (5–30)
 *
 * @param {string}  [options.generationMode]  - auto | bank-first
 * @param {string}  [options.provenanceLevel] - none | summary | full
 * @returns {Promise<{ worksheet: Object, bankStats: { fromBank: number, generated: number, totalStored: number }, provenance?: Object }>} 
 */
export async function assembleWorksheet(options) {
  const {
    grade,
    subject,
    topic,
    difficulty,
    questionCount,
    provenanceLevel = 'summary',
    repeatCapPercent = 100,
    seenQuestionSignatures,
  } = options;

  const seenSignatures = seenQuestionSignatures instanceof Set
    ? seenQuestionSignatures
    : new Set(Array.isArray(seenQuestionSignatures) ? seenQuestionSignatures : []);
  const effectiveRepeatCapPercent = Math.max(0, Math.min(100, Number(repeatCapPercent)));
  const maxRepeatQuestions = Math.floor(questionCount * (effectiveRepeatCapPercent / 100));

  // ── Step 1: Query the bank ──────────────────────────────────────────────────
  const skipBankLookup = process.env.SKIP_BANK_LOOKUP === 'true';
  const qb = await getQuestionBankAdapter();

  let bankedSelected = [];
  let repeatUsed = 0;
  let candidates = [];

  if (skipBankLookup) {
    logger.info('Assembler — SKIP_BANK_LOOKUP=true, bypassing bank query — all questions from AI');
  } else {
    candidates = await qb.listQuestions({ grade, subject, topic, difficulty });

    // ── Step 2: Randomly select up to questionCount banked questions ──────────
    const result = selectWithRepeatCap(candidates, questionCount, seenSignatures, maxRepeatQuestions);
    bankedSelected = result.selected;
    repeatUsed = result.repeatUsed;
  }

  const fromBank       = bankedSelected.length;
  const missingCount   = questionCount - fromBank;

  logger.info(
    `Assembler — bank has ${candidates.length} candidate(s); ` +
    `using ${fromBank} banked, generating ${missingCount} new`
  );

  // ── Step 3: Full bank coverage — no AI call needed ─────────────────────────
  let generatedQuestions = [];
  let totalStored = 0;
  let generationModel = null;

  if (missingCount > 0) {
    // ── Step 4: Generate only the missing questions via AI ───────────────────
    generationModel = pickModel(missingCount, questionCount, difficulty);
    logger.info(`Assembler — generating ${missingCount} question(s) using model: ${generationModel}`);

    generatedQuestions = await generateMissingQuestions(options, missingCount, generationModel);

    const filteredGenerated = [];
    for (const q of generatedQuestions) {
      const sig = buildQuestionSignature(q);
      const isSeen = seenSignatures.has(sig);
      if (!isSeen) {
        filteredGenerated.push(q);
        continue;
      }
      if (repeatUsed < maxRepeatQuestions) {
        filteredGenerated.push(q);
        repeatUsed += 1;
      }
    }
    generatedQuestions = filteredGenerated;

    if (generatedQuestions.length < missingCount) {
      throw new Error(
        `Unable to satisfy repeat cap (${effectiveRepeatCapPercent}%). ` +
        `Needed ${missingCount} generated questions, got ${generatedQuestions.length}.`
      );
    }

    // ── Step 5–6: Validate and store each new question ────────────────────────
    for (let i = 0; i < generatedQuestions.length; i++) {
      const q = generatedQuestions[i];

      // validateQuestion was already called inside generateMissingQuestions;
      // calling here is a defence-in-depth check before storing.
      // If it fails here a second time, Claude returned bad data that slipped
      // through the first pass — throw to trigger retry rather than silently
      // truncating the worksheet below the requested questionCount (C1).
      try {
        validateQuestion(q, i);
      } catch (err) {
        throw new Error(
          `Generated question at index ${i} failed second-pass validation: ${err.message}`
        );
      }

      const candidate = { grade, subject, topic, type: q.type, question: q.question };
      const newEntry = {
        ...q,
        grade,
        subject,
        topic,
        difficulty,
        modelUsed: generationModel,
      };

      const { stored } = await qb.addIfNotExists(candidate, newEntry);
      if (shouldAttachQuestionProvenance(provenanceLevel)) {
        generatedQuestions[i] = {
          ...q,
          provenance: buildGeneratedQuestionProvenance(generationModel, stored),
        };
      }

      if (stored) {
        totalStored++;
        logger.debug(`Assembler — stored new question to bank (questionId: ${stored.questionId})`);
      }
    }
  }

  // ── Step 7: Record reuse of banked questions ──────────────────────────────
  const bankedIds = bankedSelected
    .map(q => q.questionId)
    .filter(id => typeof id === 'string' && id.trim());

  if (bankedIds.length > 0) {
    await recordQuestionReuse(bankedIds);
  }

  // ── Step 8: Merge and renumber questions 1..N ─────────────────────────────
  // Banked questions are placed first, generated questions fill the remainder.
  const bankedQuestions = shouldAttachQuestionProvenance(provenanceLevel)
    ? bankedSelected.map((question) => ({
      ...question,
      provenance: buildBankQuestionProvenance(question, bankedIds.includes(question.questionId)),
    }))
    : bankedSelected;

  const merged = [...bankedQuestions, ...generatedQuestions];

  const renumbered = merged.map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));

  const totalPoints = renumbered.reduce((sum, q) => sum + (q.points ?? 1), 0);

  // ~2 minutes per question as a baseline estimate, minimum 5 minutes (W2)
  const estimatedMinutes = Math.max(5, questionCount * 2);
  const estimatedTime    = `${estimatedMinutes} minutes`;
  const timerSeconds     = estimatedMinutes * 60;

  const worksheet = {
    title:        `Grade ${grade} ${subject}: ${topic}`,
    grade,
    subject,
    topic,
    difficulty,
    estimatedTime,
    timerSeconds,
    instructions: `Answer each question carefully. Show your work where asked.`,
    totalPoints,
    questions:    renumbered,
  };

  const bankStats = {
    fromBank,
    generated: missingCount,
    totalStored,
    repeatCapPercent: effectiveRepeatCapPercent,
    maxRepeatQuestions,
    repeatUsed,
  };

  if (provenanceLevel === 'none') {
    return { worksheet, bankStats };
  }

  return {
    worksheet,
    bankStats,
    provenance: buildProvenanceSummary({
      provenanceLevel,
      fromBank,
      missingCount,
      totalStored,
      bankedIds,
      model: generationModel,
    }),
  };
}

/**
 * @file src/ai/validation/outputValidator.js
 * @description Orchestrates post-generation output validation.
 *
 *   Runs configured validators sequentially against a generated worksheet.
 *   Stops on the first failure (fail-fast) to avoid unnecessary work.
 *   Returns a structured result for use by generator.js's retry logic.
 *
 *   Validator pipeline (v1):
 *     1. profanityFilter     — word-list profanity and slur scan
 *     2. sensitiveTopicFilter — grade-aware topic detection
 *     3. factualValidator    — placeholder for Phase 2 (warn-only, never fails)
 *
 *   The set of active validators is driven by the policy's `validationFilters` array,
 *   so admins can disable individual validators via the admin API without a deploy.
 *
 *   After the pipeline completes, per-question moderation results are written
 *   to the LearnfyraModerationLog table (fire-and-forget) for COPPA-09 compliance.
 *   Import of moderationLogger is lazy so it does not add to cold-start cost.
 * @agent DEV
 */

import { scanForProfanity } from './profanityFilter.js';
import { scanForSensitiveTopics } from './sensitiveTopicFilter.js';
import { resolveEffectiveLevel } from '../guardrails/guardrailsBuilder.js';
import { logger } from '../../utils/logger.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ValidationContext
 * @property {number}             grade          - Grade level 1-10
 * @property {string}             subject        - Subject name
 * @property {'medium'|'strict'}  [guardrailLevel] - Policy-level override; derived from grade if omitted
 * @property {string[]}           [validationFilters] - Active filter names; defaults to all
 * @property {string}             [worksheetId]  - UUID of the worksheet (passed to moderation log)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean}      safe            - True if all validators passed
 * @property {string|null}  failureReason   - Short failure category name (e.g. 'profanity')
 * @property {string|null}  failureDetails  - Human-readable description of the failure
 * @property {string[]}     validatorsRun   - Names of validators that ran (in order)
 */

/**
 * Validates a generated worksheet against all configured content safety validators.
 *
 * @param {Object} worksheet - Parsed worksheet JSON (from generator.js)
 * @param {ValidationContext} context
 * @returns {Promise<ValidationResult>}
 */
export async function validateWorksheetOutput(worksheet, context) {
  const {
    grade,
    subject,
    guardrailLevel: policyLevel,
    validationFilters = ['profanity', 'sensitiveTopics'],
    worksheetId,
  } = context;

  // Resolve the effective guardrail level for this grade + policy combination
  const effectiveLevel = resolveEffectiveLevel(grade, policyLevel || 'medium');

  const validatorsRun = [];

  // result is built up through the pipeline and returned at a single exit point
  // so the moderation log call is guaranteed to fire regardless of which
  // validator triggers a rejection.
  let result = null;

  // ── 1. Profanity filter ──────────────────────────────────────────────────
  if (!result && validationFilters.includes('profanity')) {
    validatorsRun.push('profanityFilter');

    let profanityResult;
    try {
      profanityResult = scanForProfanity(worksheet);
    } catch (err) {
      logger.warn(`outputValidator: profanityFilter threw — skipping. Error: ${err.message}`);
      profanityResult = { safe: true, matches: [] };
    }

    if (!profanityResult.safe) {
      logger.warn(
        `outputValidator: profanity detected in Grade ${grade} ${subject} worksheet. ` +
        `Matches: ${profanityResult.matches.join(', ')}`
      );
      result = {
        safe: false,
        failureReason: 'profanity',
        failureDetails:
          `Profanity or slur detected in generated content. ` +
          `Flagged tokens: ${profanityResult.matches.join(', ')}`,
        validatorsRun,
      };
    }
  }

  // ── 2. Sensitive topic filter ────────────────────────────────────────────
  if (!result && validationFilters.includes('sensitiveTopics')) {
    validatorsRun.push('sensitiveTopicFilter');

    let sensitiveResult;
    try {
      sensitiveResult = scanForSensitiveTopics(worksheet, effectiveLevel);
    } catch (err) {
      logger.warn(
        `outputValidator: sensitiveTopicFilter threw — skipping. Error: ${err.message}`
      );
      sensitiveResult = { safe: true, triggeredCategories: [] };
    }

    if (!sensitiveResult.safe) {
      logger.warn(
        `outputValidator: sensitive topics detected in Grade ${grade} ${subject} worksheet. ` +
        `Categories: ${sensitiveResult.triggeredCategories.join(', ')}`
      );
      result = {
        safe: false,
        failureReason: 'sensitiveTopics',
        failureDetails:
          `Sensitive topic content detected. ` +
          `Categories: ${sensitiveResult.triggeredCategories.join(', ')}`,
        validatorsRun,
      };
    }
  }

  // ── 3. Factual validator (Phase 2 placeholder — warn only) ───────────────
  if (!result && validationFilters.includes('factualCheck')) {
    validatorsRun.push('factualValidator');
    // Phase 2: call factualValidator.js here
    // For v1 this is a no-op that never fails
  }

  if (!result) {
    result = {
      safe: true,
      failureReason: null,
      failureDetails: null,
      validatorsRun,
    };
  }

  // ── Fire-and-forget COPPA-09 per-question moderation log ─────────────────
  // Import is lazy (no cold-start impact). Never awaited at the call site;
  // any failure inside logModerationResults is already swallowed there.
  import('./moderationLogger.js')
    .then(({ logModerationResults }) => {
      logModerationResults({
        worksheetId,
        grade,
        subject,
        questions: Array.isArray(worksheet?.questions) ? worksheet.questions : [],
        validationResults: result,
        gradeBand: effectiveLevel,
        service: 'outputValidator',
      });
    })
    .catch((err) => {
      logger.warn(`outputValidator: failed to load moderationLogger — ${err.message}`);
    });

  return result;
}

/**
 * @file src/questionBank/reuseHook.js
 * @description Thin utility for recording that banked questions were used in a
 * worksheet assembly step.
 *
 * Called by any consumer (M03 bank-first pipeline, manual reuse endpoint, etc.)
 * to increment reuseCount for each question that was pulled from the bank.
 *
 * Design decisions:
 * - Silent no-op for unknown IDs: the bank may have been cleared in dev/test
 *   or the caller may be processing a mixed list of banked + AI-generated IDs.
 * - Silent no-op for an empty or non-array input: callers need not guard before
 *   calling this function.
 * - Adapter is lazy-loaded so this module is safe to import at the top of a
 *   Lambda handler without incurring cold-start overhead.
 */

/**
 * Increments reuseCount for each question ID in the supplied array.
 *
 * @param {string[]} questionIds - Array of question IDs that were assembled into a worksheet.
 *   - Non-string entries and blank strings are silently skipped.
 *   - Unknown IDs (question not in the bank) are silently skipped.
 * @returns {Promise<void>}
 */
export async function recordQuestionReuse(questionIds = []) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) return;

  const { getQuestionBankAdapter } = await import('./index.js');
  const qb = await getQuestionBankAdapter();

  // incrementReuseCount is sync on localAdapter; await ensures future async adapters work without changes here.
  for (const id of questionIds) {
    if (typeof id === 'string' && id.trim()) {
      await Promise.resolve(qb.incrementReuseCount(id.trim()));
    }
  }
}

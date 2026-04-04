/**
 * @file src/questionBank/topicSuggester.js
 * @description Suggests alternative topics when the requested topic has no
 *   questions in the bank.
 *
 * When a topic is unavailable (bank empty + Claude fails), this module queries
 * the question bank for other topics at the same grade + subject that DO have
 * questions, and returns up to 5 sorted by question count descending.
 *
 * This runs only on the fallback path (rare) so a scan-style query is
 * acceptable. Optimize with a GSI later if needed.
 *
 * @agent DEV
 */

import { getQuestionBankAdapter } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Returns up to 5 suggested alternative topics for the given grade + subject
 * that have available questions in the bank.
 *
 * @param {number} grade          - Grade level 1–10
 * @param {string} subject        - Subject (Math, ELA, Science, etc.)
 * @param {string} [excludeTopic] - Topic to exclude from suggestions (the failed one)
 * @returns {Promise<string[]>}   - Array of topic names (max 5), never null
 */
export async function suggestAlternativeTopics(grade, subject, excludeTopic) {
  try {
    const qb = await getQuestionBankAdapter();

    // Query all questions for this grade + subject (no topic filter)
    const allQuestions = await qb.listQuestions({ grade, subject });

    // Group by topic and count
    const topicCounts = new Map();
    for (const q of allQuestions) {
      const topic = q.topic || 'Unknown';
      // Skip the topic that failed
      if (excludeTopic && topic.toLowerCase() === excludeTopic.toLowerCase()) {
        continue;
      }
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }

    // Sort by count descending, take top 5
    const suggestions = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    if (suggestions.length > 0) {
      logger.debug(
        `topicSuggester: found ${suggestions.length} alternatives for ` +
        `grade ${grade}, subject ${subject} (excluding "${excludeTopic || 'none'}")`
      );
    } else {
      logger.warn(
        `topicSuggester: no alternative topics for grade ${grade}, subject ${subject}`
      );
    }

    return suggestions;
  } catch (err) {
    logger.error(`topicSuggester failed: ${err.message}`);
    return []; // Never throw — return empty on error
  }
}

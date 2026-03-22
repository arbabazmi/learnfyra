/**
 * @file src/ai/generator.js
 * @description Calls Anthropic Claude API, parses and validates JSON worksheet response
 * @agent DEV
 */

import { anthropic, CLAUDE_MODEL } from './client.js';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder.js';
import { withRetry } from '../utils/retryUtils.js';
import { validateGrade, validateQuestionCount, validateSubject } from '../cli/validator.js';
import { logger } from '../utils/logger.js';

const REQUIRED_FIELDS = ['title', 'grade', 'subject', 'topic', 'difficulty', 'questions', 'totalPoints'];

/**
 * Validates the parsed worksheet JSON against the canonical schema
 * @param {Object} data - Parsed worksheet object
 * @param {number} expectedCount - Expected number of questions
 * @throws {Error} If required fields are missing or question count is wrong
 */
function validateWorksheetSchema(data, expectedCount) {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Worksheet JSON missing required field: "${field}"`);
    }
  }

  if (!Array.isArray(data.questions) || data.questions.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} questions, got ${data.questions?.length ?? 0}`
    );
  }
}

/**
 * Parses a raw Claude API text response into a worksheet JSON object
 * @param {string} rawText - Raw text from Claude API response
 * @returns {Object} Parsed worksheet object
 * @throws {Error} If text cannot be parsed as JSON
 */
function parseWorksheetJSON(rawText) {
  // Strip any accidental markdown fences Claude might include
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Claude returned non-JSON response. Will retry with stricter prompt.');
  }
}

/**
 * Generates a worksheet by calling the Claude API
 * @param {Object} options - Worksheet generation options
 * @param {number} options.grade - Grade level 1–10
 * @param {string} options.subject - Subject name
 * @param {string} options.topic - Specific topic
 * @param {string} options.difficulty - Easy | Medium | Hard | Mixed
 * @param {number} options.questionCount - Number of questions (5–30)
 * @returns {Promise<Object>} Parsed and validated worksheet JSON object
 */
export async function generateWorksheet(options) {
  const { grade, subject, topic, difficulty, questionCount } = options;

  // Validate inputs before making the API call
  validateGrade(grade);
  validateSubject(subject);
  validateQuestionCount(questionCount);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(options);

  const callClaude = async () => {
    logger.debug('Calling Claude API...');

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const rawText = message.content[0]?.text;
    if (!rawText) {
      throw new Error('Claude API returned an empty response.');
    }

    const worksheetData = parseWorksheetJSON(rawText);
    validateWorksheetSchema(worksheetData, questionCount);

    return worksheetData;
  };

  return withRetry(callClaude, {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    onRetry: (attempt, err) => {
      logger.warn(`Retry ${attempt}: ${err.message}`);
    },
  });
}

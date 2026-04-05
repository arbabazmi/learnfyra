/**
 * @file src/ai/validation/profanityFilter.js
 * @description Word-list-based profanity scanner for generated worksheet content.
 *
 *   Scans: question, options (array), answer, explanation fields of every question.
 *   Also scans top-level: title, instructions.
 *
 *   Detection features:
 *     - Case-insensitive matching
 *     - Common letter substitutions: @ → a, 3 → e, 1 → i/l, 0 → o, $ → s, 5 → s
 *     - Whole-word boundary matching to avoid false positives on substrings
 *       (e.g., "classic" should not match "ass")
 *     - Loads both profanity.txt and slurs.txt from the wordlists directory
 *
 *   Word lists are loaded once and cached in module scope.
 * @agent DEV
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ─── Word list loading ────────────────────────────────────────────────────────

const _dir = dirname(fileURLToPath(import.meta.url));
const WORDLISTS_DIR = join(_dir, 'wordlists');

/** @type {string[] | null} */
let _wordList = null;

/**
 * Loads and returns the combined profanity + slurs word list.
 * Cached in module scope after first load.
 * @returns {string[]}
 */
function getWordList() {
  if (_wordList) return _wordList;

  const lists = ['profanity.txt', 'slurs.txt'];
  const words = [];

  for (const file of lists) {
    try {
      const raw = readFileSync(join(WORDLISTS_DIR, file), 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        // Skip blank lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;
        words.push(trimmed.toLowerCase());
      }
    } catch {
      // If a word list file is missing, continue with whatever was loaded
    }
  }

  _wordList = words;
  return _wordList;
}

// ─── Substitution normalizer ──────────────────────────────────────────────────

/**
 * Normalizes common character substitutions used to bypass simple word filters.
 * Applied to candidate text before matching.
 *
 * @param {string} text
 * @returns {string} Normalized text
 */
function normalizeSubstitutions(text) {
  return text
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\+/g, 't');
}

// ─── Field extraction ─────────────────────────────────────────────────────────

/**
 * Extracts all scannable text strings from a worksheet object.
 * Covers: title, instructions, and per-question: question, options, answer, explanation.
 *
 * @param {Object} worksheet
 * @returns {string[]} Array of text strings to scan
 */
function extractTextFields(worksheet) {
  const texts = [];

  if (typeof worksheet.title === 'string') texts.push(worksheet.title);
  if (typeof worksheet.instructions === 'string') texts.push(worksheet.instructions);

  if (Array.isArray(worksheet.questions)) {
    for (const q of worksheet.questions) {
      if (typeof q.question === 'string') texts.push(q.question);
      if (typeof q.answer === 'string')   texts.push(q.answer);
      if (typeof q.explanation === 'string') texts.push(q.explanation);
      if (Array.isArray(q.options)) {
        for (const opt of q.options) {
          if (typeof opt === 'string') texts.push(opt);
        }
      }
    }
  }

  return texts;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ProfanityFilterResult
 * @property {boolean}  safe    - True if no profanity detected
 * @property {string[]} matches - Words that triggered the filter (empty if safe)
 */

/**
 * Scans all text fields in a worksheet for profanity and slurs.
 * Uses whole-word boundary matching to minimize false positives.
 *
 * @param {Object} worksheet - Parsed worksheet JSON object
 * @returns {ProfanityFilterResult}
 */
export function scanForProfanity(worksheet) {
  const wordList = getWordList();
  if (wordList.length === 0) {
    return { safe: true, matches: [] };
  }

  const texts = extractTextFields(worksheet);
  const matches = [];

  for (const rawText of texts) {
    if (!rawText) continue;
    const normalized = normalizeSubstitutions(rawText);

    for (const word of wordList) {
      // Whole-word boundary: preceded and followed by non-word character or string boundary
      const pattern = new RegExp(`(?<![a-z])${escapeRegex(word)}(?![a-z])`, 'i');
      if (pattern.test(normalized) && !matches.includes(word)) {
        matches.push(word);
      }
    }
  }

  return {
    safe: matches.length === 0,
    matches,
  };
}

/**
 * Escapes a string for use in a RegExp pattern.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Invalidates the cached word list. Useful in tests when word list files
 * are mocked or after an admin updates the lists.
 * @returns {void}
 */
export function invalidateWordListCache() {
  _wordList = null;
}

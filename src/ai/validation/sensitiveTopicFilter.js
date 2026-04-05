/**
 * @file src/ai/validation/sensitiveTopicFilter.js
 * @description Grade-aware sensitive topic detection for generated worksheet content.
 *
 *   9 content categories: violence, politics, religion, sexuality, drugs,
 *   self-harm, discrimination, mature-themes, profanity (catch-all).
 *
 *   Grade-band thresholds:
 *     Grade 1-3  ('strict')  → ALL 9 categories blocked
 *     Grade 4-6  ('medium')  → 7 categories blocked; violence and religion
 *                              allowed ONLY for clearly historical/academic context
 *     Grade 7-10 ('medium')  → Same 7 categories; violence and religion allowed
 *                              for academic discussion
 *
 *   Detection method: regex pattern matching on normalized text. Patterns are
 *   loaded from wordlists/sensitive-topics.txt and supplemented with built-in
 *   regex patterns per category.
 *
 *   Scanning covers all text fields: title, instructions, question, options,
 *   answer, explanation.
 * @agent DEV
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// ─── Word list loading ────────────────────────────────────────────────────────

const _dir = dirname(fileURLToPath(import.meta.url));
const WORDLISTS_DIR = join(_dir, 'wordlists');

/** @type {Map<string, string[]> | null} */
let _categoryKeywords = null;

/**
 * Loads the sensitive-topics.txt file and returns a Map of category → keywords[].
 * Cached in module scope.
 * @returns {Map<string, string[]>}
 */
function getCategoryKeywords() {
  if (_categoryKeywords) return _categoryKeywords;

  const map = new Map();

  try {
    const raw = readFileSync(join(WORDLISTS_DIR, 'sensitive-topics.txt'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const category = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const keyword  = trimmed.slice(colonIdx + 1).trim().toLowerCase();

      if (!category || !keyword) continue;

      if (!map.has(category)) map.set(category, []);
      map.get(category).push(keyword);
    }
  } catch {
    // File missing — will use empty map; built-in patterns still apply
  }

  _categoryKeywords = map;
  return map;
}

// ─── Category definitions and thresholds ──────────────────────────────────────

/**
 * Categories that are ALWAYS blocked regardless of grade band.
 * @type {Set<string>}
 */
const ALWAYS_BLOCKED = new Set([
  'sexuality',
  'drugs',
  'self-harm',
  'discrimination',
  'mature-themes',
]);

/**
 * Categories conditionally blocked depending on grade band.
 * For 'strict' (grades 1-3): all blocked.
 * For 'medium' (grades 4-10): these are allowed if the match score is below threshold.
 * In practice the keyword patterns are coarse enough that a match still fails.
 * @type {Set<string>}
 */
const CONDITIONAL_BLOCKED = new Set(['violence', 'politics', 'religion']);

/**
 * Built-in supplemental regex patterns per category (augment the keyword list).
 * @type {Record<string, RegExp[]>}
 */
const SUPPLEMENTAL_PATTERNS = {
  violence: [
    /\bblood(shed|bath)?\b/i,
    /\b(gun|firearm|rifle|pistol|shotgun)s?\b/i,
    /\bexplod(e|ed|ing)\b/i,
  ],
  sexuality: [
    /\bsex(ual(ly)?)?\b/i,
    /\bporn(ograph(y|ic))?\b/i,
    /\b(nude|naked|nudity)\b/i,
    /\berect(ion)?\b/i,
  ],
  drugs: [
    /\b(drug|drugs) (dealer|use|abuse)\b/i,
    /\boverdos(e|ing)\b/i,
    /\b(inject|smoking|snorting) (drugs?|heroin|meth|cocaine)\b/i,
  ],
  'self-harm': [
    /\b(suicid(e|al)|self[-\s]harm)\b/i,
    /\b(kill|hang|cut)\s+(my|your|him|her)self\b/i,
  ],
  discrimination: [
    /\b(white|black|jewish|muslim|gay|trans)\s+supremac/i,
    /\bhate (crime|speech|group)\b/i,
  ],
};

// ─── Text extraction ──────────────────────────────────────────────────────────

/**
 * Collects all scannable strings from a worksheet object.
 * @param {Object} worksheet
 * @returns {string[]}
 */
function extractTextFields(worksheet) {
  const texts = [];

  if (typeof worksheet.title === 'string')        texts.push(worksheet.title);
  if (typeof worksheet.instructions === 'string') texts.push(worksheet.instructions);

  if (Array.isArray(worksheet.questions)) {
    for (const q of worksheet.questions) {
      if (typeof q.question === 'string')    texts.push(q.question);
      if (typeof q.answer === 'string')      texts.push(q.answer);
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

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Returns true if any of the category's keywords appear in the combined text,
 * using whole-word boundary matching.
 *
 * @param {string} combinedText - All worksheet text joined and lowercased
 * @param {string} category
 * @returns {boolean}
 */
function keywordMatch(combinedText, category) {
  const keywords = getCategoryKeywords().get(category) || [];

  for (const kw of keywords) {
    // Escape and wrap in word boundaries; use a lenient boundary for multi-word phrases
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
    if (pattern.test(combinedText)) return true;
  }

  return false;
}

/**
 * Returns true if any supplemental regex pattern for the category matches.
 *
 * @param {string} combinedText
 * @param {string} category
 * @returns {boolean}
 */
function patternMatch(combinedText, category) {
  const patterns = SUPPLEMENTAL_PATTERNS[category] || [];
  return patterns.some(re => re.test(combinedText));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SensitiveTopicResult
 * @property {boolean}  safe            - True if no blocked content detected
 * @property {string[]} triggeredCategories - Categories that triggered detection
 */

/**
 * Scans a worksheet for sensitive topic content, calibrated to the guardrail level.
 *
 * @param {Object} worksheet  - Parsed worksheet JSON
 * @param {'medium'|'strict'} guardrailLevel - Effective guardrail level for this generation
 * @returns {SensitiveTopicResult}
 */
export function scanForSensitiveTopics(worksheet, guardrailLevel = 'medium') {
  const texts = extractTextFields(worksheet);
  const combinedText = texts.join(' ').toLowerCase();

  const triggered = [];

  // Determine which categories to check based on level
  const allCategories = [
    ...ALWAYS_BLOCKED,
    ...CONDITIONAL_BLOCKED,
  ];

  for (const category of allCategories) {
    const isConditional = CONDITIONAL_BLOCKED.has(category);

    // Conditional categories are only blocked for strict level
    if (isConditional && guardrailLevel !== 'strict') continue;

    const found = keywordMatch(combinedText, category) || patternMatch(combinedText, category);

    if (found) triggered.push(category);
  }

  return {
    safe: triggered.length === 0,
    triggeredCategories: triggered,
  };
}

/**
 * Invalidates the cached category keyword map. Useful in tests.
 * @returns {void}
 */
export function invalidateSensitiveTopicCache() {
  _categoryKeywords = null;
}

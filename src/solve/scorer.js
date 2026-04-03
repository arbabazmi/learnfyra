/**
 * @file src/solve/scorer.js
 * @description Scores student answers against correct answers in a worksheet.
 * Handles all question types defined in the Learnfyra schema.
 */

/**
 * Normalises a string for comparison: lowercase, collapse internal whitespace
 * to a single space, and trim leading/trailing whitespace.
 *
 * @param {string} str - Raw input string
 * @returns {string} Normalised string
 */
export function normalizeText(str) {
  return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalises a numeric string to a canonical form for comparison.
 * Handles leading-dot decimals (.5 → 0.5) and trailing zeros (20.0 → 20).
 * Returns null if the string does not represent a finite number.
 *
 * @param {string} str - Raw numeric string, e.g. ".5" or "20.0"
 * @returns {string|null} Canonical numeric string or null if not numeric
 */
export function normalizeNumeric(str) {
  const trimmed = String(str).trim();
  // parseFloat tolerates leading dot and trailing zeros
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  // Ensure the entire string (after trim) was a valid number, not just a prefix
  if (trimmed === '' || isNaN(Number(trimmed))) return null;
  // String(n) strips trailing zeros and normalises .5 → 0.5
  return String(n);
}

/**
 * Extracts the leading number from a string that may contain trailing units
 * or text (e.g. "24 stickers" → "24", "0.5 kg" → "0.5").
 * Returns null if no leading number is found.
 *
 * @param {string} str
 * @returns {string|null}
 */
export function extractLeadingNumber(str) {
  const trimmed = String(str).trim();
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

/**
 * Compares two answer strings numerically first, falling back to normalised
 * text equality. Handles answers with trailing units (e.g. "24 stickers" vs "24").
 *
 * @param {string} a - First answer string
 * @param {string} b - Second answer string
 * @returns {boolean} True when the two values are considered equal
 */
export function numericEquals(a, b) {
  // Try strict numeric comparison first (both must be pure numbers)
  const na = normalizeNumeric(a);
  const nb = normalizeNumeric(b);
  if (na !== null && nb !== null) return na === nb;

  // Fallback: extract leading numbers (handles "24 stickers" vs "24")
  const la = extractLeadingNumber(a);
  const lb = extractLeadingNumber(b);
  if (la !== null && lb !== null) return la === lb;

  return normalizeText(a) === normalizeText(b);
}

/**
 * Extracts the option letter from a multiple-choice answer string.
 * Normalises both "B. 56" (stored format) and "B" (student input format) to "B".
 * Returns '' when no single-letter option can be identified.
 *
 * @param {string} str - Raw answer string, e.g. "B. 56" or "B"
 * @returns {string} Single uppercase letter, or '' if no letter found
 */
export function extractOptionLetter(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  // Match a single letter optionally followed by a dot/space or end of string
  const match = trimmed.match(/^([A-Za-z])(?:[.\s]|$)/);
  if (match) return match[1].toUpperCase();
  // If the whole string is exactly one letter, accept it
  if (/^[A-Za-z]$/.test(trimmed)) return trimmed.toUpperCase();
  // Cannot identify a single option letter — return empty to avoid false matches
  return '';
}

/**
 * Scores a single question by comparing the student's answer to the correct answer.
 *
 * @param {Object} question - Question object from the worksheet schema
 * @param {string|Array|Object|null|undefined} studentAnswer - The student's submitted answer.
 *   For matching: array of {left, right} objects or a JSON string of that array.
 *   For show-your-work / word-problem: object with a `finalAnswer` property, or a plain string.
 *   For all other types: string.
 * @returns {{ correct: boolean, pointsEarned: number }}
 */
export function scoreQuestion(question, studentAnswer) {
  // Guard: empty / null / undefined answer always scores 0
  if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') {
    return { correct: false, pointsEarned: 0 };
  }

  const { type, answer, points } = question;
  const maxPoints = typeof points === 'number' ? points : 1;

  switch (type) {
    case 'multiple-choice': {
      const correctLetter = extractOptionLetter(String(answer));
      const studentLetter = extractOptionLetter(String(studentAnswer));
      // If extraction failed for either side, treat as incorrect
      if (correctLetter === '' || studentLetter === '') {
        return { correct: false, pointsEarned: 0 };
      }
      const correct = correctLetter === studentLetter;
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'true-false': {
      // Expand abbreviations and common synonyms on both sides before comparing
      const expand = (v) => {
        if (v === 't' || v === 'yes') return 'true';
        if (v === 'f' || v === 'no') return 'false';
        return v;
      };
      const normCorrect = expand(normalizeText(answer));
      const normStudent = expand(normalizeText(studentAnswer));
      const correct = normCorrect === normStudent;
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'fill-in-the-blank': {
      // Numeric equivalence first ("20" === "20.0", ".5" === "0.5"),
      // then fall back to normalised text exact match
      const correct = numericEquals(answer, studentAnswer);
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'short-answer': {
      // Every keyword extracted from the correct answer must appear as a whole
      // word in the student's answer (\b prevents "photo" matching "photosynthesis")
      const normStudent = normalizeText(studentAnswer);
      if (normStudent === '') return { correct: false, pointsEarned: 0 };
      const keywords = normalizeText(answer).split(/\s+/).filter(Boolean);
      const correct = keywords.every((kw) => {
        // Escape any regex special characters in the keyword before building the pattern
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`).test(normStudent);
      });
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'matching': {
      // studentAnswer may arrive as a JSON string from the frontend
      let parsedStudent = studentAnswer;
      if (typeof parsedStudent === 'string') {
        try {
          parsedStudent = JSON.parse(parsedStudent);
        } catch {
          return { correct: false, pointsEarned: 0 };
        }
      }

      if (!Array.isArray(parsedStudent) || !Array.isArray(answer)) {
        return { correct: false, pointsEarned: 0 };
      }

      // Build a normalised lookup map from the correct answer pairs
      const correctMap = {};
      for (const pair of answer) {
        correctMap[normalizeText(pair.left)] = normalizeText(pair.right);
      }

      let correctCount = 0;
      for (const pair of parsedStudent) {
        const key = normalizeText(pair.left);
        const val = normalizeText(pair.right);
        if (correctMap[key] !== undefined && correctMap[key] === val) {
          correctCount++;
        }
      }

      const totalPairs = answer.length;
      // Award points proportionally, rounded to nearest integer, capped at maxPoints
      const pointsEarned = totalPairs > 0
        ? Math.min(maxPoints, Math.round((correctCount / totalPairs) * maxPoints))
        : 0;
      return { correct: correctCount === totalPairs, pointsEarned };
    }

    case 'show-your-work':
    case 'word-problem': {
      // Accept either an object with a finalAnswer property, or a plain string
      const rawFinal = typeof studentAnswer === 'object' && studentAnswer !== null
        ? String(studentAnswer.finalAnswer ?? '')
        : String(studentAnswer);

      if (rawFinal === '') return { correct: false, pointsEarned: 0 };

      // Numeric equivalence first, then normalised text fallback
      const correct = numericEquals(answer, rawFinal);
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    default:
      return { correct: false, pointsEarned: 0 };
  }
}

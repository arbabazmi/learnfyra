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
 * Extracts the option letter from a multiple-choice answer string.
 * Normalises both "B. 56" (stored format) and "B" (student input format) to "B".
 *
 * @param {string} str - Raw answer string, e.g. "B. 56" or "B"
 * @returns {string} Single uppercase letter, e.g. "B"
 */
export function extractOptionLetter(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  // Match a single letter optionally followed by a dot/space or end of string
  const match = trimmed.match(/^([A-Za-z])(?:[.\s]|$)/);
  if (match) return match[1].toUpperCase();
  // If the whole string is just one letter, return it uppercased
  if (/^[A-Za-z]$/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed.toUpperCase();
}

/**
 * Scores a single question by comparing the student's answer to the correct answer.
 *
 * @param {Object} question - Question object from the worksheet schema
 * @param {string|Array|null|undefined} studentAnswer - The student's submitted answer.
 *   For matching: array of {left, right} objects.
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
      const correctLetter = extractOptionLetter(answer);
      const studentLetter = extractOptionLetter(String(studentAnswer));
      const correct = correctLetter === studentLetter;
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'true-false': {
      const correct = normalizeText(answer) === normalizeText(studentAnswer);
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'fill-in-the-blank': {
      const correct = normalizeText(answer) === normalizeText(studentAnswer);
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'short-answer': {
      // Split the stored answer into keywords; every keyword must appear as a
      // substring of the student's normalised answer.
      const normStudent = normalizeText(studentAnswer);
      if (normStudent === '') return { correct: false, pointsEarned: 0 };
      const keywords = normalizeText(answer).split(' ').filter(Boolean);
      const correct = keywords.every((kw) => normStudent.includes(kw));
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    case 'matching': {
      // Both question.answer and studentAnswer are arrays of { left, right }
      if (!Array.isArray(studentAnswer) || !Array.isArray(answer)) {
        return { correct: false, pointsEarned: 0 };
      }
      // Build a lookup map from the correct answer pairs
      const correctMap = {};
      for (const pair of answer) {
        correctMap[String(pair.left).toLowerCase().trim()] =
          String(pair.right).toLowerCase().trim();
      }
      let correctCount = 0;
      for (const pair of studentAnswer) {
        const key = String(pair.left).toLowerCase().trim();
        const val = String(pair.right).toLowerCase().trim();
        if (correctMap[key] !== undefined && correctMap[key] === val) {
          correctCount++;
        }
      }
      const totalPairs = answer.length;
      // Award points proportionally, capped at maxPoints
      const pointsEarned = totalPairs > 0
        ? Math.min(maxPoints, Math.round((correctCount / totalPairs) * maxPoints))
        : 0;
      return { correct: correctCount === totalPairs, pointsEarned };
    }

    case 'show-your-work':
    case 'word-problem': {
      // Only the final answer is scored; work shown is not evaluated
      const finalAnswer = typeof studentAnswer === 'object' && studentAnswer !== null
        ? String(studentAnswer.finalAnswer ?? '')
        : String(studentAnswer);
      const correct = normalizeText(answer) === normalizeText(finalAnswer);
      return { correct, pointsEarned: correct ? maxPoints : 0 };
    }

    default:
      return { correct: false, pointsEarned: 0 };
  }
}

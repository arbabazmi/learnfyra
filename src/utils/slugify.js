/**
 * @file src/utils/slugify.js
 * @description Generates and validates SEO-friendly worksheet slugs.
 *
 * Format: grade-{N}-{subject}-{topic}-{difficulty}-{6hexFromUUID}
 * Example: grade-3-math-multiplication-easy-88b4e5
 * Max 80 chars, lowercase alphanumeric + hyphens only.
 */

const MAX_SLUG_LENGTH = 80;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{8,78}[a-z0-9]$/;

/**
 * Converts a string to a slug-safe segment: lowercase, alphanumeric + hyphens,
 * no leading/trailing hyphens, no consecutive hyphens.
 * @param {string} value
 * @returns {string}
 */
function slugSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates an SEO-friendly slug for a worksheet.
 * @param {number} grade
 * @param {string} subject
 * @param {string} topic
 * @param {string} difficulty
 * @param {string} uuid - Full v4 UUID; first 6 hex chars are used as suffix
 * @returns {string} Slug like "grade-3-math-multiplication-easy-88b4e5"
 */
export function generateWorksheetSlug(grade, subject, topic, difficulty, uuid) {
  const hexSuffix = uuid.replace(/-/g, '').slice(0, 6);
  const prefix = `grade-${grade}`;
  const suffix = hexSuffix;

  const middle = [slugSegment(subject), slugSegment(topic), slugSegment(difficulty)].join('-');

  // prefix + '-' + middle + '-' + suffix
  let slug = `${prefix}-${middle}-${suffix}`;

  // Truncate middle if slug exceeds max length, keeping prefix and suffix intact
  if (slug.length > MAX_SLUG_LENGTH) {
    const overhead = prefix.length + 1 + suffix.length + 1; // "prefix-...-suffix"
    const maxMiddle = MAX_SLUG_LENGTH - overhead;
    const truncated = middle.slice(0, maxMiddle).replace(/-+$/, '');
    slug = `${prefix}-${truncated}-${suffix}`;
  }

  return slug;
}

/**
 * Validates whether a string is a well-formed worksheet slug.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSlug(value) {
  return typeof value === 'string' && SLUG_REGEX.test(value);
}

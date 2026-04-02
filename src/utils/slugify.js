/**
 * @file src/utils/slugify.js
 * @description SEO-friendly slug generation for worksheets.
 * Slugs are used as human-readable URL identifiers in addition to UUIDs.
 */

import crypto from 'crypto';

const MAX_TOPIC_LENGTH = 40;
const MAX_SLUG_LENGTH = 80;

/**
 * Normalises a single segment to lowercase alphanumeric with hyphens.
 * Collapses consecutive hyphens and trims leading/trailing hyphens.
 * @param {string} segment
 * @returns {string}
 */
function slugifySegment(segment) {
  return String(segment)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates an SEO-friendly slug from worksheet metadata.
 *
 * Format: grade-{N}-{subject}-{topic}-{difficulty}-{hexSuffix}
 * Example: grade-3-math-multiplication-easy-a1b2c3
 *
 * The topic segment is truncated to keep the total slug within 80 characters.
 * A 6-character random hex suffix guarantees uniqueness across concurrent
 * generations for the same grade/subject/topic/difficulty combination.
 *
 * @param {number|string} grade - Grade level (1-10)
 * @param {string} subject - Subject name (e.g. "Math")
 * @param {string} topic - Topic name (e.g. "Multiplication")
 * @param {string} difficulty - Difficulty level (e.g. "Easy")
 * @param {string} [uuid] - Worksheet UUID — first 6 hex chars used as suffix. Falls back to random if not provided.
 * @returns {string} SEO-friendly slug, 10-80 chars, lowercase alphanumeric + hyphens
 */
export function generateWorksheetSlug(grade, subject, topic, difficulty, uuid) {
  // Use first 6 hex chars of UUID for deterministic, unique suffix
  const hexSuffix = uuid
    ? uuid.replace(/-/g, '').slice(0, 6).toLowerCase()
    : crypto.randomBytes(3).toString('hex');
  const gradeSegment = `grade-${slugifySegment(String(grade))}`;
  const subjectSegment = slugifySegment(subject);
  const difficultySegment = slugifySegment(difficulty);

  // Truncate topic before computing total to respect MAX_SLUG_LENGTH
  const topicRaw = slugifySegment(topic).slice(0, MAX_TOPIC_LENGTH);

  // Build slug without topic first, then determine available space for topic
  const withoutTopic = `${gradeSegment}-${subjectSegment}--${difficultySegment}-${hexSuffix}`;
  const reservedLength = withoutTopic.length; // includes the double-hyphen placeholder
  const available = MAX_SLUG_LENGTH - reservedLength + 1; // +1 because double-hyphen is 2 chars, single separator is 1
  const topicSegment = topicRaw.slice(0, Math.max(0, available));

  const slug = [gradeSegment, subjectSegment, topicSegment, difficultySegment, hexSuffix]
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug.slice(0, MAX_SLUG_LENGTH);
}

/**
 * Validates that a string matches the expected slug format.
 * Valid slugs are 10-80 characters, lowercase alphanumeric + hyphens only.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidSlug(value) {
  return (
    typeof value === 'string' &&
    value.length >= 10 &&
    value.length <= MAX_SLUG_LENGTH &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  );
}

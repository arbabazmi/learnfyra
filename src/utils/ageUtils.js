/**
 * @file src/utils/ageUtils.js
 * @description Age calculation and classification for COPPA compliance
 */

/**
 * Calculate age from a date of birth string.
 * @param {string} dateOfBirth - Date string in "YYYY-MM-DD" format
 * @returns {number} Integer age in years
 * @throws {Error} If the input is not a valid date
 */
export function calculateAge(dateOfBirth) {
  const parsed = Date.parse(dateOfBirth);
  if (
    typeof dateOfBirth !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
    Number.isNaN(parsed)
  ) {
    throw new Error('Invalid date of birth');
  }

  const [year, month, day] = dateOfBirth.split('-').map(Number);

  // Verify the parsed date components match the input (catches e.g. Feb 30)
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error('Invalid date of birth');
  }

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  let age = todayUTC.getUTCFullYear() - year;

  const birthdayThisYear = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), month - 1, day)
  );

  if (todayUTC < birthdayThisYear) {
    age--;
  }

  return age;
}

/**
 * Classify an age into a group.
 * @param {number} age - Integer age in years
 * @returns {'child' | 'teen' | 'adult'} Age group string
 */
export function getAgeGroup(age) {
  if (age < 13) return 'child';
  if (age < 18) return 'teen';
  return 'adult';
}

/**
 * Validate a date-of-birth string and return age info or an error.
 * @param {string} dateString - Date string to validate
 * @returns {{ valid: true, age: number, ageGroup: string } | { valid: false, error: string }}
 */
export function validateDateOfBirth(dateString) {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return { valid: false, error: 'Invalid format: expected YYYY-MM-DD' };
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { valid: false, error: 'Invalid date: does not exist' };
  }

  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  if (date > todayUTC) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }

  let age;
  try {
    age = calculateAge(dateString);
  } catch {
    return { valid: false, error: 'Invalid date of birth' };
  }

  if (age < 5) {
    return { valid: false, error: 'Age must be at least 5 (minimum for Grade 1)' };
  }

  if (age > 120) {
    return { valid: false, error: 'Age exceeds maximum allowed (120)' };
  }

  return { valid: true, age, ageGroup: getAgeGroup(age) };
}

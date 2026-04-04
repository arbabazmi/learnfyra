/**
 * @file backend/utils/inviteCodeUtils.js
 * @description Invite code generation utilities for M05 Teacher & Parent Roles.
 *
 * Generates 6-character uppercase invite codes using only unambiguous characters
 * (A-Z excluding I and O, digits 2-9 excluding 0 and 1) to prevent student
 * confusion when reading codes from printed or handwritten material.
 *
 * Character set: A B C D E F G H J K L M N P Q R S T U V W X Y Z 2 3 4 5 6 7 8 9
 * That is 24 letters + 8 digits = 32 characters, giving 32^6 = 1,073,741,824
 * possible codes. Collision probability at 10,000 active classes is negligible.
 */

import { randomBytes } from 'crypto';

// Unambiguous characters: uppercase A-Z (no I, O) + digits 2-9 (no 0, 1).
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Generates a single random invite code.
 * Uses cryptographically secure randomness (crypto.randomBytes) so that codes
 * cannot be predicted by an attacker who observes prior codes.
 *
 * @returns {string} 6-character uppercase string, e.g. "A3K9FZ"
 */
export function generateInviteCode() {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[bytes[i] % INVITE_CODE_CHARS.length];
  }
  return code;
}

/**
 * Checks whether an invite code already exists in the given table.
 *
 * For the Classes table, uniqueness is checked against the InviteCodeIndex GSI
 * (PK = inviteCode).  For the ParentInviteCodes table, uniqueness is checked by
 * attempting a direct PK lookup (PK = INVITE#{code}).
 *
 * @param {Object} db - Database adapter instance
 * @param {string} code - The candidate invite code
 * @param {'classes'|'parentinvitecodes'} tableName - Logical table name to check
 * @returns {Promise<boolean>} true if a collision exists, false if the code is free
 */
export async function checkCodeCollision(db, code, tableName) {
  const key = tableName.toLowerCase();

  if (key === 'classes') {
    // Query the InviteCodeIndex GSI on LearnfyraClasses.
    const results = await db.queryByPk('classes', code, {
      indexName: 'InviteCodeIndex',
    });
    return Array.isArray(results) && results.length > 0;
  }

  if (key === 'parentinvitecodes') {
    // Direct PK lookup: PK = INVITE#{code}, SK = METADATA.
    const results = await db.queryByPk('parentinvitecodes', `INVITE#${code}`);
    return Array.isArray(results) && results.length > 0;
  }

  throw new Error(`checkCodeCollision: unsupported tableName "${tableName}". Use 'classes' or 'parentinvitecodes'.`);
}

/**
 * Generates a unique invite code by retrying until no collision is found.
 * Throws an error if a unique code cannot be found within the retry budget.
 * In practice, collisions are extraordinarily rare given the keyspace size —
 * the retry budget exists as a defensive safety valve only.
 *
 * @param {Object} db - Database adapter instance
 * @param {'classes'|'parentinvitecodes'} tableName - Logical table name to check
 * @param {number} [maxRetries=5] - Maximum number of generation attempts
 * @returns {Promise<string>} A collision-free invite code
 * @throws {Error} If no unique code could be generated within maxRetries attempts
 */
export async function generateUniqueInviteCode(db, tableName, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const code = generateInviteCode();
    const collision = await checkCodeCollision(db, code, tableName);
    if (!collision) {
      return code;
    }
  }

  throw new Error(
    `generateUniqueInviteCode: failed to generate a unique code after ${maxRetries} attempts.`
  );
}

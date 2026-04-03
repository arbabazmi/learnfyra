/**
 * @file backend/utils/rbacUtils.js
 * @description Shared RBAC check functions for M05 handlers.
 *
 * Each function returns { authorized: true, record } on success, or
 * { authorized: false, reason: '<REASON_CODE>' } on failure.
 * Functions never throw — callers convert the failure object into the
 * appropriate HTTP response.
 *
 * Enumeration prevention (Section 6.2 of the M05 technical design):
 * - verifyTeacherOwnsClass returns NOT_CLASS_OWNER on ownership mismatch,
 *   even when the class does not exist.
 * - verifyParentChildLink returns CHILD_NOT_LINKED for both missing and
 *   revoked links — never 404.
 * - verifyStudentInClass returns STUDENT_NOT_IN_CLASS for both missing and
 *   inactive memberships — never 404.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a failure result with a normalised reason code.
 * @param {string} reason
 * @returns {{ authorized: false, reason: string }}
 */
function deny(reason) {
  return { authorized: false, reason };
}

/**
 * Builds a success result carrying the retrieved record.
 * @param {Object} record
 * @returns {{ authorized: true, record: Object }}
 */
function allow(record) {
  return { authorized: true, record };
}

// ---------------------------------------------------------------------------
// Exported RBAC checks
// ---------------------------------------------------------------------------

/**
 * Verifies that the given teacher owns the given class.
 *
 * Reads the class record using PK = CLASS#{classId}, SK = METADATA.
 * Returns NOT_CLASS_OWNER if the record is missing or if teacherId does not
 * match — the caller must not distinguish between the two cases.
 *
 * @param {Object} db - Database adapter instance (dynamoDbAdapter or localDbAdapter)
 * @param {string} classId - UUID of the class to check
 * @param {string} teacherId - Cognito sub of the requesting teacher
 * @returns {Promise<{ authorized: true, record: Object } | { authorized: false, reason: 'NOT_CLASS_OWNER' }>}
 */
export async function verifyTeacherOwnsClass(db, classId, teacherId) {
  let classRecord;
  try {
    // The M05 LearnfyraClasses table uses PK=CLASS#{classId}, SK=METADATA.
    // queryByPk on the 'classes' logical table name queries by the table's PK
    // attribute.  We use queryByPk with the composite key value so the adapter
    // resolves the correct table name.
    const results = await db.queryByPk('classes', `CLASS#${classId}`, {
      filterExpr: '#sk = :sk',
      filterNames: { '#sk': 'SK' },
      filterValues: { ':sk': 'METADATA' },
    });
    classRecord = results && results.length > 0 ? results[0] : null;
  } catch {
    // Treat adapter errors as a deny to prevent information leakage.
    return deny('NOT_CLASS_OWNER');
  }

  if (!classRecord || classRecord.teacherId !== teacherId) {
    return deny('NOT_CLASS_OWNER');
  }

  return allow(classRecord);
}

/**
 * Verifies that the given teacher owns the assignment (via denormalized teacherId).
 *
 * Reads the assignment record using PK = ASSIGNMENT#{assignmentId}, SK = METADATA.
 * Returns NOT_CLASS_OWNER if the record is missing or if teacherId does not match.
 *
 * @param {Object} db - Database adapter instance
 * @param {string} assignmentId - UUID of the assignment to check
 * @param {string} teacherId - Cognito sub of the requesting teacher
 * @returns {Promise<{ authorized: true, record: Object } | { authorized: false, reason: 'NOT_CLASS_OWNER' }>}
 */
export async function verifyTeacherOwnsAssignment(db, assignmentId, teacherId) {
  let assignmentRecord;
  try {
    const results = await db.queryByPk('assignments', `ASSIGNMENT#${assignmentId}`, {
      filterExpr: '#sk = :sk',
      filterNames: { '#sk': 'SK' },
      filterValues: { ':sk': 'METADATA' },
    });
    assignmentRecord = results && results.length > 0 ? results[0] : null;
  } catch {
    return deny('NOT_CLASS_OWNER');
  }

  if (!assignmentRecord || assignmentRecord.teacherId !== teacherId) {
    return deny('NOT_CLASS_OWNER');
  }

  return allow(assignmentRecord);
}

/**
 * Verifies that an active parent-child link exists between the given parent and child.
 *
 * Reads the ParentChildLinks record using PK = USER#{parentId}, SK = CHILD#{childId}.
 * A revoked link is treated identically to a missing link — both return CHILD_NOT_LINKED.
 * This prevents enumeration of valid student IDs via parent endpoints.
 *
 * @param {Object} db - Database adapter instance
 * @param {string} parentId - Cognito sub of the requesting parent
 * @param {string} childId - Cognito sub of the student being accessed
 * @returns {Promise<{ authorized: true, record: Object } | { authorized: false, reason: 'CHILD_NOT_LINKED' }>}
 */
export async function verifyParentChildLink(db, parentId, childId) {
  let linkRecord;
  try {
    const results = await db.queryByPk('parentchildlinks', `USER#${parentId}`, {
      filterExpr: '#sk = :sk',
      filterNames: { '#sk': 'SK' },
      filterValues: { ':sk': `CHILD#${childId}` },
    });
    linkRecord = results && results.length > 0 ? results[0] : null;
  } catch {
    return deny('CHILD_NOT_LINKED');
  }

  // Revoked links are treated identically to missing links (enumeration prevention).
  if (!linkRecord || linkRecord.status !== 'active') {
    return deny('CHILD_NOT_LINKED');
  }

  return allow(linkRecord);
}

/**
 * Verifies that the given student is an active member of the given class.
 *
 * Reads the ClassMembership record. Both a missing record and an inactive
 * membership return STUDENT_NOT_IN_CLASS to prevent enumeration.
 *
 * @param {Object} db - Database adapter instance
 * @param {string} classId - UUID of the class
 * @param {string} studentId - Cognito sub of the student
 * @returns {Promise<{ authorized: true, record: Object } | { authorized: false, reason: 'STUDENT_NOT_IN_CLASS' }>}
 */
export async function verifyStudentInClass(db, classId, studentId) {
  let membershipRecord;
  try {
    // LearnfyraClassMemberships uses classId (HASH) + studentId (RANGE).
    const results = await db.queryByPk('classmemberships', classId, {
      filterExpr: '#sid = :sid',
      filterNames: { '#sid': 'studentId' },
      filterValues: { ':sid': studentId },
    });
    membershipRecord = results && results.length > 0 ? results[0] : null;
  } catch {
    return deny('STUDENT_NOT_IN_CLASS');
  }

  if (!membershipRecord || membershipRecord.status !== 'active') {
    return deny('STUDENT_NOT_IN_CLASS');
  }

  return allow(membershipRecord);
}

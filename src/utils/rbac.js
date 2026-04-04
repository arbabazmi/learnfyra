/**
 * @file src/utils/rbac.js
 * @description Shared RBAC check functions for M05 handlers.
 * All functions throw structured errors with .statusCode and .errorCode set
 * so that handler catch blocks can return the correct HTTP response.
 */

/**
 * Verifies the authenticated teacher owns the specified class.
 *
 * @param {Object} db - Database adapter
 * @param {string} classId - UUID of the class
 * @param {string} teacherId - JWT sub of the authenticated teacher
 * @returns {Promise<Object>} The class record
 * @throws {Error} 403 NOT_CLASS_OWNER or 404 CLASS_NOT_FOUND
 */
export async function verifyTeacherOwnsClass(db, classId, teacherId) {
  // Try the composite-key format first (DynamoDB M05 schema).
  // Fall back to plain classId lookup for local adapter compatibility.
  let classRecord = await db.getItem('classes', `CLASS#${classId}`);
  if (!classRecord) {
    classRecord = await db.getItem('classes', classId);
  }
  if (!classRecord) {
    const err = new Error('Class not found.');
    err.statusCode = 404;
    err.errorCode = 'CLASS_NOT_FOUND';
    throw err;
  }
  if (classRecord.teacherId !== teacherId) {
    const err = new Error('You do not own this class.');
    err.statusCode = 403;
    err.errorCode = 'NOT_CLASS_OWNER';
    throw err;
  }
  return classRecord;
}

/**
 * Verifies the authenticated parent has an active link to the specified child.
 * Returns 403 CHILD_NOT_LINKED for both missing and revoked links.
 *
 * @param {Object} db - Database adapter
 * @param {string} parentId - JWT sub of the authenticated parent
 * @param {string} childId - studentId being accessed
 * @returns {Promise<Object>} The ParentChildLink record
 * @throws {Error} 403 CHILD_NOT_LINKED
 */
export async function verifyParentChildLink(db, parentId, childId) {
  const link = await db.getItem('parentchildlinks', `USER#${parentId}`);
  // The adapter's getItem for composite-key tables returns the first matching PK item.
  // We need a precise PK+SK lookup — use queryByField on the stored parentId+childId.
  // Because the local adapter uses queryByField, we do a targeted query here.
  const links = await db.queryByField('parentchildlinks', 'parentId', parentId);
  const activeLink = links.find(
    (l) => l.childId === childId && l.status === 'active'
  );
  if (!activeLink) {
    const err = new Error('Child not linked to this parent account.');
    err.statusCode = 403;
    err.errorCode = 'CHILD_NOT_LINKED';
    throw err;
  }
  return activeLink;
}

/**
 * Verifies the specified student is actively enrolled in the specified class.
 *
 * @param {Object} db - Database adapter
 * @param {string} classId - UUID of the class
 * @param {string} studentId - Cognito sub of the student
 * @returns {Promise<Object>} The ClassMembership record
 * @throws {Error} 404 STUDENT_NOT_IN_CLASS
 */
export async function verifyStudentInClass(db, classId, studentId) {
  const membershipId = `${classId}#${studentId}`;
  const membership = await db.getItem('memberships', membershipId);
  if (!membership || membership.status !== 'active') {
    const err = new Error('Student is not enrolled in this class.');
    err.statusCode = 404;
    err.errorCode = 'STUDENT_NOT_IN_CLASS';
    throw err;
  }
  return membership;
}

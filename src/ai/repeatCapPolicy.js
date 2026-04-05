/**
 * @file src/ai/repeatCapPolicy.js
 * @description Repeat-cap policy resolution and student exposure tracking helpers.
 *
 * v1.1 — Added calculateAllocation() and resolveRepeatCap() to support
 * dynamic cap-driven assembly in assembler.js (replaces hardcoded 80/20 rule).
 */

import { randomUUID } from 'crypto';

export const DEFAULT_REPEAT_CAP_PERCENT = 10;
const VALID_SCOPE = new Set(['student', 'parent', 'teacher']);

/**
 * Builds a stable question signature for repeat tracking.
 * Prefer questionId when available; otherwise use normalized content.
 * @param {Object} question
 * @returns {string}
 */
export function buildQuestionSignature(question) {
  if (question && typeof question.questionId === 'string' && question.questionId.trim()) {
    return `id:${question.questionId.trim()}`;
  }

  const type = typeof question?.type === 'string' ? question.type.trim().toLowerCase() : '';
  const prompt = typeof question?.question === 'string' ? question.question.trim().toLowerCase() : '';
  const answer = typeof question?.answer === 'string' ? question.answer.trim().toLowerCase() : '';
  return `txt:${type}|${prompt}|${answer}`;
}

/**
 * Builds the student identity key used for repeat-cap lookup/history.
 * @param {Object} input
 * @param {string} [input.studentId]
 * @param {string} [input.studentName]
 * @param {string} [input.teacherId]
 * @returns {string|null}
 */
export function buildStudentKey({ studentId, studentName, teacherId }) {
  if (typeof studentId === 'string' && studentId.trim()) {
    return `student:${studentId.trim()}`;
  }

  if (
    typeof studentName === 'string' &&
    studentName.trim() &&
    typeof teacherId === 'string' &&
    teacherId.trim()
  ) {
    const normalizedName = studentName.trim().toLowerCase().replace(/\s+/g, ' ');
    return `teacher:${teacherId.trim()}#student-name:${normalizedName}`;
  }

  return null;
}

function clampPercent(value, fallback = DEFAULT_REPEAT_CAP_PERCENT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Resolves effective repeat cap with precedence: student > parent > teacher > default.
 *
 * Global default is read from two sources in priority order:
 *   1. adminPolicies.global.repeatCapPolicy.defaultPercent  (adminHandler path)
 *   2. config table record id='repeat-cap:global', field value  (guardrailsAdminHandler path)
 *
 * Override cap value is read from `item.repeatCapPercent ?? item.value` to support
 * both the adminHandler schema (repeatCapPercent) and the guardrailsAdminHandler
 * schema (value).
 *
 * @param {Object} input
 * @param {Object} input.db
 * @param {string} [input.studentId]
 * @param {string} [input.parentId]
 * @param {string} input.teacherId
 * @returns {Promise<{capPercent:number, appliedBy:string, sourceId:string|null}>}
 */
export async function resolveEffectiveRepeatCap({ db, studentId, parentId, teacherId }) {
  let defaultPercent = DEFAULT_REPEAT_CAP_PERCENT;

  // Source 1: adminPolicies table (written by adminHandler repeatCapPolicy routes)
  const globalPolicy = await db.getItem('adminPolicies', 'global');
  if (globalPolicy?.repeatCapPolicy?.enabled === false) {
    return { capPercent: 100, appliedBy: 'disabled', sourceId: null };
  }
  if (globalPolicy?.repeatCapPolicy?.defaultPercent != null) {
    defaultPercent = clampPercent(globalPolicy.repeatCapPolicy.defaultPercent, DEFAULT_REPEAT_CAP_PERCENT);
  } else {
    // Source 2: config table (written by guardrailsAdminHandler PUT /api/admin/repeat-cap)
    const configRecord = await db.getItem('config', 'repeat-cap:global');
    if (configRecord?.value != null) {
      defaultPercent = clampPercent(configRecord.value, DEFAULT_REPEAT_CAP_PERCENT);
    }
  }

  const allOverrides = await db.listAll('repeatCapOverrides');
  const nowTs = Date.now();
  const active = Array.isArray(allOverrides)
    ? allOverrides.filter((item) => {
      if (!item || !VALID_SCOPE.has(item.scope)) return false;
      if (item.isActive === false) return false;
      if (item.expiresAt) {
        const exp = Date.parse(item.expiresAt);
        if (Number.isFinite(exp) && exp <= nowTs) return false;
      }
      return true;
    })
    : [];

  const pickOverride = (scope, id) => {
    if (typeof id !== 'string' || !id.trim()) return null;
    const scopeId = id.trim();
    const matches = active
      .filter((item) => item.scope === scope && item.scopeId === scopeId)
      .sort((a, b) => {
        const ta = Date.parse(a.updatedAt || a.createdAt || 0);
        const tb = Date.parse(b.updatedAt || b.createdAt || 0);
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
    return matches[0] || null;
  };

  /**
   * Reads the cap percent from an override record.
   * Handles both field name conventions:
   *   - `repeatCapPercent` (adminHandler schema)
   *   - `value`            (guardrailsAdminHandler schema)
   * @param {Object} item
   * @returns {number|null}
   */
  const overrideCap = (item) => {
    const raw = item.repeatCapPercent ?? item.value;
    return raw != null ? raw : null;
  };

  const studentOverride = pickOverride('student', studentId);
  if (studentOverride) {
    return {
      capPercent: clampPercent(overrideCap(studentOverride) ?? defaultPercent, defaultPercent),
      appliedBy: 'student',
      sourceId: studentOverride.scopeId,
    };
  }

  const parentOverride = pickOverride('parent', parentId);
  if (parentOverride) {
    return {
      capPercent: clampPercent(overrideCap(parentOverride) ?? defaultPercent, defaultPercent),
      appliedBy: 'parent',
      sourceId: parentOverride.scopeId,
    };
  }

  const teacherOverride = pickOverride('teacher', teacherId);
  if (teacherOverride) {
    return {
      capPercent: clampPercent(overrideCap(teacherOverride) ?? defaultPercent, defaultPercent),
      appliedBy: 'teacher',
      sourceId: teacherOverride.scopeId,
    };
  }

  return { capPercent: defaultPercent, appliedBy: 'default', sourceId: null };
}

/**
 * Returns seen question signatures for a student + grade + difficulty profile.
 * @param {Object} input
 * @param {Object} input.db
 * @param {string|null} input.studentKey
 * @param {number} input.grade
 * @param {string} input.difficulty
 * @returns {Promise<Set<string>>}
 */
export async function getSeenQuestionSignatures({ db, studentKey, grade, difficulty }) {
  if (!studentKey) return new Set();

  const all = await db.listAll('questionExposureHistory');
  const seen = new Set();
  for (const item of Array.isArray(all) ? all : []) {
    if (!item) continue;
    if (item.studentKey !== studentKey) continue;
    if (Number(item.grade) !== Number(grade)) continue;
    if (String(item.difficulty) !== String(difficulty)) continue;
    if (typeof item.signature === 'string' && item.signature.trim()) {
      seen.add(item.signature.trim());
    }
  }
  return seen;
}

/**
 * Persists question exposure rows for future repeat-cap checks.
 * @param {Object} input
 * @param {Object} input.db
 * @param {string|null} input.studentKey
 * @param {number} input.grade
 * @param {string} input.difficulty
 * @param {string} input.teacherId
 * @param {string} [input.parentId]
 * @param {string} [input.worksheetId]
 * @param {Array<Object>} input.questions
 * @returns {Promise<number>}
 */
export async function recordExposureHistory({
  db,
  studentKey,
  grade,
  difficulty,
  teacherId,
  parentId,
  worksheetId,
  questions,
}) {
  if (!studentKey || !Array.isArray(questions) || questions.length === 0) {
    return 0;
  }

  let saved = 0;
  const nowIso = new Date().toISOString();
  for (const q of questions) {
    const signature = buildQuestionSignature(q);
    if (!signature) continue;

    await db.putItem('questionExposureHistory', {
      id: randomUUID(),
      studentKey,
      studentId: typeof q?.studentId === 'string' ? q.studentId : null,
      parentId: typeof parentId === 'string' && parentId.trim() ? parentId.trim() : null,
      teacherId,
      worksheetId: worksheetId || null,
      grade,
      difficulty,
      questionId: typeof q?.questionId === 'string' ? q.questionId : null,
      signature,
      createdAt: nowIso,
    });
    saved += 1;
  }

  return saved;
}

/**
 * Calculates the maximum repeat and minimum unseen question counts from a
 * cap percentage and a total question count.
 *
 * @param {number} questionCount - Total questions requested
 * @param {number} capPercent    - Effective repeat cap (0–100)
 * @returns {{ maxRepeat: number, minUnseen: number }}
 */
export function calculateAllocation(questionCount, capPercent) {
  const clampedCap = Math.max(0, Math.min(100, Number(capPercent) || 0));
  const maxRepeat  = Math.floor(questionCount * clampedCap / 100);
  const minUnseen  = questionCount - maxRepeat;
  return { maxRepeat, minUnseen };
}

/**
 * Thin wrapper that resolves the effective repeat cap for a generation context.
 * Delegates to resolveEffectiveRepeatCap using the shared db adapter.
 *
 * Precedence: student override → parent override → teacher override → global default.
 * Falls back to DEFAULT_REPEAT_CAP_PERCENT (20) if the DB read fails.
 *
 * @param {Object} context
 * @param {Object} context.db          - DB adapter instance
 * @param {string} [context.studentId] - Student userId for student-scope override
 * @param {string} [context.parentId]  - Parent userId for parent-scope override
 * @param {string} [context.teacherId] - Teacher userId for teacher-scope override
 * @returns {Promise<{ capPercent: number, fallback: boolean }>} Effective repeat cap percentage (0–100) and whether fallback was used
 */
export async function resolveRepeatCap({ db, studentId, parentId, teacherId }) {
  try {
    const result = await resolveEffectiveRepeatCap({ db, studentId, parentId, teacherId });
    return { capPercent: result.capPercent, fallback: false };
  } catch {
    return { capPercent: DEFAULT_REPEAT_CAP_PERCENT, fallback: true };
  }
}

/**
 * Reads the UserQuestionHistory table for a specific user + grade + subject.
 * Returns a Set of questionIds the user has already seen.
 *
 * @param {Object} input
 * @param {string} [input.userId]   - Authenticated user ID (sub claim)
 * @param {string} [input.guestId]  - Guest user ID
 * @param {number} input.grade      - Grade level
 * @param {string} input.subject    - Subject name
 * @returns {Promise<Set<string>>}  Set of seen questionIds
 */
export async function getUserQuestionHistory({ userId, guestId, grade, subject }) {
  // Need userId or guestId to form the key
  if (!userId && !guestId) return new Set();

  const PK = guestId ? `GUEST#${guestId}` : `USER#${userId}`;
  const SK = `GRADE#${grade}#SUBJ#${subject}`;
  const isAws = process.env.APP_RUNTIME === 'aws' || process.env.APP_RUNTIME === 'dynamodb';

  try {
    if (isAws) {
      const tableName = process.env.USER_QUESTION_HISTORY_TABLE;
      if (!tableName) return new Set();

      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, GetCommand } = await import('@aws-sdk/lib-dynamodb');

      if (!getUserQuestionHistory._docClient) {
        getUserQuestionHistory._docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
      }

      const result = await getUserQuestionHistory._docClient.send(new GetCommand({
        TableName: tableName,
        Key: { PK, SK },
        ProjectionExpression: 'seenQuestionIds',
      }));

      return result.Item?.seenQuestionIds instanceof Set
        ? result.Item.seenQuestionIds
        : new Set(result.Item?.seenQuestionIds ?? []);
    }

    // Local dev: read from data-local/userQuestionHistory.json
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const filePath = join(process.cwd(), 'data-local', 'userQuestionHistory.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const key = `${PK}|${SK}`;
    return new Set(data[key]?.seenQuestionIds ?? []);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('getUserQuestionHistory failed (non-fatal):', err);
    }
    return new Set();
  }
}
getUserQuestionHistory._docClient = null;

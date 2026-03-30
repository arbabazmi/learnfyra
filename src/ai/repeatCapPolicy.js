/**
 * @file src/ai/repeatCapPolicy.js
 * @description Repeat-cap policy resolution and student exposure tracking helpers.
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
 * @param {Object} input
 * @param {Object} input.db
 * @param {string} [input.studentId]
 * @param {string} [input.parentId]
 * @param {string} input.teacherId
 * @returns {Promise<{capPercent:number, appliedBy:string, sourceId:string|null}>}
 */
export async function resolveEffectiveRepeatCap({ db, studentId, parentId, teacherId }) {
  let defaultPercent = DEFAULT_REPEAT_CAP_PERCENT;

  const globalPolicy = await db.getItem('adminPolicies', 'global');
  if (globalPolicy?.repeatCapPolicy?.enabled === false) {
    return { capPercent: 100, appliedBy: 'disabled', sourceId: null };
  }
  if (globalPolicy?.repeatCapPolicy?.defaultPercent != null) {
    defaultPercent = clampPercent(globalPolicy.repeatCapPolicy.defaultPercent, DEFAULT_REPEAT_CAP_PERCENT);
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

  const studentOverride = pickOverride('student', studentId);
  if (studentOverride) {
    return {
      capPercent: clampPercent(studentOverride.repeatCapPercent, defaultPercent),
      appliedBy: 'student',
      sourceId: studentOverride.scopeId,
    };
  }

  const parentOverride = pickOverride('parent', parentId);
  if (parentOverride) {
    return {
      capPercent: clampPercent(parentOverride.repeatCapPercent, defaultPercent),
      appliedBy: 'parent',
      sourceId: parentOverride.scopeId,
    };
  }

  const teacherOverride = pickOverride('teacher', teacherId);
  if (teacherOverride) {
    return {
      capPercent: clampPercent(teacherOverride.repeatCapPercent, defaultPercent),
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

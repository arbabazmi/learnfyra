/**
 * @file backend/handlers/dashboardHandler.js
 * @description Lambda-compatible handler for dashboard API routes.
 *
 * Routes:
 *   GET /api/dashboard/stats              — summary stats for the authenticated user
 *   GET /api/dashboard/recent-worksheets  — last 4 worksheet attempts
 *   GET /api/dashboard/subject-progress   — per-subject score averages
 *
 * All routes require a valid Bearer JWT.
 *
 * Data sources:
 *   'attempts'   — individual worksheet attempts (keyed by attemptId, filtered by studentId)
 *   'aggregates' — per-student per-subject stats (keyed by "{studentId}#{subject}")
 */

import { validateToken } from '../middleware/authMiddleware.js';
import { getDbAdapter } from '../../src/db/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

function okResponse(data) {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

// ── Subject colors — matches the frontend theme ────────────────────────────

const SUBJECT_COLORS = {
  'Math':           '#3D9AE8',
  'ELA':            '#6DB84B',
  'Science':        '#F5C534',
  'Social Studies': '#f97316',
  'Health':         '#8b5cf6',
};

// ── GET /api/dashboard/stats ───────────────────────────────────────────────

async function handleStats(decoded) {
  const db = getDbAdapter();
  const studentId = decoded.sub;

  // Fetch worksheets and attempts in parallel
  const [worksheets, attempts] = await Promise.all([
    db.queryByField('worksheets', 'createdBy', studentId).catch(() => []),
    db.queryByField('attempts', 'studentId', studentId),
  ]);

  // Build set of worksheetIds that have been completed
  const completedAttempts = (attempts || []).filter(a => a.percentage != null && a.percentage >= 0);
  const inProgressAttempts = (attempts || []).filter(a => a.percentage == null || a.percentage < 0);
  const attemptedIds = new Set((attempts || []).map(a => a.worksheetId));

  // "New" worksheets = generated but never attempted
  const newCount = (worksheets || []).filter(w => !attemptedIds.has(w.worksheetId)).length;

  const bestScore = completedAttempts.length > 0
    ? Math.round(Math.max(...completedAttempts.map(a => a.percentage)))
    : 0;

  // Total time in seconds → human-readable
  const totalSeconds = (attempts || []).reduce((sum, a) => sum + (a.timeTaken || 0), 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
  const studyTime = totalHours > 0
    ? `${totalHours}h ${totalMinutes}m`
    : `${totalMinutes}m`;

  return okResponse({
    worksheetsDone: completedAttempts.length,
    inProgress: inProgressAttempts.length,
    newWorksheets: newCount,
    totalWorksheets: (worksheets || []).length,
    bestScore,
    studyTime,
  });
}

// ── GET /api/dashboard/recent-worksheets ───────────────────────────────────

async function handleRecentWorksheets(decoded) {
  const db = getDbAdapter();
  const studentId = decoded.sub;

  // Fetch worksheets and attempts in parallel
  const [worksheets, attempts] = await Promise.all([
    db.queryByField('worksheets', 'createdBy', studentId).catch(() => []),
    db.queryByField('attempts', 'studentId', studentId),
  ]);

  // Build map of worksheetId → best attempt
  const bestAttemptMap = new Map();
  for (const a of (attempts || [])) {
    if (!a.worksheetId) continue;
    const existing = bestAttemptMap.get(a.worksheetId);
    if (!existing || (a.percentage != null && (existing.percentage == null || a.percentage > existing.percentage))) {
      bestAttemptMap.set(a.worksheetId, a);
    }
  }

  // Merge: every worksheet gets a status based on its best attempt
  const merged = (worksheets || []).map(w => {
    const attempt = bestAttemptMap.get(w.worksheetId);
    let status = 'new';
    let score = null;
    if (attempt) {
      if (attempt.percentage != null && attempt.percentage >= 0) {
        status = 'completed';
        score = Math.round(attempt.percentage);
      } else {
        status = 'in-progress';
      }
    }
    return {
      id: w.slug || w.worksheetId,
      title: w.title || w.topic || `${w.subject} Worksheet`,
      subject: w.subject,
      grade: w.grade,
      score,
      totalPoints: w.totalPoints || 10,
      status,
      createdAt: w.createdAt || '',
    };
  });

  // Sort by most recent first, take last 4
  merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const recent = merged.slice(0, 4);

  return okResponse(recent);
}

// ── GET /api/dashboard/subject-progress ────────────────────────────────────

async function handleSubjectProgress(decoded) {
  const db = getDbAdapter();
  const studentId = decoded.sub;

  // Try aggregates first (fast path)
  const allAggregates = await db.listAll('aggregates');
  const myAggregates = allAggregates.filter(a => {
    const id = a.id || a.aggregateId || '';
    return id.startsWith(`${studentId}#`);
  });

  if (myAggregates.length > 0) {
    const progress = myAggregates.map(a => {
      const id = a.id || a.aggregateId || '';
      const subject = id.split('#')[1] || 'Unknown';
      return {
        subject,
        score: Math.round(a.averagePercentage || 0),
        color: SUBJECT_COLORS[subject] || '#3D9AE8',
      };
    });

    return okResponse(progress);
  }

  // Fallback: compute from attempts directly
  const attempts = await db.queryByField('attempts', 'studentId', studentId);
  const completed = attempts.filter(a => a.percentage != null);

  if (completed.length === 0) {
    return okResponse([]);
  }

  // Group by subject and compute average
  const bySubject = {};
  for (const a of completed) {
    if (!bySubject[a.subject]) {
      bySubject[a.subject] = { total: 0, count: 0 };
    }
    bySubject[a.subject].total += a.percentage;
    bySubject[a.subject].count += 1;
  }

  const progress = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    score: Math.round(data.total / data.count),
    color: SUBJECT_COLORS[subject] || '#3D9AE8',
  }));

  return okResponse(progress);
}

// ── Lambda handler ─────────────────────────────────────────────────────────

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const decoded = await validateToken(event);
    const path = event.path || event.routeKey || '';

    if (path.endsWith('/stats')) {
      return await handleStats(decoded);
    }

    if (path.endsWith('/recent-worksheets')) {
      return await handleRecentWorksheets(decoded);
    }

    if (path.endsWith('/subject-progress')) {
      return await handleSubjectProgress(decoded);
    }

    return errorResponse(404, 'Route not found.');
  } catch (err) {
    console.error('dashboardHandler error:', err);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const isDebug = process.env.DEBUG_MODE === 'true';
    const message = (statusCode < 500 || isDebug) ? err.message : 'Internal server error.';
    const body = { error: message };
    if (isDebug) {
      body._debug = { stack: err.stack, handler: 'dashboardHandler', statusCode, timestamp: new Date().toISOString() };
    }
    return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
  }
};

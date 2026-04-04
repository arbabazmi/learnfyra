/**
 * @file src/services/api/teacherService.ts
 * @description API service for teacher-role endpoints — Module 5.
 * All calls require a valid Bearer JWT with role = teacher.
 */

import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import type {
  Class,
  CreateClassInput,
  Assignment,
  CreateAssignmentInput,
  StudentRosterEntry,
  ReviewQueueItem,
  AnalyticsOverview,
  HeatmapData,
} from '@/types/teacher';

// ── Shared helpers ──────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: string; message?: string }).error ??
      (body as { error?: string; message?: string }).message ??
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Class endpoints ─────────────────────────────────────────────────────────

export async function getClasses(): Promise<Class[]> {
  const res = await fetch(`${apiUrl}/api/classes`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ classes: Class[] }>(res);
  return data.classes;
}

export async function createClass(input: CreateClassInput): Promise<Class> {
  const res = await fetch(`${apiUrl}/api/classes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<Class>(res);
}

export async function getClass(classId: string): Promise<Class> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}`, {
    headers: authHeaders(),
  });
  return handleResponse<Class>(res);
}

export async function updateClass(
  classId: string,
  updates: Partial<Pick<Class, 'className' | 'accuracyThreshold'>>,
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  await handleResponse<unknown>(res);
}

export async function archiveClass(classId: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/archive`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse<unknown>(res);
}

export async function regenerateInviteCode(
  classId: string,
): Promise<{ inviteCode: string }> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/invite`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse<{ inviteCode: string }>(res);
}

// ── Student roster endpoints ────────────────────────────────────────────────

export async function getStudents(
  classId: string,
): Promise<StudentRosterEntry[]> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/students`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ students: StudentRosterEntry[] }>(res);
  return data.students;
}

export async function removeStudent(
  classId: string,
  studentId: string,
): Promise<void> {
  const res = await fetch(
    `${apiUrl}/api/classes/${classId}/students/${studentId}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  await handleResponse<unknown>(res);
}

export async function generateParentInvite(
  classId: string,
  studentId: string,
): Promise<{ inviteCode: string; expiresAt: string }> {
  const res = await fetch(
    `${apiUrl}/api/classes/${classId}/students/${studentId}/parent-invite`,
    {
      method: 'POST',
      headers: authHeaders(),
    },
  );
  return handleResponse<{ inviteCode: string; expiresAt: string }>(res);
}

// ── Assignment endpoints ────────────────────────────────────────────────────

export async function getAssignments(
  classId: string,
): Promise<Assignment[]> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/assignments`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ assignments: Assignment[] }>(res);
  return data.assignments;
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<Assignment> {
  const res = await fetch(`${apiUrl}/api/assignments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse<Assignment>(res);
}

export async function updateAssignment(
  assignmentId: string,
  updates: Partial<Assignment>,
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  await handleResponse<unknown>(res);
}

export async function closeAssignment(assignmentId: string): Promise<void> {
  const res = await fetch(`${apiUrl}/api/assignments/${assignmentId}/close`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleResponse<unknown>(res);
}

// ── Review queue endpoints ──────────────────────────────────────────────────

export async function getReviewQueue(
  classId: string,
): Promise<{ pendingCount: number; items: ReviewQueueItem[] }> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/review-queue`, {
    headers: authHeaders(),
  });
  return handleResponse<{ pendingCount: number; items: ReviewQueueItem[] }>(
    res,
  );
}

export async function resolveReviewItem(
  reviewId: string,
  action: 'approve' | 'override',
  overrideScore?: number,
): Promise<void> {
  const res = await fetch(
    `${apiUrl}/api/review-queue/${reviewId}/resolve`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action, ...(overrideScore !== undefined ? { overrideScore } : {}) }),
    },
  );
  await handleResponse<unknown>(res);
}

// ── Analytics endpoints ─────────────────────────────────────────────────────

export async function getAnalytics(
  classId: string,
): Promise<AnalyticsOverview> {
  const res = await fetch(`${apiUrl}/api/classes/${classId}/analytics`, {
    headers: authHeaders(),
  });
  return handleResponse<AnalyticsOverview>(res);
}

export async function getHeatmap(classId: string): Promise<HeatmapData> {
  const res = await fetch(
    `${apiUrl}/api/classes/${classId}/analytics/heatmap`,
    {
      headers: authHeaders(),
    },
  );
  return handleResponse<HeatmapData>(res);
}

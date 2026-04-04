/**
 * @file src/services/api/parentService.ts
 * @description API service for parent-role endpoints — Module 5.
 * All calls require a valid Bearer JWT with role = parent.
 */

import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import type {
  ChildSummary,
  ChildProgress,
  ChildAssignment,
} from '@/types/parent';

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

// ── Child linking endpoints ─────────────────────────────────────────────────

export async function getChildren(): Promise<ChildSummary[]> {
  const res = await fetch(`${apiUrl}/api/parent/children`, {
    headers: authHeaders(),
  });
  const data = await handleResponse<{ children: ChildSummary[] }>(res);
  return data.children;
}

export async function linkToChild(
  inviteCode: string,
): Promise<ChildSummary> {
  const res = await fetch(`${apiUrl}/api/parent/link`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ inviteCode }),
  });
  return handleResponse<ChildSummary>(res);
}

export async function unlinkChild(studentId: string): Promise<void> {
  const res = await fetch(
    `${apiUrl}/api/parent/children/${studentId}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  await handleResponse<unknown>(res);
}

// ── Child progress endpoints ────────────────────────────────────────────────

export async function getChildProgress(
  studentId: string,
): Promise<ChildProgress> {
  const res = await fetch(
    `${apiUrl}/api/parent/children/${studentId}/progress`,
    {
      headers: authHeaders(),
    },
  );
  return handleResponse<ChildProgress>(res);
}

export async function getChildAssignments(
  studentId: string,
): Promise<ChildAssignment[]> {
  const res = await fetch(
    `${apiUrl}/api/parent/children/${studentId}/assignments`,
    {
      headers: authHeaders(),
    },
  );
  const data = await handleResponse<{ assignments: ChildAssignment[] }>(res);
  return data.assignments;
}

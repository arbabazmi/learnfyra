/**
 * @file src/lib/guestSession.ts
 * @description Guest session manager — stores worksheet attempts, scores,
 * and nudge state in localStorage. Data persists across page reloads but
 * can be migrated to a real account on sign-up.
 *
 * All guest data lives under the 'learnfyra_guest' key.
 */

export interface GuestAttempt {
  worksheetId: string;
  title: string;
  subject: string;
  grade: number;
  score: number | null;
  totalPoints: number;
  completedAt: string | null;
  answers: Record<number, string>;
}

interface GuestData {
  attempts: GuestAttempt[];
  nudgesDismissed: string[];    // IDs of dismissed nudges
  worksheetsCompleted: number;
  createdAt: string;
}

const STORAGE_KEY = 'learnfyra_guest';

function getDefault(): GuestData {
  return {
    attempts: [],
    nudgesDismissed: [],
    worksheetsCompleted: 0,
    createdAt: new Date().toISOString(),
  };
}

function read(): GuestData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...getDefault(), ...JSON.parse(raw) } : getDefault();
  } catch {
    return getDefault();
  }
}

function write(data: GuestData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Save or update a worksheet attempt. */
export function saveAttempt(attempt: GuestAttempt): void {
  const data = read();
  const idx = data.attempts.findIndex((a) => a.worksheetId === attempt.worksheetId);
  if (idx >= 0) {
    data.attempts[idx] = attempt;
  } else {
    data.attempts.push(attempt);
  }
  if (attempt.completedAt && attempt.score !== null) {
    data.worksheetsCompleted = data.attempts.filter((a) => a.completedAt).length;
  }
  write(data);
}

/** Get all guest attempts. */
export function getAttempts(): GuestAttempt[] {
  return read().attempts;
}

/** Get a single attempt by worksheet ID. */
export function getAttempt(worksheetId: string): GuestAttempt | null {
  return read().attempts.find((a) => a.worksheetId === worksheetId) ?? null;
}

/** Number of completed worksheets (with score). */
export function getCompletedCount(): number {
  return read().worksheetsCompleted;
}

/** Check if a nudge has been dismissed. */
export function isNudgeDismissed(nudgeId: string): boolean {
  return read().nudgesDismissed.includes(nudgeId);
}

/** Dismiss a nudge. */
export function dismissNudge(nudgeId: string): void {
  const data = read();
  if (!data.nudgesDismissed.includes(nudgeId)) {
    data.nudgesDismissed.push(nudgeId);
    write(data);
  }
}

/** Whether the guest has any meaningful data worth saving. */
export function hasGuestData(): boolean {
  return read().worksheetsCompleted > 0;
}

/** Export all guest data (for migration to a real account). */
export function exportGuestData(): GuestData {
  return read();
}

/** Clear all guest data (after successful migration). */
export function clearGuestData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * @file src/types/parent.ts
 * @description TypeScript types for the Parent role — Module 5.
 * Covers child linking, progress tracking, and assignment monitoring.
 */

// ── Child Linking ──────────────────────────────────────────────────────────

export type LinkMethod = 'teacher-generated' | 'student-generated';

export interface ChildSummary {
  studentId: string;
  displayName: string;
  gradeLevel: number | null;
  linkMethod: LinkMethod;
  linkedAt: string;
}

// ── Child Progress ─────────────────────────────────────────────────────────

export interface ActivityWindow {
  worksheetsAttempted: number;
  averageScore: number | null;
  totalTimeSpentSeconds: number;
}

export interface NeedsAttentionTopic {
  topic: string;
  currentAccuracy: number;
  attemptCount: number;
}

export interface ChildProgress {
  studentId: string;
  displayName: string;
  last7Days: ActivityWindow;
  last30Days: ActivityWindow;
  overallAccuracy: number | null;
  needsAttention: NeedsAttentionTopic[];
}

// ── Child Assignments ─────────────────────────────────────────────────────

export type ChildAssignmentStatus =
  | 'not-started'
  | 'in-progress'
  | 'submitted'
  | 'overdue';

export interface ChildAssignment {
  assignmentId: string;
  title: string;
  className: string;
  teacherName: string;
  dueDate: string | null;
  status: ChildAssignmentStatus;
  score: number | null;
  totalPoints: number;
  submittedAt: string | null;
}

/**
 * @file src/types/teacher.ts
 * @description TypeScript types for the Teacher role — Module 5.
 * Covers classes, assignments, student roster, review queue, and analytics.
 */

// ── Class ─────────────────────────────────────────────────────────────────

export interface Class {
  classId: string;
  className: string;
  gradeLevel: number | null;
  subjects: string[];
  inviteCode: string;
  status: 'active' | 'archived';
  studentCount: number;
  pendingReviewCount: number;
  accuracyThreshold: number;
  createdAt: string;
  archivedAt?: string | null;
}

export interface CreateClassInput {
  className: string;
  gradeLevel?: number;
  subjects?: string[];
}

// ── Assignment ────────────────────────────────────────────────────────────

export type AssignmentMode = 'practice' | 'test';
export type RetakePolicy = 'unlimited' | 'limited' | 'once';
export type AssignmentStatus = 'active' | 'closed' | 'archived';

export interface Assignment {
  assignmentId: string;
  classId: string;
  worksheetId: string;
  title: string;
  mode: AssignmentMode;
  timeLimit: number | null;
  dueDate: string | null;
  openAt: string | null;
  closeAt: string | null;
  retakePolicy: RetakePolicy;
  retakeLimit: number | null;
  status: AssignmentStatus;
  createdAt: string;
  closedAt?: string | null;
}

export interface CreateAssignmentInput {
  classId: string;
  worksheetId: string;
  mode: AssignmentMode;
  dueDate?: string;
  openAt?: string;
  closeAt?: string;
  timeLimit?: number;
  retakePolicy: RetakePolicy;
  retakeLimit?: number;
}

// ── Student Roster ─────────────────────────────────────────────────────────

export interface AssignmentsSummary {
  total: number;
  submitted: number;
  overdue: number;
}

export interface StudentRosterEntry {
  studentId: string;
  displayName: string;
  joinedAt: string;
  status: 'active' | 'removed';
  assignmentsSummary: AssignmentsSummary;
  lastActiveAt: string | null;
  overallAccuracy: number | null;
}

// ── Review Queue ──────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  reviewId: string;
  studentName: string;
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  expectedAnswer: string;
  systemConfidenceScore: number;
  currentScore: number;
  pointsPossible: number;
  attemptId: string;
  createdAt: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────

export interface AssignmentBreakdown {
  active: number;
  closed: number;
  total: number;
}

export interface WeakestTopic {
  topic: string;
  averageAccuracy: number;
  attemptCount: number;
}

export interface StudentBelowThreshold {
  studentId: string;
  displayName: string;
  overallAccuracy: number;
}

export interface AnalyticsOverview {
  classId: string;
  assignmentBreakdown: AssignmentBreakdown;
  overallCompletionRate: number;
  weakestTopics: WeakestTopic[];
  studentsBelowThreshold: StudentBelowThreshold[];
  accuracyThreshold: number;
}

// ── Heatmap ───────────────────────────────────────────────────────────────

export interface HeatmapCell {
  studentId: string;
  topic: string;
  accuracy: number | null;
  attemptCount: number;
}

export interface HeatmapData {
  classId: string;
  students: Array<{ studentId: string; displayName: string }>;
  topics: string[];
  cells: HeatmapCell[];
}

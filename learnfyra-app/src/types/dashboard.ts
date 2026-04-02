/**
 * @file src/types/dashboard.ts
 * @description Dashboard TypeScript types.
 */

export interface DashboardStats {
  worksheetsDone: number;
  inProgress: number;
  bestScore: number;
  studyTime: string;
  downloaded?: number;
}

export type WorksheetStatus = 'completed' | 'new' | 'in-progress';

export interface DashboardWorksheet {
  id: string;
  title: string;
  subject: string;
  grade: number;
  score: number | null;
  totalPoints: number;
  status: WorksheetStatus;
}

export interface SubjectProgress {
  subject: string;
  score: number;
  color: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentWorksheets: DashboardWorksheet[];
  subjectProgress: SubjectProgress[];
}

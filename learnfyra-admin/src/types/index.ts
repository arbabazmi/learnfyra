/**
 * @file src/types/index.ts
 * @description Canonical TypeScript types for the Learnfyra admin console
 */

// ── Roles ──────────────────────────────────────────────────────
export type UserRole = 'student' | 'teacher' | 'parent' | 'school_admin' | 'admin' | 'super_admin';
export type AdminRole = 'super_admin' | 'admin' | 'school_admin';

// ── Auth ───────────────────────────────────────────────────────
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  schoolId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
  token: string;
}

// ── Users ──────────────────────────────────────────────────────
export interface User {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  suspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  generationCount?: number;
  attemptCount?: number;
  totalAttempts?: number;
  classIds?: string[];
}

export interface UsersListResponse {
  users: User[];
  count: number;
  lastKey?: string;
}

export interface UsersListParams {
  role?: UserRole;
  limit?: number;
  lastKey?: string;
  search?: string;
  suspended?: boolean;
}

// ── Question Bank ──────────────────────────────────────────────
export type QuestionStatus = 'active' | 'flagged' | 'deleted';

export interface Question {
  questionId: string;
  question: string;
  type: string;
  grade: number;
  subject: string;
  topic: string;
  status: QuestionStatus;
  options?: string[];
  answer: string;
  explanation: string;
  createdAt: string;
  flaggedAt?: string;
  flaggedBy?: string;
}

export interface QuestionListResponse {
  questions: Question[];
  count: number;
  lastKey?: string;
}

export interface QuestionListParams {
  status?: QuestionStatus;
  grade?: number;
  subject?: string;
  limit?: number;
  lastKey?: string;
}

// ── Cost Dashboard ─────────────────────────────────────────────
export type CostWindow = '24h' | '7d' | '30d';

export interface CostDashboardResponse {
  window: CostWindow;
  totalTokens: number;
  costEstimateByModel: Record<string, number | null>;
  avgTokensBySubjectAndGrade: Record<string, Record<string, number>>;
  successRate: number;
  failureRate: number;
  retryRate: number;
  totalGenerations: number;
}

export interface TopExpensiveRequest {
  requestId: string;
  userId: string;
  model: string;
  tokensUsed: number;
  estimatedCost: number | null;
  grade: number;
  subject: string;
  createdAt: string;
}

// ── Config ─────────────────────────────────────────────────────
export interface ConfigEntry {
  configKey: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'string-enum' | 'string-array';
  description?: string;
  allowedValues?: string[];
  updatedBy?: string;
  updatedAt?: string;
}

export interface ConfigListResponse {
  config: ConfigEntry[];
}

// ── Schools ────────────────────────────────────────────────────
export interface School {
  schoolId: string;
  schoolName: string;
  district?: string;
  address?: string;
  minGrade: number;
  maxGrade: number;
  activeSubjects: string[];
  schoolAdminIds: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
}

export interface CreateSchoolRequest {
  schoolName: string;
  minGrade: number;
  maxGrade: number;
  activeSubjects: string[];
  district?: string;
  address?: string;
}

// ── Audit Log ──────────────────────────────────────────────────
export type AuditAction =
  | 'USER_SUSPENDED' | 'USER_UNSUSPENDED' | 'FORCE_LOGOUT' | 'ROLE_CHANGE'
  | 'COPPA_DELETION' | 'QUESTION_FLAGGED' | 'QUESTION_UNFLAGGED'
  | 'QUESTION_SOFT_DELETED' | 'CONFIG_UPDATED' | 'SCHOOL_CREATED'
  | 'SCHOOL_UPDATED' | 'SCHOOL_ADMIN_ASSIGNED' | 'TEACHER_INVITED'
  | 'TEACHER_REMOVED' | 'BULK_ASSIGNMENT_CREATED' | 'SCHOOL_CONFIG_UPDATED';

export interface AuditLogEntry {
  auditId: string;
  actorId: string;
  actorRole: string;
  action: AuditAction;
  targetEntityType: string;
  targetEntityId: string;
  beforeState: string | null;
  afterState: string | null;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  count: number;
  lastKey?: string;
}

export interface AuditLogParams {
  actorId?: string;
  targetEntityId?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  limit?: number;
  lastKey?: string;
}

// ── Compliance Log ─────────────────────────────────────────────
export type ComplianceStatus = 'in-progress' | 'completed' | 'partial-failure';

export interface ComplianceLogEntry {
  requestId: string;
  requestType: string;
  requestedBy: string;
  targetUserId: string;
  startedAt: string;
  completedAt: string | null;
  legalBasis: string;
  status: ComplianceStatus;
  deletedEntities: Array<{ entityType: string; count: number }> | null;
  errorState: { failedStep: string; errorMessage: string; countAtFailure: number } | null;
}

export interface ComplianceLogResponse {
  entries: ComplianceLogEntry[];
  count: number;
}

// ── School Admin ───────────────────────────────────────────────
export interface Teacher {
  userId: string;
  displayName: string;
  email: string;
  activeClassCount: number;
  linkedAt: string;
}

export interface Student {
  userId: string;
  displayName: string;
  grade: number;
  classMembershipCount: number;
}

export interface SchoolAnalytics {
  subjectAccuracy: Record<string, number>;
  gradeAccuracy: Record<number, number>;
  teacherCompletionRates: Array<{ teacherId: string; name: string; rate: number }>;
  weakAreas: Array<{ subject: string; grade: number; accuracy: number }>;
}

export interface InviteTeacherResponse {
  inviteCode: string;
  expiresAt: string;
}

export interface BulkAssignRequest {
  worksheetId: string;
  classIds: string[];
  dueDate: string;
  allowedAttempts: number;
}

export interface BulkAssignResponse {
  worksheetId: string;
  results: Array<{ classId: string; status: 'success' | 'error'; error?: string }>;
}

export interface SchoolConfig {
  schoolId: string;
  schoolName: string;
  minGrade: number;
  maxGrade: number;
  activeSubjects: string[];
}

// ── Dashboard ──────────────────────────────────────────────────
export interface DashboardStats {
  totalUsers: number;
  totalGenerations: number;
  totalSchools: number;
  activeToday: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    actor: string;
  }>;
}

// ── Pagination ─────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  lastKey?: string;
}

// ── API Error ──────────────────────────────────────────────────
export interface ApiError {
  error: string;
  code: string;
  retryAfter?: number;
}

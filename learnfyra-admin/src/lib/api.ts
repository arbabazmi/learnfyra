/**
 * @file src/lib/api.ts
 * @description Typed API client for the Learnfyra admin console.
 * All methods map 1-to-1 to backend API endpoints.
 * On 401 the client clears local auth state and redirects to /login.
 */

import type {
  LoginRequest,
  LoginResponse,
  User,
  UsersListResponse,
  UsersListParams,
  QuestionListResponse,
  QuestionListParams,
  CostDashboardResponse,
  CostWindow,
  TopExpensiveRequest,
  ConfigListResponse,
  ConfigEntry,
  School,
  CreateSchoolRequest,
  AuditLogResponse,
  AuditLogParams,
  ComplianceLogResponse,
  DashboardStats,
  Teacher,
  Student,
  SchoolAnalytics,
  InviteTeacherResponse,
  BulkAssignRequest,
  BulkAssignResponse,
  SchoolConfig,
  ApiError,
} from '@/types';

const API_BASE = '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('admin_token');
  }

  private clearAuth(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  }

  /**
   * Core fetch wrapper. Attaches the Bearer token, handles 401 redirect,
   * and surfaces non-ok responses as typed ApiError throws.
   *
   * @param path - Path relative to API_BASE (must start with /)
   * @param options - Standard RequestInit options
   * @returns Parsed JSON response body typed as T
   * @throws {ApiError} on non-2xx responses
   */
  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    if (res.status === 401) {
      this.clearAuth();
      throw { error: 'Unauthorized', code: 'AUTH_ERROR' } as ApiError;
    }

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: res.statusText, code: 'UNKNOWN_ERROR' }));
      throw err as ApiError;
    }

    return res.json();
  }

  /**
   * Serialises a params object into a query string, omitting undefined/null/empty values.
   *
   * @param params - Key-value pairs to encode
   * @returns Query string including leading '?', or empty string
   */
  private buildQuery(params: object): string {
    const entries = Object.entries(params as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  }

  // ── Auth ─────────────────────────────────────────────────────

  /**
   * Authenticates an admin user and returns a JWT token + user record.
   *
   * @param data - Email and password credentials
   * @returns LoginResponse containing token and AuthUser
   */
  login(data: LoginRequest): Promise<LoginResponse> {
    return this.fetch('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  }

  // ── Dashboard ────────────────────────────────────────────────

  /**
   * Returns platform-level summary statistics for the admin dashboard.
   *
   * @returns DashboardStats with totals and recent activity feed
   */
  getDashboardStats(): Promise<DashboardStats> {
    return this.fetch('/admin/dashboard');
  }

  // ── Users ────────────────────────────────────────────────────

  /**
   * Lists users with optional filtering and cursor-based pagination.
   *
   * @param params - Filter/pagination options (role, suspended, search, limit, lastKey)
   * @returns Paginated list of User records
   */
  getUsers(params: UsersListParams = {}): Promise<UsersListResponse> {
    return this.fetch(`/admin/users${this.buildQuery(params)}`);
  }

  /**
   * Fetches a single user by ID.
   *
   * @param userId - UUID of the target user
   * @returns Full User record
   */
  getUser(userId: string): Promise<User> {
    return this.fetch(`/admin/users/${userId}`);
  }

  /**
   * Suspends a user account. Logs a USER_SUSPENDED audit entry.
   *
   * @param userId - UUID of the target user
   * @param reason - Optional human-readable suspension reason
   */
  suspendUser(
    userId: string,
    reason?: string,
  ): Promise<{ userId: string; status: string; suspendedAt: string }> {
    return this.fetch(`/admin/users/${userId}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Lifts a suspension from a user account. Logs a USER_UNSUSPENDED audit entry.
   *
   * @param userId - UUID of the target user
   */
  unsuspendUser(
    userId: string,
  ): Promise<{ userId: string; status: string; unsuspendedAt: string }> {
    return this.fetch(`/admin/users/${userId}/unsuspend`, { method: 'PATCH' });
  }

  /**
   * Invalidates all active sessions for a user. Logs a FORCE_LOGOUT audit entry.
   *
   * @param userId - UUID of the target user
   */
  forceLogout(userId: string): Promise<void> {
    return this.fetch(`/admin/users/${userId}/force-logout`, {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  /**
   * Changes a user's role. Logs a ROLE_CHANGE audit entry.
   *
   * @param userId - UUID of the target user
   * @param role - New role string
   */
  changeUserRole(
    userId: string,
    role: string,
  ): Promise<{ userId: string; role: string; updatedAt: string }> {
    return this.fetch(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  /**
   * Permanently deletes a user under COPPA/FERPA compliance rules.
   * Requires a pre-issued confirmation token. Logs a COPPA_DELETION audit entry.
   *
   * @param userId - UUID of the target user
   * @param confirmationToken - Token issued by the compliance confirmation flow
   */
  coppaDeleteUser(
    userId: string,
    confirmationToken: string,
  ): Promise<{ userId: string; deleted: boolean; deletedAt: string }> {
    return this.fetch(`/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmationToken }),
    });
  }

  // ── Question Bank ────────────────────────────────────────────

  /**
   * Lists questions from the question bank with optional filters.
   *
   * @param params - Filter/pagination options (status, grade, subject, limit, lastKey)
   * @returns Paginated list of Question records
   */
  getQuestions(params: QuestionListParams = {}): Promise<QuestionListResponse> {
    return this.fetch(`/admin/question-bank${this.buildQuery(params)}`);
  }

  /**
   * Flags a question for human review. Logs a QUESTION_FLAGGED audit entry.
   *
   * @param questionId - ID of the question to flag
   */
  flagQuestion(questionId: string): Promise<void> {
    return this.fetch(`/admin/question-bank/${questionId}/flag`, { method: 'PATCH' });
  }

  /**
   * Clears the flag on a previously flagged question. Logs a QUESTION_UNFLAGGED audit entry.
   *
   * @param questionId - ID of the question to unflag
   */
  unflagQuestion(questionId: string): Promise<void> {
    return this.fetch(`/admin/question-bank/${questionId}/unflag`, { method: 'PATCH' });
  }

  /**
   * Soft-deletes a question (marks status=deleted, not physically removed).
   * Logs a QUESTION_SOFT_DELETED audit entry.
   *
   * @param questionId - ID of the question to delete
   */
  softDeleteQuestion(questionId: string): Promise<void> {
    return this.fetch(`/admin/question-bank/${questionId}`, { method: 'DELETE' });
  }

  // ── Cost Dashboard ───────────────────────────────────────────

  /**
   * Returns aggregated token usage and cost estimates for a given time window.
   *
   * @param window - Time window: '24h' | '7d' | '30d' (default '7d')
   * @returns CostDashboardResponse with token totals, per-model costs, and rates
   */
  getCostDashboard(window: CostWindow = '7d'): Promise<CostDashboardResponse> {
    return this.fetch(`/admin/cost-dashboard?window=${window}`);
  }

  /**
   * Returns the top AI generation requests by token cost.
   *
   * @returns Array of TopExpensiveRequest sorted descending by estimatedCost
   */
  getTopExpensiveRequests(): Promise<TopExpensiveRequest[]> {
    return this.fetch('/admin/cost-dashboard/top-expensive');
  }

  // ── Config ───────────────────────────────────────────────────

  /**
   * Returns all platform configuration entries.
   *
   * @returns ConfigListResponse containing the full config array
   */
  getConfig(): Promise<ConfigListResponse> {
    return this.fetch('/admin/config');
  }

  /**
   * Updates a single config entry by key. Logs a CONFIG_UPDATED audit entry.
   *
   * @param configKey - The config key to update
   * @param value - New value (type must match the entry's declared type)
   * @param reason - Human-readable reason for the change (required for audit trail)
   * @returns Updated ConfigEntry
   */
  updateConfig(configKey: string, value: unknown, reason: string): Promise<ConfigEntry> {
    return this.fetch(`/admin/config/${configKey}`, {
      method: 'PUT',
      body: JSON.stringify({ value, reason }),
    });
  }

  // ── Schools ──────────────────────────────────────────────────

  /**
   * Returns all schools registered on the platform.
   *
   * @returns Array of School records
   */
  getSchools(): Promise<School[]> {
    return this.fetch('/admin/schools');
  }

  /**
   * Returns a single school by ID.
   *
   * @param schoolId - UUID of the school
   * @returns Full School record
   */
  getSchool(schoolId: string): Promise<School> {
    return this.fetch(`/admin/schools/${schoolId}`);
  }

  /**
   * Creates a new school. Logs a SCHOOL_CREATED audit entry.
   *
   * @param data - School creation payload
   * @returns Created School record including generated schoolId
   */
  createSchool(data: CreateSchoolRequest): Promise<School> {
    return this.fetch('/admin/schools', { method: 'POST', body: JSON.stringify(data) });
  }

  /**
   * Updates an existing school. Logs a SCHOOL_UPDATED audit entry.
   *
   * @param schoolId - UUID of the school to update
   * @param data - Partial School fields to update
   * @returns Updated School record
   */
  updateSchool(schoolId: string, data: Partial<School>): Promise<School> {
    return this.fetch(`/admin/schools/${schoolId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ── Audit Log ────────────────────────────────────────────────

  /**
   * Returns audit log entries with optional actor/target/action/date filters.
   *
   * @param params - Filter and pagination options
   * @returns Paginated AuditLogResponse
   */
  getAuditLog(params: AuditLogParams = {}): Promise<AuditLogResponse> {
    return this.fetch(`/admin/audit-log${this.buildQuery(params)}`);
  }

  // ── Compliance Log ───────────────────────────────────────────

  /**
   * Returns the history of COPPA/FERPA compliance deletion requests.
   *
   * @returns ComplianceLogResponse with all compliance request records
   */
  getComplianceLog(): Promise<ComplianceLogResponse> {
    return this.fetch('/admin/compliance-log');
  }

  // ── School Admin Endpoints ───────────────────────────────────

  /**
   * Returns teachers linked to the calling school admin's school.
   *
   * @returns Array of Teacher records
   */
  getTeachers(): Promise<Teacher[]> {
    return this.fetch('/school/teachers');
  }

  /**
   * Generates a one-time teacher invite code for the calling school admin's school.
   * Logs a TEACHER_INVITED audit entry.
   *
   * @param note - Optional note attached to the invite
   * @returns Invite code and expiry timestamp
   */
  inviteTeacher(note?: string): Promise<InviteTeacherResponse> {
    return this.fetch('/school/teachers/invite', {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  /**
   * Removes a teacher from the calling school admin's school.
   * Logs a TEACHER_REMOVED audit entry.
   *
   * @param userId - UUID of the teacher to remove
   */
  removeTeacher(userId: string): Promise<void> {
    return this.fetch(`/school/teachers/${userId}`, { method: 'DELETE' });
  }

  /**
   * Returns students enrolled in the calling school admin's school.
   *
   * @returns Array of Student records
   */
  getStudents(): Promise<Student[]> {
    return this.fetch('/school/students');
  }

  /**
   * Returns performance analytics for the calling school admin's school.
   *
   * @returns SchoolAnalytics with accuracy by subject/grade and weak areas
   */
  getSchoolAnalytics(): Promise<SchoolAnalytics> {
    return this.fetch('/school/analytics');
  }

  /**
   * Bulk-assigns a worksheet to one or more classes.
   * Logs a BULK_ASSIGNMENT_CREATED audit entry.
   *
   * @param data - Worksheet ID, target class IDs, due date, and attempt limit
   * @returns Per-class assignment results
   */
  bulkAssign(data: BulkAssignRequest): Promise<BulkAssignResponse> {
    return this.fetch('/school/bulk-assign', { method: 'POST', body: JSON.stringify(data) });
  }

  /**
   * Returns the configuration for the calling school admin's school.
   *
   * @returns SchoolConfig record
   */
  getSchoolConfig(): Promise<SchoolConfig> {
    return this.fetch('/school/config');
  }

  /**
   * Updates the configuration for the calling school admin's school.
   * Logs a SCHOOL_CONFIG_UPDATED audit entry.
   *
   * @param data - Partial SchoolConfig fields to update
   * @returns Updated SchoolConfig record
   */
  updateSchoolConfig(data: Partial<SchoolConfig>): Promise<SchoolConfig> {
    return this.fetch('/school/config', { method: 'PATCH', body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();

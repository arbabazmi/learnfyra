/**
 * @file src/App.tsx
 * @description Root routing tree. Splits routes by role: platform admin routes
 * and school admin routes, each wrapped in the appropriate auth guard and
 * rendered inside the shared AdminLayout shell.
 */
import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { RequirePlatformAdmin } from '@/components/guards/RequirePlatformAdmin';
import { RequireSchoolAdmin } from '@/components/guards/RequireSchoolAdmin';
import { AdminLayout } from '@/components/layout/AdminLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersListPage from '@/pages/UsersListPage';
import UserDetailPage from '@/pages/UserDetailPage';
import { QuestionBankPage } from '@/pages/QuestionBankPage';
import { CostDashboardPage } from '@/pages/CostDashboardPage';
import { ConfigEditorPage } from '@/pages/ConfigEditorPage';
import SchoolsListPage from '@/pages/SchoolsListPage';
import SchoolDetailPage from '@/pages/SchoolDetailPage';
import AuditLogPage from '@/pages/AuditLogPage';
import { ComplianceLogPage } from '@/pages/ComplianceLogPage';
import { SchoolDashboardPage } from '@/pages/school/SchoolDashboardPage';
import { TeachersPage } from '@/pages/school/TeachersPage';
import { StudentsPage } from '@/pages/school/StudentsPage';
import { BulkAssignPage } from '@/pages/school/BulkAssignPage';
import { SchoolConfigPage } from '@/pages/school/SchoolConfigPage';

/**
 * Redirects from "/" based on auth state and role.
 * Unauthenticated users go to /login; school_admin goes to /school; everyone
 * else goes to /dashboard.
 */
function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'school_admin') return <Navigate to="/school" replace />;
  return <Navigate to="/dashboard" replace />;
}

/**
 * Defines all application routes.
 *
 * Platform admin routes (/dashboard, /users, etc.) are gated by
 * RequirePlatformAdmin. School admin routes (/school/*) are gated by
 * RequireSchoolAdmin, which also allows platform admins access for
 * auditing purposes.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Platform Admin Routes */}
      <Route element={<RequirePlatformAdmin><AdminLayout /></RequirePlatformAdmin>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersListPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/cost" element={<CostDashboardPage />} />
        <Route path="/config" element={<ConfigEditorPage />} />
        <Route path="/schools" element={<SchoolsListPage />} />
        <Route path="/schools/:id" element={<SchoolDetailPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/compliance-log" element={<ComplianceLogPage />} />
      </Route>

      {/* School Admin Routes */}
      <Route element={<RequireSchoolAdmin><AdminLayout /></RequireSchoolAdmin>}>
        <Route path="/school" element={<SchoolDashboardPage />} />
        <Route path="/school/teachers" element={<TeachersPage />} />
        <Route path="/school/students" element={<StudentsPage />} />
        <Route path="/school/bulk-assign" element={<BulkAssignPage />} />
        <Route path="/school/config" element={<SchoolConfigPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

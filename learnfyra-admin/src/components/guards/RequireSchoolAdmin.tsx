/**
 * @file src/components/guards/RequireSchoolAdmin.tsx
 * @description Convenience route guard that restricts access to any admin role
 * (super_admin | admin | school_admin). Unauthenticated users are redirected
 * to /login.
 */

import { RequireAuth } from './RequireAuth';

/**
 * Restricts a route subtree to any admin role, including school_admin.
 * Platform admins (super_admin | admin) can also access school-admin routes
 * so they can impersonate or audit individual schools.
 *
 * @example
 * <RequireSchoolAdmin><SchoolDashboardPage /></RequireSchoolAdmin>
 */
export function RequireSchoolAdmin({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={['super_admin', 'admin', 'school_admin']}>{children}</RequireAuth>;
}

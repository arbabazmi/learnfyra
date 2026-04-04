/**
 * @file src/components/guards/RequirePlatformAdmin.tsx
 * @description Convenience route guard that restricts access to super_admin
 * and admin roles. school_admin users are redirected to /school.
 */

import { RequireAuth } from './RequireAuth';

/**
 * Restricts a route subtree to platform-level admins (super_admin | admin).
 *
 * @example
 * <RequirePlatformAdmin><CostDashboardPage /></RequirePlatformAdmin>
 */
export function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={['super_admin', 'admin']}>{children}</RequireAuth>;
}

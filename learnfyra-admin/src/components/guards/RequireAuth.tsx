/**
 * @file src/components/guards/RequireAuth.tsx
 * @description Route guard that redirects unauthenticated users to /login.
 * Optionally restricts access to a set of AdminRole values.
 * school_admin users attempting to reach platform-only pages are redirected
 * to /school rather than /login.
 */

import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import type { AdminRole } from '@/types';

interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * When provided, only users whose role appears in this list are allowed through.
   * All other authenticated users are redirected based on their role.
   */
  roles?: AdminRole[];
}

/**
 * Wraps a route subtree with authentication and optional role-based access control.
 *
 * Renders a centered spinner while the auth state is being rehydrated from
 * localStorage to prevent a flash redirect on page reload.
 *
 * @example
 * // Any authenticated admin role:
 * <RequireAuth><DashboardPage /></RequireAuth>
 *
 * @example
 * // Platform admins only:
 * <RequireAuth roles={['super_admin', 'admin']}><UsersPage /></RequireAuth>
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    // Preserve the attempted destination so /login can redirect back after auth.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role as AdminRole)) {
    // school_admin users should land on their own dashboard, not the login page.
    if (user.role === 'school_admin') {
      return <Navigate to="/school" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

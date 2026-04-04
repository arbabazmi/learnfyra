/**
 * @file src/pages/UserDetailPage.tsx
 * @description Single-user detail view. Shows profile data and exposes admin
 * actions: suspend/unsuspend, force logout, role change, and COPPA deletion.
 *
 * Role-change UX: the user selects the new role from an inline dropdown in the
 * Actions card, then clicks "Change Role" which opens a ConfirmModal for final
 * confirmation. This avoids needing children inside ConfirmModal.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Ban, CheckCircle, LogOut, UserCog, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { User } from '@/types';

/** All roles selectable by an admin performing a role change. */
const ASSIGNABLE_ROLES = [
  { value: 'super_admin',  label: 'Super Admin' },
  { value: 'admin',        label: 'Admin' },
  { value: 'school_admin', label: 'School Admin' },
  { value: 'teacher',      label: 'Teacher' },
  { value: 'student',      label: 'Student' },
  { value: 'parent',       label: 'Parent' },
];

/**
 * Renders the full detail view for a single user identified by the :id URL param.
 * Provides suspend/unsuspend, force-logout, role-change, and COPPA delete actions.
 */
export default function UserDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { toast }   = useToast();

  const { data: user, isLoading, refetch } = useApi<User>(
    () => api.getUser(id!),
    [id],
  );

  // Modal visibility flags
  const [suspendModal, setSuspendModal] = useState(false);
  const [logoutModal,  setLogoutModal]  = useState(false);
  const [roleModal,    setRoleModal]    = useState(false);
  const [deleteModal,  setDeleteModal]  = useState(false);

  // The role the admin has chosen in the inline select (defaults to current role)
  const [pendingRole, setPendingRole] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  // ── Action handlers ──────────────────────────────────────────────────────

  /**
   * Toggles suspension state. Calls suspend or unsuspend based on current status.
   */
  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      if (user?.suspended) {
        await api.unsuspendUser(id!);
        toast('User unsuspended', 'success');
      } else {
        await api.suspendUser(id!);
        toast('User suspended', 'success');
      }
      setSuspendModal(false);
      refetch();
    } catch {
      toast('Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Revokes all active sessions for the user via the force-logout endpoint.
   */
  const handleForceLogout = async () => {
    setActionLoading(true);
    try {
      await api.forceLogout(id!);
      toast('User logged out from all sessions', 'success');
      setLogoutModal(false);
    } catch {
      toast('Force logout failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Changes the user's role to `pendingRole`. Requires the role to differ from
   * the current role — the button is disabled otherwise.
   */
  const handleRoleChange = async () => {
    setActionLoading(true);
    try {
      await api.changeUserRole(id!, pendingRole);
      toast('Role updated', 'success');
      setRoleModal(false);
      refetch();
    } catch {
      toast('Role change failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Permanently deletes the user under COPPA compliance rules.
   * Navigates back to the users list on success.
   */
  const handleCoppaDelete = async () => {
    setActionLoading(true);
    try {
      await api.coppaDeleteUser(id!, 'confirmed');
      toast('User deleted (COPPA)', 'success');
      setDeleteModal(false);
      navigate('/users');
    } catch {
      toast('Deletion failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <p className="text-center py-20 text-muted-foreground">User not found</p>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Users
      </button>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{user.name || 'Unnamed User'}</h2>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={user.suspended ? 'destructive' : 'success'}>
            {user.suspended ? 'Suspended' : 'Active'}
          </Badge>
          <Badge variant="default">{user.role}</Badge>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">User ID</dt>
                <dd className="text-sm font-mono mt-0.5 break-all">{user.userId}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="text-sm mt-0.5">{user.role}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Joined</dt>
                <dd className="text-sm mt-0.5">
                  {new Date(user.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last Login</dt>
                <dd className="text-sm mt-0.5">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Generations</dt>
                <dd className="text-sm mt-0.5">{user.generationCount ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Attempts</dt>
                <dd className="text-sm mt-0.5">{user.totalAttempts ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Actions card */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Suspend / Unsuspend */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setSuspendModal(true)}
            >
              {user.suspended ? (
                <><CheckCircle className="size-4" /> Unsuspend</>
              ) : (
                <><Ban className="size-4" /> Suspend</>
              )}
            </Button>

            {/* Force Logout */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setLogoutModal(true)}
            >
              <LogOut className="size-4" /> Force Logout
            </Button>

            {/* Role change — inline select + confirm button */}
            <div className="space-y-2">
              <Select
                value={pendingRole || user.role}
                onChange={e => setPendingRole(e.target.value)}
                aria-label="Select new role"
              >
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setPendingRole(prev => prev || user.role);
                  setRoleModal(true);
                }}
                disabled={!pendingRole || pendingRole === user.role}
              >
                <UserCog className="size-4" /> Change Role
              </Button>
            </div>

            {/* COPPA Delete */}
            <Button
              variant="destructive"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setDeleteModal(true)}
            >
              <Trash2 className="size-4" /> COPPA Delete
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={suspendModal}
        onClose={() => setSuspendModal(false)}
        onConfirm={handleSuspend}
        title={user.suspended ? 'Unsuspend User' : 'Suspend User'}
        description={
          user.suspended
            ? `Re-enable access for ${user.email}?`
            : `Suspend ${user.email}? They will be blocked within 5 minutes.`
        }
        confirmText={user.suspended ? 'Unsuspend' : 'Suspend'}
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmModal
        open={logoutModal}
        onClose={() => setLogoutModal(false)}
        onConfirm={handleForceLogout}
        title="Force Logout"
        description={`This will revoke all sessions for ${user.email}. They will need to sign in again.`}
        confirmText="Force Logout"
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmModal
        open={roleModal}
        onClose={() => setRoleModal(false)}
        onConfirm={handleRoleChange}
        title="Change Role"
        description={`Change role for ${user.email} from "${user.role}" to "${pendingRole || user.role}"?`}
        confirmText="Change Role"
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleCoppaDelete}
        title="COPPA Deletion"
        description={`This permanently deletes ALL data for ${user.email}. This action CANNOT be undone.`}
        confirmText="Delete Permanently"
        confirmValue={user.email}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

/**
 * @file src/pages/UsersListPage.tsx
 * @description Paginated, searchable, filterable list of all platform users.
 * Supports filtering by role and navigates to UserDetailPage on row click.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { User, UsersListResponse, UserRole } from '@/types';

/** Maps each role to a Badge colour variant. */
const roleBadgeVariant: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'muted'
> = {
  super_admin:  'destructive',
  admin:        'warning',
  school_admin: 'default',
  teacher:      'success',
  student:      'muted',
  parent:       'muted',
};

/**
 * Renders the users list with search, role filter, and cursor pagination.
 * Each name cell is a link to /users/:userId.
 */
export default function UsersListPage() {
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const navigate = useNavigate();

  const { data, isLoading } = useApi<UsersListResponse>(
    () =>
      api.getUsers({
        search:     search     || undefined,
        role:       (roleFilter || undefined) as UserRole | undefined,
      }),
    [search, roleFilter],
  );

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <button
          onClick={() => navigate(`/users/${user.userId}`)}
          className="text-sm font-medium text-primary hover:underline text-left"
        >
          {user.name || '—'}
        </button>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => (
        <span className="text-sm text-muted-foreground">{user.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <Badge variant={roleBadgeVariant[user.role] ?? 'muted'}>
          {user.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) =>
        user.suspended ? (
          <Badge variant="destructive">Suspended</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user) => (
        <span className="text-sm text-muted-foreground">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage platform users and roles
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.users ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search by name or email..."
        onSearch={setSearch}
        searchValue={search}
        filters={
          <Select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-40"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="school_admin">School Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </Select>
        }
        hasMore={!!data?.lastKey}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search or filter criteria."
      />
    </div>
  );
}

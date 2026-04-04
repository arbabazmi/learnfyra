/**
 * @file src/pages/AuditLogPage.tsx
 * @description Filterable, read-only audit log of all admin actions across the platform.
 */

import { useState } from 'react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { AuditLogEntry, AuditLogResponse } from '@/types';

const actionColors: Record<string, 'success' | 'warning' | 'destructive' | 'default' | 'muted'> = {
  USER_SUSPENDED: 'destructive',
  USER_UNSUSPENDED: 'success',
  FORCE_LOGOUT: 'warning',
  ROLE_CHANGE: 'warning',
  COPPA_DELETION: 'destructive',
  QUESTION_FLAGGED: 'warning',
  QUESTION_UNFLAGGED: 'success',
  QUESTION_SOFT_DELETED: 'destructive',
  CONFIG_UPDATED: 'default',
  SCHOOL_CREATED: 'success',
  SCHOOL_UPDATED: 'default',
  SCHOOL_ADMIN_ASSIGNED: 'default',
  TEACHER_INVITED: 'success',
  TEACHER_REMOVED: 'warning',
  BULK_ASSIGNMENT_CREATED: 'default',
  SCHOOL_CONFIG_UPDATED: 'default',
};

export function AuditLogPage() {
  const [actorId, setActorId] = useState('');
  const [targetId, setTargetId] = useState('');

  const { data, isLoading } = useApi<AuditLogResponse>(
    () => api.getAuditLog({ actorId: actorId || undefined, targetEntityId: targetId || undefined }),
    [actorId, targetId]
  );

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (e) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (e) => <Badge variant={actionColors[e.action] || 'muted'}>{e.action.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e) => (
        <div>
          <p className="text-xs font-mono">{e.actorId.slice(0, 8)}...</p>
          <p className="text-[10px] text-muted-foreground">{e.actorRole}</p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      render: (e) => (
        <div>
          <p className="text-xs">{e.targetEntityType}</p>
          <p className="text-[10px] font-mono text-muted-foreground">{e.targetEntityId.slice(0, 12)}...</p>
        </div>
      ),
    },
    {
      key: 'changes',
      header: 'Changes',
      render: (e) => (
        <div className="text-xs max-w-xs">
          {e.beforeState && <p className="text-red-600 truncate">- {e.beforeState.slice(0, 50)}</p>}
          {e.afterState && <p className="text-green-600 truncate">+ {e.afterState.slice(0, 50)}</p>}
          {!e.beforeState && !e.afterState && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (e) => <span className="text-xs font-mono text-muted-foreground">{e.ipAddress}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-muted-foreground text-sm mt-1">Immutable record of all admin actions</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        isLoading={isLoading}
        filters={
          <>
            <Input placeholder="Filter by Actor ID..." value={actorId} onChange={e => setActorId(e.target.value)} className="w-48" />
            <Input placeholder="Filter by Target ID..." value={targetId} onChange={e => setTargetId(e.target.value)} className="w-48" />
          </>
        }
        hasMore={!!data?.lastKey}
        emptyTitle="No audit entries"
        emptyDescription="Admin actions will appear here."
      />
    </div>
  );
}

export default AuditLogPage;

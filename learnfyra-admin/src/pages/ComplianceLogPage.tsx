/**
 * @file src/pages/ComplianceLogPage.tsx
 * @description Read-only COPPA/FERPA compliance deletion records. Permanently retained.
 */

import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { ComplianceLogEntry, ComplianceLogResponse, ComplianceStatus } from '@/types';

const statusVariant: Record<ComplianceStatus, 'success' | 'warning' | 'destructive'> = {
  completed: 'success',
  'in-progress': 'warning',
  'partial-failure': 'destructive',
};

export function ComplianceLogPage() {
  const { data, isLoading } = useApi<ComplianceLogResponse>(() => api.getComplianceLog(), []);

  const columns: Column<ComplianceLogEntry>[] = [
    {
      key: 'requestId',
      header: 'Request ID',
      render: (e) => <span className="text-xs font-mono">{e.requestId.slice(0, 12)}...</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (e) => <Badge variant="muted">{e.requestType}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge variant={statusVariant[e.status]}>{e.status}</Badge>,
    },
    {
      key: 'target',
      header: 'Target User',
      render: (e) => <span className="text-xs font-mono">{e.targetUserId.slice(0, 12)}...</span>,
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (e) => <span className="text-xs font-mono">{e.requestedBy.slice(0, 12)}...</span>,
    },
    {
      key: 'started',
      header: 'Started',
      render: (e) => <span className="text-xs text-muted-foreground">{new Date(e.startedAt).toLocaleString()}</span>,
    },
    {
      key: 'completed',
      header: 'Completed',
      render: (e) => e.completedAt
        ? <span className="text-xs text-muted-foreground">{new Date(e.completedAt).toLocaleString()}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'entities',
      header: 'Deleted Entities',
      render: (e) => e.deletedEntities
        ? <div className="flex gap-1 flex-wrap">{e.deletedEntities.map((d, i) => <Badge key={i} variant="muted">{d.entityType}: {d.count}</Badge>)}</div>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'error',
      header: 'Error',
      render: (e) => e.errorState
        ? <span className="text-xs text-destructive">{e.errorState.failedStep}: {e.errorState.errorMessage}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Compliance Log</h2>
        <p className="text-muted-foreground text-sm mt-1">Read-only COPPA deletion records. Permanently retained.</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        isLoading={isLoading}
        emptyTitle="No compliance records"
        emptyDescription="COPPA deletion records will appear here."
      />
    </div>
  );
}

export default ComplianceLogPage;

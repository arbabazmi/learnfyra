/**
 * @file src/pages/ConfigEditorPage.tsx
 * @description Inline editor for platform configuration keys.
 */

import { useState } from 'react';
import { Save, Edit2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { ConfigListResponse, ConfigEntry } from '@/types';

export function ConfigEditorPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useApi<ConfigListResponse>(() => api.getConfig(), []);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const startEdit = (entry: ConfigEntry) => {
    setEditing(entry.configKey);
    setEditValue(typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value));
    setEditReason('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
    setEditReason('');
  };

  const saveEdit = async (entry: ConfigEntry) => {
    setSaving(true);
    try {
      let parsed: unknown = editValue;
      if (entry.type === 'number') parsed = Number(editValue);
      else if (entry.type === 'boolean') parsed = editValue === 'true';
      else if (entry.type === 'string-array') parsed = JSON.parse(editValue);

      await api.updateConfig(entry.configKey, parsed, editReason || 'Updated via admin console');
      toast('Config updated. Changes take effect within 60 seconds.', 'success');
      cancelEdit();
      refetch();
    } catch { toast('Failed to update config', 'error'); }
    finally { setSaving(false); }
  };

  const typeBadge: Record<string, 'default' | 'success' | 'warning' | 'muted'> = {
    string: 'muted',
    number: 'default',
    boolean: 'success',
    'string-enum': 'warning',
    'string-array': 'default',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuration</h2>
        <p className="text-muted-foreground text-sm mt-1">Edit platform configuration. Changes take effect within 60 seconds.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.config ?? []).map(entry => (
                  <TableRow key={entry.configKey}>
                    <TableCell className="font-mono text-xs">{entry.configKey}</TableCell>
                    <TableCell><Badge variant={typeBadge[entry.type] || 'muted'}>{entry.type}</Badge></TableCell>
                    <TableCell>
                      {editing === entry.configKey ? (
                        <div className="space-y-2 max-w-sm">
                          <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="text-xs font-mono" />
                          <Input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Reason for change..." className="text-xs" />
                        </div>
                      ) : (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {typeof entry.value === 'object' ? JSON.stringify(entry.value) : String(entry.value)}
                        </code>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {editing === entry.configKey ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => saveEdit(entry)} loading={saving}><Save className="size-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={cancelEdit}><X className="size-4" /></Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(entry)}><Edit2 className="size-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

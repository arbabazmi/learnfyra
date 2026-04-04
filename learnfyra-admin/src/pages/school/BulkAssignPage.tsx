/**
 * @file src/pages/school/BulkAssignPage.tsx
 * @description Assign a worksheet to multiple classes in one operation.
 * Calls POST /school/bulk-assign and renders per-class success/error results.
 */

import { useState } from 'react';
import { Send, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { BulkAssignResponse } from '@/types';

export function BulkAssignPage() {
  const { toast } = useToast();
  const [worksheetId, setWorksheetId] = useState('');
  const [classIdsInput, setClassIdsInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attempts, setAttempts] = useState('3');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkAssignResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const classIds = classIdsInput.split(',').map(s => s.trim()).filter(Boolean);
    if (!worksheetId || classIds.length === 0 || !dueDate) {
      toast('Please fill all required fields', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.bulkAssign({
        worksheetId,
        classIds,
        dueDate: new Date(dueDate).toISOString(),
        allowedAttempts: Number(attempts),
      });
      setResult(res);
      toast('Bulk assignment completed', 'success');
    } catch { toast('Bulk assignment failed', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bulk Assign</h2>
        <p className="text-muted-foreground text-sm mt-1">Assign a worksheet to multiple classes at once</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Assignment Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="text-sm font-medium">Worksheet ID *</label>
              <Input value={worksheetId} onChange={e => setWorksheetId(e.target.value)} placeholder="Enter worksheet UUID" required />
            </div>
            <div>
              <label className="text-sm font-medium">Class IDs * (comma-separated)</label>
              <Input value={classIdsInput} onChange={e => setClassIdsInput(e.target.value)} placeholder="class-id-1, class-id-2, ..." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Due Date *</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Allowed Attempts</label>
                <Input type="number" min="1" max="10" value={attempts} onChange={e => setAttempts(e.target.value)} />
              </div>
            </div>
            <Button type="submit" loading={submitting}><Send className="size-4" /> Assign</Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader><CardTitle>Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.results.map(r => (
                <div key={r.classId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-mono">{r.classId}</span>
                  {r.status === 'success' ? (
                    <Badge variant="success"><CheckCircle className="size-3 mr-1" /> Success</Badge>
                  ) : (
                    <Badge variant="destructive"><XCircle className="size-3 mr-1" /> {r.error || 'Failed'}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

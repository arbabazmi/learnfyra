/**
 * @file src/pages/school/TeachersPage.tsx
 * @description List teachers linked to the school with invite (code generation)
 * and remove actions. Calls GET /school/teachers, POST /school/teachers/invite,
 * and DELETE /school/teachers/:userId.
 */

import { useState } from 'react';
import { UserPlus, Trash2, Copy, CheckCircle } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { Teacher, InviteTeacherResponse } from '@/types';

export function TeachersPage() {
  const { toast } = useToast();
  const { data: teachers, isLoading, refetch } = useApi<Teacher[]>(() => api.getTeachers(), []);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteTeacherResponse | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Teacher | null>(null);
  const [removing, setRemoving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    setInviting(true);
    try {
      const result = await api.inviteTeacher(inviteNote || undefined);
      setInviteResult(result);
    } catch { toast('Failed to generate invite code', 'error'); }
    finally { setInviting(false); }
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeTeacher(removeTarget.userId);
      toast('Teacher removed from school', 'success');
      setRemoveTarget(null);
      refetch();
    } catch { toast('Failed to remove teacher', 'error'); }
    finally { setRemoving(false); }
  };

  const closeInviteModal = () => {
    setShowInvite(false);
    setInviteNote('');
    setInviteResult(null);
    setCopied(false);
  };

  const columns: Column<Teacher>[] = [
    { key: 'name', header: 'Name', render: (t) => <span className="text-sm font-medium">{t.displayName}</span> },
    { key: 'email', header: 'Email', render: (t) => <span className="text-sm text-muted-foreground">{t.email}</span> },
    { key: 'classes', header: 'Active Classes', render: (t) => <span className="text-sm">{t.activeClassCount}</span> },
    { key: 'joined', header: 'Joined', render: (t) => <span className="text-sm text-muted-foreground">{new Date(t.linkedAt).toLocaleDateString()}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      render: (t) => (
        <Button variant="ghost" size="icon-sm" onClick={() => setRemoveTarget(t)} title="Remove teacher">
          <Trash2 className="size-4 text-red-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Teachers</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your school's teacher roster</p>
        </div>
        <Button onClick={() => setShowInvite(true)}><UserPlus className="size-4" /> Invite Teacher</Button>
      </div>

      <DataTable columns={columns} data={teachers ?? []} isLoading={isLoading} emptyTitle="No teachers yet" emptyDescription="Invite your first teacher to get started." />

      <Modal open={showInvite} onClose={closeInviteModal} title="Invite Teacher" description="Generate an invite code for a teacher to join your school.">
        {inviteResult ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-success-light border border-green-200 p-4 text-center">
              <p className="text-sm text-green-700 mb-2">Share this code with the teacher:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-2xl font-bold tracking-widest text-green-800">{inviteResult.inviteCode}</code>
                <button onClick={() => handleCopy(inviteResult.inviteCode)} className="p-1 rounded hover:bg-green-200">
                  {copied ? <CheckCircle className="size-4 text-green-600" /> : <Copy className="size-4 text-green-600" />}
                </button>
              </div>
              <p className="text-xs text-green-600 mt-2">Expires: {new Date(inviteResult.expiresAt).toLocaleString()}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeInviteModal}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Note (optional)</label>
              <Input value={inviteNote} onChange={e => setInviteNote(e.target.value)} placeholder="e.g., For the new math teacher" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={closeInviteModal}>Cancel</Button>
              <Button onClick={handleInvite} loading={inviting}>Generate Code</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        title="Remove Teacher"
        description={removeTarget ? `Remove ${removeTarget.displayName} from your school? Their account will not be deleted.` : ''}
        confirmText="Remove"
        variant="warning"
        loading={removing}
      />
    </div>
  );
}

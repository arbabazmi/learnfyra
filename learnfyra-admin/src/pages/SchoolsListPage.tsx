/**
 * @file src/pages/SchoolsListPage.tsx
 * @description Paginated list of registered schools with create action.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { School } from '@/types';

const subjects = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];

export function SchoolsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: schools, isLoading, refetch } = useApi<School[]>(() => api.getSchools(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ schoolName: '', minGrade: '1', maxGrade: '10', district: '', activeSubjects: [...subjects] });

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createSchool({
        schoolName: form.schoolName,
        minGrade: Number(form.minGrade),
        maxGrade: Number(form.maxGrade),
        activeSubjects: form.activeSubjects,
        district: form.district || undefined,
      });
      toast('School created', 'success');
      setShowCreate(false);
      setForm({ schoolName: '', minGrade: '1', maxGrade: '10', district: '', activeSubjects: [...subjects] });
      refetch();
    } catch { toast('Failed to create school', 'error'); }
    finally { setCreating(false); }
  };

  const toggleSubject = (s: string) => {
    setForm(prev => ({
      ...prev,
      activeSubjects: prev.activeSubjects.includes(s)
        ? prev.activeSubjects.filter(x => x !== s)
        : [...prev.activeSubjects, s],
    }));
  };

  const columns: Column<School>[] = [
    {
      key: 'name',
      header: 'School Name',
      render: (s) => (
        <button onClick={() => navigate(`/schools/${s.schoolId}`)} className="text-sm font-medium text-primary hover:underline">
          {s.schoolName}
        </button>
      ),
    },
    { key: 'district', header: 'District', render: (s) => <span className="text-sm text-muted-foreground">{s.district || '—'}</span> },
    { key: 'grades', header: 'Grades', render: (s) => <span className="text-sm">{s.minGrade}–{s.maxGrade}</span> },
    {
      key: 'subjects',
      header: 'Subjects',
      render: (s) => <div className="flex gap-1 flex-wrap">{s.activeSubjects.map(sub => <Badge key={sub} variant="muted">{sub}</Badge>)}</div>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <Badge variant={s.status === 'active' ? 'success' : 'muted'}>{s.status}</Badge>,
    },
    {
      key: 'admins',
      header: 'Admins',
      render: (s) => <span className="text-sm">{s.schoolAdminIds.length}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Schools</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage schools and their administrators</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create School</Button>
      </div>

      <DataTable columns={columns} data={schools ?? []} isLoading={isLoading} emptyTitle="No schools yet" emptyDescription="Create your first school to get started." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create School" description="Add a new school to the platform.">
        <div className="space-y-4">
          <div><label className="text-sm font-medium">School Name *</label><Input value={form.schoolName} onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))} placeholder="Enter school name" /></div>
          <div><label className="text-sm font-medium">District</label><Input value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} placeholder="Optional" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Min Grade</label><Select value={form.minGrade} onChange={e => setForm(p => ({ ...p, minGrade: e.target.value }))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}</Select></div>
            <div><label className="text-sm font-medium">Max Grade</label><Select value={form.maxGrade} onChange={e => setForm(p => ({ ...p, maxGrade: e.target.value }))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}</Select></div>
          </div>
          <div>
            <label className="text-sm font-medium">Active Subjects</label>
            <div className="flex gap-2 flex-wrap mt-2">
              {subjects.map(s => (
                <button key={s} onClick={() => toggleSubject(s)} className={`px-3 py-1 text-xs rounded-full border transition-colors ${form.activeSubjects.includes(s) ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.schoolName}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SchoolsListPage;

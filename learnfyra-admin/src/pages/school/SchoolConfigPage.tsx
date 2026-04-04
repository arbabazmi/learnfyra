/**
 * @file src/pages/school/SchoolConfigPage.tsx
 * @description School-scoped configuration: grade range and active subjects.
 * Fetches from GET /school/config and saves via PATCH /school/config.
 */

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { SchoolConfig } from '@/types';

const allSubjects = ['Math', 'ELA', 'Science', 'Social Studies', 'Health'];

export function SchoolConfigPage() {
  const { toast } = useToast();
  const { data: config, isLoading, refetch } = useApi<SchoolConfig>(() => api.getSchoolConfig(), []);
  const [minGrade, setMinGrade] = useState('1');
  const [maxGrade, setMaxGrade] = useState('10');
  const [activeSubjects, setActiveSubjects] = useState<string[]>([...allSubjects]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setMinGrade(String(config.minGrade));
      setMaxGrade(String(config.maxGrade));
      setActiveSubjects(config.activeSubjects);
    }
  }, [config]);

  const toggleSubject = (s: string) => {
    setActiveSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleSave = async () => {
    if (Number(minGrade) > Number(maxGrade)) {
      toast('Min grade cannot exceed max grade', 'error');
      return;
    }
    if (activeSubjects.length === 0) {
      toast('At least one subject required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.updateSchoolConfig({ minGrade: Number(minGrade), maxGrade: Number(maxGrade), activeSubjects });
      toast('School settings updated', 'success');
      refetch();
    } catch { toast('Failed to update settings', 'error'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">School Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">Configure grade range and active subjects for your school</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{config?.schoolName || 'School'} Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-6 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Grade</label>
                <Select value={minGrade} onChange={e => setMinGrade(e.target.value)}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Max Grade</label>
                <Select value={maxGrade} onChange={e => setMaxGrade(e.target.value)}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Active Subjects</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {allSubjects.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleSubject(s)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${activeSubjects.includes(s) ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} loading={saving}><Save className="size-4" /> Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

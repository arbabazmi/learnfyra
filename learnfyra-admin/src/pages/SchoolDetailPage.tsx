/**
 * @file src/pages/SchoolDetailPage.tsx
 * @description Single-school detail view showing configuration, subjects, and assigned admins.
 */

import { useParams, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { School } from '@/types';

export function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: school, isLoading } = useApi<School>(() => api.getSchool(id!), [id]);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!school) return <p className="text-center py-20 text-muted-foreground">School not found</p>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/schools')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Schools
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{school.schoolName}</h2>
          <p className="text-muted-foreground text-sm">{school.district || 'No district'}</p>
        </div>
        <Badge variant={school.status === 'active' ? 'success' : 'muted'}>{school.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div><dt className="text-xs text-muted-foreground">School ID</dt><dd className="text-sm font-mono">{school.schoolId}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Grade Range</dt><dd className="text-sm">{school.minGrade} – {school.maxGrade}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="text-sm">{new Date(school.createdAt).toLocaleDateString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Address</dt><dd className="text-sm">{school.address || '—'}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subjects & Admins</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Active Subjects</p>
              <div className="flex gap-1 flex-wrap">
                {school.activeSubjects.map(s => <Badge key={s} variant="default">{s}</Badge>)}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">School Admins ({school.schoolAdminIds.length})</p>
              {school.schoolAdminIds.length > 0 ? (
                <div className="space-y-1">
                  {school.schoolAdminIds.map(adminId => (
                    <p key={adminId} className="text-sm font-mono bg-muted px-2 py-1 rounded">{adminId}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No admins assigned</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SchoolDetailPage;

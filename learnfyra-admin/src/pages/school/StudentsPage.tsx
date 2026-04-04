/**
 * @file src/pages/school/StudentsPage.tsx
 * @description Deduplicated student roster across all school classes.
 * Fetches from GET /school/students and renders a read-only DataTable.
 */

import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { Student } from '@/types';

export function StudentsPage() {
  const { data: students, isLoading } = useApi<Student[]>(() => api.getStudents(), []);

  const columns: Column<Student>[] = [
    { key: 'name', header: 'Name', render: (s) => <span className="text-sm font-medium">{s.displayName}</span> },
    { key: 'grade', header: 'Grade', render: (s) => <Badge variant="muted">Grade {s.grade}</Badge> },
    { key: 'classes', header: 'Classes', render: (s) => <span className="text-sm">{s.classMembershipCount}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Students</h2>
        <p className="text-muted-foreground text-sm mt-1">Deduplicated student roster across all school classes</p>
      </div>

      <DataTable
        columns={columns}
        data={students ?? []}
        isLoading={isLoading}
        emptyTitle="No students found"
        emptyDescription="Students will appear here once enrolled in classes."
      />
    </div>
  );
}

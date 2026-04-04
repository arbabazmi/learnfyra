/**
 * @file src/pages/school/SchoolDashboardPage.tsx
 * @description School admin overview: subject accuracy, grade accuracy, weak areas,
 * and teacher completion rates. Fetches from GET /school/analytics.
 */

import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { SchoolAnalytics } from '@/types';

export function SchoolDashboardPage() {
  const { data, isLoading } = useApi<SchoolAnalytics>(() => api.getSchoolAnalytics(), []);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!data) return <p className="text-center py-20 text-muted-foreground">No analytics data available</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">School Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">Performance analytics for your school</p>
      </div>

      {/* Subject Accuracy */}
      <Card>
        <CardHeader><CardTitle>Accuracy by Subject</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.subjectAccuracy).map(([subject, accuracy]) => (
              <div key={subject} className="flex items-center gap-4">
                <span className="text-sm w-28 shrink-0">{subject}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${accuracy >= 60 ? 'bg-secondary' : 'bg-destructive'}`}
                    style={{ width: `${Math.min(accuracy, 100)}%` }}
                  />
                </div>
                <span className={`text-sm font-medium w-12 text-right ${accuracy < 60 ? 'text-destructive' : ''}`}>
                  {accuracy.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grade Accuracy */}
        <Card>
          <CardHeader><CardTitle>Accuracy by Grade</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.gradeAccuracy)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([grade, accuracy]) => (
                  <div key={grade} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-sm">Grade {grade}</span>
                    <Badge variant={accuracy >= 60 ? 'success' : 'destructive'}>{accuracy.toFixed(0)}%</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Weak Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" /> Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.weakAreas.length > 0 ? (
              <div className="space-y-2">
                {data.weakAreas.map((area, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-sm">{area.subject} — Grade {area.grade}</span>
                    <Badge variant="destructive">{area.accuracy.toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">All areas above threshold</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Teacher Completion */}
      <Card>
        <CardHeader><CardTitle>Teacher Completion Rates</CardTitle></CardHeader>
        <CardContent>
          {data.teacherCompletionRates.length > 0 ? (
            <div className="space-y-3">
              {data.teacherCompletionRates.map(t => (
                <div key={t.teacherId} className="flex items-center gap-4">
                  <span className="text-sm w-40 truncate shrink-0">{t.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(t.rate * 100, 100)}%` }} />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{(t.rate * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No teacher data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

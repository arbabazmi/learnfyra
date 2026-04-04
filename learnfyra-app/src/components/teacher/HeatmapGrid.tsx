/**
 * @file src/components/teacher/HeatmapGrid.tsx
 * @description Color-coded topic x student accuracy heatmap.
 * Cells are colored from red (low accuracy) to green (high accuracy).
 * Null cells (no attempts) are rendered as a neutral grey.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeacher } from '@/contexts/TeacherContext';

// ── Color scale ────────────────────────────────────────────────────────────

function accuracyToColor(accuracy: number | null): string {
  if (accuracy === null) return 'bg-muted text-muted-foreground';
  if (accuracy >= 80) return 'bg-secondary text-white';
  if (accuracy >= 60) return 'bg-accent text-accent-foreground';
  if (accuracy >= 40) return 'bg-orange-400 text-white';
  return 'bg-destructive text-white';
}

function accuracyLabel(accuracy: number | null): string {
  if (accuracy === null) return '—';
  return `${Math.round(accuracy)}%`;
}

// ── Component ──────────────────────────────────────────────────────────────

const HeatmapGrid: React.FC = () => {
  const { heatmap, loadingHeatmap, fetchHeatmap } = useTeacher();

  React.useEffect(() => {
    void fetchHeatmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingHeatmap) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!heatmap || heatmap.students.length === 0 || heatmap.topics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Not enough data to render the heatmap yet.
        </p>
      </div>
    );
  }

  // Build a lookup map: [studentId][topic] -> accuracy
  const lookup = new Map<string, Map<string, number | null>>();
  for (const cell of heatmap.cells) {
    if (!lookup.has(cell.studentId)) {
      lookup.set(cell.studentId, new Map());
    }
    lookup.get(cell.studentId)!.set(cell.topic, cell.accuracy);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
        Accuracy Heatmap
      </h3>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs font-semibold">
        <span className="text-muted-foreground">Score:</span>
        {[
          { label: '80%+', color: 'bg-secondary' },
          { label: '60–79%', color: 'bg-accent' },
          { label: '40–59%', color: 'bg-orange-400' },
          { label: '<40%', color: 'bg-destructive' },
          { label: 'No data', color: 'bg-muted' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={cn('w-3 h-3 rounded-sm shrink-0', color)} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Grid — horizontally scrollable on small screens */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table
          className="text-xs min-w-full"
          aria-label="Accuracy heatmap"
        >
          <thead>
            <tr className="bg-surface border-b border-border">
              {/* Student name column header */}
              <th
                className="px-4 py-3 text-left font-bold text-muted-foreground sticky left-0 bg-surface z-10 min-w-[140px]"
                scope="col"
              >
                Student
              </th>
              {heatmap.topics.map((topic) => (
                <th
                  key={topic}
                  className="px-3 py-3 text-center font-bold text-muted-foreground max-w-[100px]"
                  scope="col"
                >
                  <span
                    className="block truncate"
                    title={topic}
                  >
                    {topic}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {heatmap.students.map((student) => {
              const studentMap = lookup.get(student.studentId);
              return (
                <tr key={student.studentId} className="bg-white hover:bg-surface transition-colors">
                  {/* Student name */}
                  <th
                    className="px-4 py-2.5 text-left font-semibold text-foreground sticky left-0 bg-white z-10"
                    scope="row"
                  >
                    {student.displayName}
                  </th>
                  {/* Accuracy cells */}
                  {heatmap.topics.map((topic) => {
                    const acc = studentMap?.get(topic) ?? null;
                    return (
                      <td
                        key={topic}
                        className="px-3 py-2.5 text-center"
                        title={`${student.displayName} — ${topic}: ${accuracyLabel(acc)}`}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-12 h-7 rounded-lg text-[11px] font-bold transition-colors',
                            accuracyToColor(acc),
                          )}
                        >
                          {accuracyLabel(acc)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { HeatmapGrid };

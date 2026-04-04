/**
 * @file src/components/parent/NeedsAttention.tsx
 * @description List of topics where the child's accuracy is below the
 * recommended threshold — highlights areas needing extra practice.
 */

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useParent } from '@/contexts/ParentContext';

const NeedsAttention: React.FC = () => {
  const { childProgress, loadingProgress, fetchChildProgress } = useParent();

  React.useEffect(() => {
    void fetchChildProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadingProgress) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!childProgress) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No data available yet.
      </p>
    );
  }

  const topics = childProgress.needsAttention;

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">
        Needs Attention
      </h3>

      {topics.length === 0 ? (
        <div className="rounded-2xl border border-border bg-success-light p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-secondary">
            Great work! No topics need extra attention right now.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Topics needing attention">
          {topics.map((t) => (
            <li
              key={t.topic}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 hover:bg-surface transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-4 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {t.topic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.attemptCount} attempt{t.attemptCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Badge
                variant={t.currentAccuracy < 50 ? 'destructive' : 'warning'}
              >
                {Math.round(t.currentAccuracy)}% accuracy
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { NeedsAttention };

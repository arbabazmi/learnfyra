/**
 * @file src/components/dashboard/StatsRow.tsx
 * @description 4-card stats grid. Shows skeleton while loading.
 * In guest mode, each card has a subtle "SAMPLE" watermark.
 */

import * as React from 'react';
import { CheckCircle, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import type { DashboardStats } from '@/types/dashboard';

export interface StatsRowProps {
  stats: DashboardStats;
  isLoading: boolean;
  isGuest?: boolean;
}

interface StatCardConfig {
  label: string;
  value: string;
  Icon: React.ElementType;
  color: string;
}

function buildStatCards(stats: DashboardStats): StatCardConfig[] {
  return [
    { label: 'Worksheets Done', value: String(stats.worksheetsDone), Icon: CheckCircle, color: '#3D9AE8' },
    { label: 'In Progress', value: String(stats.inProgress), Icon: Clock, color: '#F5C534' },
    { label: 'Best Score', value: `${stats.bestScore}%`, Icon: TrendingUp, color: '#6DB84B' },
    { label: 'Total Study Time', value: stats.studyTime, Icon: BarChart3, color: '#f97316' },
  ];
}

const StatsRow: React.FC<StatsRowProps> = ({ stats, isLoading, isGuest = false }) => {
  const cards = buildStatCards(stats);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const { label, value, Icon, color } = card;

        if (isLoading) {
          return (
            <div key={label} className="bg-white rounded-2xl border border-border p-5 shadow-card" aria-busy="true">
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse mb-3" />
              <div className="h-7 w-16 rounded-lg bg-muted animate-pulse mb-1.5" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
          );
        }

        return (
          <div key={label} className="relative bg-white rounded-2xl border border-border p-5 shadow-card overflow-hidden">
            {/* Guest watermark */}
            {isGuest && (
              <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 select-none" aria-hidden="true">
                Sample
              </span>
            )}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${color}18` }}
            >
              <Icon className="size-5" style={{ color }} aria-hidden="true" />
            </div>
            <div className="text-2xl font-extrabold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        );
      })}
    </div>
  );
};

StatsRow.displayName = 'StatsRow';

export { StatsRow };

/**
 * @file src/pages/DashboardPage.tsx
 * @description Platform admin dashboard showing aggregate stats and a recent
 * activity feed. Fetches from GET /api/admin/dashboard via the api client.
 */
import { Users, FileText, School, Activity } from 'lucide-react';
import { StatsCard } from '@/components/ui/StatsCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';

/**
 * Renders platform-level overview cards and a recent activity list.
 * Automatically re-fetches when the component mounts.
 */
export default function DashboardPage() {
  const { data, isLoading } = useApi<DashboardStats>(() => api.getDashboardStats(), []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const stats = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Platform Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">Key metrics at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers ?? '—'}
          icon={Users}
        />
        <StatsCard
          title="Worksheets Generated"
          value={stats?.totalGenerations ?? '—'}
          icon={FileText}
        />
        <StatsCard
          title="Schools"
          value={stats?.totalSchools ?? '—'}
          icon={School}
        />
        <StatsCard
          title="Active Today"
          value={stats?.activeToday ?? '—'}
          icon={Activity}
        />
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div className="space-y-0">
              {stats.recentActivity.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="muted" className="shrink-0">
                      {item.type}
                    </Badge>
                    <span className="text-sm truncate">{item.description}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

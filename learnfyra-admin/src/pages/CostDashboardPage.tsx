/**
 * @file src/pages/CostDashboardPage.tsx
 * @description Token usage and cost estimates across time windows.
 */

import { useState } from 'react';
import { Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatsCard } from '@/components/ui/StatsCard';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { CostDashboardResponse, CostWindow, TopExpensiveRequest } from '@/types';

const windows: { value: CostWindow; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export function CostDashboardPage() {
  const [window, setWindow] = useState<CostWindow>('7d');

  const { data: costData, isLoading: costLoading } = useApi<CostDashboardResponse>(
    () => api.getCostDashboard(window), [window]
  );
  const { data: topExpensive, isLoading: topLoading } = useApi<TopExpensiveRequest[]>(
    () => api.getTopExpensiveRequests(), []
  );

  const formatCost = (cost: number | null) => cost === null ? 'N/A' : `$${cost.toFixed(4)}`;
  const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cost Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">AI token usage and cost monitoring</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {windows.map(w => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${window === w.value ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {costLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : costData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Tokens" value={formatTokens(costData.totalTokens)} icon={Zap} />
            <StatsCard title="Total Generations" value={costData.totalGenerations} icon={TrendingUp} />
            <StatsCard
              title="Success Rate"
              value={`${(costData.successRate * 100).toFixed(1)}%`}
              icon={costData.successRate >= 0.95 ? TrendingUp : AlertCircle}
            />
            <StatsCard title="Failure Rate" value={`${(costData.failureRate * 100).toFixed(1)}%`} icon={AlertCircle} />
          </div>

          <Card>
            <CardHeader><CardTitle>Cost by Model</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Estimated Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(costData.costEstimateByModel).map(([model, cost]) => (
                    <TableRow key={model}>
                      <TableCell className="font-mono text-sm">{model}</TableCell>
                      <TableCell className="text-right">{formatCost(cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Top 10 Most Expensive Requests</CardTitle></CardHeader>
        <CardContent>
          {topLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : topExpensive && topExpensive.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topExpensive.map(req => (
                  <TableRow key={req.requestId}>
                    <TableCell className="font-mono text-xs">{req.model}</TableCell>
                    <TableCell>{req.subject}</TableCell>
                    <TableCell>{req.grade}</TableCell>
                    <TableCell className="text-right">{formatTokens(req.tokensUsed)}</TableCell>
                    <TableCell className="text-right">{formatCost(req.estimatedCost)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

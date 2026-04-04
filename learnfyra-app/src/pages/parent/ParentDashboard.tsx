/**
 * @file src/pages/parent/ParentDashboard.tsx
 * @description Parent dashboard — wraps ParentContext.Provider.
 * Child switcher is at the TOP level per FRD requirement.
 * Tab navigation: Activity | Assignments | Needs Attention.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { Plus, Activity, ClipboardList, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { ChildSwitcher } from '@/components/parent/ChildSwitcher';
import { ActivitySummary } from '@/components/parent/ActivitySummary';
import { ChildAssignments } from '@/components/parent/ChildAssignments';
import { NeedsAttention } from '@/components/parent/NeedsAttention';
import { ParentProvider, useParent } from '@/contexts/ParentContext';
import { cn } from '@/lib/utils';
import { usePageMeta } from '@/lib/pageMeta';

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'activity' | 'assignments' | 'needs-attention';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'activity',        label: 'Activity',        icon: Activity },
  { id: 'assignments',     label: 'Assignments',     icon: ClipboardList },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle },
];

// ── Inner dashboard (consumes ParentContext) ───────────────────────────────

const ParentDashboardInner: React.FC = () => {
  const { children, currentChildId, loadingChildren } = useParent();
  const [activeTab, setActiveTab] = React.useState<Tab>('activity');

  const hasChildren = children.length > 0;

  return (
    <AppLayout pageTitle="Parent Dashboard">
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── TOP: Child switcher — FRD required at top level ───────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <ChildSwitcher />
          <Button variant="outline" size="sm" asChild>
            <Link to="/parent/link">
              <Plus className="size-4" />
              Link Child
            </Link>
          </Button>
        </div>

        {/* ── No children empty state ────────────────────────────────────── */}
        {!loadingChildren && !hasChildren && (
          <section
            className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-4"
            aria-label="No children linked"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
              <Plus className="size-7 text-primary" />
            </div>
            <h2 className="text-xl font-extrabold text-foreground">
              Link your child's account
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Ask your child's teacher for a parent invite code, or use the
              invite your child generated from their account.
            </p>
            <Button variant="primary" size="lg" asChild>
              <Link to="/parent/link">
                <Plus className="size-5" />
                Link Child
              </Link>
            </Button>
          </section>
        )}

        {/* ── Tabs (only shown when a child is selected) ────────────────── */}
        {currentChildId && (
          <>
            {/* Tab bar */}
            <nav
              className="flex gap-1 bg-surface border border-border rounded-xl p-1 overflow-x-auto"
              aria-label="Parent dashboard sections"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150',
                      active
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/50',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Tab content */}
            <div role="tabpanel" aria-label={activeTab}>
              {activeTab === 'activity' && <ActivitySummary />}
              {activeTab === 'assignments' && <ChildAssignments />}
              {activeTab === 'needs-attention' && <NeedsAttention />}
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
};

// ── Page export — wraps with provider ─────────────────────────────────────

const ParentDashboard: React.FC = () => {
  usePageMeta({
    title: 'Parent Dashboard',
    description:
      'Monitor your child\'s Learnfyra progress, assignments, and areas needing attention.',
    keywords:
      'parent dashboard, child progress, school assignments, learning tracker',
  });

  return (
    <ParentProvider>
      <ParentDashboardInner />
    </ParentProvider>
  );
};

export default ParentDashboard;

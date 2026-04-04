/**
 * @file src/pages/teacher/TeacherDashboard.tsx
 * @description Teacher dashboard — wraps TeacherContext.Provider.
 * Tab navigation: Assignments | Analytics | Review Queue | Students.
 * Class switcher is always visible at the top.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { Plus, ClipboardList, BarChart3, AlertCircle, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ClassSwitcher } from '@/components/teacher/ClassSwitcher';
import { AssignmentList } from '@/components/teacher/AssignmentList';
import { AssignmentCreateForm } from '@/components/teacher/AssignmentCreateForm';
import { AnalyticsOverview } from '@/components/teacher/AnalyticsOverview';
import { HeatmapGrid } from '@/components/teacher/HeatmapGrid';
import { ReviewQueuePanel } from '@/components/teacher/ReviewQueuePanel';
import { StudentRoster } from '@/components/teacher/StudentRoster';
import { TeacherProvider, useTeacher } from '@/contexts/TeacherContext';
import { cn } from '@/lib/utils';
import { usePageMeta } from '@/lib/pageMeta';

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'assignments' | 'analytics' | 'review' | 'students';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'analytics',   label: 'Analytics',   icon: BarChart3 },
  { id: 'review',      label: 'Review Queue', icon: AlertCircle },
  { id: 'students',    label: 'Students',     icon: Users },
];

// ── Inner dashboard (consumes TeacherContext) ──────────────────────────────

const TeacherDashboardInner: React.FC = () => {
  const { classes, currentClassId, reviewPendingCount } = useTeacher();
  const [activeTab, setActiveTab] = React.useState<Tab>('assignments');
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const hasClasses = classes.length > 0;

  return (
    <AppLayout pageTitle="Teacher Dashboard">
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── Top bar: class switcher + new class CTA ────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <ClassSwitcher />
          <Button variant="outline" size="sm" asChild>
            <Link to="/teacher/class/new">
              <Plus className="size-4" />
              New Class
            </Link>
          </Button>
        </div>

        {/* ── No classes empty state ─────────────────────────────────────── */}
        {!hasClasses && (
          <section
            className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-4"
            aria-label="No classes yet"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto">
              <Users className="size-7 text-primary" />
            </div>
            <h2 className="text-xl font-extrabold text-foreground">
              Create your first class
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Set up a class, share the invite code with students, and start
              assigning worksheets.
            </p>
            <Button variant="primary" size="lg" asChild>
              <Link to="/teacher/class/new">
                <Plus className="size-5" />
                Create Class
              </Link>
            </Button>
          </section>
        )}

        {/* ── Tabs (only shown when a class is selected) ────────────────── */}
        {currentClassId && (
          <>
            {/* Tab bar */}
            <nav
              className="flex gap-1 bg-surface border border-border rounded-xl p-1 overflow-x-auto"
              aria-label="Dashboard sections"
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
                    {tab.id === 'review' && reviewPendingCount > 0 && (
                      <Badge variant="warning" className="ml-1 px-1.5 py-0 text-[10px]">
                        {reviewPendingCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Tab content */}
            <div role="tabpanel" aria-label={activeTab}>
              {/* Assignments */}
              {activeTab === 'assignments' && !showCreateForm && (
                <AssignmentList onCreateClick={() => setShowCreateForm(true)} />
              )}

              {activeTab === 'assignments' && showCreateForm && (
                <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-foreground">
                      New Assignment
                    </h3>
                  </div>
                  <AssignmentCreateForm
                    onSuccess={() => setShowCreateForm(false)}
                    onCancel={() => setShowCreateForm(false)}
                  />
                </div>
              )}

              {/* Analytics */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <AnalyticsOverview />
                  <HeatmapGrid />
                </div>
              )}

              {/* Review queue */}
              {activeTab === 'review' && <ReviewQueuePanel />}

              {/* Students */}
              {activeTab === 'students' && <StudentRoster />}
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
};

// ── Page export — wraps with provider ─────────────────────────────────────

const TeacherDashboard: React.FC = () => {
  usePageMeta({
    title: 'Teacher Dashboard',
    description:
      'Manage your classes, assignments, and student progress from the Learnfyra teacher dashboard.',
    keywords: 'teacher dashboard, class management, assignments, student progress',
  });

  return (
    <TeacherProvider>
      <TeacherDashboardInner />
    </TeacherProvider>
  );
};

export default TeacherDashboard;

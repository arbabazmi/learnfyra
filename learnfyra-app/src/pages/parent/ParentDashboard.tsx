/**
 * @file src/pages/parent/ParentDashboard.tsx
 * @description Parent dashboard — wraps ParentContext.Provider.
 * Child switcher is at the TOP level per FRD requirement.
 * Tab navigation: Activity | Assignments | Needs Attention.
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Plus,
  Activity,
  ClipboardList,
  AlertTriangle,
  Shield,
  Download,
  XCircle,
  CheckCircle,
  Loader2,
  AlertCircle,
  GraduationCap,
  Play,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChildSwitcher } from '@/components/parent/ChildSwitcher';
import { ActivitySummary } from '@/components/parent/ActivitySummary';
import { ChildAssignments } from '@/components/parent/ChildAssignments';
import { NeedsAttention } from '@/components/parent/NeedsAttention';
import { ParentProvider, useParent } from '@/contexts/ParentContext';
import { cn } from '@/lib/utils';
import { usePageMeta } from '@/lib/pageMeta';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';
import { startChildSession } from '@/services/api/parentService';
import type { ChildSummary } from '@/types/parent';

// ── Tab definitions ────────────────────────────────────────────────────────

type Tab = 'activity' | 'assignments' | 'needs-attention' | 'privacy';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'activity',        label: 'Activity',        icon: Activity },
  { id: 'assignments',     label: 'Assignments',     icon: ClipboardList },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle },
  { id: 'privacy',         label: 'Privacy',         icon: Shield },
];

// ── Privacy controls panel ─────────────────────────────────────────────────

interface ConsentStatus {
  consentGrantedAt: string | null;
  consentStatus: 'active' | 'revoked' | 'pending' | null;
}

interface PrivacyPanelProps {
  child: ChildSummary & { consentStatus?: ConsentStatus };
}

const PrivacyPanel: React.FC<PrivacyPanelProps> = ({ child }) => {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isStartingSession, setIsStartingSession] = React.useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = React.useState(false);
  const [actionSuccess, setActionSuccess] = React.useState('');
  const [actionError, setActionError] = React.useState('');

  const handleStartSession = async () => {
    setIsStartingSession(true);
    setActionError('');
    try {
      const result = await startChildSession(child.studentId);
      // COPPA: Child tokens stored in sessionStorage (NOT localStorage) — cleared when tab closes
      sessionStorage.setItem('learnfyra_child_token', result.childAccessToken);
      sessionStorage.setItem(
        'learnfyra_child_session',
        JSON.stringify({
          childUserId: result.childUserId,
          childName: result.childName,
          role: result.role,
          ageGroup: result.ageGroup,
          parentId: result.parentId,
        }),
      );
      navigate('/dashboard');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start session. Please try again.');
    } finally {
      setIsStartingSession(false);
    }
  };

  // Approximate consent status from ChildSummary.linkedAt (real data comes from API)
  const consentGrantedAt = child.linkedAt ?? null;
  const consentActive = true; // default until API provides real status

  const handleDownload = async () => {
    setIsDownloading(true);
    setActionError('');
    const token = getAuthToken();
    try {
      const res = await fetch(`${apiUrl}/api/parent/children/${child.studentId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError((data as { error?: string }).error || 'Export failed. Please try again.');
        return;
      }
      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `learnfyra-data-${child.displayName.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionSuccess('Data exported successfully.');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    setActionError('');
    const token = getAuthToken();
    try {
      const res = await fetch(`${apiUrl}/api/parent/children/${child.studentId}/revoke-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError((data as { error?: string }).error || 'Revoke failed. Please try again.');
        return;
      }
      setShowRevokeConfirm(false);
      setActionSuccess('Consent revoked. The account has been suspended.');
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Child identity + consent status card */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
            <GraduationCap className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-extrabold text-foreground">{child.displayName}</p>
            {child.gradeLevel && (
              <p className="text-xs text-muted-foreground mt-0.5">Grade {child.gradeLevel}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={consentActive ? 'success' : 'destructive'}>
                {consentActive ? 'Consent active' : 'Consent revoked'}
              </Badge>
              {consentGrantedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Linked {new Date(consentGrantedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={handleStartSession}
            disabled={isStartingSession || !consentActive}
          >
            {isStartingSession ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                Start Session
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Action feedback */}
      {actionSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success-light border border-secondary/20">
          <CheckCircle className="size-4 text-secondary shrink-0" />
          <p className="text-sm font-semibold text-secondary">{actionSuccess}</p>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-semibold">{actionError}</p>
        </div>
      )}

      {/* Download data */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
              <Download className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Download Child's Data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Export all worksheets, scores, and activity for {child.displayName} as a JSON file.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Revoke consent */}
      <div className="bg-white rounded-2xl border border-destructive/30 shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="size-4 text-destructive shrink-0" />
          <span className="text-xs font-bold text-destructive uppercase tracking-widest">Danger Zone</span>
        </div>

        {!showRevokeConfirm ? (
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                <XCircle className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Revoke Consent</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Revoke parental consent and suspend {child.displayName}'s account. This can be re-granted later.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setShowRevokeConfirm(true)}
            >
              <XCircle className="size-3.5" />
              Revoke Consent
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground font-semibold">
              Are you sure you want to revoke consent for{' '}
              <span className="text-destructive">{child.displayName}</span>? Their account will be suspended.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevoke}
                disabled={isRevoking}
              >
                {isRevoking ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  'Yes, Revoke Consent'
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeConfirm(false)}
                disabled={isRevoking}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// ── Inner dashboard (consumes ParentContext) ───────────────────────────────

const ParentDashboardInner: React.FC = () => {
  const { children, currentChildId, loadingChildren } = useParent();
  const [activeTab, setActiveTab] = React.useState<Tab>('activity');

  const currentChild = children.find((c) => c.studentId === currentChildId) ?? null;

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
              {activeTab === 'privacy' && currentChild && (
                <PrivacyPanel child={currentChild} />
              )}
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

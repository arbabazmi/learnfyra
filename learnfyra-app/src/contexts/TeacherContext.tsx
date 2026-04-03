/**
 * @file src/contexts/TeacherContext.tsx
 * @description Teacher context — provides class list, selected class,
 * assignments, review queue, and analytics state to the teacher dashboard.
 *
 * Loaded lazily — only mounted when the authenticated user has role = teacher.
 */

import * as React from 'react';
import * as teacherService from '@/services/api/teacherService';
import type {
  Class,
  Assignment,
  ReviewQueueItem,
  AnalyticsOverview,
  HeatmapData,
} from '@/types/teacher';

// ── State shape ────────────────────────────────────────────────────────────

interface TeacherState {
  /** The currently selected class ID, or null if none selected. */
  currentClassId: string | null;
  /** All classes owned by this teacher. */
  classes: Class[];
  /** Assignments for the currently selected class. */
  assignments: Assignment[];
  /** Pending review items for the currently selected class. */
  reviewQueue: ReviewQueueItem[];
  /** Pending review count for the currently selected class. */
  reviewPendingCount: number;
  /** Analytics overview for the currently selected class. */
  analytics: AnalyticsOverview | null;
  /** Heatmap data for the currently selected class. */
  heatmap: HeatmapData | null;

  /** Loading flags — granular to avoid full-page spinners. */
  loadingClasses: boolean;
  loadingAssignments: boolean;
  loadingReviewQueue: boolean;
  loadingAnalytics: boolean;
  loadingHeatmap: boolean;

  /** Error messages per domain. */
  errorClasses: string | null;
  errorAssignments: string | null;
  errorReviewQueue: string | null;
  errorAnalytics: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Fetch (or refresh) the full list of teacher's classes. */
  fetchClasses: () => Promise<void>;
  /** Set the active class and trigger downstream data loads. */
  selectClass: (classId: string) => void;
  /** Fetch assignments for the currently selected class. */
  fetchAssignments: () => Promise<void>;
  /** Fetch the review queue for the currently selected class. */
  fetchReviewQueue: () => Promise<void>;
  /** Fetch analytics overview for the currently selected class. */
  fetchAnalytics: () => Promise<void>;
  /** Fetch heatmap data for the currently selected class. */
  fetchHeatmap: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const TeacherContext = React.createContext<TeacherState | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

const TeacherProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentClassId, setCurrentClassId] = React.useState<string | null>(
    null,
  );
  const [classes, setClasses] = React.useState<Class[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [reviewQueue, setReviewQueue] = React.useState<ReviewQueueItem[]>([]);
  const [reviewPendingCount, setReviewPendingCount] = React.useState(0);
  const [analytics, setAnalytics] = React.useState<AnalyticsOverview | null>(
    null,
  );
  const [heatmap, setHeatmap] = React.useState<HeatmapData | null>(null);

  const [loadingClasses, setLoadingClasses] = React.useState(false);
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);
  const [loadingReviewQueue, setLoadingReviewQueue] = React.useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(false);
  const [loadingHeatmap, setLoadingHeatmap] = React.useState(false);

  const [errorClasses, setErrorClasses] = React.useState<string | null>(null);
  const [errorAssignments, setErrorAssignments] = React.useState<string | null>(
    null,
  );
  const [errorReviewQueue, setErrorReviewQueue] = React.useState<string | null>(
    null,
  );
  const [errorAnalytics, setErrorAnalytics] = React.useState<string | null>(
    null,
  );

  // ── fetchClasses ──────────────────────────────────────────────────────────

  const fetchClasses = React.useCallback(async () => {
    setLoadingClasses(true);
    setErrorClasses(null);
    try {
      const data = await teacherService.getClasses();
      setClasses(data);
      // Auto-select the first active class if none is selected
      if (!currentClassId) {
        const first = data.find((c) => c.status === 'active') ?? data[0];
        if (first) setCurrentClassId(first.classId);
      }
    } catch (err) {
      setErrorClasses(
        err instanceof Error ? err.message : 'Failed to load classes.',
      );
    } finally {
      setLoadingClasses(false);
    }
  }, [currentClassId]);

  // ── selectClass ───────────────────────────────────────────────────────────

  const selectClass = React.useCallback((classId: string) => {
    setCurrentClassId(classId);
    // Clear stale data from the previous class
    setAssignments([]);
    setReviewQueue([]);
    setReviewPendingCount(0);
    setAnalytics(null);
    setHeatmap(null);
  }, []);

  // ── fetchAssignments ──────────────────────────────────────────────────────

  const fetchAssignments = React.useCallback(async () => {
    if (!currentClassId) return;
    setLoadingAssignments(true);
    setErrorAssignments(null);
    try {
      const data = await teacherService.getAssignments(currentClassId);
      setAssignments(data);
    } catch (err) {
      setErrorAssignments(
        err instanceof Error ? err.message : 'Failed to load assignments.',
      );
    } finally {
      setLoadingAssignments(false);
    }
  }, [currentClassId]);

  // ── fetchReviewQueue ──────────────────────────────────────────────────────

  const fetchReviewQueue = React.useCallback(async () => {
    if (!currentClassId) return;
    setLoadingReviewQueue(true);
    setErrorReviewQueue(null);
    try {
      const { items, pendingCount } =
        await teacherService.getReviewQueue(currentClassId);
      setReviewQueue(items);
      setReviewPendingCount(pendingCount);
    } catch (err) {
      setErrorReviewQueue(
        err instanceof Error ? err.message : 'Failed to load review queue.',
      );
    } finally {
      setLoadingReviewQueue(false);
    }
  }, [currentClassId]);

  // ── fetchAnalytics ────────────────────────────────────────────────────────

  const fetchAnalytics = React.useCallback(async () => {
    if (!currentClassId) return;
    setLoadingAnalytics(true);
    setErrorAnalytics(null);
    try {
      const data = await teacherService.getAnalytics(currentClassId);
      setAnalytics(data);
    } catch (err) {
      setErrorAnalytics(
        err instanceof Error ? err.message : 'Failed to load analytics.',
      );
    } finally {
      setLoadingAnalytics(false);
    }
  }, [currentClassId]);

  // ── fetchHeatmap ──────────────────────────────────────────────────────────

  const fetchHeatmap = React.useCallback(async () => {
    if (!currentClassId) return;
    setLoadingHeatmap(true);
    try {
      const data = await teacherService.getHeatmap(currentClassId);
      setHeatmap(data);
    } catch {
      // Heatmap is supplementary — fail silently
    } finally {
      setLoadingHeatmap(false);
    }
  }, [currentClassId]);

  // ── Initial load ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    void fetchClasses();
    // Run once on mount — ignore fetchClasses identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = React.useMemo<TeacherState>(
    () => ({
      currentClassId,
      classes,
      assignments,
      reviewQueue,
      reviewPendingCount,
      analytics,
      heatmap,
      loadingClasses,
      loadingAssignments,
      loadingReviewQueue,
      loadingAnalytics,
      loadingHeatmap,
      errorClasses,
      errorAssignments,
      errorReviewQueue,
      errorAnalytics,
      fetchClasses,
      selectClass,
      fetchAssignments,
      fetchReviewQueue,
      fetchAnalytics,
      fetchHeatmap,
    }),
    [
      currentClassId,
      classes,
      assignments,
      reviewQueue,
      reviewPendingCount,
      analytics,
      heatmap,
      loadingClasses,
      loadingAssignments,
      loadingReviewQueue,
      loadingAnalytics,
      loadingHeatmap,
      errorClasses,
      errorAssignments,
      errorReviewQueue,
      errorAnalytics,
      fetchClasses,
      selectClass,
      fetchAssignments,
      fetchReviewQueue,
      fetchAnalytics,
      fetchHeatmap,
    ],
  );

  return (
    <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
  );
};

// ── Consumer hook ─────────────────────────────────────────────────────────

function useTeacher(): TeacherState {
  const ctx = React.useContext(TeacherContext);
  if (!ctx)
    throw new Error('useTeacher must be used within <TeacherProvider>');
  return ctx;
}

export { TeacherProvider, useTeacher };

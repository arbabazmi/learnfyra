/**
 * @file src/contexts/ParentContext.tsx
 * @description Parent context — provides linked children list, selected child,
 * child progress, and child assignments to the parent dashboard.
 *
 * Loaded lazily — only mounted when the authenticated user has role = parent.
 */

import * as React from 'react';
import * as parentService from '@/services/api/parentService';
import type {
  ChildSummary,
  ChildProgress,
  ChildAssignment,
} from '@/types/parent';

// ── State shape ────────────────────────────────────────────────────────────

interface ParentState {
  /** The currently selected child student ID, or null if none. */
  currentChildId: string | null;
  /** All children linked to this parent. */
  children: ChildSummary[];
  /** Progress summary for the currently selected child. */
  childProgress: ChildProgress | null;
  /** Assignment list for the currently selected child. */
  childAssignments: ChildAssignment[];

  /** Loading flags. */
  loadingChildren: boolean;
  loadingProgress: boolean;
  loadingAssignments: boolean;

  /** Error messages per domain. */
  errorChildren: string | null;
  errorProgress: string | null;
  errorAssignments: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Fetch (or refresh) the full list of linked children. */
  fetchChildren: () => Promise<void>;
  /** Set the active child and load their data. */
  selectChild: (studentId: string) => void;
  /** Fetch progress for the currently selected child. */
  fetchChildProgress: () => Promise<void>;
  /** Fetch assignments for the currently selected child. */
  fetchChildAssignments: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const ParentContext = React.createContext<ParentState | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

const ParentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentChildId, setCurrentChildId] = React.useState<string | null>(
    null,
  );
  const [childrenList, setChildrenList] = React.useState<ChildSummary[]>([]);
  const [childProgress, setChildProgress] =
    React.useState<ChildProgress | null>(null);
  const [childAssignments, setChildAssignments] = React.useState<
    ChildAssignment[]
  >([]);

  const [loadingChildren, setLoadingChildren] = React.useState(false);
  const [loadingProgress, setLoadingProgress] = React.useState(false);
  const [loadingAssignments, setLoadingAssignments] = React.useState(false);

  const [errorChildren, setErrorChildren] = React.useState<string | null>(
    null,
  );
  const [errorProgress, setErrorProgress] = React.useState<string | null>(
    null,
  );
  const [errorAssignments, setErrorAssignments] = React.useState<string | null>(
    null,
  );

  // ── fetchChildren ─────────────────────────────────────────────────────────

  const fetchChildren = React.useCallback(async () => {
    setLoadingChildren(true);
    setErrorChildren(null);
    try {
      const data = await parentService.getChildren();
      setChildrenList(data);
      // Auto-select first child if none selected
      if (!currentChildId && data.length > 0) {
        setCurrentChildId(data[0].studentId);
      }
    } catch (err) {
      setErrorChildren(
        err instanceof Error ? err.message : 'Failed to load children.',
      );
    } finally {
      setLoadingChildren(false);
    }
  }, [currentChildId]);

  // ── selectChild ───────────────────────────────────────────────────────────

  const selectChild = React.useCallback((studentId: string) => {
    setCurrentChildId(studentId);
    // Clear stale data from previous child
    setChildProgress(null);
    setChildAssignments([]);
  }, []);

  // ── fetchChildProgress ────────────────────────────────────────────────────

  const fetchChildProgress = React.useCallback(async () => {
    if (!currentChildId) return;
    setLoadingProgress(true);
    setErrorProgress(null);
    try {
      const data = await parentService.getChildProgress(currentChildId);
      setChildProgress(data);
    } catch (err) {
      setErrorProgress(
        err instanceof Error ? err.message : 'Failed to load progress.',
      );
    } finally {
      setLoadingProgress(false);
    }
  }, [currentChildId]);

  // ── fetchChildAssignments ─────────────────────────────────────────────────

  const fetchChildAssignments = React.useCallback(async () => {
    if (!currentChildId) return;
    setLoadingAssignments(true);
    setErrorAssignments(null);
    try {
      const data = await parentService.getChildAssignments(currentChildId);
      setChildAssignments(data);
    } catch (err) {
      setErrorAssignments(
        err instanceof Error ? err.message : 'Failed to load assignments.',
      );
    } finally {
      setLoadingAssignments(false);
    }
  }, [currentChildId]);

  // ── Initial load ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    void fetchChildren();
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

  const value = React.useMemo<ParentState>(
    () => ({
      currentChildId,
      children: childrenList,
      childProgress,
      childAssignments,
      loadingChildren,
      loadingProgress,
      loadingAssignments,
      errorChildren,
      errorProgress,
      errorAssignments,
      fetchChildren,
      selectChild,
      fetchChildProgress,
      fetchChildAssignments,
    }),
    [
      currentChildId,
      childrenList,
      childProgress,
      childAssignments,
      loadingChildren,
      loadingProgress,
      loadingAssignments,
      errorChildren,
      errorProgress,
      errorAssignments,
      fetchChildren,
      selectChild,
      fetchChildProgress,
      fetchChildAssignments,
    ],
  );

  return (
    <ParentContext.Provider value={value}>{children}</ParentContext.Provider>
  );
};

// ── Consumer hook ──────────────────────────────────────────────────────────

function useParent(): ParentState {
  const ctx = React.useContext(ParentContext);
  if (!ctx) throw new Error('useParent must be used within <ParentProvider>');
  return ctx;
}

export { ParentProvider, useParent };

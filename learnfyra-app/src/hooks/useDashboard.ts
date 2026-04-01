/**
 * @file src/hooks/useDashboard.ts
 * @description Dashboard data hook — returns dummy data for guests, real API data for logged-in users.
 */

import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/env';
import { getToken } from '@/lib/auth';
import type { DashboardStats, DashboardWorksheet, SubjectProgress } from '@/types/dashboard';

// ── Dummy data for guest mode ──────────────────────────────────────────────

const GUEST_STATS: DashboardStats = {
  worksheetsDone: 24,
  inProgress: 3,
  bestScore: 92,
  studyTime: '15h',
};

const GUEST_WORKSHEETS: DashboardWorksheet[] = [
  { id: 'ws-001', title: 'Linear Equations', subject: 'Math', grade: 7, score: 90, totalPoints: 10, status: 'completed' },
  { id: 'ws-002', title: 'Cell Biology Basics', subject: 'Science', grade: 7, score: 80, totalPoints: 10, status: 'completed' },
  { id: 'ws-003', title: 'The American Revolution', subject: 'History', grade: 7, score: null, totalPoints: 10, status: 'new' },
  { id: 'ws-004', title: 'Parts of Speech', subject: 'ELA', grade: 7, score: null, totalPoints: 10, status: 'in-progress' },
];

const GUEST_PROGRESS: SubjectProgress[] = [
  { subject: 'Algebra', score: 88, color: '#3D9AE8' },
  { subject: 'Reading', score: 74, color: '#6DB84B' },
  { subject: 'Science', score: 91, color: '#F5C534' },
  { subject: 'History', score: 67, color: '#f97316' },
];

// ── Greeting ───────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Hello';
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseDashboardReturn {
  isGuest: boolean;
  userName: string;
  greeting: string;
  stats: DashboardStats;
  recentWorksheets: DashboardWorksheet[];
  subjectProgress: SubjectProgress[];
  isLoading: boolean;
  error: string | null;
}

export function useDashboard(): UseDashboardReturn {
  const auth = useAuth();
  const isGuest = auth.isGuest;
  const token = getToken();

  // Initialize with appropriate defaults — guest gets dummy data, logged-in gets empty (avoids flash of fake data)
  const EMPTY_STATS: DashboardStats = { worksheetsDone: 0, inProgress: 0, bestScore: 0, studyTime: '0m' };
  const [stats, setStats] = React.useState<DashboardStats>(isGuest ? GUEST_STATS : EMPTY_STATS);
  const [recentWorksheets, setRecentWorksheets] = React.useState<DashboardWorksheet[]>(isGuest ? GUEST_WORKSHEETS : []);
  const [subjectProgress, setSubjectProgress] = React.useState<SubjectProgress[]>(isGuest ? GUEST_PROGRESS : []);
  const [isLoading, setIsLoading] = React.useState(!isGuest);
  const [error, setError] = React.useState<string | null>(null);
  const greeting = getGreeting();

  const userName = auth.isAuthenticated && auth.user
    ? auth.user.displayName.split(' ')[0]
    : (auth.selectedRole ? auth.selectedRole.charAt(0).toUpperCase() + auth.selectedRole.slice(1) : 'Student');

  // Fetch real data for logged-in users
  React.useEffect(() => {
    if (isGuest) {
      setStats(GUEST_STATS);
      setRecentWorksheets(GUEST_WORKSHEETS);
      setSubjectProgress(GUEST_PROGRESS);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    Promise.all([
      fetch(`${apiUrl}/api/dashboard/stats`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/dashboard/recent-worksheets`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/dashboard/subject-progress`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
    ])
      .then(([s, w, p]) => {
        if (!isMounted) return;
        setStats(s || EMPTY_STATS);
        setRecentWorksheets(Array.isArray(w) ? w : []);
        setSubjectProgress(Array.isArray(p) ? p : []);
      })
      .catch((err) => {
        if (!isMounted || err.name === 'AbortError') return;
        setError('Failed to load dashboard data.');
        setStats(EMPTY_STATS);
        setRecentWorksheets([]);
        setSubjectProgress([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isGuest, token]);

  return { isGuest, userName, greeting, stats, recentWorksheets, subjectProgress, isLoading, error };
}

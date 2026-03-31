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
  const [stats, setStats] = React.useState<DashboardStats>(GUEST_STATS);
  const [recentWorksheets, setRecentWorksheets] = React.useState<DashboardWorksheet[]>(GUEST_WORKSHEETS);
  const [subjectProgress, setSubjectProgress] = React.useState<SubjectProgress[]>(GUEST_PROGRESS);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isGuest = auth.isGuest;
  const greeting = getGreeting();

  const userName = auth.isAuthenticated && auth.user
    ? auth.user.displayName.split(' ')[0]
    : (auth.selectedRole ? auth.selectedRole.charAt(0).toUpperCase() + auth.selectedRole.slice(1) : 'Student');

  // Empty defaults for logged-in users (real zeros, not fake data)
  const EMPTY_STATS: DashboardStats = { worksheetsDone: 0, inProgress: 0, bestScore: 0, studyTime: '0m' };

  // Fetch real data for logged-in users
  React.useEffect(() => {
    if (isGuest) {
      setStats(GUEST_STATS);
      setRecentWorksheets(GUEST_WORKSHEETS);
      setSubjectProgress(GUEST_PROGRESS);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    };

    Promise.all([
      fetch(`${apiUrl}/api/dashboard/stats`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/dashboard/recent-worksheets`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
      fetch(`${apiUrl}/api/dashboard/subject-progress`, { headers, signal: controller.signal }).then(r => r.ok ? r.json() : null),
    ])
      .then(([s, w, p]) => {
        setStats(s || EMPTY_STATS);
        setRecentWorksheets(Array.isArray(w) ? w : []);
        setSubjectProgress(Array.isArray(p) ? p : []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Failed to load dashboard data.');
          setStats(EMPTY_STATS);
          setRecentWorksheets([]);
          setSubjectProgress([]);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isGuest]);

  return { isGuest, userName, greeting, stats, recentWorksheets, subjectProgress, isLoading, error };
}

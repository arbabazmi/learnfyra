import { createBrowserRouter } from 'react-router';
import Landing from './pages/landing';
import StudentDashboard from './pages/student-dashboard';
import TeacherDashboard from './pages/teacher-dashboard';
import ParentDashboard from './pages/parent-dashboard';
import AdminDashboard from './pages/admin-dashboard';
import CreateWorksheet from './pages/create-worksheet';
import WorksheetSolve from './pages/worksheet-solve';
import WorksheetList from './pages/worksheet-list';
import PerformanceReport from './pages/performance-report';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Landing,
  },
  {
    path: '/student/dashboard',
    Component: StudentDashboard,
  },
  {
    path: '/student/worksheets',
    Component: WorksheetList,
  },
  {
    path: '/student/performance',
    Component: PerformanceReport,
  },
  {
    path: '/student/worksheet/:id',
    Component: WorksheetSolve,
  },
  {
    path: '/teacher/dashboard',
    Component: TeacherDashboard,
  },
  {
    path: '/teacher/worksheets',
    Component: TeacherDashboard,
  },
  {
    path: '/teacher/students',
    Component: TeacherDashboard,
  },
  {
    path: '/teacher/analytics',
    Component: TeacherDashboard,
  },
  {
    path: '/teacher/create-worksheet',
    Component: CreateWorksheet,
  },
  {
    path: '/parent/dashboard',
    Component: ParentDashboard,
  },
  {
    path: '/parent/children',
    Component: ParentDashboard,
  },
  {
    path: '/parent/performance',
    Component: ParentDashboard,
  },
  {
    path: '/admin/dashboard',
    Component: AdminDashboard,
  },
  {
    path: '/admin/users',
    Component: AdminDashboard,
  },
  {
    path: '/admin/settings',
    Component: AdminDashboard,
  },
]);
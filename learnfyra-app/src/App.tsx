/**
 * @file src/App.tsx
 * @description Root router. Defines all application routes.
 *
 * Routes:
 *   /                  Landing page (public) — auth modal is inline
 *   /auth/callback     OAuth redirect handler (stores token, redirects to dashboard)
 *   /login             Redirects to / (auth is handled via modal on landing page)
 *   /dashboard         Student / Teacher dashboard (authenticated)
 *   /worksheet         Worksheets list (authenticated)
 *   /worksheet/new     Generate new worksheet (authenticated)
 *   /worksheet/:id     Worksheet solver (authenticated)
 *   /reports           Performance reports (authenticated)
 *   /achievements      Badges & streaks (authenticated)
 *   /settings          User settings (authenticated)
 *   *                  404 Not Found
 */

import { Routes, Route, Navigate, useParams } from 'react-router';
import Landing               from './pages/Landing';
import AuthCallbackPage      from './pages/AuthCallbackPage';
import ForgotPasswordPage    from './pages/ForgotPasswordPage';
import ResetPasswordPage     from './pages/ResetPasswordPage';
import VerifyResetCodePage   from './pages/VerifyResetCodePage';
import DashboardPage         from './pages/DashboardPage';
import WorksheetsListPage    from './pages/WorksheetsListPage';
import GenerateWorksheetPage from './pages/GenerateWorksheetPage';
import ReportsPage           from './pages/ReportsPage';
import AchievementsPage      from './pages/AchievementsPage';
import SettingsPage          from './pages/SettingsPage';
import NotFoundPage          from './pages/NotFoundPage';
import SolvePage             from './modules/solve';
// @ts-expect-error — JSX test runner, no TS types
import TestRunnerPage        from './pages/TestRunnerPage.jsx';

/** Redirect old /worksheet/:id to /solve/:id */
function WorksheetRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/solve/${id}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* ── Public ──────────────────────────────────────── */}
      <Route path="/"              element={<Landing />} />
      <Route path="/solve/:worksheetId" element={<SolvePage />} />
      <Route path="/auth/callback"          element={<AuthCallbackPage />} />
      <Route path="/auth/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-password"   element={<ResetPasswordPage />} />
      <Route path="/auth/verify-reset-code" element={<VerifyResetCodePage />} />
      <Route path="/login"         element={<Navigate to="/" replace />} />

      {/* ── Authenticated app ───────────────────────────── */}
      <Route path="/dashboard"        element={<DashboardPage />} />
      <Route path="/worksheet"        element={<WorksheetsListPage />} />
      <Route path="/worksheet/new"    element={<GenerateWorksheetPage />} />
      <Route path="/worksheet/:id"    element={<WorksheetRedirect />} />
      <Route path="/reports"          element={<ReportsPage />} />
      <Route path="/achievements"     element={<AchievementsPage />} />
      <Route path="/settings"         element={<SettingsPage />} />

      {/* ── Dev tools ──────────────────────────────────── */}
      <Route path="/tests" element={<TestRunnerPage />} />

      {/* ── Fallback ────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

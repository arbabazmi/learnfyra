import { createBrowserRouter } from "react-router";
import Landing from "./pages/landing";
import StudentDashboard from "./pages/student-dashboard";
import TeacherDashboard from "./pages/teacher-dashboard";
import ParentDashboard from "./pages/parent-dashboard";
import WorksheetSolve from "./pages/worksheet-solve";
import CreateWorksheet from "./pages/create-worksheet";
import WorksheetList from "./pages/worksheet-list";
import PerformanceReport from "./pages/performance-report";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/student",
    Component: StudentDashboard,
  },
  {
    path: "/teacher",
    Component: TeacherDashboard,
  },
  {
    path: "/parent",
    Component: ParentDashboard,
  },
  {
    path: "/worksheet/:id",
    Component: WorksheetSolve,
  },
  {
    path: "/create-worksheet",
    Component: CreateWorksheet,
  },
  {
    path: "/worksheets",
    Component: WorksheetList,
  },
  {
    path: "/performance/:studentId",
    Component: PerformanceReport,
  },
]);

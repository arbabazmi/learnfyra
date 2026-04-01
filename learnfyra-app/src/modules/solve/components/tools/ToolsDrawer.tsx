/**
 * @file ToolsDrawer.tsx
 * @description Mobile bottom sheet wrapper. Used directly in ExamSolve/PracticeSolve.
 *              This is the mobile-specific variant — ToolsPanel is rendered inside it.
 */

// Note: The mobile drawer is integrated directly into ExamSolve.tsx and PracticeSolve.tsx
// using AnimatePresence + motion.div. This file exists for architectural completeness
// and can be used as a standalone if needed.

export { default } from './ToolsPanel';

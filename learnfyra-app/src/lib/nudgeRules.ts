/**
 * @file src/lib/nudgeRules.ts
 * @description Nudge timing rules for guest-to-signup conversion prompts.
 * Returns the highest-priority undismissed nudge for the current guest state.
 */

import { isNudgeDismissed } from '@/lib/guestSession';

export interface NudgeConfig {
  id: string;
  title: string;
  body: string;
  ctaText: string;
  dismissText: string;
}

/** All defined nudges in priority order (highest priority first). */
const NUDGES: Array<NudgeConfig & { minCount: number | null }> = [
  {
    id: 'streak-three',
    minCount: 3,
    title: "You're on a roll!",
    body: '3 worksheets done! Sign up to keep your streak and unlock achievements.',
    ctaText: 'Create Free Account',
    dismissText: 'Not now',
  },
  {
    id: 'first-worksheet',
    minCount: 1,
    title: 'Nice work!',
    body: 'Create a free account to save your score and track progress.',
    ctaText: 'Save My Progress',
    dismissText: 'Maybe later',
  },
  {
    id: 'view-history',
    minCount: null,
    title: 'Want to see all your past attempts?',
    body: 'Sign in to access your full worksheet history and progress reports.',
    ctaText: 'Sign In',
    dismissText: 'Skip',
  },
];

/**
 * Returns the highest-priority undismissed nudge for the current guest state,
 * or null if no nudge should be shown.
 *
 * Count-based nudges (streak-three, first-worksheet) are evaluated against
 * completedCount. The view-history nudge is triggered externally — it is
 * included here so callers can retrieve its config by ID, but it is excluded
 * from count-based evaluation (minCount === null).
 *
 * @param completedCount - Number of worksheets the guest has completed.
 * @param isGuest - Whether the current user is a guest (not signed in).
 * @returns The highest-priority NudgeConfig to show, or null.
 */
export function getActiveNudge(
  completedCount: number,
  isGuest: boolean,
): NudgeConfig | null {
  if (!isGuest) return null;

  for (const nudge of NUDGES) {
    // Skip nudges that are triggered externally (no minCount threshold)
    if (nudge.minCount === null) continue;

    if (completedCount >= nudge.minCount && !isNudgeDismissed(nudge.id)) {
      const { minCount: _minCount, ...config } = nudge;
      return config;
    }
  }

  return null;
}

/**
 * Returns the NudgeConfig for a specific nudge ID, regardless of dismissal
 * state. Useful for externally triggered nudges such as view-history.
 *
 * @param id - The nudge ID to look up.
 * @returns The NudgeConfig, or null if the ID is not found or already dismissed.
 */
export function getNudgeById(id: string): NudgeConfig | null {
  const nudge = NUDGES.find((n) => n.id === id);
  if (!nudge) return null;
  if (isNudgeDismissed(nudge.id)) return null;
  const { minCount: _minCount, ...config } = nudge;
  return config;
}

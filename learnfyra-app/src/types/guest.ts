/**
 * @file src/types/guest.ts
 * @description Guest flow types — used by TryWorksheetFlow and related components.
 */

import type { UserRole } from '@/lib/auth';

export type FlowStep = 'role-select' | 'onboarding';

export interface RoleOption {
  id: UserRole;
  label: string;
  icon: React.ElementType;
  color: string;
  colorLight: string;
  description: string;
  onboardingHeadline: string;
  onboardingBody: string;
  onboardingIcon: React.ElementType;
}

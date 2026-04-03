/**
 * @file src/components/dashboard/WelcomeBanner.tsx
 * @description Full-width welcome banner with greeting, worksheet count, and a
 *              "New Worksheet" CTA. Uses the brand primary background with a
 *              dot-grid pattern overlay matching the existing DashboardPage style.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface WelcomeBannerProps {
  greeting: string;
  userName: string;
  worksheetCount: number;
  isGuest: boolean;
  role?: string | null;
}

/**
 * Renders a branded welcome banner with a personalised greeting and a
 * "New Worksheet" button that navigates to /worksheet/new.
 *
 * @param {WelcomeBannerProps} props
 * @returns {React.ReactElement}
 */
const ROLE_LABELS: Record<string, { label: string; emoji: string }> = {
  student: { label: 'Student', emoji: '' },
  teacher: { label: 'Teacher', emoji: '' },
  parent: { label: 'Parent', emoji: '' },
  'guest-student': { label: 'Student', emoji: '' },
  'guest-teacher': { label: 'Teacher', emoji: '' },
  'guest-parent': { label: 'Parent', emoji: '' },
};

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  greeting,
  userName,
  worksheetCount,
  role,
}) => {
  const roleKey = role?.toLowerCase() ?? '';
  const roleInfo = ROLE_LABELS[roleKey];
  return (
    <section
      aria-label="Welcome"
      className="relative rounded-2xl bg-primary overflow-hidden p-6 lg:p-8"
    >
      {/* Dot-grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: greeting + subtitle */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-extrabold text-white">
              {greeting}, {userName}!
            </h2>
            {roleInfo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wide backdrop-blur-sm">
                {roleInfo.label}
              </span>
            )}
          </div>
          <p className="text-white/75 text-sm mt-1">
            You have{' '}
            <span className="text-white font-bold">
              {worksheetCount} worksheet{worksheetCount !== 1 ? 's' : ''}
            </span>{' '}
            ready to solve.
          </p>
        </div>

        {/* Right: CTA */}
        <Button
          variant="white"
          size="md"
          className="text-primary font-bold shrink-0"
          asChild
        >
          <Link to="/worksheet/new">
            <Plus className="size-4" />
            New Worksheet
          </Link>
        </Button>
      </div>
    </section>
  );
};

WelcomeBanner.displayName = 'WelcomeBanner';

export { WelcomeBanner };

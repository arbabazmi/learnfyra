/**
 * @file src/components/dashboard/GenerateWorksheetBanner.tsx
 * @description Full-width call-to-action card that prompts the user to
 *   generate a new worksheet. Adapts to guest vs. authenticated state.
 */

import * as React from 'react';
import { Link } from 'react-router';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface GenerateWorksheetBannerProps {
  /** When true the user is unauthenticated; the CTA still links to /worksheet/new
   *  and the app layer is responsible for prompting sign-in if required. */
  isGuest: boolean;
}

/**
 * Renders a prominently styled banner card with an icon, copy, and a
 * "Get Started" button linking to the worksheet creation flow.
 *
 * @param {GenerateWorksheetBannerProps} props
 * @returns {React.ReactElement}
 */
const GenerateWorksheetBanner: React.FC<GenerateWorksheetBannerProps> = () => {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      {/* Icon badge */}
      <div
        className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <Sparkles className="size-6 text-primary" />
      </div>

      {/* Copy */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-extrabold text-foreground leading-snug">
          Generate a New Worksheet
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pick a subject and topic — AI builds a custom worksheet in seconds.
        </p>
      </div>

      {/* CTA */}
      <Button
        variant="primary"
        size="md"
        className="w-full sm:w-auto shrink-0"
        asChild
      >
        <Link to="/worksheet/new">
          Get Started
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
};

GenerateWorksheetBanner.displayName = 'GenerateWorksheetBanner';

export { GenerateWorksheetBanner };

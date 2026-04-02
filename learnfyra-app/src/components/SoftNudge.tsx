/**
 * @file src/components/SoftNudge.tsx
 * @description Dismissible, non-blocking nudge banner that slides up from the
 * bottom of the screen. Renders as a fixed bottom-right toast on desktop and
 * a full-width bottom sheet on mobile.
 */

import * as React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { dismissNudge } from '@/lib/guestSession';
import type { NudgeConfig } from '@/lib/nudgeRules';

export interface SoftNudgeProps {
  nudge: NudgeConfig | null;
  onAction: () => void;
  onDismiss: () => void;
}

/**
 * Renders a soft nudge prompt at the bottom of the screen.
 * Returns null when `nudge` is null.
 *
 * @param props.nudge     - The nudge config to display, or null to render nothing.
 * @param props.onAction  - Called when the user clicks the CTA button.
 * @param props.onDismiss - Called after the nudge is dismissed (either via X or dismiss text).
 */
export function SoftNudge({ nudge, onAction, onDismiss }: SoftNudgeProps) {
  if (!nudge) return null;

  function handleDismiss() {
    dismissNudge(nudge!.id);
    onDismiss();
  }

  return (
    /*
     * Positioning:
     *   mobile  → bottom-0, left-0, right-0 (full-width bottom sheet)
     *   desktop → bottom-4, right-4, max-w-sm (toast)
     *
     * Rounding:
     *   mobile  → rounded-t-2xl (bottom edges flush with viewport)
     *   desktop → rounded-2xl
     *
     * Animation: slides up on mount using an arbitrary Tailwind keyframe.
     */
    <div
      role="region"
      aria-label="Account nudge"
      className={[
        // Layout — mobile: bottom sheet; desktop: bottom-right toast
        'fixed z-50',
        'bottom-0 left-0 right-0',
        'sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm',
        // Shape
        'rounded-t-2xl sm:rounded-2xl',
        // Surface
        'bg-white shadow-xl border border-border',
        // Slide-up entrance animation
        'animate-[slideUp_300ms_ease-out]',
      ].join(' ')}
    >
      {/* Close button */}
      <button
        type="button"
        aria-label="Close"
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1 hover:bg-muted"
      >
        <X size={16} />
      </button>

      <div className="flex gap-3 p-5 pr-9">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <span className="flex items-center justify-center size-9 rounded-full bg-success-light text-success">
            <CheckCircle size={18} strokeWidth={2.5} />
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <p className="font-extrabold text-foreground leading-snug">
              {nudge.title}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {nudge.body}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={onAction}
            >
              {nudge.ctaText}
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {nudge.dismissText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

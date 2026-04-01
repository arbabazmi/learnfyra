/**
 * @file src/components/guest/RoleMicroOnboarding.tsx
 * @description Role-specific micro-onboarding — shows a motivational message
 * and a CTA to proceed to worksheet generation.
 */

import * as React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { RoleOption } from '@/types/guest';

interface RoleMicroOnboardingProps {
  role: RoleOption;
  onContinue: () => void;
  onBack: () => void;
  visible: boolean;
}

const RoleMicroOnboarding: React.FC<RoleMicroOnboardingProps> = ({
  role, onContinue, onBack, visible,
}) => {
  const Icon = role.onboardingIcon;

  return (
    <div
      className={[
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none',
      ].join(' ')}
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <div className="max-w-md mx-auto text-center space-y-6">
        {/* Icon */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto"
          style={{ background: role.colorLight }}
        >
          <Icon className="size-12" style={{ color: role.color }} />
        </div>

        {/* Message */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-snug">
            {role.onboardingHeadline}
          </h2>
          <p className="text-base text-muted-foreground mt-4 leading-relaxed max-w-sm mx-auto">
            {role.onboardingBody}
          </p>
        </div>

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          className="w-full sm:w-auto gap-2 px-10"
          onClick={onContinue}
        >
          Let's Go
          <ArrowRight className="size-5" />
        </Button>
      </div>
    </div>
  );
};

export { RoleMicroOnboarding };

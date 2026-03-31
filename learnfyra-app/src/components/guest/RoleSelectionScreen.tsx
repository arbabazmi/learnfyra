/**
 * @file src/components/guest/RoleSelectionScreen.tsx
 * @description Three role cards with staggered entrance animation.
 * Headline: "Who is learning today?"
 */

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { RoleCard } from './RoleCard';
import type { RoleOption } from '@/types/guest';

interface RoleSelectionScreenProps {
  roles: RoleOption[];
  selectedRole: RoleOption | null;
  onSelect: (role: RoleOption) => void;
  onBack: () => void;
  visible: boolean;
}

const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  roles, selectedRole, onSelect, onBack, visible,
}) => {
  // Stagger entrance after a brief mount delay
  const [cardsVisible, setCardsVisible] = React.useState(false);
  React.useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setCardsVisible(true));
      return () => cancelAnimationFrame(t);
    }
    setCardsVisible(false);
  }, [visible]);

  return (
    <div
      className={[
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none',
      ].join(' ')}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      {/* Headline */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">
          Who is learning today?
        </h2>
        <p className="text-base text-muted-foreground mt-3">
          Pick your role so we can tailor your experience
        </p>
      </div>

      {/* Role cards */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 max-w-3xl mx-auto">
        {roles.map((role, i) => (
          <RoleCard
            key={role.id}
            role={role}
            selected={selectedRole?.id === role.id}
            onSelect={onSelect}
            index={i}
            visible={cardsVisible}
          />
        ))}
      </div>
    </div>
  );
};

export { RoleSelectionScreen };

/**
 * @file src/components/guest/RoleCard.tsx
 * @description Individual role card — hover/active/selected states with smooth transitions.
 */

import * as React from 'react';
import { Check } from 'lucide-react';
import type { RoleOption } from '@/types/guest';

interface RoleCardProps {
  role: RoleOption;
  selected: boolean;
  onSelect: (role: RoleOption) => void;
  /** Stagger index for entrance animation delay */
  index: number;
  /** Whether entrance animation has started */
  visible: boolean;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, selected, onSelect, index, visible }) => {
  const Icon = role.icon;

  return (
    <button
      onClick={() => onSelect(role)}
      style={{ transitionDelay: visible ? `${index * 80}ms` : '0ms' }}
      className={[
        'relative w-full sm:w-auto sm:flex-1 flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl border-2 text-center',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Entrance animation
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        // Selected vs unselected
        selected
          ? 'border-primary bg-primary-light shadow-md scale-[1.02]'
          : 'border-border bg-white shadow-card hover:border-primary/40 hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]',
      ].join(' ')}
    >
      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="size-3.5 text-white" />
        </div>
      )}

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: role.colorLight }}
      >
        <Icon className="size-8" style={{ color: role.color }} />
      </div>

      {/* Label */}
      <h3 className="text-base font-extrabold text-foreground">{role.label}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
    </button>
  );
};

export { RoleCard };

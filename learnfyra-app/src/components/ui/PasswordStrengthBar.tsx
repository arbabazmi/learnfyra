/**
 * @file src/components/ui/PasswordStrengthBar.tsx
 * @description Reusable password strength indicator — 4-bar meter + check list.
 */

import * as React from 'react';
import { Check } from 'lucide-react';
import { validatePassword } from '@/lib/emailAuth';

const BAR_COLORS  = ['bg-destructive', 'bg-destructive', 'bg-accent', 'bg-secondary', 'bg-secondary'];
const TEXT_COLORS  = ['text-destructive', 'text-destructive', 'text-accent-foreground', 'text-secondary', 'text-secondary'];

const LABELS: Record<string, string> = { length: '8+', uppercase: 'A-Z', number: '0-9', special: '!@#' };

interface PasswordStrengthBarProps {
  password: string;
}

const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({ password }) => {
  if (!password) return null;
  const { score, label, checks } = validatePassword(password);

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? BAR_COLORS[score] : 'bg-surface-2'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${TEXT_COLORS[score]}`}>{label}</span>
        <div className="flex gap-2">
          {Object.entries(checks).map(([key, ok]) => (
            <span key={key} className={`text-[10px] font-semibold ${ok ? 'text-secondary' : 'text-muted-foreground'}`}>
              {ok ? <Check className="size-3 inline -mt-0.5 mr-0.5" /> : null}
              {LABELS[key]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export { PasswordStrengthBar };

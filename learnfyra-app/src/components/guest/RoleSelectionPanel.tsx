/**
 * @file src/components/guest/RoleSelectionPanel.tsx
 * @description Centered overlay for role selection. Appears on top of the page
 * with a backdrop blur. Contains role cards, post-selection message, and Continue CTA.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  GraduationCap,
  BookOpen,
  Users,
  ArrowRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { setSelectedRole, type UserRole } from '@/lib/auth';

// ── Role definitions ───────────────────────────────────────────────────────

interface RoleDef {
  id: UserRole;
  label: string;
  tagline: string;
  icon: React.ElementType;
  color: string;
  colorLight: string;
  message: string;
  route: string;
}

const ROLES: RoleDef[] = [
  {
    id: 'student',
    label: 'Student',
    tagline: 'Practice & improve your skills',
    icon: GraduationCap,
    color: '#3D9AE8',
    colorLight: '#EFF6FF',
    message: 'Practice smarter with AI-powered worksheets',
    route: '/worksheet/new',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    tagline: 'Assign work & monitor class',
    icon: BookOpen,
    color: '#6DB84B',
    colorLight: '#F0FDF4',
    message: 'Assign work and monitor performance easily',
    route: '/worksheet/new',
  },
  {
    id: 'parent',
    label: 'Parent',
    tagline: "Track your child's progress",
    icon: Users,
    color: '#F5C534',
    colorLight: '#FEFCE8',
    message: "Track your child's learning and progress",
    route: '/worksheet/new',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

interface RoleSelectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const RoleSelectionPanel: React.FC<RoleSelectionPanelProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<RoleDef | null>(null);
  const [cardsVisible, setCardsVisible] = React.useState(false);

  // Reset on open/close
  React.useEffect(() => {
    if (isOpen) {
      setSelected(null);
      requestAnimationFrame(() => setCardsVisible(true));
    } else {
      setCardsVisible(false);
    }
  }, [isOpen]);

  // Lock body scroll + close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [isOpen, onClose]);

  const handleSelect = (role: RoleDef) => {
    setSelected(role);
    setSelectedRole(role.id);
  };

  const handleContinue = () => {
    if (selected) {
      onClose();
      navigate(selected.route);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative z-10 bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 sm:p-8 animate-[scaleIn_250ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your role"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Heading */}
        <h2 className="text-2xl font-extrabold text-foreground mb-2">
          Who is learning today?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Pick your role so we can personalize your experience
        </p>

        {/* Role cards */}
        <div className="flex flex-col sm:flex-row gap-3">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            const isSelected = selected?.id === role.id;
            const isFaded = !!selected && !isSelected;

            return (
              <button
                key={role.id}
                onClick={() => handleSelect(role)}
                className={[
                  'group relative flex flex-col items-center text-center p-5 rounded-2xl border-2 flex-1',
                  'transition-all duration-200 ease-out cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                  isSelected
                    ? 'shadow-lg scale-[1.02]'
                    : isFaded
                      ? 'opacity-30 scale-[0.97] border-border bg-white'
                      : 'border-border bg-white shadow-card hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 active:scale-[0.97]',
                ].join(' ')}
                style={{
                  transitionDelay: cardsVisible ? `${i * 80}ms` : '0ms',
                  ...(isSelected
                    ? { borderColor: role.color, backgroundColor: role.colorLight }
                    : {}),
                }}
              >
                {/* Top accent bar when selected */}
                {isSelected && (
                  <div
                    className="absolute -top-px left-0 right-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: role.color }}
                  />
                )}

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: isSelected ? `${role.color}25` : role.colorLight }}
                >
                  <Icon className="size-7" style={{ color: role.color }} />
                </div>

                {/* Label */}
                <p className="text-base font-extrabold text-foreground">{role.label}</p>

                {/* Tagline */}
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{role.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Post-selection: message + Continue */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: selected ? '100px' : '0px',
            opacity: selected ? 1 : 0,
            marginTop: selected ? '1.25rem' : '0',
          }}
        >
          {selected && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-surface border border-border">
              <p className="text-sm font-semibold text-foreground flex-1">
                {selected.message}
              </p>
              <Button
                variant="primary"
                size="md"
                className="gap-2 shrink-0 w-full sm:w-auto"
                onClick={handleContinue}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { RoleSelectionPanel };

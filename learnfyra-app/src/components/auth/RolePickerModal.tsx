/**
 * @file src/components/auth/RolePickerModal.tsx
 * @description Auto-shown modal for first-time visitors (tokenState === 'none').
 * Lets them pick a role and either continue as guest or sign in.
 * Shown once per session — tracked via sessionStorage 'lf_modal_shown'.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  GraduationCap,
  BookOpen,
  Users,
  ArrowRight,
  LogIn,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { GUEST_STORAGE_KEYS, setSelectedRole, type UserRole } from '@/lib/auth';
import { apiUrl, googleOAuth } from '@/lib/env';

interface RoleDef {
  id: UserRole;
  label: string;
  tagline: string;
  icon: React.ElementType;
  color: string;
  colorLight: string;
}

const ROLES: RoleDef[] = [
  {
    id: 'student',
    label: 'Student',
    tagline: 'Practice & improve your skills',
    icon: GraduationCap,
    color: '#3D9AE8',
    colorLight: '#EFF6FF',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    tagline: 'Assign work & monitor class',
    icon: BookOpen,
    color: '#6DB84B',
    colorLight: '#F0FDF4',
  },
  {
    id: 'parent',
    label: 'Parent',
    tagline: "Track your child's progress",
    icon: Users,
    color: '#F5C534',
    colorLight: '#FEFCE8',
  },
];

const RolePickerModal: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<RoleDef | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [visible, setVisible] = React.useState(false);

  // Sync visibility with context
  React.useEffect(() => {
    setVisible(auth.showRoleModal);
  }, [auth.showRoleModal]);

  // Lock body scroll
  React.useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  const handleContinueAsGuest = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError('');

    try {
      setSelectedRole(selected.id);

      const response = await fetch(`${apiUrl}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected.id }),
      });

      if (!response.ok) throw new Error('Failed to get guest token');

      // Backend sets cookie via Set-Cookie header
      sessionStorage.setItem(GUEST_STORAGE_KEYS.modalShown, '1');
      auth.closeRoleModal();
      auth.refresh();
      navigate('/worksheet/new');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    sessionStorage.setItem(
      GUEST_STORAGE_KEYS.preLoginUrl,
      window.location.pathname + window.location.search,
    );
    sessionStorage.setItem(GUEST_STORAGE_KEYS.modalShown, '1');
    auth.closeRoleModal();

    try {
      const res = await fetch(googleOAuth.initiateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      const data = await res.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
    } catch { /* fall through */ }

    window.location.href = '/';
  };

  const handleDismiss = () => {
    sessionStorage.setItem(GUEST_STORAGE_KEYS.modalShown, '1');
    auth.closeRoleModal();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop with blur — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px] animate-[fadeIn_200ms_ease-out] cursor-pointer"
        aria-hidden="true"
        onClick={handleDismiss}
      />

      {/* Card — full-screen on mobile, centered on desktop */}
      <div
        className="relative z-10 bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-border shadow-xl p-6 sm:p-8 animate-[slideUp_250ms_ease-out] sm:animate-[scaleIn_250ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your role"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Handle bar on mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-border mx-auto mb-4" />

        <h2 className="text-2xl font-extrabold text-foreground mb-2">
          Who is learning today?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Pick your role so we can personalize your experience
        </p>

        {/* Role cards */}
        <div className="flex flex-col sm:flex-row gap-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selected?.id === role.id;
            const isFaded = !!selected && !isSelected;

            return (
              <button
                key={role.id}
                onClick={() => { setSelected(role); setError(''); }}
                className={[
                  'group relative flex flex-col items-center text-center p-5 rounded-2xl border-2 flex-1',
                  'transition-all duration-200 ease-out cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'shadow-lg scale-[1.02]'
                    : isFaded
                      ? 'opacity-30 scale-[0.97] border-border bg-white'
                      : 'border-border bg-white shadow-card hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 active:scale-[0.97]',
                ].join(' ')}
                style={isSelected ? { borderColor: role.color, backgroundColor: role.colorLight } : {}}
              >
                {isSelected && (
                  <div
                    className="absolute -top-px left-0 right-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: role.color }}
                  />
                )}

                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: isSelected ? `${role.color}25` : role.colorLight }}
                >
                  <Icon className="size-7" style={{ color: role.color }} />
                </div>

                <p className="text-base font-extrabold text-foreground">{role.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{role.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive font-semibold mt-4" role="alert">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full gap-2"
            onClick={handleContinueAsGuest}
            disabled={!selected || loading}
            loading={loading}
          >
            {!loading && <ArrowRight className="size-4" />}
            Continue as Guest
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2"
            onClick={handleLogin}
          >
            <LogIn className="size-4" />
            Login / Sign Up
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          You can always sign in later to save your progress
        </p>
      </div>
    </div>
  );
};

export { RolePickerModal };

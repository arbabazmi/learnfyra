/**
 * @file src/components/guest/TryWorksheetFlow.tsx
 * @description Orchestrator for the guest "Try a Worksheet" flow.
 *
 * Manages two steps entirely in component state (no routing between them):
 *   1. Role Selection — "Who is learning today?"
 *   2. Micro-Onboarding — role-specific message + "Let's Go" CTA
 *
 * After step 2, navigates to /worksheet/new.
 * The flow renders as a full-viewport overlay on top of the landing page.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  GraduationCap,
  ClipboardList,
  Heart,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { X } from 'lucide-react';
import { setSelectedRole } from '@/lib/auth';
import { RoleSelectionScreen } from './RoleSelectionScreen';
import { RoleMicroOnboarding } from './RoleMicroOnboarding';
import type { FlowStep, RoleOption } from '@/types/guest';

// ── Role definitions (mirrors AuthModal but lives here for independence) ──

const ROLES: RoleOption[] = [
  {
    id: 'student',
    label: 'I am a Student',
    icon: GraduationCap,
    color: '#3D9AE8',
    colorLight: '#EFF6FF',
    description: 'Practice and improve your skills',
    onboardingIcon: Sparkles,
    onboardingHeadline: 'Practice smarter with AI-powered worksheets',
    onboardingBody: 'Get personalized practice, instant scoring, and explanations that help you actually learn — not just memorize.',
  },
  {
    id: 'teacher',
    label: 'I am a Teacher',
    icon: ClipboardList,
    color: '#6DB84B',
    colorLight: '#F0FDF4',
    description: 'Create and assign worksheets',
    onboardingIcon: ClipboardList,
    onboardingHeadline: 'Generate worksheets and track your class',
    onboardingBody: 'Create curriculum-aligned worksheets in seconds and see how every student performs — all from one dashboard.',
  },
  {
    id: 'parent',
    label: 'I am a Parent',
    icon: Heart,
    color: '#F5C534',
    colorLight: '#FEFCE8',
    description: "Support your child's learning",
    onboardingIcon: BarChart3,
    onboardingHeadline: "Track your child's progress",
    onboardingBody: 'See exactly how your child is doing, which subjects need attention, and celebrate their wins together.',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

interface TryWorksheetFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

const TryWorksheetFlow: React.FC<TryWorksheetFlowProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<FlowStep>('role-select');
  const [selectedRole, setRole] = React.useState<RoleOption | null>(null);

  // Reset when opening
  React.useEffect(() => {
    if (isOpen) {
      setStep('role-select');
      setRole(null);
    }
  }, [isOpen]);

  // Lock scroll when open
  React.useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleRoleSelect = (role: RoleOption) => {
    setRole(role);
    setSelectedRole(role.id);
    // Auto-advance to onboarding after a brief highlight
    setTimeout(() => setStep('onboarding'), 200);
  };

  const handleContinue = () => {
    onClose();
    navigate('/worksheet/new');
  };

  const handleBack = () => {
    if (step === 'onboarding') {
      setStep('role-select');
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-background">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>

      {/* Content */}
      <div className="h-full overflow-y-auto px-4 sm:px-6 py-16 sm:py-20 flex items-start justify-center">
        <div className="w-full max-w-3xl">
          {step === 'role-select' && (
            <RoleSelectionScreen
              roles={ROLES}
              selectedRole={selectedRole}
              onSelect={handleRoleSelect}
              onBack={onClose}
              visible={isOpen && step === 'role-select'}
            />
          )}

          {step === 'onboarding' && selectedRole && (
            <RoleMicroOnboarding
              role={selectedRole}
              onContinue={handleContinue}
              onBack={handleBack}
              visible={isOpen && step === 'onboarding'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export { TryWorksheetFlow };

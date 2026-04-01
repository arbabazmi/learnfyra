/**
 * @file src/components/AuthModal.tsx
 * @description Full-screen modal with multi-step auth flow:
 *   Step 1: Role selection (Student / Teacher / Parent)
 *   Step 2: Role-specific micro-onboarding message
 *   Step 3: Sign-in options (Google OAuth + Email)
 *   Step 4: Email entry
 *   Step 5: Email sign-in (password)
 *   Step 6: Email sign-up (full registration form)
 *   Step 7: Forgot password
 *
 * "Sign In" opens directly at step 3.
 * "Get Started" opens at step 1.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import {
  GraduationCap,
  Heart,
  ArrowRight,
  ArrowLeft,
  Shield,
  X,
  Sparkles,
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Check,
  AlertCircle,
  Loader2,
  KeyRound,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { googleOAuth, isLocal, mailhogUrl } from '@/lib/env';
import { setSelectedRole, getSelectedRole, type UserRole } from '@/lib/auth';
import {
  signIn,
  signUp,
  forgotPassword,
  validatePassword,
  isPasswordValid,
  isEmailValid,
  type AuthError,
} from '@/lib/emailAuth';

// ── Types ──────────────────────────────────────────────────────────────────

type ModalStep = 'role' | 'onboarding' | 'signin' | 'email-entry' | 'email-signin' | 'email-signup' | 'forgot-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: ModalStep;
}

// ── Role config ────────────────────────────────────────────────────────────

interface RoleConfig {
  id: UserRole;
  label: string;
  icon: React.ElementType;
  color: string;
  colorLight: string;
  description: string;
  onboardingIcon: React.ElementType;
  onboardingHeadline: string;
  onboardingBody: string;
}

const ROLES: RoleConfig[] = [
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
    onboardingHeadline: 'Assign work and monitor performance easily',
    onboardingBody: 'Generate curriculum-aligned worksheets in seconds, assign them to your class, and track every student\'s progress from one dashboard.',
  },
  {
    id: 'parent',
    label: 'I am a Parent',
    icon: Heart,
    color: '#F5C534',
    colorLight: '#FEFCE8',
    description: 'Monitor your child\'s progress',
    onboardingIcon: BarChart3,
    onboardingHeadline: 'Track your child\'s learning and progress',
    onboardingBody: 'See exactly how your child is performing, which subjects need attention, and celebrate their achievements together.',
  },
];

// ── Shared sub-components ──────────────────────────────────────────────────

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const inputCls = 'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
const inputErrorCls = 'border-destructive focus:border-destructive focus:ring-destructive/20';

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
  >
    <ArrowLeft className="size-4" />
    Back
  </button>
);

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="size-3 shrink-0" />
      {message}
    </p>
  ) : null;

const PasswordInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, onBlur, placeholder = 'Password', error, autoFocus }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`${inputCls} pl-10 pr-10 ${error ? inputErrorCls : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
};

const PasswordStrengthBar: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const { score, label, checks } = validatePassword(password);
  const colors = ['bg-destructive', 'bg-destructive', 'bg-accent', 'bg-secondary', 'bg-secondary'];
  const textColors = ['text-destructive', 'text-destructive', 'text-accent-foreground', 'text-secondary', 'text-secondary'];

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < score ? colors[score] : 'bg-surface-2'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${textColors[score]}`}>{label}</span>
        <div className="flex gap-2">
          {Object.entries(checks).map(([key, ok]) => (
            <span key={key} className={`text-[10px] font-semibold ${ok ? 'text-secondary' : 'text-muted-foreground'}`}>
              {ok ? <Check className="size-3 inline -mt-0.5 mr-0.5" /> : null}
              {key === 'length' ? '8+' : key === 'uppercase' ? 'A-Z' : key === 'number' ? '0-9' : '!@#'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialStep = 'role' }) => {
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = React.useState<ModalStep>(initialStep);
  const [selectedRole, setRole] = React.useState<RoleConfig | null>(null);
  const [direction, setDirection] = React.useState<'forward' | 'backward'>('forward');

  // Google auth state
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  // Email auth state
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [signupRole, setSignupRole] = React.useState<UserRole>(getSelectedRole() || 'student');
  const [isLoading, setIsLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');

  // Field-level validation (shown on blur)
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setRole(null);
      setDirection('forward');
      setIsGoogleLoading(false);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setSignupRole(getSelectedRole() || 'student');
      setIsLoading(false);
      setApiError('');
      setTouched({});
      setResetSent(false);
    }
  }, [isOpen, initialStep]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Navigation helpers ───────────────────────────────────────────────

  const goForward = (to: ModalStep) => { setDirection('forward'); setApiError(''); setStep(to); };
  const goBack = (to: ModalStep) => { setDirection('backward'); setApiError(''); setStep(to); };

  const handleRoleSelect = (role: RoleConfig) => {
    setRole(role);
    setSelectedRole(role.id);
    setSignupRole(role.id);
    goForward('onboarding');
  };

  // Forgot password state
  const [resetSent, setResetSent] = React.useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid(email)) return;
    setIsLoading(true);
    await forgotPassword(email);
    setIsLoading(false);
    setResetSent(true);

    // In non-local envs, close modal and redirect to code entry
    if (!isLocal) {
      setTimeout(() => {
        onClose();
        navigate('/auth/verify-reset-code', { state: { email } });
      }, 1500);
    }
  };

  const handleBack = () => {
    if (step === 'forgot-password') {
      setResetSent(false);
      goBack('email-signin');
    } else if (step === 'email-signup' || step === 'email-signin') {
      goBack('email-entry');
    } else if (step === 'email-entry') {
      goBack('signin');
    } else if (step === 'signin' && selectedRole) {
      goBack('onboarding');
    } else if (step === 'signin') {
      onClose();
    } else if (step === 'onboarding') {
      goBack('role');
    }
  };

  // ── Google OAuth ─────────────────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const res = await fetch(googleOAuth.initiateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      const data = await res.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        setIsGoogleLoading(false);
      }
    } catch {
      setIsGoogleLoading(false);
    }
  };

  // ── Email auth handlers ──────────────────────────────────────────────

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid(email)) return;
    setPassword('');
    setConfirmPassword('');
    setApiError('');
    setTouched({});
    // Go to sign-in by default — user can switch to sign-up
    goForward('email-signin');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setApiError('');
    try {
      await signIn(email, password);
      onClose();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const authErr = err as AuthError;
      setApiError(authErr.error || 'Sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !isPasswordValid(password) || password !== confirmPassword) return;
    setIsLoading(true);
    setApiError('');
    try {
      await signUp(displayName, email, password, signupRole);
      onClose();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const authErr = err as AuthError;
      if (authErr.status === 409) {
        setApiError('An account with this email already exists. Try signing in instead.');
      } else {
        setApiError(authErr.error || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Validation helpers ───────────────────────────────────────────────

  const emailError = touched.email && !isEmailValid(email) ? 'Enter a valid email address' : '';
  const passwordError = touched.password && password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters' : '';
  const confirmError = touched.confirm && confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '';
  const nameError = touched.name && !displayName.trim() ? 'Full name is required' : '';

  if (!isOpen) return null;

  const contentAnim = direction === 'forward'
    ? 'animate-[slideInRight_250ms_ease-out]'
    : 'animate-[slideInLeft_250ms_ease-out]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-white rounded-2xl border border-border shadow-xl w-[95%] max-w-md mx-auto overflow-hidden overflow-y-auto max-h-[90vh] animate-[scaleIn_250ms_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label="Authentication"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="min-h-[420px] flex flex-col" key={step}>
          <div className={contentAnim}>

            {/* ══════════════════════════════════════════════════
                Step 1: Role Selection
               ══════════════════════════════════════════════════ */}
            {step === 'role' && (
              <div className="p-6 pt-8 space-y-6">
                <div className="text-center">
                  <Logo size="sm" className="mx-auto mb-4" />
                  <h2 className="text-xl font-extrabold text-foreground">Welcome to Learnfyra</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Tell us about yourself to get started</p>
                </div>

                <div className="space-y-3">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleRoleSelect(role)}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-border bg-white text-left transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: role.colorLight }}>
                          <Icon className="size-6" style={{ color: role.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-foreground">{role.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>

                <p className="text-center text-xs text-muted-foreground pt-1">
                  Already have an account?{' '}
                  <button onClick={() => goForward('signin')} className="text-primary font-bold hover:underline">
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 2: Micro-Onboarding
               ══════════════════════════════════════════════════ */}
            {step === 'onboarding' && selectedRole && (
              <div className="p-6 pt-8 space-y-6">
                <BackButton onClick={handleBack} />
                <div className="text-center space-y-5 pt-2">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto" style={{ background: selectedRole.colorLight }}>
                    {React.createElement(selectedRole.onboardingIcon, { className: 'size-10', style: { color: selectedRole.color } })}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-foreground leading-snug">{selectedRole.onboardingHeadline}</h2>
                    <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto leading-relaxed">{selectedRole.onboardingBody}</p>
                  </div>
                  <Button variant="primary" size="lg" className="w-full gap-2 mt-4" onClick={() => goForward('signin')}>
                    Continue
                    <ArrowRight className="size-5" />
                  </Button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 3: Sign-In Options (Google + Email)
               ══════════════════════════════════════════════════ */}
            {step === 'signin' && (
              <div className="p-6 pt-8 space-y-5">
                {selectedRole && <BackButton onClick={handleBack} />}

                <div className="text-center">
                  <Logo size="sm" className="mx-auto mb-4" />
                  <h2 className="text-xl font-extrabold text-foreground">
                    {selectedRole ? `Sign in as ${selectedRole.label.replace('I am a ', '')}` : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Sign in to continue to Learnfyra</p>
                </div>

                {/* Google button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl border-2 border-border bg-white text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary-light/30 hover:shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      <span>Redirecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="size-5 shrink-0" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-muted-foreground">or</span>
                  </div>
                </div>

                {/* Email button — now functional */}
                <button
                  onClick={() => goForward('email-entry')}
                  className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl border-2 border-border bg-white text-sm font-bold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary-light/30 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Mail className="size-5 shrink-0 text-muted-foreground" />
                  <span>Continue with Email</span>
                </button>

                {/* Trust line */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Shield className="size-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Your data is encrypted and securely stored</p>
                </div>

                {!selectedRole && (
                  <p className="text-center text-xs text-muted-foreground">
                    New to Learnfyra?{' '}
                    <button onClick={() => goBack('role')} className="text-primary font-bold hover:underline">
                      Get Started
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 4: Email Entry
               ══════════════════════════════════════════════════ */}
            {step === 'email-entry' && (
              <div className="p-6 pt-8 space-y-5">
                <BackButton onClick={handleBack} />

                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
                    <Mail className="size-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-extrabold text-foreground">Enter your email</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">We'll check if you have an account</p>
                </div>

                <form onSubmit={handleEmailContinue} className="space-y-4">
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => touch('email')}
                        placeholder="you@example.com"
                        autoFocus
                        autoComplete="email"
                        className={`${inputCls} pl-10 ${emailError ? inputErrorCls : ''}`}
                      />
                    </div>
                    <FieldError message={emailError} />
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full gap-2"
                    type="submit"
                    disabled={!isEmailValid(email)}
                  >
                    Continue
                    <ArrowRight className="size-5" />
                  </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    onClick={() => { setTouched({}); setApiError(''); goForward('email-signup'); }}
                    className="text-primary font-bold hover:underline"
                  >
                    Create one
                  </button>
                </p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 5: Email Sign In
               ══════════════════════════════════════════════════ */}
            {step === 'email-signin' && (
              <div className="p-6 pt-8 space-y-5">
                <BackButton onClick={handleBack} />

                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
                    <Lock className="size-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-extrabold text-foreground">Sign in</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">{email}</p>
                </div>

                {apiError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-semibold">{apiError}</p>
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    autoFocus
                    placeholder="Password"
                    error={passwordError}
                    onBlur={() => touch('password')}
                  />

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full gap-2"
                    type="submit"
                    disabled={!password || isLoading}
                    loading={isLoading}
                  >
                    Sign In
                  </Button>
                </form>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    onClick={() => goForward('forgot-password')}
                    className="text-primary font-bold hover:underline"
                  >
                    Forgot password?
                  </button>
                  <span>
                    No account?{' '}
                    <button
                      onClick={() => { setPassword(''); setApiError(''); setTouched({}); goForward('email-signup'); }}
                      className="text-primary font-bold hover:underline"
                    >
                      Create one
                    </button>
                  </span>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 6: Email Sign Up
               ══════════════════════════════════════════════════ */}
            {step === 'email-signup' && (
              <div className="p-6 pt-8 space-y-5">
                <BackButton onClick={handleBack} />

                <div className="text-center">
                  <h2 className="text-xl font-extrabold text-foreground">Create your account</h2>
                  <p className="text-sm text-muted-foreground mt-1.5">Join thousands of learners on Learnfyra</p>
                </div>

                {apiError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-semibold">{apiError}</p>
                  </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-3">
                  {/* Full Name */}
                  <div>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onBlur={() => touch('name')}
                        placeholder="Full name"
                        autoFocus
                        autoComplete="name"
                        className={`${inputCls} pl-10 ${nameError ? inputErrorCls : ''}`}
                      />
                    </div>
                    <FieldError message={nameError} />
                  </div>

                  {/* Email */}
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => touch('email')}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={`${inputCls} pl-10 ${emailError ? inputErrorCls : ''}`}
                      />
                    </div>
                    <FieldError message={emailError} />
                  </div>

                  {/* Password */}
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    onBlur={() => touch('password')}
                    placeholder="Create password"
                  />
                  <PasswordStrengthBar password={password} />

                  {/* Confirm Password */}
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    onBlur={() => touch('confirm')}
                    placeholder="Confirm password"
                    error={confirmError}
                  />

                  {/* Role selector */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                      I am a
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['student', 'teacher', 'parent'] as UserRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSignupRole(r)}
                          className={`h-10 rounded-xl border-2 text-sm font-bold capitalize transition-all duration-150 ${
                            signupRole === r
                              ? 'border-primary bg-primary-light text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full gap-2 mt-1"
                    type="submit"
                    disabled={!displayName.trim() || !isEmailValid(email) || !isPasswordValid(password) || password !== confirmPassword || isLoading}
                    loading={isLoading}
                  >
                    Create Account
                  </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setPassword(''); setConfirmPassword(''); setApiError(''); setTouched({}); goForward('email-signin'); }}
                    className="text-primary font-bold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                Step 7: Forgot Password
               ══════════════════════════════════════════════════ */}
            {step === 'forgot-password' && (
              <div className="p-6 pt-8 space-y-5">
                <BackButton onClick={handleBack} />

                {!resetSent ? (
                  <>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4">
                        <KeyRound className="size-7 text-accent-foreground" />
                      </div>
                      <h2 className="text-xl font-extrabold text-foreground">Forgot your password?</h2>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        Enter your email and we'll send you a reset link.
                      </p>
                    </div>

                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => touch('email')}
                            placeholder="you@example.com"
                            autoFocus
                            autoComplete="email"
                            className={`${inputCls} pl-10 ${emailError ? inputErrorCls : ''}`}
                          />
                        </div>
                        <FieldError message={emailError} />
                      </div>

                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full gap-2"
                        type="submit"
                        disabled={!isEmailValid(email) || isLoading}
                        loading={isLoading}
                      >
                        Send Reset Link
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="text-center space-y-4 pt-4">
                    <div className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto">
                      <CheckCircle className="size-8 text-secondary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-foreground">Check your email</h2>
                      {isLocal ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            A reset link has been sent to <span className="font-bold text-foreground">{email}</span>.
                          </p>
                          <a
                            href={mailhogUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                          >
                            Open Mailhog ({mailhogUrl})
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                          We've sent a verification code to <span className="font-bold text-foreground">{email}</span>.
                          Redirecting...
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="md"
                      className="gap-2"
                      onClick={() => { setResetSent(false); goBack('email-signin'); }}
                    >
                      <ArrowLeft className="size-4" />
                      Back to Sign In
                    </Button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export { AuthModal };
export type { ModalStep };

/**
 * @file src/pages/SettingsPage.tsx
 * @description Settings page — profile, learning preferences, notifications,
 * appearance, and account management for Learnfyra students.
 */

import * as React from 'react';
import {
  Camera,
  Download,
  Trash2,
  Sun,
  Moon,
  Monitor,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/env';
import { getToken } from '@/lib/auth';

// ── Inline toggle switch ────────────────────────────────────────────────────

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, disabled = false }) => (
  <label
    htmlFor={id}
    className={cn(
      'relative inline-flex items-center cursor-pointer shrink-0',
      disabled && 'opacity-40 pointer-events-none',
    )}
    aria-label="Toggle"
  >
    <input
      id={id}
      type="checkbox"
      className="sr-only"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    {/* Track */}
    <span
      className={cn(
        'block w-11 h-6 rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-border',
      )}
    />
    {/* Dot */}
    <span
      className={cn(
        'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0',
      )}
    />
  </label>
);

// ── Section header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest mb-5">
    {children}
  </h2>
);

// ── Toggle row ──────────────────────────────────────────────────────────────

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ id, label, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-6 py-3.5 border-b border-border last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <ToggleSwitch id={id} checked={checked} onChange={onChange} />
  </div>
);

// ── Input styling constant ──────────────────────────────────────────────────

const inputCls =
  'w-full h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

const selectCls = inputCls + ' cursor-pointer';

// ── Google SVG icon (inline, no external dependency) ───────────────────────

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// ── Save toast ──────────────────────────────────────────────────────────────

const SaveToast: React.FC<{ visible: boolean; isError?: boolean; message?: string }> = ({ visible, isError = false, message }) => (
  <div
    className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5',
      'text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg',
      'transition-all duration-300',
      isError ? 'bg-destructive' : 'bg-foreground',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
    )}
    role="status"
    aria-live="polite"
  >
    {isError ? (
      <AlertTriangle className="size-4 shrink-0" />
    ) : (
      <CheckCircle className="size-4 text-secondary shrink-0" />
    )}
    {message || 'Changes saved successfully'}
  </div>
);

// ── Theme option card ───────────────────────────────────────────────────────

interface ThemeCardProps {
  value: string;
  label: string;
  icon: React.ElementType;
  selected: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ value, label, icon: Icon, selected, disabled = false, onChange }) => (
  <label
    className={cn(
      'relative flex flex-col items-center gap-2.5 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all duration-150',
      selected
        ? 'border-primary bg-primary-light'
        : 'border-border bg-surface hover:border-primary/40',
      disabled && 'opacity-40 cursor-not-allowed',
    )}
  >
    <input
      type="radio"
      name="theme"
      value={value}
      checked={selected}
      disabled={disabled}
      onChange={() => !disabled && onChange(value)}
      className="sr-only"
    />
    <Icon
      className={cn('size-5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
    />
    <span
      className={cn(
        'text-xs font-bold',
        selected ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {label}
    </span>
    {disabled && (
      <Badge variant="warning" className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0">
        Coming Soon
      </Badge>
    )}
  </label>
);

// ── Main page ───────────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  usePageMeta({
    title: 'Settings',
    description: 'Manage your Learnfyra profile, learning preferences, notifications, and account settings.',
    keywords: 'settings, profile, preferences, notifications, account',
  });

  const auth = useAuth();

  // ── Profile state — seeded from auth context ────────────────────────────
  const [fullName, setFullName]   = React.useState('');
  const [email, setEmail]         = React.useState('');
  const [authType, setAuthType]   = React.useState('');
  const [grade, setGrade]         = React.useState('');
  const [profileLoading, setProfileLoading] = React.useState(true);

  // Seed from auth context immediately, then fetch full profile from API
  React.useEffect(() => {
    if (auth.user) {
      setFullName(auth.user.displayName || '');
      setEmail(auth.user.email || '');
    }

    const token = getToken();
    if (!token) { setProfileLoading(false); return; }

    fetch(`${apiUrl}/api/student/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.displayName) setFullName(data.displayName);
          if (data.email) setEmail(data.email);
          if (data.grade) setGrade(String(data.grade));
          if (data.authType) setAuthType(data.authType);
        }
      })
      .catch(() => { /* profile fetch failed — use auth context data */ })
      .finally(() => setProfileLoading(false));
  }, [auth.user]);

  // ── Learning preferences state ───────────────────────────────────────────
  const [defaultSubject,    setDefaultSubject]    = React.useState('Math');
  const [defaultDifficulty, setDefaultDifficulty] = React.useState('Medium');
  const [questionCount,     setQuestionCount]     = React.useState(10);
  const [timedMode,         setTimedMode]         = React.useState(false);
  const [soundEffects,      setSoundEffects]      = React.useState(true);

  // ── Notifications state ──────────────────────────────────────────────────
  const [streakReminders,  setStreakReminders]  = React.useState(true);
  const [weeklyReports,    setWeeklyReports]    = React.useState(true);
  const [newWorksheets,    setNewWorksheets]    = React.useState(true);
  const [achievementAlerts, setAchievementAlerts] = React.useState(false);

  // ── Appearance state ─────────────────────────────────────────────────────
  const [theme, setTheme] = React.useState('light');

  // ── Toast state ──────────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = React.useState(false);
  const [toastError, setToastError] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2800);
  };

  React.useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const isGoogleAuth = authType.includes('google') || authType.includes('oauth');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) { showToast('You must be signed in to save.', true); return; }
    try {
      const res = await fetch(`${apiUrl}/api/student/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: fullName, grade: grade ? Number(grade) : undefined }),
      });
      if (res.ok) {
        showToast('Profile saved successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to save profile.', true);
      }
    } catch {
      showToast('Network error. Please try again.', true);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: PATCH /api/preferences
    showToast('Preferences saved successfully');
  };

  return (
    <AppLayout pageTitle="Settings">
      <div className="p-6 space-y-6 max-w-3xl mx-auto">

        {/* ── 1. Profile ───────────────────────────────────────────── */}
        <section aria-label="Profile settings">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <SectionHeader>Profile</SectionHeader>

            <form onSubmit={handleSaveProfile} noValidate>
              {/* Avatar */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-extrabold select-none"
                    style={{ background: 'linear-gradient(135deg, #3D9AE8 0%, #6DB84B 100%)' }}
                    aria-label={`Profile avatar — initials ${initials}`}
                  >
                    {profileLoading ? '...' : initials}
                  </div>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-sm hover:bg-primary-hover transition-colors"
                    aria-label="Change profile photo"
                  >
                    <Camera className="size-3.5 text-white" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Full name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className={inputCls}
                    autoComplete="name"
                  />
                </div>

                {/* Email — read-only */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    {isGoogleAuth && (
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                        <GoogleIcon className="size-4" />
                      </div>
                    )}
                    <input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className={cn(
                        inputCls,
                        'opacity-75 cursor-not-allowed bg-muted',
                        isGoogleAuth ? 'pl-10 pr-36' : 'pr-36',
                      )}
                      aria-describedby="emailHint"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <Badge variant="success" id="emailHint">
                        {isGoogleAuth ? 'Connected via Google' : 'Email account'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Grade */}
                <div>
                  <label
                    htmlFor="grade"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Grade
                  </label>
                  <select
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className={selectCls}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={String(g)}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <Button type="submit" variant="primary" size="md">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* ── 2. Learning Preferences ──────────────────────────────── */}
        <section aria-label="Learning preferences">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <SectionHeader>Learning Preferences</SectionHeader>

            <form onSubmit={handleSavePreferences} noValidate>
              <div className="space-y-4">
                {/* Default subject */}
                <div>
                  <label
                    htmlFor="defaultSubject"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Default Subject
                  </label>
                  <select
                    id="defaultSubject"
                    value={defaultSubject}
                    onChange={(e) => setDefaultSubject(e.target.value)}
                    className={selectCls}
                  >
                    {['Math', 'ELA', 'Science', 'Social Studies', 'Health'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Default difficulty */}
                <div>
                  <label
                    htmlFor="defaultDifficulty"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Default Difficulty
                  </label>
                  <select
                    id="defaultDifficulty"
                    value={defaultDifficulty}
                    onChange={(e) => setDefaultDifficulty(e.target.value)}
                    className={selectCls}
                  >
                    {['Easy', 'Medium', 'Hard', 'Mixed'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Default question count */}
                <div>
                  <label
                    htmlFor="questionCount"
                    className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5"
                  >
                    Default Question Count
                    <span className="ml-2 text-primary font-extrabold normal-case tracking-normal">
                      {questionCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuestionCount((n) => Math.max(5, n - 1))}
                      disabled={questionCount <= 5}
                      className="w-11 h-11 rounded-xl border border-border bg-surface text-foreground font-bold text-lg flex items-center justify-center hover:border-primary hover:bg-primary-light transition-all disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Decrease question count"
                    >
                      −
                    </button>
                    <input
                      id="questionCount"
                      type="number"
                      min={5}
                      max={30}
                      value={questionCount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) setQuestionCount(Math.min(30, Math.max(5, v)));
                      }}
                      className={cn(inputCls, 'text-center flex-1')}
                      aria-label="Question count"
                    />
                    <button
                      type="button"
                      onClick={() => setQuestionCount((n) => Math.min(30, n + 1))}
                      disabled={questionCount >= 30}
                      className="w-11 h-11 rounded-xl border border-border bg-surface text-foreground font-bold text-lg flex items-center justify-center hover:border-primary hover:bg-primary-light transition-all disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Increase question count"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Range: 5 – 30 questions</p>
                </div>

                {/* Toggle rows */}
                <div className="pt-1">
                  <ToggleRow
                    id="timedMode"
                    label="Enable timed mode by default"
                    description="Start a countdown timer automatically when you open a worksheet."
                    checked={timedMode}
                    onChange={setTimedMode}
                  />
                  <ToggleRow
                    id="soundEffects"
                    label="Play sounds on correct/incorrect answers"
                    description="Hear a chime for correct answers and a soft buzz for incorrect ones."
                    checked={soundEffects}
                    onChange={setSoundEffects}
                  />
                </div>
              </div>

              <div className="mt-6">
                <Button type="submit" variant="primary" size="md">
                  Save Preferences
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* ── 3. Notifications ────────────────────────────────────── */}
        <section aria-label="Notification settings">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <SectionHeader>Notifications</SectionHeader>

            <div>
              <ToggleRow
                id="streakReminders"
                label="Streak reminders"
                description="Get reminded to maintain your streak."
                checked={streakReminders}
                onChange={setStreakReminders}
              />
              <ToggleRow
                id="weeklyReports"
                label="Weekly reports"
                description="Receive a weekly progress summary."
                checked={weeklyReports}
                onChange={setWeeklyReports}
              />
              <ToggleRow
                id="newWorksheets"
                label="New worksheets"
                description="Notify when teacher assigns new worksheets."
                checked={newWorksheets}
                onChange={setNewWorksheets}
              />
              <ToggleRow
                id="achievementAlerts"
                label="Achievement alerts"
                description="Get notified when you earn a badge."
                checked={achievementAlerts}
                onChange={setAchievementAlerts}
              />
            </div>
          </div>
        </section>

        {/* ── 4. Appearance ───────────────────────────────────────── */}
        <section aria-label="Appearance settings">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <SectionHeader>Appearance</SectionHeader>

            <fieldset>
              <legend className="sr-only">Choose theme</legend>
              <div className="grid grid-cols-3 gap-3">
                <ThemeCard
                  value="light"
                  label="Light"
                  icon={Sun}
                  selected={theme === 'light'}
                  onChange={setTheme}
                />
                <ThemeCard
                  value="dark"
                  label="Dark"
                  icon={Moon}
                  selected={theme === 'dark'}
                  disabled
                  onChange={setTheme}
                />
                <ThemeCard
                  value="system"
                  label="System"
                  icon={Monitor}
                  selected={theme === 'system'}
                  disabled
                  onChange={setTheme}
                />
              </div>
            </fieldset>
          </div>
        </section>

        {/* ── 5. Account ──────────────────────────────────────────── */}
        <section aria-label="Account settings">
          <div className="bg-white rounded-2xl border border-border shadow-card p-6">
            <SectionHeader>Account</SectionHeader>

            {/* Export data */}
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row py-4 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
                  <Download className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Export My Data</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download all your worksheets, scores, and progress as a ZIP file.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  // TODO: GET /api/export-data
                }}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>

            {/* Danger zone */}
            <div
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
              role="region"
              aria-label="Danger zone"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 text-destructive shrink-0" />
                <span className="text-xs font-bold text-destructive uppercase tracking-widest">
                  Danger Zone
                </span>
              </div>
              <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 className="size-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Delete Account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permanently delete your account and all data. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    // TODO: show confirmation modal before calling DELETE /api/account
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── Save toast ────────────────────────────────────────────── */}
      <SaveToast visible={toastVisible} isError={toastError} message={toastMessage} />
    </AppLayout>
  );
};

export default SettingsPage;

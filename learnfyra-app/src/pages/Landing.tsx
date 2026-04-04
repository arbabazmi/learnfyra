/**
 * @file src/pages/Landing.tsx
 * @description Learnfyra landing page — premium SaaS UI
 *
 * Typography:  Nunito 800 (headings) · Nunito 400-700 (body) · Handlee (hero accent only)
 * Colors:      Primary #3D9AE8 · Secondary #6DB84B · Accent #F5C534
 * Grid:        8px base · max-w-7xl · px-4/6/8 per breakpoint
 */

import * as React from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Sparkles,
  TrendingUp,
  BookOpen,
  Users,
  CheckCircle,
  ArrowRight,
  GraduationCap,
  Star,
  Timer,
  BarChart3,
  FileText,
  ChevronRight,
  Brain,
  Award,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Badge } from '@/components/ui/Badge';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthModal, type ModalStep } from '@/components/AuthModal';
import { RoleSelectionPanel } from '@/components/guest/RoleSelectionPanel';
import { SmartSearchBox } from '@/components/search/SmartSearchBox';
import { useAuth } from '@/contexts/AuthContext';
import { useInView } from '@/hooks/useInView';
import { usePageMeta } from '@/lib/pageMeta';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — SectionLabel (one consistent overline style across all sections)
// ─────────────────────────────────────────────────────────────────────────────

interface SectionLabelProps {
  children: React.ReactNode;
  color?: string;
}
const SectionLabel: React.FC<SectionLabelProps> = ({ children, color = 'text-primary' }) => (
  <p className={`text-xs font-bold tracking-[0.12em] uppercase ${color}`}>{children}</p>
);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — FadeIn wrapper (scroll-triggered, one-shot)
// ─────────────────────────────────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
}
const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, className = '', style, as: Tag = 'div' }) => {
  const { ref, inView } = useInView();
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      className={[
        className,
        'transition-all duration-700 ease-out',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
      ].join(' ')}
    >
      {children}
    </Tag>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO — Worksheet solver mockup (right panel)
// ─────────────────────────────────────────────────────────────────────────────

const WorksheetMockup: React.FC = () => {
  const options = [
    { label: 'A', text: 'x = 3' },
    { label: 'B', text: 'x = 4' },
    { label: 'C', text: 'x = 6' },
    { label: 'D', text: 'x = 8' },
  ];

  return (
    /* overflow-hidden prevents floating badges from causing horizontal scroll on mobile */
    <div className="relative animate-float" style={{ isolation: 'isolate' }}>
      {/* Ambient glow */}
      <div
        className="absolute -inset-8 rounded-3xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(61,154,232,0.13) 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-white rounded-2xl border border-border overflow-hidden w-full max-w-[340px] mx-auto shadow-[0_4px_32px_rgba(0,0,0,0.10)]">

        {/* Header bar */}
        <div className="flex items-center justify-between bg-primary px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-white/80" />
            <span className="text-white text-[11px] font-bold tracking-wider uppercase">AI Worksheet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-[11px]">Grade 7 · Math</span>
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
              <Timer className="size-3 text-white" />
              <span className="text-white text-[11px] font-semibold">8:42</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 pt-3 pb-3 border-b border-border">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Question 3 of 10</span>
            <span className="text-[11px] font-bold text-primary">30%</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full w-[30%] bg-primary rounded-full" />
          </div>
        </div>

        {/* Question */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Multiple Choice
          </p>
          <p className="text-sm font-bold text-foreground mb-4 leading-snug">
            Solve for <em>x</em>:{' '}
            <span className="font-accent text-[15px] text-primary">2x + 5 = 13</span>
          </p>

          {/* Options — display only, no interaction to avoid dead-end affordance */}
          <div className="space-y-2">
            {options.map((opt) => {
              const isSelected = opt.label === 'B';
              return (
                <div
                  key={opt.label}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold',
                    isSelected
                      ? 'border-primary bg-primary-light text-primary'
                      : 'border-border bg-surface text-foreground',
                  ].join(' ')}
                  aria-selected={isSelected}
                >
                  <span
                    className={[
                      'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      isSelected ? 'bg-primary text-white' : 'bg-border/70 text-muted-foreground',
                    ].join(' ')}
                  >
                    {opt.label}
                  </span>
                  {opt.text}
                  {isSelected && <CheckCircle className="size-4 ml-auto text-primary shrink-0" />}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full w-[92%] bg-secondary rounded-full" />
              </div>
              <span className="text-[11px] font-bold text-secondary shrink-0">92%</span>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>24 completed</span>
              <span>15h study time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — achievement (top right, clipped to parent bounds) */}
      <div
        className="absolute -top-3 -right-3 bg-accent rounded-xl px-2.5 py-1.5 shadow-card border border-accent/30"
        style={{ zIndex: 10 }}
      >
        <div className="flex items-center gap-1.5">
          <Award className="size-3.5 text-accent-foreground shrink-0" />
          <span className="text-[11px] font-bold text-accent-foreground whitespace-nowrap">+50 XP</span>
        </div>
      </div>

      {/* Floating badge — AI explanation (bottom left) */}
      <div
        className="absolute -bottom-2 -left-2 bg-white rounded-xl px-2.5 py-1.5 shadow-card border border-border"
        style={{ zIndex: 10 }}
      >
        <div className="flex items-center gap-1.5">
          <Brain className="size-3.5 text-secondary shrink-0" />
          <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">AI Explanation Ready</span>
        </div>
      </div>
    </div>
  );
};

interface HeroProps {
  onTryWorksheet: () => void;
  ctaLabel?: string;
  externalGrade?: string | null;
  onExternalGradeHandled?: () => void;
}

const HeroSection: React.FC<HeroProps> = ({ onTryWorksheet, ctaLabel = 'Try a Worksheet', externalGrade, onExternalGradeHandled }) => (
  <section id="hero" className="relative overflow-hidden bg-white">
    {/* Dot grid */}
    <div className="absolute inset-0 bg-dot-pattern opacity-50 pointer-events-none" aria-hidden="true" />
    {/* Radial glow */}
    <div
      className="absolute top-0 left-1/3 w-[640px] h-[520px] -translate-x-1/2 -translate-y-1/3 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse, rgba(61,154,232,0.10) 0%, transparent 68%)' }}
      aria-hidden="true"
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
      <div className="grid lg:grid-cols-[56fr_44fr] gap-16 items-center">

        {/* Left — copy */}
        <div>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary-light text-primary border border-primary/20 rounded-full px-4 py-1.5 text-[13px] font-bold mb-5 animate-fade-up">
            <Sparkles className="size-3.5 shrink-0" />
            AI-Powered · USA Curriculum Aligned
          </div>

          {/* Headline */}
          <div className="animate-fade-up delay-100">
            <h1 className="text-5xl sm:text-6xl lg:text-[4.25rem] font-extrabold leading-[1.08] tracking-tight text-foreground">
              Learn Smarter.
              <br />
              <span className="text-gradient-brand">Score Higher.</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mt-7 text-[17px] text-muted-foreground leading-relaxed max-w-[500px] animate-fade-up delay-200">
            AI-generated worksheets for Grades&nbsp;1–10, aligned to CCSS and NGSS.
            Solve online, get instant feedback, and watch every score improve.
          </p>

          {/* ── Smart Search Box ──────────────────────────── */}
          <div className="mt-8 animate-fade-up delay-300 relative z-30">
            <SmartSearchBox externalGrade={externalGrade} onExternalGradeHandled={onExternalGradeHandled} />
          </div>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-wrap gap-4 animate-fade-up delay-400 relative z-10">
            <Button
              variant="primary"
              size="lg"
              className="gap-2 shadow-primary-sm hover:shadow-primary-md"
              onClick={onTryWorksheet}
            >
              {ctaLabel}
              <ArrowRight className="size-5" />
            </Button>
            <Button variant="ghost" size="lg" className="gap-2 border border-border hover:border-primary/30" asChild>
              <Link to="#how-it-works">
                See How It Works
                <ChevronRight className="size-5" />
              </Link>
            </Button>
          </div>

        </div>

        {/* Right — mockup */}
        <div className="flex justify-center lg:justify-end animate-fade-in delay-200">
          <WorksheetMockup />
        </div>
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STRIP — stats only, no duplicate content from hero
// ─────────────────────────────────────────────────────────────────────────────

const TrustStrip: React.FC<{ onGradeClick?: (grade: string) => void }> = ({ onGradeClick }) => {
  const grades = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

  return (
    <section className="bg-surface border-y border-border py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Grade chips — clickable, feeds into search box */}
        <div className="flex flex-wrap justify-center gap-2">
          {grades.map((g) => (
            <button
              key={g}
              onClick={() => {
                onGradeClick?.(g);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-block px-3 py-1 rounded-full bg-white border border-border text-[12px] font-semibold text-muted-foreground hover:border-primary/40 hover:bg-primary-light hover:text-primary transition-all cursor-pointer"
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES — bento grid (lg:col-span-2 — fixed from sm:col-span-2)
// ─────────────────────────────────────────────────────────────────────────────

interface BentoFeature {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
  accentLight: string;
  wide?: boolean;
}

const bentoFeatures: BentoFeature[] = [
  {
    icon: Sparkles,
    title: 'AI-Powered Generation',
    description:
      'Claude AI crafts unique, curriculum-aligned worksheets in seconds — calibrated to any grade, subject, topic, and difficulty level you choose. Never see the same question twice.',
    accent: '#3D9AE8',
    accentLight: '#EFF6FF',
    wide: true,
  },
  {
    icon: Timer,
    title: 'Timed + Untimed Modes',
    description: 'Practice under real exam conditions or explore at your own pace. Auto-submit when time expires.',
    accent: '#6DB84B',
    accentLight: '#F0FDF4',
  },
  {
    icon: CheckCircle,
    title: 'Instant AI Feedback',
    description: 'Every answer validated immediately. Clear explanations show exactly why an answer is right or wrong.',
    accent: '#F5C534',
    accentLight: '#FEFCE8',
  },
  {
    icon: BarChart3,
    title: 'Progress Analytics',
    description: 'Visual dashboards track scores over time, highlight weak areas, and celebrate consistent improvement.',
    accent: '#f97316',
    accentLight: '#FFF7ED',
  },
  {
    icon: FileText,
    title: 'Every Question Type',
    description:
      'Multiple choice, fill-in-the-blank, short answer, true/false, matching, and word problems — every format students face in real exams, covered.',
    accent: '#8b5cf6',
    accentLight: '#F5F3FF',
    wide: true,
  },
  {
    icon: Users,
    title: 'Teacher & Parent Portal',
    description: 'Assign worksheets, monitor class progress, and export reports — all in one dashboard.',
    accent: '#ec4899',
    accentLight: '#FDF2F8',
  },
];

const FeaturesSection: React.FC = () => {
  const { ref, inView } = useInView();

  return (
    <section id="features" className="py-24 bg-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="text-center mb-14 space-y-3">
          <SectionLabel>Features</SectionLabel>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mt-2">
            Everything Learners Need. Nothing Extra.
          </h2>
          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
            Built around how students actually learn — with the tools teachers have always wanted.
          </p>
        </FadeIn>

        {/* Bento grid — lg:col-span-2 so wide cards only span on 3-col layout */}
        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {bentoFeatures.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={[
                  'group relative rounded-2xl border border-border bg-white p-7 overflow-hidden',
                  'transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong',
                  'shadow-card hover:shadow-card-hover',
                  feat.wide ? 'lg:col-span-2' : '',
                  'transition-all duration-700 ease-out',
                  inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                ].join(' ')}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: feat.accentLight }}
                >
                  <Icon className="size-6" style={{ color: feat.accent }} />
                </div>

                {/* Title — bumped up from text-base to text-[17px] for clear hierarchy */}
                <h3 className="text-[17px] font-extrabold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>

                {/* Decorative corner */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-tr-2xl rounded-bl-[4rem] opacity-[0.06] pointer-events-none"
                  style={{ background: feat.accent }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PREVIEW — browser-framed mockup with legible text
// ─────────────────────────────────────────────────────────────────────────────

const DashboardPreviewSection: React.FC = () => {
  const subjectBars = [
    { name: 'Algebra', score: 88, color: '#3D9AE8' },
    { name: 'Reading', score: 74, color: '#6DB84B' },
    { name: 'Science', score: 91, color: '#F5C534' },
    { name: 'History', score: 67, color: '#f97316' },
  ];

  const recentWorksheets = [
    { title: 'Linear Equations', subject: 'Math · Gr 7', score: '9/10', done: true },
    { title: 'Cell Biology', subject: 'Science · Gr 7', score: '8/10', done: true },
    { title: 'American Revolution', subject: 'History · Gr 7', score: null, done: false },
  ];

  return (
    <section id="dashboard" className="py-24 bg-surface scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn className="text-center mb-12 space-y-3">
          <SectionLabel color="text-secondary">Product Preview</SectionLabel>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mt-2">
            A Dashboard Built for Real Learning
          </h2>
          <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
            Students, teachers, and parents each get a purpose-built view — no clutter, just what matters.
          </p>
        </FadeIn>

        {/* Browser frame */}
        <FadeIn delay={150}>
          <div className="relative max-w-5xl mx-auto">
            {/* Ambient glow */}
            <div
              className="absolute -inset-6 rounded-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(61,154,232,0.08) 0%, transparent 70%)' }}
              aria-hidden="true"
            />

            <div className="relative rounded-2xl border border-border overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.11)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-3 bg-surface-2 border-b border-border px-4 py-3">
                <div className="flex gap-1.5 shrink-0">
                  {['#ff5f57', '#ffbd2e', '#28ca42'].map((c) => (
                    <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-muted-foreground border border-border text-center max-w-[280px] mx-auto">
                  learnfyra.com / student / dashboard
                </div>
              </div>

              {/* App shell */}
              <div className="bg-white flex" style={{ minHeight: '420px' }}>
                {/* Sidebar */}
                <div className="w-48 border-r border-border bg-surface shrink-0 p-4 space-y-1">
                  <div className="mb-5 px-1">
                    <Logo size="sm" className="h-7 w-auto" />
                  </div>
                  {[
                    { icon: BarChart3, label: 'Dashboard', active: true },
                    { icon: FileText, label: 'Worksheets', active: false },
                    { icon: TrendingUp, label: 'Progress', active: false },
                    { icon: Award, label: 'Achievements', active: false },
                  ].map(({ icon: Icon, label, active }) => (
                    <div
                      key={label}
                      className={[
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold',
                        active ? 'bg-primary-light text-primary' : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      <Icon className="size-4 shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Main */}
                <div className="flex-1 p-6 space-y-5 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-foreground">Welcome back, Priya</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Grade 7 · Math · 3 new worksheets ready</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="success" className="text-xs">92% Accuracy</Badge>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">PS</div>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { val: '24', lbl: 'Completed', color: '#3D9AE8' },
                      { val: '8', lbl: 'In Progress', color: '#F5C534' },
                      { val: '92%', lbl: 'Best Score', color: '#6DB84B' },
                      { val: '15h', lbl: 'Study Time', color: '#f97316' },
                    ].map((s) => (
                      <div key={s.lbl} className="bg-surface rounded-xl p-3 border border-border">
                        <div className="text-[17px] font-extrabold" style={{ color: s.color }}>{s.val}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Two columns */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Subject scores */}
                    <div className="bg-surface rounded-xl border border-border p-4">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                        Subject Scores
                      </p>
                      <div className="space-y-3">
                        {subjectBars.map((s) => (
                          <div key={s.name}>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-foreground">{s.name}</span>
                              <span style={{ color: s.color }}>{s.score}%</span>
                            </div>
                            <div className="h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${s.score}%`, background: s.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent worksheets */}
                    <div className="bg-surface rounded-xl border border-border p-4">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                        Recent Worksheets
                      </p>
                      <div className="space-y-3">
                        {recentWorksheets.map((w) => (
                          <div key={w.title} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{w.title}</p>
                              <p className="text-[11px] text-muted-foreground">{w.subject}</p>
                            </div>
                            {w.done ? (
                              <span className="text-xs font-bold text-secondary shrink-0">{w.score}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-primary bg-primary-light rounded-full px-2 py-0.5 shrink-0">New</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS — 3 steps
// ─────────────────────────────────────────────────────────────────────────────

const steps = [
  {
    number: '01',
    title: 'Generate Your Worksheet',
    description:
      'Pick grade, subject, topic, and difficulty. Our AI builds a perfectly calibrated worksheet in under 10 seconds — ready to print or solve online.',
    icon: Sparkles,
    bg: 'bg-primary',
    fg: 'text-white',
  },
  {
    number: '02',
    title: 'Solve & Get Feedback',
    description:
      'Complete the worksheet in timed or untimed mode. Submit and receive an instant score with step-by-step AI explanations for every answer.',
    icon: CheckCircle,
    bg: 'bg-secondary',
    fg: 'text-white',
  },
  {
    number: '03',
    title: 'Track Your Growth',
    description:
      'See detailed analytics, earn achievement badges, and watch scores climb over time. Teachers and parents get the same visibility.',
    icon: TrendingUp,
    bg: 'bg-accent',
    fg: 'text-accent-foreground',
  },
];

const HowItWorksSection: React.FC = () => (
  <section id="how-it-works" className="py-24 bg-white scroll-mt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeIn className="text-center mb-16 space-y-3">
        <SectionLabel>How It Works</SectionLabel>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mt-2">
          Three Steps to Better Grades
        </h2>
        <p className="text-[17px] text-muted-foreground max-w-xl mx-auto">
          From worksheet generation to score review — the whole learning loop, in one place.
        </p>
      </FadeIn>

      <div className="relative grid lg:grid-cols-3 gap-10 lg:gap-8">
        {/* Dashed connector — desktop only, correctly positioned */}
        <div
          className="hidden lg:block absolute top-[3rem] left-[calc(33.33%_-_0px)] right-[calc(33.33%_-_0px)] h-px"
          style={{
            background: 'repeating-linear-gradient(90deg, rgba(61,154,232,0.22) 0, rgba(61,154,232,0.22) 8px, transparent 8px, transparent 18px)',
          }}
          aria-hidden="true"
        />

        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <FadeIn key={step.number} delay={i * 120} className="flex flex-col items-center text-center">
              {/* Ghost number — positioned safely within the column */}
              <div className="relative mb-6">
                <span
                  className="absolute inset-0 flex items-center justify-center text-[5.5rem] font-black text-foreground/[0.04] select-none pointer-events-none leading-none translate-y-2"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <div
                  className={`relative z-10 w-24 h-24 rounded-3xl ${step.bg} flex items-center justify-center shadow-card`}
                >
                  <Icon className={`size-11 ${step.fg}`} />
                </div>
              </div>

              <h3 className="text-xl font-extrabold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{step.description}</p>
            </FadeIn>
          );
        })}
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CARDS
// ─────────────────────────────────────────────────────────────────────────────

const roleCards = [
  {
    title: 'For Students',
    description:
      'Practice anytime, get instant AI feedback, earn badges, and level up subject by subject.',
    cta: 'Start Learning',
    icon: GraduationCap,
    gradientFrom: '#3D9AE8',
    gradientTo: '#2d87d4',
    darkText: false,
    highlights: ['Timed & untimed practice', 'Instant score + explanations', 'Achievement badges & streaks'],
  },
  {
    title: 'For Teachers',
    description:
      'Generate AI worksheets in seconds, assign to your class, and monitor every student from one clean dashboard.',
    cta: 'Create Worksheets',
    icon: BookOpen,
    gradientFrom: '#6DB84B',
    gradientTo: '#5ca33e',
    darkText: false,
    highlights: ['Export PDF, DOCX, or HTML', 'Class-level progress view', 'Saves hours of prep weekly'],
  },
  {
    title: 'For Parents',
    description:
      'Stay connected to your child\'s learning journey with weekly progress reports and subject breakdowns.',
    cta: 'View Progress',
    icon: Users,
    gradientFrom: '#F5C534',
    gradientTo: '#e6b520',
    darkText: true,
    highlights: ['Weekly progress summaries', 'Score history & trends', 'Subject-level breakdown'],
  },
];

const RoleCardsSection: React.FC = () => (
  <section id="for-schools" className="py-24 bg-surface scroll-mt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeIn className="text-center mb-14 space-y-3">
        <SectionLabel>Built for Everyone</SectionLabel>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mt-2">
          Every Role. One Platform.
        </h2>
        <p className="text-[17px] text-muted-foreground max-w-xl mx-auto">
          Students practice, teachers create, parents track — all under one roof.
        </p>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-6">
        {roleCards.map((role, i) => {
          const Icon = role.icon;
          const textMain = role.darkText ? 'text-foreground' : 'text-white';
          const textSub = role.darkText ? 'text-foreground/65' : 'text-white/80';

          return (
            <FadeIn
              key={role.title}
              delay={i * 100}
              className="relative rounded-2xl p-8 overflow-hidden hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.13)] transition-all duration-200 cursor-default"
              style={{ background: `linear-gradient(140deg, ${role.gradientFrom} 0%, ${role.gradientTo} 100%)` } as React.CSSProperties}
            >
              {/* Decorative circles */}
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
              <div className="absolute -bottom-12 -left-6 w-56 h-56 rounded-full bg-white/[0.06] pointer-events-none" aria-hidden="true" />

              <div className="relative space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Icon className={`size-7 ${textMain}`} />
                </div>
                <div>
                  <h3 className={`text-[22px] font-extrabold mb-2 ${textMain}`}>{role.title}</h3>
                  <p className={`text-sm leading-relaxed ${textSub}`}>{role.description}</p>
                </div>
                <ul className="space-y-2">
                  {role.highlights.map((h) => (
                    <li key={h} className={`flex items-center gap-2 text-[13px] font-semibold ${textSub}`}>
                      <CheckCircle className={`size-3.5 shrink-0 ${textMain} opacity-75`} />
                      {h}
                    </li>
                  ))}
                </ul>
                <button
                  className={[
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-150',
                    role.darkText ? 'bg-black/10 hover:bg-black/18 text-foreground' : 'bg-white/20 hover:bg-white/30 text-white',
                  ].join(' ')}
                >
                  {role.cta}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIALS
// ─────────────────────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      "My daughter's math scores jumped from a C+ to an A in one semester. The instant feedback actually helped her understand where she went wrong — not just what the right answer was.",
    name: 'Emma K.',
    role: 'Parent · Grade 8 Student',
    initials: 'EK',
    avatarBg: '#3D9AE8',
    darkInitials: false,
  },
  {
    quote:
      "I used to spend Sunday nights preparing worksheets for Monday. Now I generate a full week of practice problems in under five minutes. The curriculum alignment is spot-on.",
    name: 'Mr. Rodriguez',
    role: '5th Grade Teacher · Austin, TX',
    initials: 'MR',
    avatarBg: '#6DB84B',
    darkInitials: false,
  },
  {
    quote:
      "The AI explanations actually make sense. When I get a question wrong, it doesn't just give me the answer — it walks me through the thinking step by step.",
    name: 'Alex T.',
    role: 'Student · Grade 10',
    initials: 'AT',
    avatarBg: '#F5C534',
    darkInitials: true,
  },
];

const TestimonialsSection: React.FC = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <FadeIn className="text-center mb-14 space-y-3">
        <SectionLabel color="text-secondary">Testimonials</SectionLabel>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-foreground mt-2">
          Real Results for Real Students
        </h2>
      </FadeIn>

      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <FadeIn
            key={t.name}
            delay={i * 100}
            className="relative bg-white rounded-2xl border border-border p-8 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Decorative quote mark */}
            <div
              className="absolute top-5 right-6 text-[4rem] font-black leading-none opacity-[0.06] select-none pointer-events-none"
              style={{ color: t.avatarBg }}
              aria-hidden="true"
            >
              &ldquo;
            </div>

            {/* Stars */}
            <div className="flex gap-0.5 mb-5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-3.5 text-accent fill-accent" />
              ))}
            </div>

            {/* Quote — max-w prevents overly long lines */}
            <p className="text-[14px] text-foreground leading-relaxed mb-6">
              &ldquo;{t.quote}&rdquo;
            </p>

            {/* Author */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: t.avatarBg,
                  color: t.darkInitials ? '#0a0f1e' : '#ffffff',
                }}
              >
                {t.initials}
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

const SHOW_TESTIMONIALS = false; // Keep available for future use on the Home page.

// ─────────────────────────────────────────────────────────────────────────────
// CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────

const CTASection: React.FC<{ onTryWorksheet?: () => void; ctaLabel?: string }> = ({ onTryWorksheet, ctaLabel = 'Try a Worksheet' }) => (
  <section className="relative py-24 overflow-hidden bg-primary">
    {/* Dot grid */}
    <div
      className="absolute inset-0 opacity-[0.07] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      aria-hidden="true"
    />
    {/* Blobs */}
    <div
      className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
      style={{ background: '#F5C534' }}
      aria-hidden="true"
    />
    <div
      className="absolute bottom-0 left-0 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-20 pointer-events-none"
      style={{ background: '#6DB84B' }}
      aria-hidden="true"
    />

    <FadeIn className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

      <h2 className="text-3xl lg:text-5xl font-extrabold text-white mb-5 leading-tight">
        Ready to Transform Learning?
      </h2>

      {/* Single clean subtext — no Handlee here, not the right context */}
      <p className="text-[17px] text-white/75 mb-10 max-w-lg mx-auto">
        Free to start — no credit card required.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <Button
          variant="white"
          size="lg"
          className="text-primary font-extrabold gap-2 hover:bg-white/90 shadow-md"
          onClick={onTryWorksheet}
        >
          {ctaLabel} — Free
        </Button>
      </div>
    </FadeIn>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

const Landing: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  // Auth modal state (for Sign In only)
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalStep, setModalStep] = React.useState<ModalStep>('role');

  // Inline role selection state
  const [roleFlowOpen, setRoleFlowOpen] = React.useState(false);

  // Grade chip → search box bridge
  const [externalGrade, setExternalGrade] = React.useState<string | null>(null);

  const ctaLabel = (auth.role === 'teacher' || auth.role === 'guest-teacher')
    ? 'Create Worksheet'
    : 'Try a Worksheet';

  const openSignIn = () => { setModalStep('signin'); setModalOpen(true); };
  const openRoleFlow = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setRoleFlowOpen(true);
  };

  const handleCtaClick = () => {
    if (auth.tokenState === 'none') {
      auth.openRoleModal();
      return;
    }
    navigate('/worksheet/new');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar onSignIn={openSignIn} onTryWorksheet={handleCtaClick} />
      <main className="flex-1">
        <HeroSection
          onTryWorksheet={handleCtaClick}
          ctaLabel={ctaLabel}
          externalGrade={externalGrade}
          onExternalGradeHandled={() => setExternalGrade(null)}
        />
        <TrustStrip onGradeClick={(g) => setExternalGrade(g)} />
        <FeaturesSection />
        <DashboardPreviewSection />
        <HowItWorksSection />
        <RoleCardsSection />
        {SHOW_TESTIMONIALS && <TestimonialsSection />}
        <CTASection onTryWorksheet={handleCtaClick} ctaLabel={ctaLabel} />
      </main>
      <Footer />

      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialStep={modalStep}
      />

      <RoleSelectionPanel
        isOpen={roleFlowOpen}
        onClose={() => setRoleFlowOpen(false)}
      />
    </div>
  );
};

export default Landing;

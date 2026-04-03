/**
 * @file src/pages/WorksheetsListPage.tsx
 * @description Worksheets list page — browse all worksheets with search,
 *              subject/status filtering, and grid/list view toggle.
 */

import * as React from 'react';
import { Link } from 'react-router';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  BookOpen,
  Clock,
  HelpCircle,
  ArrowRight,
  FileText,
  LogIn,
  Loader2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/lib/pageMeta';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/env';
import { getAuthToken } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────
type WorksheetStatus = 'completed' | 'new' | 'in-progress';
type Subject = 'Math' | 'Science' | 'ELA' | 'Social Studies' | 'Health';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Mixed';

interface Worksheet {
  id: string;
  title: string;
  subject: Subject;
  grade: number;
  topic: string;
  difficulty: Difficulty;
  score: number | null;
  totalPoints: number;
  questionCount: number;
  estimatedTime: string;
  status: WorksheetStatus;
  date: string;
}

// ── API attempt shape returned by GET /api/progress/history ───────────────
interface AttemptRecord {
  attemptId: string;
  worksheetId: string;
  grade: number;
  subject: string;
  topic: string;
  difficulty: string;
  totalScore: number;
  totalPoints: number;
  percentage: number | null;
  timeTaken: number;
  timed: boolean;
  createdAt: string;
}

/** Maps a raw attempt record to the internal Worksheet display shape. */
function attemptToWorksheet(a: AttemptRecord): Worksheet {
  const validSubjects: Subject[] = ['Math', 'Science', 'ELA', 'Social Studies', 'Health'];
  const validDifficulties: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Mixed'];

  const subject = validSubjects.includes(a.subject as Subject)
    ? (a.subject as Subject)
    : 'Math';

  const difficulty = validDifficulties.includes(a.difficulty as Difficulty)
    ? (a.difficulty as Difficulty)
    : 'Medium';

  const score = a.percentage != null ? Math.round(a.percentage) : null;
  const status: WorksheetStatus = score != null ? 'completed' : 'in-progress';

  const date = a.createdAt
    ? new Date(a.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return {
    id: a.attemptId || a.worksheetId,
    title: `${a.topic} — Grade ${a.grade}`,
    subject,
    grade: a.grade,
    topic: a.topic,
    difficulty,
    score,
    totalPoints: a.totalPoints || 10,
    questionCount: 0,
    estimatedTime: '',
    status,
    date,
  };
}

// ── Config maps ────────────────────────────────────────────────────────────
const statusConfig: Record<WorksheetStatus, { label: string; variant: 'success' | 'primary' | 'warning' }> = {
  completed:    { label: 'Done',        variant: 'success' },
  new:          { label: 'New',         variant: 'primary' },
  'in-progress': { label: 'In Progress', variant: 'warning' },
};

const difficultyConfig: Record<Difficulty, { variant: 'success' | 'warning' | 'destructive' | 'primary' }> = {
  Easy:   { variant: 'success' },
  Medium: { variant: 'warning' },
  Hard:   { variant: 'destructive' },
  Mixed:  { variant: 'primary' },
};

const subjectColorMap: Record<Subject, string> = {
  Math:            '#3D9AE8',
  Science:         '#6DB84B',
  ELA:             '#8b5cf6',
  'Social Studies': '#f97316',
  Health:          '#ec4899',
};

// ── Score badge helper ──────────────────────────────────────────────────────
function scoreBadgeVariant(score: number): 'success' | 'warning' | 'destructive' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'destructive';
}

// ── Subject options ─────────────────────────────────────────────────────────
const SUBJECT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',            label: 'All Subjects' },
  { value: 'Math',           label: 'Math' },
  { value: 'Science',        label: 'Science' },
  { value: 'ELA',            label: 'ELA' },
  { value: 'Social Studies', label: 'Social Studies' },
  { value: 'Health',         label: 'Health' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all',         label: 'All Status' },
  { value: 'completed',   label: 'Completed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'new',         label: 'New' },
];

// ── WorksheetCard (grid view) ───────────────────────────────────────────────
const WorksheetCard: React.FC<{ ws: Worksheet }> = ({ ws }) => {
  const { label: statusLabel, variant: statusVariant } = statusConfig[ws.status];
  const { variant: diffVariant } = difficultyConfig[ws.difficulty];
  const subjectColor = subjectColorMap[ws.subject] ?? '#3D9AE8';

  return (
    <Link
      to={`/worksheet/${ws.id}`}
      className="group block bg-white rounded-2xl border border-border shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`Open ${ws.title}`}
    >
      {/* Colored top strip */}
      <div
        className="h-1.5 w-full"
        style={{ background: subjectColor }}
        aria-hidden="true"
      />

      <div className="p-5">
        {/* Header row: subject badge + status badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Badge
            className="text-[11px] font-bold"
            style={{
              background: `${subjectColor}18`,
              color: subjectColor,
              borderColor: `${subjectColor}30`,
            }}
          >
            {ws.subject}
          </Badge>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>

        {/* Title */}
        <h3 className="text-sm font-extrabold text-foreground leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
          {ws.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Grade {ws.grade} · {ws.topic}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <HelpCircle className="size-3 shrink-0" />
            {ws.questionCount} Qs
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            {ws.estimatedTime}
          </span>
          <Badge variant={diffVariant} className="text-[10px] px-2 py-0">
            {ws.difficulty}
          </Badge>
        </div>

        {/* Footer: score or CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {ws.score !== null ? (
            <div className="flex items-center gap-2">
              <Badge variant={scoreBadgeVariant(ws.score)} className="font-extrabold text-xs px-2.5">
                {ws.score}%
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {ws.score >= 80 ? 'Great work!' : ws.score >= 60 ? 'Keep going' : 'Review needed'}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">{ws.date}</span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
            {ws.status === 'completed' ? 'Review' : 'Start'}
            <ArrowRight className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
};

// ── WorksheetRow (list view) ────────────────────────────────────────────────
const WorksheetRow: React.FC<{ ws: Worksheet; isLast: boolean }> = ({ ws, isLast }) => {
  const { label: statusLabel, variant: statusVariant } = statusConfig[ws.status];
  const { variant: diffVariant } = difficultyConfig[ws.difficulty];
  const subjectColor = subjectColorMap[ws.subject] ?? '#3D9AE8';

  return (
    <tr className={`${!isLast ? 'border-b border-border' : ''} hover:bg-surface transition-colors group`}>
      {/* Title + subject icon */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${subjectColor}18` }}
            aria-hidden="true"
          >
            <BookOpen className="size-4" style={{ color: subjectColor }} />
          </div>
          <div className="min-w-0">
            <Link
              to={`/worksheet/${ws.id}`}
              className="text-sm font-bold text-foreground hover:text-primary hover:underline transition-colors truncate block"
            >
              {ws.title}
            </Link>
            <p className="text-[11px] text-muted-foreground">Grade {ws.grade} · {ws.topic}</p>
          </div>
        </div>
      </td>

      {/* Subject */}
      <td className="px-5 py-3.5 hidden sm:table-cell">
        <span className="text-sm font-semibold" style={{ color: subjectColor }}>
          {ws.subject}
        </span>
      </td>

      {/* Difficulty */}
      <td className="px-5 py-3.5 hidden md:table-cell">
        <Badge variant={diffVariant}>{ws.difficulty}</Badge>
      </td>

      {/* Questions + time */}
      <td className="px-5 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <HelpCircle className="size-3 shrink-0" />
            {ws.questionCount} Qs
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            {ws.estimatedTime}
          </span>
        </div>
      </td>

      {/* Date */}
      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">
        {ws.date}
      </td>

      {/* Score */}
      <td className="px-5 py-3.5 text-center">
        {ws.score !== null ? (
          <Badge variant={scoreBadgeVariant(ws.score)} className="font-extrabold">
            {ws.score}%
          </Badge>
        ) : (
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        )}
      </td>

      {/* Action */}
      <td className="px-5 py-3.5 text-right">
        <Link
          to={`/worksheet/${ws.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          {ws.status === 'completed' ? 'Review' : 'Start'}
          <ArrowRight className="size-3" />
        </Link>
      </td>
    </tr>
  );
};

// ── Empty state ─────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ hasFilters: boolean }> = ({ hasFilters }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    {/* CSS-only illustration */}
    <div
      className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center mb-5"
      aria-hidden="true"
    >
      <FileText className="size-10 text-primary opacity-60" />
    </div>
    <h3 className="text-base font-extrabold text-foreground mb-1">
      {hasFilters ? 'No worksheets match your filters' : 'No worksheets yet'}
    </h3>
    <p className="text-sm text-muted-foreground max-w-xs mb-6">
      {hasFilters
        ? 'Try adjusting the search term or filters to find what you are looking for.'
        : 'Generate your first AI worksheet and start practicing today.'}
    </p>
    {!hasFilters && (
      <Button variant="primary" size="md" className="gap-2" asChild>
        <Link to="/worksheet/new">
          <Plus className="size-4" />
          New Worksheet
        </Link>
      </Button>
    )}
  </div>
);

// ── Guest sign-in prompt ─────────────────────────────────────────────────────
const GuestPrompt: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div
      className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center mb-5"
      aria-hidden="true"
    >
      <LogIn className="size-10 text-primary opacity-60" />
    </div>
    <h3 className="text-base font-extrabold text-foreground mb-1">
      Sign in to see your worksheets
    </h3>
    <p className="text-sm text-muted-foreground max-w-xs mb-6">
      Your worksheet history is saved to your account. Sign in to browse, filter, and continue where you left off.
    </p>
    <Button variant="primary" size="md" className="gap-2" asChild>
      <Link to="/?signin=1">
        <LogIn className="size-4" />
        Sign In
      </Link>
    </Button>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────
const WorksheetsListPage: React.FC = () => {
  usePageMeta({
    title: 'My Worksheets',
    description: 'Browse all your Learnfyra worksheets — filter by subject and status, track scores, and start or review any worksheet.',
    keywords: 'worksheets list, student practice, worksheet history, subject filter',
  });

  const auth = useAuth();
  const token = getAuthToken();

  const [worksheets, setWorksheets] = React.useState<Worksheet[]>([]);
  const [isLoading, setIsLoading]   = React.useState(!auth.isGuest);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey]   = React.useState(0);

  const [search, setSearch]           = React.useState('');
  const [subjectFilter, setSubject]   = React.useState('all');
  const [statusFilter, setStatus]     = React.useState('all');
  const [viewMode, setViewMode]       = React.useState<'grid' | 'list'>('grid');

  // ── Fetch worksheet history for authenticated users ───────────────────────
  React.useEffect(() => {
    if (auth.isGuest) {
      setWorksheets([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setFetchError(null);

    fetch(`${apiUrl}/api/progress/history?limit=100`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { attempts: AttemptRecord[] }) => {
        if (!isMounted) return;
        const mapped = Array.isArray(data.attempts)
          ? data.attempts.map(attemptToWorksheet)
          : [];
        setWorksheets(mapped);
      })
      .catch((err: Error) => {
        if (!isMounted || err.name === 'AbortError') return;
        setFetchError('Failed to load worksheets. Please try again.');
        setWorksheets([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [auth.isGuest, token, reloadKey]);

  // ── Filtered worksheets ──────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return worksheets.filter((ws) => {
      const matchSearch =
        !q ||
        ws.title.toLowerCase().includes(q) ||
        ws.topic.toLowerCase().includes(q) ||
        ws.subject.toLowerCase().includes(q);
      const matchSubject = subjectFilter === 'all' || ws.subject === subjectFilter;
      const matchStatus  = statusFilter  === 'all' || ws.status  === statusFilter;
      return matchSearch && matchSubject && matchStatus;
    });
  }, [worksheets, search, subjectFilter, statusFilter]);

  const hasFilters = search.trim() !== '' || subjectFilter !== 'all' || statusFilter !== 'all';

  // ── Select shared styles (no Tailwind class lists to duplicate) ──────────
  const selectCls =
    'h-9 px-3 text-sm font-semibold rounded-xl border border-border bg-white text-foreground ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer ' +
    'hover:border-primary/40';

  return (
    <AppLayout pageTitle="Worksheets">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">My Worksheets</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading
                ? 'Loading your library...'
                : `${worksheets.length} worksheet${worksheets.length !== 1 ? 's' : ''} in your library`}
            </p>
          </div>
          <Button variant="primary" size="md" className="gap-2 shrink-0" asChild>
            <Link to="/worksheet/new">
              <Plus className="size-4" />
              New Worksheet
            </Link>
          </Button>
        </div>

        {/* ── Toolbar: search + filters + view toggle ──────────────── */}
        {!auth.isGuest && <div className="flex flex-col sm:flex-row gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search worksheets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search worksheets"
              className={
                'w-full h-9 pl-9 pr-4 text-sm rounded-xl border border-border bg-white text-foreground ' +
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 ' +
                'focus:border-primary transition-colors'
              }
            />
          </div>

          {/* Subject filter */}
          <select
            value={subjectFilter}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by subject"
            className={selectCls}
          >
            {SUBJECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className={selectCls}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* View toggle */}
          <div
            className="flex items-center rounded-xl border border-border bg-white overflow-hidden shrink-0"
            role="group"
            aria-label="Toggle view mode"
          >
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
              className={
                'h-9 w-9 flex items-center justify-center transition-colors ' +
                (viewMode === 'grid'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface')
              }
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
              className={
                'h-9 w-9 flex items-center justify-center transition-colors ' +
                (viewMode === 'list'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface')
              }
            >
              <List className="size-4" />
            </button>
          </div>
        </div>}

        {/* ── Results count ─────────────────────────────────────────── */}
        {!isLoading && !auth.isGuest && hasFilters && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground -mt-2">
            Showing <span className="font-bold text-foreground">{filtered.length}</span> of {worksheets.length} worksheets
          </p>
        )}

        {/* ── Content area ──────────────────────────────────────────── */}
        {auth.isGuest ? (
          <div className="bg-white rounded-2xl border border-border shadow-card">
            <GuestPrompt />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 text-primary animate-spin" aria-label="Loading worksheets" />
          </div>
        ) : fetchError ? (
          <div className="bg-white rounded-2xl border border-border shadow-card flex flex-col items-center justify-center py-16 text-center gap-3">
            <p className="text-sm font-bold text-destructive">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border shadow-card">
            <EmptyState hasFilters={hasFilters} />
          </div>
        ) : viewMode === 'grid' ? (

          /* Grid view */
          <section aria-label="Worksheets grid">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((ws) => (
                <WorksheetCard key={ws.id} ws={ws} />
              ))}
            </div>
          </section>

        ) : (

          /* List view */
          <section aria-label="Worksheets list">
            <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
              <table className="w-full text-sm" aria-label="Worksheets table">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Worksheet
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                      Subject
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                      Difficulty
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden lg:table-cell">
                      Details
                    </th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">
                      Date
                    </th>
                    <th className="text-center px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Score
                    </th>
                    <th className="text-right px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ws, i) => (
                    <WorksheetRow key={ws.id} ws={ws} isLast={i === filtered.length - 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </AppLayout>
  );
};

export default WorksheetsListPage;

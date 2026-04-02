/**
 * @file src/components/search/SmartSearchBox.tsx
 * @description Large hero search input with dropdown panel and login nudge.
 * Self-contained — manages its own dropdown, search state, and nudge modal.
 */

import * as React from 'react';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchDropdown } from './SearchDropdown';
import { LoginNudgeModal, wasNudgeShown } from './LoginNudgeModal';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { useSearchDropdown } from '@/hooks/useSearchDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { googleOAuth } from '@/lib/env';
import type { SearchContext, WorksheetResult } from '@/types/search';

interface SmartSearchBoxProps {
  /** Called when a grade chip outside the component is clicked */
  externalGrade?: string | null;
  onExternalGradeHandled?: () => void;
}

const SmartSearchBox: React.FC<SmartSearchBoxProps> = ({ externalGrade, onExternalGradeHandled }) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const search = useSmartSearch();
  const dropdown = useSearchDropdown();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [nudgeOpen, setNudgeOpen] = React.useState(false);
  const [pendingContext, setPendingContext] = React.useState<SearchContext | null>(null);

  // Handle external grade chip click
  React.useEffect(() => {
    if (externalGrade) {
      search.setGrade(externalGrade as Parameters<typeof search.setGrade>[0]);
      dropdown.open();
      inputRef.current?.focus();
      onExternalGradeHandled?.();
    }
  }, [externalGrade]);

  // ── Navigation helpers ───────────────────────────────────────────────

  const goToWorksheet = (ctx: SearchContext) => {
    dropdown.close();
    navigate('/worksheet/new', { state: { searchContext: ctx } });
  };

  const maybeShowNudge = (ctx: SearchContext) => {
    if (auth.tokenState === 'authenticated' || wasNudgeShown()) {
      goToWorksheet(ctx);
    } else {
      setPendingContext(ctx);
      setNudgeOpen(true);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const ctx = search.executeSearch();
    maybeShowNudge(ctx);
  };

  const handleSelectResult = (result: WorksheetResult) => {
    search.setGrade(result.grade);
    search.setSubject(result.subject);
    search.setComplexity(result.complexity);
    search.setQuery(result.title);
    const ctx = search.executeSearch();
    maybeShowNudge(ctx);
  };

  const handleSurprise = () => {
    const ctx = search.surprise();
    maybeShowNudge(ctx);
  };

  const handleBrowseAll = () => {
    const ctx = search.executeSearch();
    maybeShowNudge(ctx);
  };

  // Nudge handlers
  const handleContinueAsGuest = () => {
    setNudgeOpen(false);
    if (pendingContext) goToWorksheet(pendingContext);
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch(googleOAuth.initiateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      const data = await res.json();
      if (data.authorizationUrl) window.location.href = data.authorizationUrl;
    } catch { /* ignore */ }
  };

  const handleEmailSignIn = () => {
    setNudgeOpen(false);
    // Navigate to landing with auth modal — the user will return and context is saved
    navigate('/');
  };

  const hasQuery = search.searchState.query.length > 0;

  return (
    <>
      <div ref={dropdown.containerRef} className="relative z-10 w-full max-w-[540px]">
        {/* ── Search input ────────────────────────────────── */}
        <form onSubmit={handleSearch} className="relative">
          <div
            className={[
              'flex items-center h-14 sm:h-16 rounded-2xl border-2 bg-white transition-all duration-200',
              dropdown.isOpen
                ? 'border-primary shadow-[0_4px_24px_rgba(61,154,232,0.15)] rounded-b-none'
                : 'border-border shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:border-primary/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)]',
            ].join(' ')}
          >
            {/* Search icon */}
            <Search className="size-5 text-muted-foreground ml-4 shrink-0" />

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={search.searchState.query}
              onChange={(e) => search.setQuery(e.target.value)}
              onFocus={dropdown.open}
              placeholder="Search by topic, grade or subject... e.g. Grade 5 Fractions"
              aria-label="Search worksheets"
              className="flex-1 h-full px-3 bg-transparent text-sm sm:text-base font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />

            {/* Search button — appears when user types */}
            {hasQuery && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="mr-2 rounded-xl px-4 shrink-0"
              >
                Search
              </Button>
            )}
          </div>

          {/* ── Dropdown ────────────────────────────────────── */}
          <SearchDropdown
            isOpen={dropdown.isOpen}
            query={search.searchState.query}
            grade={search.searchState.grade}
            subject={search.searchState.subject}
            complexity={search.searchState.complexity}
            results={search.results}
            isLoading={search.isLoading}
            onSetGrade={search.setGrade}
            onSetSubject={search.setSubject}
            onSetComplexity={search.setComplexity}
            onSelectResult={handleSelectResult}
            onSurprise={handleSurprise}
            onBrowseAll={handleBrowseAll}
          />
        </form>
      </div>

      {/* ── Login nudge modal ────────────────────────────── */}
      <LoginNudgeModal
        isOpen={nudgeOpen}
        onContinueAsGuest={handleContinueAsGuest}
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
      />
    </>
  );
};

export { SmartSearchBox };

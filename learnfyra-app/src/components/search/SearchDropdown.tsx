/**
 * @file src/components/search/SearchDropdown.tsx
 * @description Dropdown panel: filter chips, live results, quick actions.
 * Overlays content below — never causes layout shift.
 */

import * as React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { FilterChipRow } from './FilterChips';
import { WorksheetResultCard } from './WorksheetResultCard';
import { SearchResultsSkeleton } from './SearchResultsSkeleton';
import type {
  GradeOption, SubjectOption, ComplexityOption,
  WorksheetResult,
} from '@/types/search';
import { ALL_GRADES, ALL_SUBJECTS, ALL_COMPLEXITIES } from '@/types/search';

interface SearchDropdownProps {
  isOpen: boolean;
  query: string;
  grade: GradeOption | null;
  subject: SubjectOption | null;
  complexity: ComplexityOption | null;
  results: WorksheetResult[];
  isLoading: boolean;
  onSetGrade: (g: GradeOption | null) => void;
  onSetSubject: (s: SubjectOption | null) => void;
  onSetComplexity: (c: ComplexityOption | null) => void;
  onSelectResult: (r: WorksheetResult) => void;
  onSurprise: () => void;
  onBrowseAll: () => void;
}

const SearchDropdown: React.FC<SearchDropdownProps> = ({
  isOpen, query, grade, subject, complexity, results, isLoading,
  onSetGrade, onSetSubject, onSetComplexity, onSelectResult, onSurprise, onBrowseAll,
}) => (
  <div
    className={[
      'absolute left-0 right-0 top-full z-50 bg-white border border-t-0 border-border rounded-b-2xl shadow-xl',
      'transition-all duration-220 ease-out origin-top',
      isOpen
        ? 'opacity-100 translate-y-0 pointer-events-auto'
        : 'opacity-0 -translate-y-2 pointer-events-none',
    ].join(' ')}
    role="listbox"
    aria-label="Search results"
  >
    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

      {/* ── Section A: Filter chips ────────────────────── */}
      <div className="space-y-2.5" role="radiogroup" aria-label="Filters">
        <FilterChipRow label="Grade" options={ALL_GRADES} selected={grade} onSelect={onSetGrade} />
        <FilterChipRow label="Subject" options={ALL_SUBJECTS} selected={subject} onSelect={onSetSubject} />
        <FilterChipRow label="Level" options={ALL_COMPLEXITIES} selected={complexity} onSelect={onSetComplexity} />
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* ── Section B: Live results ────────────────────── */}
      {isLoading ? (
        <SearchResultsSkeleton />
      ) : results.length > 0 ? (
        <div className="space-y-1">
          {results.map((r) => (
            <WorksheetResultCard key={r.id} result={r} query={query} onClick={onSelectResult} />
          ))}
        </div>
      ) : (query.length >= 2 || grade || subject || complexity) ? (
        <div className="text-center py-6">
          <Search className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-muted-foreground">No worksheets found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different topic or adjust your filters</p>
        </div>
      ) : null}

      {/* ── Section C: Quick actions ───────────────────── */}
      {(grade || subject) && !query && (
        <div className="border-t border-border pt-3 space-y-1">
          <button
            onClick={onBrowseAll}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary-light/50 transition-colors text-left"
          >
            <ArrowRight className="size-4 shrink-0" />
            Browse all{subject ? ` ${subject}` : ''} worksheets{grade ? ` for ${grade}` : ''}
          </button>
        </div>
      )}
    </div>
  </div>
);

export { SearchDropdown };

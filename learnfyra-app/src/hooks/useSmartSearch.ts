/**
 * @file src/hooks/useSmartSearch.ts
 * @description Search state management with debounced mock results.
 * Uses AbortController pattern — ready for real API when backend is wired.
 */

import * as React from 'react';
import type {
  SearchState,
  SearchContext,
  GradeOption,
  SubjectOption,
  ComplexityOption,
  WorksheetResult,
} from '@/types/search';

// ── Mock results — replace with real API call later ────────────────────────

const MOCK_WORKSHEETS: WorksheetResult[] = [
  { id: 'ws-101', title: 'Adding Fractions', grade: 'Grade 5', subject: 'Math', complexity: 'Medium', questionCount: 10, estimatedTime: '20 min' },
  { id: 'ws-102', title: 'Multiplying Decimals', grade: 'Grade 5', subject: 'Math', complexity: 'Hard', questionCount: 12, estimatedTime: '25 min' },
  { id: 'ws-103', title: 'Parts of Speech', grade: 'Grade 4', subject: 'English', complexity: 'Easy', questionCount: 8, estimatedTime: '15 min' },
  { id: 'ws-104', title: 'The Solar System', grade: 'Grade 6', subject: 'Science', complexity: 'Medium', questionCount: 10, estimatedTime: '20 min' },
  { id: 'ws-105', title: 'American Revolution', grade: 'Grade 7', subject: 'Social Studies', complexity: 'Hard', questionCount: 12, estimatedTime: '25 min' },
  { id: 'ws-106', title: 'Linear Equations', grade: 'Grade 8', subject: 'Math', complexity: 'Medium', questionCount: 10, estimatedTime: '20 min' },
  { id: 'ws-107', title: 'Cell Biology Basics', grade: 'Grade 7', subject: 'Science', complexity: 'Easy', questionCount: 8, estimatedTime: '15 min' },
  { id: 'ws-108', title: 'Figurative Language', grade: 'Grade 6', subject: 'English', complexity: 'Medium', questionCount: 10, estimatedTime: '20 min' },
  { id: 'ws-109', title: 'Geometry Basics', grade: 'Grade 3', subject: 'Math', complexity: 'Easy', questionCount: 8, estimatedTime: '15 min' },
  { id: 'ws-110', title: 'Water Cycle', grade: 'Grade 5', subject: 'Science', complexity: 'Easy', questionCount: 8, estimatedTime: '15 min' },
  { id: 'ws-111', title: 'Subtraction with Regrouping', grade: 'Grade 2', subject: 'Math', complexity: 'Medium', questionCount: 10, estimatedTime: '20 min' },
  { id: 'ws-112', title: 'Reading Comprehension', grade: 'Grade 3', subject: 'English', complexity: 'Easy', questionCount: 6, estimatedTime: '15 min' },
];

function filterMock(state: SearchState): WorksheetResult[] {
  return MOCK_WORKSHEETS.filter((ws) => {
    if (state.grade && ws.grade !== state.grade) return false;
    if (state.subject && ws.subject !== state.subject) return false;
    if (state.complexity && ws.complexity !== state.complexity) return false;
    if (state.query.length >= 2) {
      const q = state.query.toLowerCase();
      if (!ws.title.toLowerCase().includes(q) && !ws.subject.toLowerCase().includes(q) && !ws.grade.toLowerCase().includes(q)) return false;
    }
    return true;
  }).slice(0, 6);
}

// ── Persistence ────────────────────────────────────────────────────────────

const CONTEXT_KEY = 'learnfyra_search_context';

export function saveSearchContext(ctx: SearchContext): void {
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
}

export function getSearchContext(): SearchContext | null {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export interface UseSmartSearchReturn {
  searchState: SearchState;
  setQuery: (query: string) => void;
  setGrade: (grade: GradeOption | null) => void;
  setSubject: (subject: SubjectOption | null) => void;
  setComplexity: (complexity: ComplexityOption | null) => void;
  results: WorksheetResult[];
  isLoading: boolean;
  executeSearch: () => SearchContext;
  clearSearch: () => void;
  surprise: () => SearchContext;
}

export function useSmartSearch(): UseSmartSearchReturn {
  const [searchState, setSearchState] = React.useState<SearchState>({
    query: '',
    grade: null,
    subject: null,
    complexity: null,
  });
  const [results, setResults] = React.useState<WorksheetResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  React.useEffect(() => {
    const hasQuery = searchState.query.length >= 2;
    const hasFilters = searchState.grade || searchState.subject || searchState.complexity;

    if (!hasQuery && !hasFilters) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setResults(filterMock(searchState));
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [searchState]);

  const setQuery = (query: string) => setSearchState((s) => ({ ...s, query }));
  const setGrade = (grade: GradeOption | null) => setSearchState((s) => ({ ...s, grade }));
  const setSubject = (subject: SubjectOption | null) => setSearchState((s) => ({ ...s, subject }));
  const setComplexity = (complexity: ComplexityOption | null) => setSearchState((s) => ({ ...s, complexity }));

  const executeSearch = (): SearchContext => {
    const ctx: SearchContext = { ...searchState, source: searchState.query ? 'search' : 'filter' };
    saveSearchContext(ctx);
    return ctx;
  };

  const clearSearch = () => {
    setSearchState({ query: '', grade: null, subject: null, complexity: null });
    setResults([]);
  };

  const surprise = (): SearchContext => {
    const random = MOCK_WORKSHEETS[Math.floor(Math.random() * MOCK_WORKSHEETS.length)];
    const ctx: SearchContext = {
      query: random.title,
      grade: random.grade,
      subject: random.subject,
      complexity: random.complexity,
      source: 'surprise',
    };
    saveSearchContext(ctx);
    return ctx;
  };

  return { searchState, setQuery, setGrade, setSubject, setComplexity, results, isLoading, executeSearch, clearSearch, surprise };
}

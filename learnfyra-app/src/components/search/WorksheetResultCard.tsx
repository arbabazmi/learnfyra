/**
 * @file src/components/search/WorksheetResultCard.tsx
 * @description Single worksheet result row inside the search dropdown.
 */

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import type { WorksheetResult } from '@/types/search';

const COMPLEXITY_DOT: Record<string, string> = {
  Easy: 'bg-secondary',
  Medium: 'bg-accent',
  Hard: 'bg-destructive',
};

interface WorksheetResultCardProps {
  result: WorksheetResult;
  query: string;
  onClick: (result: WorksheetResult) => void;
}

/** Highlights matching text in the title. */
function highlightMatch(text: string, query: string) {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-light text-foreground font-extrabold rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const WorksheetResultCard: React.FC<WorksheetResultCardProps> = ({ result, query, onClick }) => (
  <button
    role="option"
    onClick={() => onClick(result)}
    className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-surface transition-colors cursor-pointer group"
  >
    {/* Complexity dot */}
    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COMPLEXITY_DOT[result.complexity] || 'bg-muted'}`} />

    {/* Content */}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-foreground truncate">
        {highlightMatch(result.title, query)}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[11px] font-semibold text-primary bg-primary-light px-1.5 py-0.5 rounded">{result.grade}</span>
        <span className="text-[11px] font-semibold text-secondary bg-secondary-light px-1.5 py-0.5 rounded">{result.subject}</span>
        <span className="text-[11px] text-muted-foreground">{result.questionCount}q · {result.estimatedTime}</span>
      </div>
    </div>

    {/* Arrow */}
    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
  </button>
);

export { WorksheetResultCard };

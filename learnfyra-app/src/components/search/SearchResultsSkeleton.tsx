/**
 * @file src/components/search/SearchResultsSkeleton.tsx
 * @description Loading skeleton — 3 placeholder rows.
 */

import * as React from 'react';

const SearchResultsSkeleton: React.FC = () => (
  <div className="space-y-2 py-2 animate-pulse">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3">
        <div className="w-2.5 h-2.5 rounded-full bg-surface-2 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-surface-2 rounded w-3/4" />
          <div className="h-3 bg-surface-2 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export { SearchResultsSkeleton };

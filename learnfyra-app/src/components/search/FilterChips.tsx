/**
 * @file src/components/search/FilterChips.tsx
 * @description Grade / Subject / Complexity filter chip rows.
 */

import * as React from 'react';

interface FilterChipRowProps<T extends string> {
  label: string;
  options: T[];
  selected: T | null;
  onSelect: (value: T | null) => void;
}

function FilterChipRow<T extends string>({ label, options, selected, onSelect }: FilterChipRowProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest shrink-0 w-20">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              onClick={() => onSelect(active ? null : opt)}
              role="radio"
              aria-checked={active}
              className={[
                'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer shrink-0',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted-foreground border-border hover:border-primary/30 hover:bg-primary-light/50',
              ].join(' ')}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { FilterChipRow };

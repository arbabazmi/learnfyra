/**
 * @file FormulaSheet.tsx
 * @description Subject-relevant formula reference with search and collapsible sections.
 */

import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mathFormulas, scienceFormulas } from '../../mock-data';
import type { FormulaSection } from '../../mock-data';
import type { Subject } from '../../types';

interface FormulaSheetProps {
  subject: Subject;
  grade: number;
}

export default function FormulaSheet({ subject }: FormulaSheetProps) {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const formulas: FormulaSection[] = subject === 'Math' ? mathFormulas : subject === 'Science' ? scienceFormulas : [];

  const filteredFormulas = formulas.map(section => ({
    ...section,
    formulas: section.formulas.filter(f =>
      !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.formula.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter(s => s.formulas.length > 0);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  if (formulas.length === 0) {
    return <p className="pt-3 text-xs text-muted-foreground">No formulas available for {subject}.</p>;
  }

  return (
    <div className="pt-3">
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search formulas..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {filteredFormulas.map(section => {
          const isOpen = openSections.has(section.title) || !!search;
          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full text-xs font-bold text-foreground hover:text-primary transition-colors"
              >
                {section.title}
                <ChevronDown className={cn('size-3 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="mt-1.5 space-y-1.5">
                  {section.formulas.map(f => (
                    <div key={f.name} className="p-2 rounded-lg bg-surface-2">
                      <p className="text-[10px] text-muted-foreground">{f.name}</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{f.formula}</p>
                      {f.description && <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

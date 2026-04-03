/**
 * @file src/components/parent/ChildSwitcher.tsx
 * @description Dropdown for selecting the active child in the parent dashboard.
 * Per FRD requirement, this must appear at the TOP level of the parent dashboard.
 */

import * as React from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParent } from '@/contexts/ParentContext';

const ChildSwitcher: React.FC = () => {
  const { children, currentChildId, selectChild, loadingChildren } =
    useParent();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const currentChild = children.find((c) => c.studentId === currentChildId);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (loadingChildren) {
    return <div className="h-10 w-48 rounded-xl bg-muted animate-pulse" />;
  }

  if (children.length === 0) {
    return (
      <div className="flex items-center gap-2 h-10 px-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        <GraduationCap className="size-4 shrink-0" />
        No children linked
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch child"
        className={cn(
          'flex items-center gap-2 h-10 pl-3 pr-2 rounded-xl border text-sm font-semibold transition-all',
          'bg-white border-border hover:border-primary/40 hover:bg-primary-light/30',
          open && 'border-primary ring-2 ring-primary/20',
        )}
      >
        <GraduationCap className="size-4 text-primary shrink-0" />
        <span className="max-w-[150px] truncate text-foreground">
          {currentChild?.displayName ?? 'Select child'}
        </span>
        {currentChild?.gradeLevel && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            G{currentChild.gradeLevel}
          </span>
        )}
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground ml-1 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select child"
          className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl border border-border shadow-xl z-50 py-2 overflow-hidden"
        >
          {children.map((child) => (
            <button
              key={child.studentId}
              role="option"
              aria-selected={child.studentId === currentChildId}
              type="button"
              onClick={() => {
                selectChild(child.studentId);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors text-left',
                child.studentId === currentChildId
                  ? 'bg-primary-light text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="truncate block">{child.displayName}</span>
                {child.gradeLevel && (
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Grade {child.gradeLevel}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export { ChildSwitcher };

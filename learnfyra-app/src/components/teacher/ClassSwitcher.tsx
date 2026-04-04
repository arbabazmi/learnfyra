/**
 * @file src/components/teacher/ClassSwitcher.tsx
 * @description Dropdown for selecting the active class in the teacher dashboard.
 */

import * as React from 'react';
import { ChevronDown, BookOpen, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeacher } from '@/contexts/TeacherContext';

const ClassSwitcher: React.FC = () => {
  const { classes, currentClassId, selectClass, loadingClasses } =
    useTeacher();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const currentClass = classes.find((c) => c.classId === currentClassId);
  const activeClasses = classes.filter((c) => c.status === 'active');
  const archivedClasses = classes.filter((c) => c.status === 'archived');

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

  if (loadingClasses) {
    return (
      <div className="h-10 w-56 rounded-xl bg-muted animate-pulse" />
    );
  }

  if (classes.length === 0) {
    return (
      <div className="flex items-center gap-2 h-10 px-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        <BookOpen className="size-4 shrink-0" />
        No classes yet
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
        aria-label="Switch class"
        className={cn(
          'flex items-center gap-2 h-10 pl-3 pr-2 rounded-xl border text-sm font-semibold transition-all',
          'bg-white border-border hover:border-primary/40 hover:bg-primary-light/30',
          open && 'border-primary ring-2 ring-primary/20',
        )}
      >
        <BookOpen className="size-4 text-primary shrink-0" />
        <span className="max-w-[160px] truncate text-foreground">
          {currentClass?.className ?? 'Select class'}
        </span>
        {currentClass && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            G{currentClass.gradeLevel ?? '?'}
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
          aria-label="Classes"
          className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl border border-border shadow-xl z-50 py-2 overflow-hidden"
        >
          {activeClasses.length > 0 && (
            <>
              <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Active
              </p>
              {activeClasses.map((cls) => (
                <button
                  key={cls.classId}
                  role="option"
                  aria-selected={cls.classId === currentClassId}
                  type="button"
                  onClick={() => {
                    selectClass(cls.classId);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors text-left',
                    cls.classId === currentClassId
                      ? 'bg-primary-light text-primary'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <BookOpen className="size-4 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{cls.className}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {cls.studentCount} students
                      {cls.pendingReviewCount > 0 && (
                        <span className="ml-2 text-amber-600 font-semibold">
                          · {cls.pendingReviewCount} to review
                        </span>
                      )}
                    </span>
                  </div>
                  {cls.gradeLevel && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      G{cls.gradeLevel}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {archivedClasses.length > 0 && (
            <>
              <div className="my-1 border-t border-border" />
              <p className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Archived
              </p>
              {archivedClasses.map((cls) => (
                <button
                  key={cls.classId}
                  role="option"
                  aria-selected={cls.classId === currentClassId}
                  type="button"
                  onClick={() => {
                    selectClass(cls.classId);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors text-left opacity-60',
                    cls.classId === currentClassId
                      ? 'bg-primary-light text-primary opacity-100'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Archive className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{cls.className}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export { ClassSwitcher };

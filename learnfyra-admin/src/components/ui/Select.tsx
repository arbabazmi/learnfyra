import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <div className="w-full">
      <select
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-lg border bg-input-background px-3 py-2 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-destructive' : 'border-border',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';

export { Select };

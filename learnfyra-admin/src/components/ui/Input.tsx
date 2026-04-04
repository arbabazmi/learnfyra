import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-lg border bg-input-background px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

export { Input };

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat';
  hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, onClick, children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-card border border-border shadow-sm',
      elevated: 'bg-card border border-border shadow-lg',
      flat: 'bg-card border border-border shadow-none',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl text-card-foreground',
          variantClasses[variant],
          hover && 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
          onClick && 'cursor-pointer',
          className,
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export { Card };

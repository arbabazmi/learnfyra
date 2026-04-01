import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-primary-light text-primary border border-primary/20',
        success: 'bg-success-light text-success border border-success/20',
        warning: 'bg-accent-light text-amber-700 border border-accent/30',
        muted: 'bg-muted text-muted-foreground border border-border',
        destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
        solid: 'bg-primary text-white',
        'solid-success': 'bg-secondary text-white',
        'solid-warning': 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };

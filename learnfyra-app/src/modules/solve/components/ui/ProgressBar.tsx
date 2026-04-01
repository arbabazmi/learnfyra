/**
 * @file ProgressBar.tsx
 * @description Step dots for <=10 questions, thin bar for >10.
 */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  total: number;
  current: number;
  answered: number;
  variant?: 'dots' | 'bar';
}

export default function ProgressBar({ total, current, answered, variant }: ProgressBarProps) {
  const mode = variant || (total <= 10 ? 'dots' : 'bar');

  if (mode === 'dots') {
    return (
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'size-2.5 rounded-full transition-all duration-300',
              i === current && 'bg-primary scale-125 ring-2 ring-primary/30',
              i < answered && i !== current && 'bg-primary/60',
              i >= answered && i !== current && 'bg-border',
            )}
          />
        ))}
      </div>
    );
  }

  const pct = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

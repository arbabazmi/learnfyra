/**
 * @file HintReveal.tsx
 * @description Progressive 2-step hint system.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GradeTheme } from '../../types';

interface HintRevealProps {
  hint1: string;
  hint2: string;
  hintsUsed: number;
  onUseHint: () => void;
  theme: GradeTheme;
  disabled?: boolean;
}

export default function HintReveal({ hint1, hint2, hintsUsed, onUseHint, theme, disabled }: HintRevealProps) {
  const buttonText = theme.tier === 'early'
    ? (hintsUsed === 0 ? 'Ask for help!' : hintsUsed === 1 ? 'One more hint!' : '')
    : (hintsUsed === 0 ? 'Need a hint?' : hintsUsed === 1 ? 'Another hint' : '');

  return (
    <div className="mt-4">
      {hintsUsed < 2 && !disabled && (
        <button
          type="button"
          onClick={onUseHint}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
            'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-3 py-1.5',
            theme.tier === 'early'
              ? 'text-accent-foreground bg-accent/20 hover:bg-accent/30'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Lightbulb className={cn('size-4', theme.tier === 'early' ? 'text-accent' : 'text-muted-foreground')} />
          {buttonText} {theme.tier === 'early' && '\uD83E\uDD14'}
        </button>
      )}

      <AnimatePresence>
        {hintsUsed >= 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-3 rounded-lg bg-accent-light border border-accent/20"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-accent-foreground">Hint 1:</span> {hint1}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hintsUsed >= 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-3 rounded-lg bg-accent-light border border-accent/20"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-accent-foreground">Hint 2:</span> {hint2}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

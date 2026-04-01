/**
 * @file CountdownTimer.tsx
 * @description Animated countdown timer with normal/amber/red states.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  paused?: boolean;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CountdownTimer({ totalSeconds, onTimeUp, paused }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (paused || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, remaining, onTimeUp]);

  const pct = remaining / totalSeconds;
  const isAmber = pct <= 0.25 && pct > 0.1;
  const isRed = pct <= 0.1;

  const colorClass = isRed
    ? 'text-destructive'
    : isAmber
      ? 'text-amber-500'
      : 'text-primary';

  const bgClass = isRed
    ? 'bg-destructive/10'
    : isAmber
      ? 'bg-amber-50'
      : 'bg-primary-light';

  return (
    <motion.div
      className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl font-mono font-bold text-2xl', bgClass, colorClass)}
      animate={isRed ? { scale: [1, 1.02, 1] } : isAmber ? { scale: [1, 1.01, 1] } : {}}
      transition={isRed ? { duration: 0.8, repeat: Infinity } : isAmber ? { duration: 1.2, repeat: Infinity } : {}}
    >
      <Clock className="size-5 shrink-0" />
      <span>{formatCountdown(remaining)}</span>
    </motion.div>
  );
}

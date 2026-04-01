/**
 * @file ConfettiEffect.tsx
 * @description Grade-aware celebration effect on correct answers.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GradeTheme } from '../../types';

interface ConfettiEffectProps {
  active: boolean;
  theme: GradeTheme;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
}

const COLORS = ['#3D9AE8', '#6DB84B', '#F5C534', '#f97316', '#8b5cf6', '#ef4444'];

function createParticles(level: 'max' | 'medium' | 'subtle'): Particle[] {
  const count = level === 'max' ? 32 : level === 'medium' ? 16 : 0;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10,
    color: COLORS[i % COLORS.length],
    size: level === 'max' ? 6 + Math.random() * 6 : 4 + Math.random() * 4,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.4,
  }));
}

export default function ConfettiEffect({ active, theme }: ConfettiEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (active) {
      setParticles(createParticles(theme.celebrationLevel));
      const t = setTimeout(() => setParticles([]), 2000);
      return () => clearTimeout(t);
    }
    setParticles([]);
  }, [active, theme.celebrationLevel, prefersReducedMotion]);

  if (theme.celebrationLevel === 'subtle') {
    return (
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ boxShadow: '0 0 30px rgba(109, 184, 75, 0.3) inset' }}
          />
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: '-5vh', rotate: 0, opacity: 1 }}
              animate={{
                y: '110vh',
                rotate: p.rotation + 720,
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.5 + Math.random(), delay: p.delay, ease: 'easeIn' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

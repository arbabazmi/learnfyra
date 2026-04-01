/**
 * @file MatchingQuestion.tsx
 * @description Click-to-match question with two columns + SVG lines.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { MatchingQuestion as MatchType, QuestionRendererProps } from '../../types';

interface MatchingProps extends Omit<QuestionRendererProps, 'question'> {
  question: MatchType;
}

const PAIR_COLORS = ['#3D9AE8', '#6DB84B', '#F5C534', '#f97316', '#8b5cf6'];

export default function MatchingQuestion({ question, value, onChange, disabled, showResult }: MatchingProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [linePositions, setLinePositions] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string }[]>([]);

  // Parse current matches from value
  let matches: Record<string, string> = {};
  try {
    matches = value ? JSON.parse(value) : {};
  } catch { matches = {}; }

  const shuffledRight = useRef(
    [...question.pairs].sort(() => Math.random() - 0.5),
  ).current;

  const handleLeftClick = useCallback((pairId: string) => {
    if (disabled) return;
    setSelectedLeft(prev => prev === pairId ? null : pairId);
  }, [disabled]);

  const handleRightClick = useCallback((pairId: string) => {
    if (disabled || !selectedLeft) return;
    const newMatches = { ...matches, [selectedLeft]: pairId };
    onChange(JSON.stringify(newMatches));
    setSelectedLeft(null);
  }, [disabled, selectedLeft, matches, onChange]);

  // Update line positions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const lines: typeof linePositions = [];

    Object.entries(matches).forEach(([leftId, rightId], i) => {
      const leftEl = leftRefs.current[leftId];
      const rightEl = rightRefs.current[rightId];
      if (leftEl && rightEl) {
        const lr = leftEl.getBoundingClientRect();
        const rr = rightEl.getBoundingClientRect();
        lines.push({
          x1: lr.right - rect.left,
          y1: lr.top + lr.height / 2 - rect.top,
          x2: rr.left - rect.left,
          y2: rr.top + rr.height / 2 - rect.top,
          color: PAIR_COLORS[i % PAIR_COLORS.length],
        });
      }
    });
    setLinePositions(lines);
  }, [matches]);

  const getMatchedColor = (pairId: string, side: 'left' | 'right') => {
    if (side === 'left') {
      const idx = Object.keys(matches).indexOf(pairId);
      return idx >= 0 ? PAIR_COLORS[idx % PAIR_COLORS.length] : null;
    }
    const idx = Object.values(matches).indexOf(pairId);
    return idx >= 0 ? PAIR_COLORS[idx % PAIR_COLORS.length] : null;
  };

  return (
    <div ref={containerRef} className="relative">
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {linePositions.map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke={line.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}
      </svg>

      <div className="grid grid-cols-2 gap-x-12 gap-y-2">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Terms</p>
          {question.pairs.map(pair => {
            const color = getMatchedColor(pair.id, 'left');
            const isMatched = pair.id in matches;
            return (
              <button
                key={pair.id}
                ref={el => { leftRefs.current[pair.id] = el; }}
                type="button"
                onClick={() => handleLeftClick(pair.id)}
                disabled={disabled}
                className={cn(
                  'px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedLeft === pair.id && 'border-primary bg-primary-light shadow-sm',
                  isMatched && !selectedLeft && 'bg-card shadow-sm',
                  !isMatched && selectedLeft !== pair.id && 'border-border bg-card hover:border-primary/30',
                )}
                style={color ? { borderColor: color, backgroundColor: `${color}10` } : undefined}
              >
                {pair.left}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Definitions</p>
          {shuffledRight.map(pair => {
            const color = getMatchedColor(pair.id, 'right');
            const isMatched = Object.values(matches).includes(pair.id);
            return (
              <button
                key={pair.id}
                ref={el => { rightRefs.current[pair.id] = el; }}
                type="button"
                onClick={() => handleRightClick(pair.id)}
                disabled={disabled || !selectedLeft}
                className={cn(
                  'px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedLeft && !isMatched && 'border-primary/30 hover:border-primary hover:bg-primary-light cursor-pointer',
                  !selectedLeft && !isMatched && 'border-border bg-card',
                  isMatched && 'bg-card shadow-sm',
                )}
                style={color ? { borderColor: color, backgroundColor: `${color}10` } : undefined}
              >
                {pair.right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

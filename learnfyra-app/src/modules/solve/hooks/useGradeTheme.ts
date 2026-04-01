/**
 * @file src/modules/solve/hooks/useGradeTheme.ts
 * @description Grade-aware theming hook that adjusts UI based on student grade level.
 */

import { useMemo } from 'react';
import type { GradeTheme, GradeTier } from '../types';

function getGradeTier(grade: number): GradeTier {
  if (grade <= 3) return 'early';
  if (grade <= 6) return 'middle';
  return 'advanced';
}

export function useGradeTheme(grade: number): GradeTheme {
  return useMemo(() => {
    const tier = getGradeTier(grade);

    switch (tier) {
      case 'early':
        return {
          tier,
          fontSizeBoost: 2,
          borderRadius: 'rounded-3xl',
          celebrationLevel: 'max',
          useEmoji: true,
          correctMessage: 'Great job! You got it!',
          incorrectMessage: 'Oops! Let\'s learn together',
          completionMessage: 'Amazing work!',
          backgroundStyle: 'playful',
        };
      case 'middle':
        return {
          tier,
          fontSizeBoost: 0,
          borderRadius: 'rounded-2xl',
          celebrationLevel: 'medium',
          useEmoji: true,
          correctMessage: 'Correct!',
          incorrectMessage: 'Not quite \u2014 here\'s the explanation',
          completionMessage: 'Well done!',
          backgroundStyle: 'geometric',
        };
      case 'advanced':
        return {
          tier,
          fontSizeBoost: 0,
          borderRadius: 'rounded-xl',
          celebrationLevel: 'subtle',
          useEmoji: false,
          correctMessage: 'Correct',
          incorrectMessage: 'Incorrect \u2014 review the concept below',
          completionMessage: 'Assessment complete',
          backgroundStyle: 'minimal',
        };
    }
  }, [grade]);
}

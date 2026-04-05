/**
 * @file tests/unit/sensitiveTopicFilter.test.js
 * @description Unit tests for src/ai/validation/sensitiveTopicFilter.js
 *
 * Covers:
 *   - 5 always-blocked categories (sexuality, drugs, self-harm, discrimination, mature-themes)
 *   - 3 conditional categories (violence, politics, religion) blocked for strict, allowed for medium
 *   - Grade-band threshold differences via guardrailLevel parameter
 *   - Historical/academic context allowed for Grade 4-10 (medium level)
 *   - Clean content passes for all grade bands
 *   - Supplemental regex patterns (bloodshed, gun, explode, etc.)
 *   - All 9 content categories have at least one test
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  scanForSensitiveTopics,
  invalidateSensitiveTopicCache,
} from '../../src/ai/validation/sensitiveTopicFilter.js';

// Reset keyword cache so file reads are fresh for each test suite
beforeEach(() => {
  invalidateSensitiveTopicCache();
});

// ── Worksheet helpers ─────────────────────────────────────────────────────────

function worksheetWithText(text) {
  return {
    title: 'Test Worksheet',
    instructions: 'Answer the questions.',
    questions: [{
      number: 1,
      type: 'short-answer',
      question: text,
      answer: 'See explanation.',
      explanation: 'Standard answer.',
    }],
  };
}

function cleanWorksheet() {
  return {
    title: 'Math Worksheet',
    instructions: 'Solve each problem.',
    questions: [{
      number: 1,
      type: 'fill-in-the-blank',
      question: 'What is 8 × 9?',
      answer: '72',
      explanation: '8 × 9 = 72',
    }],
  };
}

// ── Clean content — all grade bands ──────────────────────────────────────────

describe('scanForSensitiveTopics — clean content', () => {
  it('returns safe=true for a clean math worksheet at strict level', () => {
    const result = scanForSensitiveTopics(cleanWorksheet(), 'strict');
    expect(result.safe).toBe(true);
    expect(result.triggeredCategories).toHaveLength(0);
  });

  it('returns safe=true for a clean ELA worksheet at medium level', () => {
    const ws = worksheetWithText('What is the main theme of this story?');
    const result = scanForSensitiveTopics(ws, 'medium');
    expect(result.safe).toBe(true);
  });

  it('returns safe=true for a clean science worksheet at strict level', () => {
    const ws = worksheetWithText('What is the process of photosynthesis?');
    const result = scanForSensitiveTopics(ws, 'strict');
    expect(result.safe).toBe(true);
  });
});

// ── Always-blocked categories ─────────────────────────────────────────────────

describe('scanForSensitiveTopics — sexuality (always blocked)', () => {
  it('blocks sexual content at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Describe sexual reproduction in plants.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('sexuality');
  });

  it('blocks sexual content at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('What is pornography?'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('sexuality');
  });

  it('blocks nudity keywords at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The painting showed a nude figure.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('sexuality');
  });
});

describe('scanForSensitiveTopics — drugs (always blocked)', () => {
  it('blocks cocaine reference at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Cocaine is a dangerous drug.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('drugs');
  });

  it('blocks heroin reference at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Heroin causes addiction.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('drugs');
  });

  it('blocks overdose reference at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('He died of an overdose from pills.'), 'medium');
    expect(result.safe).toBe(false);
    // overdose is listed both in drugs keyword and sensitive-topics
    expect(result.triggeredCategories.some(c => ['drugs', 'self-harm'].includes(c))).toBe(true);
  });
});

describe('scanForSensitiveTopics — self-harm (always blocked)', () => {
  it('blocks suicide reference at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Suicide is a public health issue.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('self-harm');
  });

  it('blocks self-harm phrase at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Self-harm is dangerous.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('self-harm');
  });
});

describe('scanForSensitiveTopics — discrimination (always blocked)', () => {
  it('blocks racist content at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('That is a racist belief.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('discrimination');
  });

  it('blocks homophobia at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Homophobic statements hurt people.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('discrimination');
  });

  it('blocks nazi reference at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Nazi ideology was harmful.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('discrimination');
  });
});

describe('scanForSensitiveTopics — mature-themes (always blocked)', () => {
  it('blocks child abuse reference at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Child abuse has lasting effects.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('mature-themes');
  });

  it('blocks domestic violence at medium level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Domestic violence occurs in homes.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('mature-themes');
  });
});

// ── Conditional categories — strict vs medium ─────────────────────────────────

describe('scanForSensitiveTopics — violence (conditional)', () => {
  it('blocks violence keyword "murder" at strict level (Grade 1-3)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The murder mystery story.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('violence');
  });

  it('blocks "kill" keyword at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The hunter wants to kill the animal.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('violence');
  });

  it('allows violence keyword "war" at medium level (historical context)', () => {
    // War is in the keywords but medium level skips conditional categories
    const result = scanForSensitiveTopics(worksheetWithText('The American Civil War was a major conflict.'), 'medium');
    // violence should NOT be in triggeredCategories at medium level
    expect(result.triggeredCategories).not.toContain('violence');
  });

  it('allows "weapon" keyword at medium level (Grade 4-10 academic)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('What weapon was used in the Revolutionary War?'), 'medium');
    expect(result.triggeredCategories).not.toContain('violence');
  });

  it('blocks bloodshed (supplemental regex) at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The battle ended in bloodshed.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('violence');
  });

  it('blocks gun mention (supplemental regex) at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('He picked up a gun.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('violence');
  });

  it('does NOT block gun mention at medium level (supplemental regex conditional)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('He picked up a gun.'), 'medium');
    expect(result.triggeredCategories).not.toContain('violence');
  });
});

describe('scanForSensitiveTopics — politics (conditional)', () => {
  it('blocks politics keyword "democrat" at strict level (Grade 1-3)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The democrat candidate spoke.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('politics');
  });

  it('allows politics keyword at medium level (Grade 4-10 academic context)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The republican party was founded in 1854.'), 'medium');
    expect(result.triggeredCategories).not.toContain('politics');
  });

  it('blocks partisan language at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Partisan debates are common.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('politics');
  });
});

describe('scanForSensitiveTopics — religion (conditional)', () => {
  it('blocks religion keyword "jesus" at strict level (Grade 1-3)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('Jesus was a historical figure.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('religion');
  });

  it('allows religion keyword "bible" at medium level (academic discussion)', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The Bible is an important historical text.'), 'medium');
    expect(result.triggeredCategories).not.toContain('religion');
  });

  it('blocks "crusade" at strict level', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The Crusade was a medieval campaign.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('religion');
  });
});

// ── Grade-band boundary tests ─────────────────────────────────────────────────

describe('scanForSensitiveTopics — grade-band thresholds', () => {
  it('strict level blocks violence for Grade 1 worksheet equivalent', () => {
    // Caller passes guardrailLevel='strict' for grades 1-3
    const result = scanForSensitiveTopics(worksheetWithText('The soldier carried a gun.'), 'strict');
    expect(result.safe).toBe(false);
  });

  it('medium level allows violence mention for Grade 10 worksheet equivalent', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The soldier carried a weapon in the war.'), 'medium');
    expect(result.triggeredCategories).not.toContain('violence');
  });

  it('strict level still blocks always-blocked categories at Grade 1', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The student had suicidal thoughts.'), 'strict');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('self-harm');
  });

  it('medium level still blocks always-blocked categories at Grade 10', () => {
    const result = scanForSensitiveTopics(worksheetWithText('The student used cocaine.'), 'medium');
    expect(result.safe).toBe(false);
    expect(result.triggeredCategories).toContain('drugs');
  });
});

// ── Multiple triggered categories ────────────────────────────────────────────

describe('scanForSensitiveTopics — multiple categories', () => {
  it('reports all triggered categories in a single scan', () => {
    const ws = worksheetWithText('Cocaine and suicide were discussed in the propaganda.');
    const result = scanForSensitiveTopics(ws, 'medium');
    expect(result.safe).toBe(false);
    // Both drugs (cocaine) and self-harm (suicide) should be triggered
    expect(result.triggeredCategories).toContain('drugs');
    expect(result.triggeredCategories).toContain('self-harm');
  });

  it('returns empty triggeredCategories for clean content', () => {
    const result = scanForSensitiveTopics(cleanWorksheet(), 'strict');
    expect(result.triggeredCategories).toHaveLength(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('scanForSensitiveTopics — edge cases', () => {
  it('returns safe=true for an empty worksheet object', () => {
    const result = scanForSensitiveTopics({}, 'strict');
    expect(result.safe).toBe(true);
  });

  it('returns safe=true when all text fields are empty strings', () => {
    const result = scanForSensitiveTopics(
      { title: '', instructions: '', questions: [{ number: 1, question: '', answer: '', explanation: '' }] },
      'strict'
    );
    expect(result.safe).toBe(true);
  });

  it('defaults guardrailLevel to medium when omitted', () => {
    // Should not block violence keyword (conditional) by default
    const result = scanForSensitiveTopics(worksheetWithText('The Civil War was fought over slavery.'));
    expect(result.triggeredCategories).not.toContain('violence');
  });
});

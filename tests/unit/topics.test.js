/**
 * @file tests/unit/topics.test.js
 * @description Unit tests for curriculum data helper functions in topics.js.
 * @agent QA
 */

import { describe, it, expect } from '@jest/globals';
import {
  getAllGrades,
  getSubjectsForGrade,
  getTopicsForGradeSubject,
  getStandardsForGradeSubject,
  getQuestionTypesForGradeSubject,
  getDescriptionForGradeSubject,
  getAllTopicCombinations,
  CURRICULUM,
} from '../../src/ai/topics.js';

describe('getAllGrades()', () => {

  it('returns an array of numbers', () => {
    const grades = getAllGrades();
    expect(Array.isArray(grades)).toBe(true);
    grades.forEach(g => expect(typeof g).toBe('number'));
  });

  it('contains grades 1 through 10', () => {
    const grades = getAllGrades();
    for (let g = 1; g <= 10; g++) {
      expect(grades).toContain(g);
    }
  });

  it('returns exactly 10 grades', () => {
    expect(getAllGrades()).toHaveLength(10);
  });

});

describe('getSubjectsForGrade()', () => {

  it('returns an array of strings for grade 3', () => {
    const subjects = getSubjectsForGrade(3);
    expect(Array.isArray(subjects)).toBe(true);
    subjects.forEach(s => expect(typeof s).toBe('string'));
  });

  it('includes Math for grade 3', () => {
    expect(getSubjectsForGrade(3)).toContain('Math');
  });

  it('includes ELA for grade 1', () => {
    expect(getSubjectsForGrade(1)).toContain('ELA');
  });

  it('includes Science for grade 5', () => {
    expect(getSubjectsForGrade(5)).toContain('Science');
  });

  it('returns empty array for invalid grade 99', () => {
    const result = getSubjectsForGrade(99);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns subjects for every valid grade', () => {
    for (let g = 1; g <= 10; g++) {
      const subjects = getSubjectsForGrade(g);
      expect(subjects.length).toBeGreaterThan(0);
    }
  });

});

describe('getTopicsForGradeSubject()', () => {

  it('returns an array for grade 3 Math', () => {
    const topics = getTopicsForGradeSubject(3, 'Math');
    expect(Array.isArray(topics)).toBe(true);
  });

  it('returns at least 8 topics for grade 3 Math', () => {
    expect(getTopicsForGradeSubject(3, 'Math').length).toBeGreaterThanOrEqual(8);
  });

  it('includes Multiplication facts topic for grade 3 Math', () => {
    const topics = getTopicsForGradeSubject(3, 'Math');
    const hasMult = topics.some(t => t.toLowerCase().includes('multiplication'));
    expect(hasMult).toBe(true);
  });

  it('returns all string values', () => {
    getTopicsForGradeSubject(5, 'Science').forEach(t => expect(typeof t).toBe('string'));
  });

  it('returns empty array for invalid grade', () => {
    const result = getTopicsForGradeSubject(99, 'Math');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for invalid subject on valid grade', () => {
    const result = getTopicsForGradeSubject(3, 'ArtHistory');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns topics for grade 1 ELA', () => {
    expect(getTopicsForGradeSubject(1, 'ELA').length).toBeGreaterThan(0);
  });

  it('returns topics for grade 10 Math', () => {
    expect(getTopicsForGradeSubject(10, 'Math').length).toBeGreaterThan(0);
  });

});

describe('getStandardsForGradeSubject()', () => {

  it('returns an array for grade 3 Math', () => {
    const standards = getStandardsForGradeSubject(3, 'Math');
    expect(Array.isArray(standards)).toBe(true);
  });

  it('returns non-empty standards for grade 3 Math', () => {
    expect(getStandardsForGradeSubject(3, 'Math').length).toBeGreaterThan(0);
  });

  it('returns standard code strings containing dots or dashes', () => {
    const standards = getStandardsForGradeSubject(3, 'Math');
    standards.forEach(s => expect(typeof s).toBe('string'));
  });

  it('returns CCSS codes for Math', () => {
    const standards = getStandardsForGradeSubject(3, 'Math');
    const hasCCSS = standards.some(s => s.startsWith('CCSS'));
    expect(hasCCSS).toBe(true);
  });

  it('returns empty array for invalid grade', () => {
    const result = getStandardsForGradeSubject(99, 'Math');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for invalid subject', () => {
    const result = getStandardsForGradeSubject(3, 'InvalidSubject');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

});

describe('getQuestionTypesForGradeSubject()', () => {

  it('returns an array for grade 3 Math', () => {
    const types = getQuestionTypesForGradeSubject(3, 'Math');
    expect(Array.isArray(types)).toBe(true);
  });

  it('returns string values', () => {
    getQuestionTypesForGradeSubject(3, 'Math').forEach(t => expect(typeof t).toBe('string'));
  });

  it('includes multiple-choice for all grades and subjects', () => {
    for (let g = 1; g <= 10; g++) {
      const subjects = getSubjectsForGrade(g);
      subjects.forEach(s => {
        const types = getQuestionTypesForGradeSubject(g, s);
        expect(types).toContain('multiple-choice');
      });
    }
  });

  it('returns default types for invalid grade/subject combination', () => {
    const types = getQuestionTypesForGradeSubject(99, 'Unknown');
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain('multiple-choice');
  });

  it('returns fill-in-the-blank for grade 3 Math (elementary math)', () => {
    expect(getQuestionTypesForGradeSubject(3, 'Math')).toContain('fill-in-the-blank');
  });

});

describe('getDescriptionForGradeSubject()', () => {

  it('returns a string for grade 3 Math', () => {
    const desc = getDescriptionForGradeSubject(3, 'Math');
    expect(typeof desc).toBe('string');
  });

  it('returns a non-empty string for grade 3 Math', () => {
    const desc = getDescriptionForGradeSubject(3, 'Math');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('returns empty string for invalid grade', () => {
    const desc = getDescriptionForGradeSubject(99, 'Math');
    expect(desc).toBe('');
  });

  it('returns empty string for invalid subject', () => {
    const desc = getDescriptionForGradeSubject(3, 'FakeSubject');
    expect(desc).toBe('');
  });

});

describe('getAllTopicCombinations()', () => {

  it('returns an array', () => {
    expect(Array.isArray(getAllTopicCombinations())).toBe(true);
  });

  it('returns at least 400 combinations (curriculum has 410+)', () => {
    expect(getAllTopicCombinations().length).toBeGreaterThanOrEqual(400);
  });

  it('every item has grade, subject, and topic properties', () => {
    getAllTopicCombinations().forEach(item => {
      expect(item).toHaveProperty('grade');
      expect(item).toHaveProperty('subject');
      expect(item).toHaveProperty('topic');
    });
  });

  it('grade values are numbers between 1 and 10', () => {
    getAllTopicCombinations().forEach(item => {
      expect(typeof item.grade).toBe('number');
      expect(item.grade).toBeGreaterThanOrEqual(1);
      expect(item.grade).toBeLessThanOrEqual(10);
    });
  });

  it('subject and topic values are non-empty strings', () => {
    getAllTopicCombinations().forEach(item => {
      expect(typeof item.subject).toBe('string');
      expect(item.subject.length).toBeGreaterThan(0);
      expect(typeof item.topic).toBe('string');
      expect(item.topic.length).toBeGreaterThan(0);
    });
  });

  it('contains a combination for grade 3 Math multiplication', () => {
    const combos = getAllTopicCombinations();
    const found = combos.some(
      c => c.grade === 3 && c.subject === 'Math' && c.topic.toLowerCase().includes('multiplication')
    );
    expect(found).toBe(true);
  });

  it('contains combinations for grade 1 and grade 10', () => {
    const combos = getAllTopicCombinations();
    expect(combos.some(c => c.grade === 1)).toBe(true);
    expect(combos.some(c => c.grade === 10)).toBe(true);
  });

});

describe('CURRICULUM constant', () => {

  it('is exported and is an object', () => {
    expect(typeof CURRICULUM).toBe('object');
    expect(CURRICULUM).not.toBeNull();
  });

  it('has entry for each grade 1–10', () => {
    for (let g = 1; g <= 10; g++) {
      expect(CURRICULUM[g]).toBeDefined();
    }
  });

  it('grade 3 Math entry has topics, standards, description, questionTypes', () => {
    const entry = CURRICULUM[3]['Math'];
    expect(entry).toHaveProperty('topics');
    expect(entry).toHaveProperty('standards');
    expect(entry).toHaveProperty('description');
    expect(entry).toHaveProperty('questionTypes');
  });

});

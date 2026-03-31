/**
 * @file src/types/search.ts
 * @description All search-related TypeScript types.
 */

export type GradeOption =
  | 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' | 'Grade 5'
  | 'Grade 6' | 'Grade 7' | 'Grade 8' | 'Grade 9' | 'Grade 10';

export type SubjectOption = 'Math' | 'English' | 'Science' | 'Social Studies';

export type ComplexityOption = 'Easy' | 'Medium' | 'Hard';

export interface SearchState {
  query: string;
  grade: GradeOption | null;
  subject: SubjectOption | null;
  complexity: ComplexityOption | null;
}

export interface SearchContext extends SearchState {
  source: 'search' | 'filter' | 'surprise';
}

export interface WorksheetResult {
  id: string;
  title: string;
  grade: GradeOption;
  subject: SubjectOption;
  complexity: ComplexityOption;
  questionCount: number;
  estimatedTime: string;
}

export const ALL_GRADES: GradeOption[] = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
];

export const ALL_SUBJECTS: SubjectOption[] = ['Math', 'English', 'Science', 'Social Studies'];

export const ALL_COMPLEXITIES: ComplexityOption[] = ['Easy', 'Medium', 'Hard'];

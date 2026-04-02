/**
 * @file QuestionRenderer.tsx
 * @description Routes to the correct question component based on type.
 */

import type { QuestionRendererProps } from '../../types';
import MCQQuestion from './MCQQuestion';
import FillBlankQuestion from './FillBlankQuestion';
import ShortAnswerQuestion from './ShortAnswerQuestion';
import MatchingQuestion from './MatchingQuestion';
import type { MCQQuestion as MCQType, FillBlankQuestion as FBType, MatchingQuestion as MatchType } from '../../types';

export default function QuestionRenderer(props: QuestionRendererProps) {
  switch (props.question.type) {
    case 'multiple-choice':
      return <MCQQuestion {...props} question={props.question as MCQType} />;
    case 'fill-in-the-blank':
      return <FillBlankQuestion {...props} question={props.question as FBType} />;
    case 'short-answer':
      return <ShortAnswerQuestion {...props} />;
    case 'matching':
      return <MatchingQuestion {...props} question={props.question as MatchType} />;
    default:
      return <p className="text-muted-foreground">Unsupported question type.</p>;
  }
}

# Prompt Library

All prompts are built by `src/ai/promptBuilder.js`. This document describes the structure, key sections, and design rationale for each prompt type.

## System Prompt (buildSystemPrompt)

The system prompt establishes Claude as a curriculum expert. Key sections:

```
You are an expert curriculum designer for USA K-12 education. You create worksheets that are:
- Aligned to {standard} for {subject} (CCSS for Math/ELA, NGSS for Science, C3 for Social Studies, NHES for Health)
- Appropriate for Grade {grade} students
- Clear, unambiguous, and free of trick questions
- Using grade-appropriate vocabulary

You MUST respond with a single valid JSON object. No markdown, no explanation, no preamble.
The JSON must exactly match the schema provided.
```

**Why JSON in system prompt:** Claude is more reliable at producing JSON when the format requirement is in the system prompt, not buried in the user message. This reduces extraction failures.

## User Prompt (buildUserPrompt)

Standard prompt for first attempt:

```javascript
export function buildUserPrompt(options) {
  const { grade, subject, topic, difficulty, questionCount, standards, questionTypes, description } = options;

  return `Generate a worksheet with exactly ${questionCount} questions.

Grade: ${grade}
Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}
Standards: ${standards.join(', ')}
Question types to use: ${questionTypes.join(', ')}
Curriculum context: ${description}

Return ONLY this JSON structure (no other text):
{
  "title": "Grade ${grade} ${subject} — ${topic}",
  "grade": ${grade},
  "subject": "${subject}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "standards": ${JSON.stringify(standards)},
  "estimatedTime": "X minutes",
  "instructions": "...",
  "totalPoints": ${questionCount},
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "B",
      "explanation": "...",
      "points": 1
    }
  ]
}

RULES:
- Exactly ${questionCount} questions, numbered 1 to ${questionCount}
- "options" field ONLY for multiple-choice questions
- "answer" must be the letter only for multiple-choice (A, B, C, or D)
- All questions must be appropriate for Grade ${grade} students
- estimatedTime: calculate as approximately 2 minutes per question`;
}
```

## Strict User Prompt (buildStrictUserPrompt)

Used on retry attempt >= 1. Same as user prompt but with a CRITICAL prefix:

```javascript
export function buildStrictUserPrompt(options) {
  const base = buildUserPrompt(options);
  return `CRITICAL: Your previous response failed JSON validation. You MUST return ONLY valid JSON.
No text before or after the JSON. No markdown code fences. No explanation. ONLY the JSON object.

${base}`;
}
```

**Why CRITICAL prefix works:** Claude treats all-caps instructions with high priority. The explicit reminder that "previous response failed" triggers more careful formatting.

## Grade-Band Language Hints

The system prompt includes grade-band vocabulary guidance embedded in `buildSystemPrompt`:

| Grade Band | Vocabulary Guidance |
|---|---|
| 1–2 (early elementary) | Simple words, short sentences, concrete objects, counting |
| 3–5 (elementary) | Age-appropriate vocabulary, real-world contexts, full sentences |
| 6–8 (middle school) | Academic vocabulary, abstract reasoning, multi-step problems |
| 9–10 (high school) | Discipline-specific terminology, analytical questions, evidence-based reasoning |

```javascript
function getGradeBandHint(grade) {
  if (grade <= 2) return 'Use very simple words and short sentences suitable for early readers. Focus on concrete, everyday objects.';
  if (grade <= 5) return 'Use age-appropriate vocabulary. Include real-world contexts. Sentences should be clear and complete.';
  if (grade <= 8) return 'Use academic vocabulary appropriate for middle school. Include multi-step problems and abstract reasoning.';
  return 'Use discipline-specific terminology appropriate for high school. Include analytical and evidence-based questions.';
}
```

## Topic Context Injection

Each prompt includes the full curriculum context from `src/ai/topics.js`:

```javascript
const topicData = getDescriptionForGradeSubject(grade, subject, topic);
const standards = getStandardsForGradeSubject(grade, subject);
const questionTypes = getQuestionTypesForGradeSubject(grade, subject);
```

This ensures Claude knows:
- The specific learning objectives for this topic at this grade level
- Which CCSS/NGSS/NHES codes to reference in explanations
- Which question types are appropriate for this subject (e.g., Science uses more short-answer and show-your-work than ELA)

## Concrete Example Schema

The schema shown to Claude in the prompt is a concrete JSON example, not type annotations. This produces more reliable output than abstract type definitions:

```
✗ Don't show:    "grade": "integer 1-10"
✓ Do show:       "grade": 3
```

Claude produces better structured JSON when the example demonstrates the exact values it should produce, not the types.

## Prompt Length

Typical prompt lengths:
- System prompt: ~400 tokens
- User prompt: ~600-800 tokens (varies with questionCount, standards, description)
- Total input: ~1000-1200 tokens
- Expected output: ~150 tokens per question (1500-4500 for 10-30 questions)

Total tokens per generation: 2500-5700 (well within Sonnet's context window).

## Error Recovery Prompts

When `extractJSON` fails to find valid JSON in the response:

1. The error is logged with the raw response text
2. `buildStrictUserPrompt` is used for the next attempt
3. After 3 failures, the error is surfaced to the caller as `GENERATION_FAILED`

A common failure pattern is Claude wrapping the JSON in a markdown code fence:

```
```json
{ "title": "..." }
```
```

`extractJSON` handles this by stripping the code fence before parsing:

```javascript
export function extractJSON(rawText) {
  // Try to extract from markdown code fence first
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Fallback: find the outermost JSON object
  const jsonMatch = rawText.match(/(\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();

  throw new Error('No JSON found in Claude response');
}
```

## Future Prompt Improvements (Backlog)

- **Difficulty calibration:** Add Bloom's taxonomy levels to prompts (Remembering → Creating) for more precise difficulty targeting
- **Diversity enforcement:** Add a rule to prevent the same question pattern repeating (e.g., 10 multiplication-by-7 questions)
- **Explanation quality:** Add instructions for explanation length and format (1-2 sentences, include the calculation or reasoning path)
- **Matching question format:** Provide explicit format guidance for matching question pairs

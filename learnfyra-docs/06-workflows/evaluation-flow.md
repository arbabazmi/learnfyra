# Evaluation & Feedback Flow

## Answer Evaluation Pipeline

```
POST /api/submit arrives
     │
     ▼
submitHandler.js
  │
  ├── 1. Validate worksheetId (UUID v4 format — path traversal guard)
  │
  ├── 2. Load solve-data.json from storage
  │      (contains authoritative answers)
  │
  ├── 3. Build answer key map
  │      { 1: {answer, explanation, type, points}, 2: {...}, ... }
  │
  ├── 4. For each submitted answer:
  │      scorer.js.scoreAnswer(studentAnswer, correctAnswer, questionType)
  │
  ├── 5. resultBuilder.js.buildResult(scoreResults, worksheetMeta)
  │      → totalScore, percentage, per-question breakdown
  │
  ├── 6. (Authenticated users only)
  │      Save WorksheetAttempt to DynamoDB
  │      Update precomputed aggregates in Users table
  │
  └── 7. Return result JSON
```

## scorer.js — Detailed Scoring Logic

### scoreAnswer(studentAnswer, correctAnswer, questionType)

```javascript
export function scoreAnswer(student, correct, type) {
  if (!student || student.trim() === '') return false;

  switch (type) {
    case 'multiple-choice':
      return student.trim().toUpperCase() === correct.trim().toUpperCase();

    case 'true-false':
      return student.trim().toLowerCase() === correct.trim().toLowerCase();

    case 'fill-in-the-blank':
      return student.trim().toLowerCase() === correct.trim().toLowerCase();

    case 'short-answer': {
      // correct answer field contains keywords separated by '|'
      const keywords = correct.split('|').map(k => k.trim().toLowerCase());
      const studentLower = student.toLowerCase();
      return keywords.some(kw => studentLower.includes(kw));
    }

    case 'matching': {
      // student answer is JSON array of answers per pair
      // correct answer is JSON array of correct answers
      const studentPairs = JSON.parse(student);
      const correctPairs = JSON.parse(correct);
      return correctPairs.every((c, i) =>
        studentPairs[i]?.trim().toLowerCase() === c.trim().toLowerCase()
      );
    }

    case 'show-your-work':
    case 'word-problem': {
      // Only the finalAnswer field is scored
      // student answer object: { workShown, finalAnswer }
      const studentObj = JSON.parse(student);
      return studentObj.finalAnswer?.trim().toLowerCase() === correct.trim().toLowerCase();
    }

    default:
      return false;
  }
}
```

### Edge Cases

| Scenario | Handling |
|---|---|
| Student leaves question blank | Returns `correct: false`, `pointsEarned: 0` |
| Student submits extra questions (number not in worksheet) | Those answers are ignored |
| Student omits some questions | Missing questions score 0 |
| Short-answer with no keywords match | Returns `correct: false` (no partial credit in Phase 1) |
| Fill-in-the-blank trailing/leading spaces | Trimmed before comparison |
| Multiple-choice with "A." instead of "A" | Letter extracted before comparison |

## resultBuilder.js

```javascript
export function buildResult(worksheet, submittedAnswers, scoredResults, meta) {
  const totalScore = scoredResults.reduce((sum, r) => sum + r.pointsEarned, 0);
  const totalPoints = worksheet.totalPoints;
  const percentage = Math.round((totalScore / totalPoints) * 100);

  return {
    worksheetId: worksheet.worksheetId,
    totalScore,
    totalPoints,
    percentage,
    timeTaken: meta.timeTaken,
    timed: meta.timed,
    results: scoredResults.map(r => ({
      number: r.number,
      correct: r.correct,
      studentAnswer: r.studentAnswer,
      correctAnswer: r.correctAnswer,
      explanation: r.explanation,
      pointsEarned: r.pointsEarned,
      pointsPossible: r.pointsPossible
    }))
  };
}
```

## Feedback Display Design

### Correct Answer Display

```
Question 1                                           ✓ 1/1 pt
What is 6 × 7?
Your answer: B. 42                                   CORRECT
Explanation: 6 × 7 = 42. Multiplication is repeated addition:
7 + 7 + 7 + 7 + 7 + 7 = 42
```

Visual treatment:
- Green left border on card
- Green checkmark icon
- "CORRECT" badge in green
- Points shown in green

### Incorrect Answer Display

```
Question 2                                           ✗ 0/1 pt
8 × 9 = ___
Your answer: 63        Correct answer: 72            INCORRECT
Explanation: 8 × 9 = 72. You can verify by counting:
9 groups of 8 = 8, 16, 24, 32, 40, 48, 56, 64, 72
```

Visual treatment:
- Red left border on card
- Red X icon
- "INCORRECT" badge in red
- Correct answer shown prominently
- Explanation in secondary text

### Score Summary

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Score: 8/10        80%                    B+             │
│                                                             │
│   Time: 14:05    Mode: Timed                               │
│                                                             │
│   ████████░░  8 correct  ·  2 incorrect                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Grade scale (for display only — not stored):
- 90–100%: A
- 80–89%: B
- 70–79%: C
- 60–69%: D
- < 60%: Try Again

## Progress Aggregate Update Flow

After scoring, for authenticated students, the aggregates are updated inline:

```
submitHandler completes scoring
     │
     ▼
Write WorksheetAttempt to DynamoDB
     │
     ▼
Read current aggregates from Users table
     │
     ▼
Recompute:
  totalAttempts += 1
  avgScore = rolling average (new score weighted in)
  streak = check if completedAt is consecutive day
  weakAreas = topics where avgScore < 60%
  strongAreas = topics where avgScore > 85%
  subjectAvgScores[subject] = updated average
     │
     ▼
Write updated aggregates to Users table
(UpdateItem with calculated expressions)
```

This is done inline (not via async stream) to keep the submit response fast. The aggregate update adds approximately 50–100ms to the total response time.

## Timer Auto-Submit Flow

```
Client-side (solve.js):
  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      submitForm({ autoSubmitted: true });
    }
  }, 1000);

submitForm({ autoSubmitted: true }):
  Captures all currently filled answers (including blanks)
  Adds timeTaken = originalTimerSeconds (full time used)
  Adds timed = true
  Calls POST /api/submit
```

The server does not enforce timed mode — it trusts the client's `timed` and `timeTaken` fields. Timer enforcement is cosmetic/UX only; score calculation is identical for timed and untimed modes.

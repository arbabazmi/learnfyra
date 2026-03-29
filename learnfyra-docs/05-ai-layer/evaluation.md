# AI Content Evaluation

## Quality Dimensions

Every generated worksheet is evaluated against four quality dimensions:

| Dimension | Definition | Measurement |
|---|---|---|
| Curriculum Alignment | Questions address the specified standard(s) | Human review + standard code presence in explanation |
| Grade Appropriateness | Vocabulary and complexity match the grade level | Grade-band vocabulary guidelines in prompt |
| Question Variety | Mix of question types (not all multiple-choice) | Automated: count of unique question types |
| Structural Validity | JSON schema compliance, no missing fields | Automated: validateQuestions() in generator.js |

## Automated Validation (generator.js)

Every worksheet passes through these automated checks before being returned:

### validateTopLevel
```javascript
function validateTopLevel(data) {
  const required = ['title', 'grade', 'subject', 'topic', 'difficulty', 'questions'];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      throw new ValidationError(`Missing required field: ${field}`);
    }
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new ValidationError('questions must be a non-empty array');
  }
  if (data.grade < 1 || data.grade > 10) {
    throw new ValidationError(`Invalid grade: ${data.grade}`);
  }
}
```

### validateQuestions
Checks each question object:
- `number`: integer, sequential starting from 1
- `type`: must be one of the 7 allowed types
- `question`: non-empty string
- `answer`: non-empty string
- `explanation`: non-empty string
- `points`: positive integer
- `options`: ONLY present on `multiple-choice` type, must be exactly 4 items

### coerceTypes
Handles common Claude type inconsistencies:
- `"grade": "3"` → `grade: 3` (string to number)
- `"points": "1"` → `points: 1`
- `"grade": 3.0` → `grade: 3` (float to integer)

## Generation Log (Quality Monitoring)

Every generation writes to `LearnfyraGenerationLog` DynamoDB table including:
- `generationMode`: bank-only / mixed / ai-only
- `provenanceLevel`: full-bank / partial-bank / full-ai
- `modelUsed`: Claude model ID
- `durationMs`: end-to-end generation latency
- `retryCount`: number of retry attempts before success

Admin reports (`GET /api/admin/reports/usage`) aggregate these logs to monitor:
- AI-only generation rate (should decrease over time as bank grows)
- Average retry count (should be < 0.3 — most generations succeed on first attempt)
- Generation latency by topic and model

## Quality Signals (Manual Review Triggers)

The following signals indicate a worksheet may need admin review:

| Signal | Threshold | Action |
|---|---|---|
| retryCount | >= 2 | Flag in generation log for review |
| durationMs | > 45000ms | Log as slow generation, investigate |
| Student score | < 30% (across many students) | Questions may be too hard or ambiguous |
| Student score | > 98% (across many students) | Questions may be too easy |

The admin dashboard will surface these signals in a "Quality Alerts" panel (Phase 2 — not yet built).

## Curriculum Accuracy Standards

All topics in `src/ai/topics.js` are verified against:
- **CCSS (Math/ELA):** corestandards.org
- **NGSS (Science):** nextgenscience.org
- **C3 Framework (Social Studies):** socialstudies.org/c3
- **NHES (National Health Education Standards):** cdc.gov

Standard codes in the `standards` array of each worksheet must be valid. The topics.js curriculum map is reviewed and updated when new standards are published.

**Rule:** No worksheet topic is added to the curriculum map until the standards code has been verified against the official standards document. Topics outside the verified curriculum map are rejected at the generate endpoint with a 400 error.

## Retry Rate Monitoring

Acceptable retry rates by model:
- claude-sonnet-4-20250514: < 5% of requests need any retry
- claude-haiku-20240307: < 15% of requests need any retry (simpler model, more formatting failures)

If retry rate exceeds these thresholds for 2 consecutive hours, consider switching to the higher-quality model via M07 Admin panel.

## Phase 2 — Automated Quality Scoring

Phase 2 will add automated quality scoring using a second Claude call to evaluate the generated worksheet:

```javascript
// Planned (Phase 2)
const qualityScore = await evaluateWorksheet(worksheet, {
  rubric: [
    'Are all questions clearly worded with no ambiguity?',
    'Is the vocabulary appropriate for Grade {grade}?',
    'Do the explanations fully explain why the correct answer is correct?',
    'Are the incorrect options for multiple-choice plausible but clearly wrong?'
  ]
});
// Returns: { score: 0-100, flags: [{question: 2, issue: 'Ambiguous wording'}] }
```

Worksheets below a quality threshold (< 70) would be regenerated automatically before being returned to the user.

# Feature: AI Generation Fallback

**Document version:** 1.0
**Date:** 2026-04-03
**Status:** Draft — awaiting DEV and QA sign-off
**Author:** BA Agent

---

## Feature Overview

When Claude AI fails to generate worksheet questions — due to an API outage,
rate limit, content-policy refusal, or response validation failure — the
entire POST /api/generate request currently throws and returns HTTP 500 with a
raw error string. Teachers and students see a generic browser error and must
manually retry with no guidance.

This feature introduces a three-tier graceful degradation chain so that
Learnfyra always delivers the most helpful response it can, even when the AI
layer is unavailable. Partial content is preferred over no content. A complete
failure produces actionable suggestions rather than an opaque 500. Operations
staff receive an automated alert so they can act on the outage before teachers
notice it.

---

## User Stories

### Teacher perspective
As a teacher,
I want to receive a usable worksheet (or a helpful explanation) when AI
generation fails,
So that class preparation is not blocked by a temporary API outage.

### Student perspective
As a student,
I want to see a clear, friendly message when a worksheet cannot be generated,
So that I understand what happened and can try a related topic instead of
assuming the site is broken.

### Admin / Operations perspective
As an operations administrator,
I want to receive an automated notification whenever AI generation fails
completely and the question bank also has no coverage,
So that I can investigate and resolve the underlying cause before it affects
more users.

---

## Acceptance Criteria

### AC-1 — Tier 1: Normal path (no change to happy path)
Given a valid POST /api/generate request is received
And the Claude AI generates questions successfully within the retry window
When the assembler returns a full worksheet
Then the response is HTTP 200 with `success: true`, `fallbackMode: null`,
and the worksheet is complete with exactly `questionCount` questions.

### AC-2 — Tier 2: Partial bank fallback — bank has some questions
Given the AI generation fails after all retries (any error category: outage,
rate limit, content refusal, validation failure)
And the question bank returns at least 1 question for the requested
grade/subject/topic
When the assembler catches the AI error and falls back to the bank
Then the response is HTTP 200 with:
- `success: true`
- `fallbackMode: "partial"`
- `fallbackReason` is a human-readable string
- `requestedCount` equals the originally requested question count
- `metadata.questionCount` equals the number of questions actually served
- `questions` contains the banked questions renumbered 1..N
- The worksheet is otherwise fully formed (title, estimatedTime, totalPoints)
And the HTTP status code is 200.

### AC-3 — Tier 2: Partial bank fallback — boundary at grade 1 and grade 10
Given the AI fails and the bank has at least 1 question
When the grade is 1 (lower boundary) or 10 (upper boundary)
Then the partial worksheet response contains only questions whose stored grade
field matches the requested grade
And the fallback response includes `fallbackMode: "partial"` and the correct
`servedCount`.

### AC-4 — Tier 2: Partial bank fallback — boundary at 5 and 30 questions
Given the AI fails and the bank has between 1 and 4 questions for a requested
count of 5
When the fallback runs
Then `requestedCount` is 5, `servedCount` is the actual count from the bank
(1-4), `fallbackMode: "partial"`
And the worksheet is returned with only those questions.

### AC-5 — Tier 3: No questions available — friendly error with suggestions
Given the AI fails completely
And the question bank has zero questions for the requested grade/subject/topic
(or the bank query itself throws)
When the fallback runs
Then the response is HTTP 400 with:
- `success: false`
- `code: "WG_NO_QUESTIONS_AVAILABLE"`
- `fallbackMode: "none"`
- `fallbackReason` string describes why no content was served
- `suggestedTopics` is an array of topic strings with available questions
- No raw error stack trace is exposed in non-debug environments
And an admin notification is dispatched via AWS SNS (see AC-7).

### AC-6 — Tier 3: Suggestions query uses same-grade, same-subject scope
Given the Tier 3 path is triggered
When the suggestion query runs against the question bank
Then it queries DynamoDB for all topics within the same grade and subject
And returns up to 5 distinct topic names that have at least 1 question
And excludes the originally requested topic from the suggestions list
And returns an empty array (not null) if no suggestions exist.

### AC-7 — Admin notification via SNS
Given the Tier 3 path is triggered (zero available questions)
When the alert handler runs
Then it reads the SNS topic ARN from the `LearnfyraConfig` DynamoDB table
using key `configKey: "admin-fallback-sns-topic-arn"`, field `value`
And publishes a message to the SNS topic with:
- Subject: "Learnfyra Alert: AI Generation Failed"
- Message: grade, subject, topic, difficulty, AI error message, timestamp, requestId
And if the config lookup fails, or if SNS publish fails, the error is logged
at WARN level but the user-facing response is not affected (non-fatal)
And an `adminNotified` boolean field is present in the Tier 3 response body.

### AC-8 — AWS deployment: generateHandler IAM permissions
Given the feature is deployed to any environment (dev, staging, prod)
When the Lambda function learnfyra-generate executes Tier 3 fallback
Then the Lambda execution role has:
- `dynamodb:GetItem` on the `LearnfyraConfig` table (to read config)
- `sns:Publish` on the fallback alert SNS topic ARN

### AC-9 — Frontend: yellow warning banner for Tier 2
Given the API returns HTTP 200 with `fallbackMode: "partial"` and `success: true`
When GenerateWorksheetPage renders the response
Then a yellow warning banner is displayed above the worksheet result area
stating the number of questions served versus requested
And the banner does not appear when `fallbackMode` is `null`.

### AC-10 — Frontend: friendly error card for Tier 3
Given the API returns HTTP 400 with `success: false` and
`code: "WG_NO_QUESTIONS_AVAILABLE"`
When GenerateWorksheetPage renders the response
Then a friendly error card replaces the generic error message
And the card lists each entry in `suggestedTopics` as a clickable button that
pre-fills the topic selector on the generate form
And no raw error message or stack trace is shown to the user.

### AC-11 — No 500 responses for fallback conditions
Given any of the AI failure scenarios described in AC-2 through AC-10
When the Lambda handler catches the AI error
Then the HTTP status code is 200 (Tier 2) or 400 (Tier 3)
And a 500 is only returned for truly unexpected errors unrelated to AI
generation (e.g. auth failure, S3 upload crash).

---

## Out of Scope

- Changes to retry counts or backoff in `src/utils/retryUtils.js`
- Caching AI responses or pre-generating questions
- Slack, PagerDuty, or any alert channel other than SNS email subscriptions
- Admin UI to update the config values
- Question bank auto-seeding when the bank is empty
- Changes to the solve, submit, download, or list Lambda handlers

---

## Dependencies

| Dependency | Status |
|------------|--------|
| `src/questionBank/dynamoAdapter.js` — `listQuestions` | Exists |
| `src/ai/assembler.js` — `generateMissingQuestions` | Exists |
| `LearnfyraConfig` DynamoDB table | Exists in CDK |
| SNS topic for admin alerts | Must be provisioned via CDK |
| `@aws-sdk/client-sns` npm package | Must be installed |

---

## Open Questions

| ID | Question |
|----|----------|
| OQ-1 | Should Tier 2 run the answer key export against the bank-only worksheet? |
| OQ-2 | Should SNS publish be awaited or fire-and-forget? |
| OQ-3 | Should `suggestedTopics` be sorted by question count or alphabetically? |

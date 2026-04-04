# AI Prompt Guardrails & Admin Controls — Feature Specification

**Document ID:** LFR-FRD-GUARDRAILS-001
**Version:** 1.0
**Date:** 2026-04-04
**Status:** Draft — Awaiting DEV, IaC, and QA sign-off
**Author:** BA Agent
**Audience:** DEV Agent, QA Agent, IaC Agent, DevOps Agent, Legal/Compliance
**Supersedes:** AI-PROMPT-GUARDRAIL-ADMIN-REQUIREMENT.md (source requirement)
**Compliance Refs:** COPPA, California AB 2013, FTC Section 5, CCSS, NGSS

---

## 1. Feature Summary

Learnfyra generates AI-powered worksheets for US Grade 1–10 students. The current
AI layer (`src/ai/promptBuilder.js`, `src/ai/generator.js`) produces prompts from
structured teacher inputs and validates the structural shape of responses (JSON schema,
question types). However, it does not enforce content safety guardrails, does not scan
outputs for harmful or age-inappropriate material, and does not give Super Admins or
Ops Admins a UI-accessible control plane to manage prompt templates, guardrail rules,
or AI model configuration.

This feature introduces three coordinated capabilities:

1. **Prompt Engineering Guardrails** — concise, grade-context-aware safety instructions
   embedded in every AI prompt, token-efficiently, before the AI generates any content.

2. **Output Validation & Content Moderation** — programmatic scanning of every generated
   question, answer, and explanation before it reaches a student, using grade and subject
   context to calibrate strictness. Flagged outputs are rejected and trigger an automatic
   retry with a more restrictive prompt or a fallback to the question bank.

3. **Admin Controls** — a protected API surface (and eventually a UI panel within the
   existing admin console) that allows only Super Admins and Ops Admins to view, version,
   and update prompt templates, guardrail rules, and active AI model configuration. Every
   change is audit-logged and reversible.

This feature is classified **SHOULD HAVE** for initial launch and **MUST HAVE** before
school district onboarding or any public marketing to K-12 institutions (see
LFR-AUDIT-001 requirement AI-03). A single incident of inappropriate content reaching a
student would trigger FTC Section 5 investigation and destroy institutional trust.

### Affected Source Files (existing — extend only, do not rebuild)

| File | Change Type |
|---|---|
| `src/ai/promptBuilder.js` | Extend `buildSystemPrompt()` and `buildUserPrompt()` with guardrail clauses |
| `src/ai/generator.js` | Add post-generation content scan call |
| `src/ai/assembler.js` | Wire moderation result into retry logic |
| `backend/handlers/generateHandler.js` | Surface moderation flag in response metadata |
| `backend/handlers/adminHandler.js` | Add guardrail CRUD endpoints |
| `src/admin/auditLogger.js` | Extend to log prompt template and guardrail changes |

### New Source Files Required

| File | Purpose |
|---|---|
| `src/ai/guardrails/promptGuardrail.js` | Builds grade-context guardrail clause for prompt injection |
| `src/ai/guardrails/outputValidator.js` | Scans AI output for forbidden content categories |
| `src/ai/guardrails/moderationAdapter.js` | Abstraction layer over moderation service (AWS Comprehend or custom) |
| `src/ai/guardrails/guardrailConfig.js` | Loads active guardrail config from DynamoDB Config table |
| `tests/unit/promptGuardrail.test.js` | Unit tests for guardrail clause builder |
| `tests/unit/outputValidator.test.js` | Unit tests for output scanner |
| `tests/unit/moderationAdapter.test.js` | Unit tests with mocked AWS Comprehend |
| `tests/integration/guardrailFlow.test.js` | End-to-end: generate → scan → retry on flag |

---

## 2. User Stories

### US-GUARD-001 — Grade-Aware Safe Prompts (Teacher / Platform)
As a teacher using Learnfyra,
I want every worksheet the AI generates to be automatically filtered for age-appropriate
content without me having to configure anything,
So that I can trust the platform to protect my students from harmful or
inappropriate material.

### US-GUARD-002 — Content Moderation Before Delivery (Teacher / Student)
As a teacher assigning a generated worksheet to Grade 1 students,
I want the system to automatically reject any AI output containing harmful, offensive,
or age-inappropriate language and retry generation before the worksheet is delivered,
So that no inappropriate content ever reaches a six- or seven-year-old student.

### US-GUARD-003 — Prompt Template Management (Super Admin)
As a Super Admin,
I want to view and update the AI system prompt templates and guardrail instructions
through a protected API endpoint,
So that I can refine the safety rules that govern every worksheet generated on the
platform without requiring a code deployment.

### US-GUARD-004 — AI Model Control (Super Admin / Ops Admin)
As a Super Admin or Ops Admin,
I want to change the active AI model (e.g., switch from Claude Sonnet to Claude Haiku)
from the admin control plane,
So that I can respond immediately to model quality issues, cost anomalies, or a vendor
outage without touching infrastructure.

### US-GUARD-005 — Audit Trail for Prompt Changes (Super Admin / Compliance Admin)
As a Data/Compliance Admin,
I want to see a full audit log of every change made to prompt templates, guardrail
rules, and AI model selection, including who made the change, when, and what the
previous value was,
So that I can demonstrate compliance with internal governance policies and respond to
any regulatory inquiry.

### US-GUARD-006 — Teacher Reporting of Inappropriate Content (Teacher)
As a teacher,
I want to flag a specific worksheet as containing inappropriate or incorrect content
with a one-click report,
So that the platform operations team can review and remove it, and the AI generation
rules can be tightened if needed.

### US-GUARD-007 — Retry on Failed Moderation (Developer / Platform)
As a developer operating the platform,
I want the system to automatically retry AI generation with a more restrictive prompt
when the moderation scan fails,
So that transient AI quality issues are self-healed without human intervention and
without delivering bad content to users.

### US-GUARD-008 — Bias and Inclusivity Enforcement (Platform / Students)
As a student from any background,
I want AI-generated worksheet content to be free from stereotypes, cultural bias, and
discriminatory framing,
So that the platform treats all students equitably and does not reinforce harmful
assumptions through educational materials.

### US-GUARD-009 — Guardrail Configuration Read Access (Ops Admin / Data Admin)
As an Ops Admin or Data/Compliance Admin,
I want to read the current prompt templates and guardrail configuration without being
able to modify them,
So that I can verify the platform is operating within approved parameters during an
audit or incident investigation.

### US-GUARD-010 — Admin Rollback of Prompt Template (Super Admin)
As a Super Admin,
I want to instantly roll back a prompt template or guardrail rule to its previous
approved version if a change causes a content quality regression,
So that student-facing content quality is restored in minutes rather than hours.

---

## 3. Functional Requirements

Requirements are organized into seven groups. Each requirement has: ID, description,
priority, and Given/When/Then acceptance criteria.

Priority key: P0 = launch-blocking, P1 = must ship within 30 days of launch, P2 = Phase 2.

---

### Group A — Prompt Engineering Guardrails

#### FR-GUARD-001 — Grade-Context Guardrail Clause in Every Prompt
**Priority:** P0

Every call to the AI model for question generation MUST include a concise guardrail
instruction block that specifies:
- The target grade level and approximate student age range.
- That content must be factual, educationally appropriate, and aligned to US curriculum.
- That the AI must not produce references to violence, graphic content, sexually
  explicit material, political opinion, religious doctrine, or mature themes.
- That the AI must not include stereotypes, culturally insensitive framing, or
  discriminatory language.
- That the AI must not include brand names, commercial endorsements, or product
  advertising.

The guardrail clause MUST be injected at the beginning of the system prompt, before
curriculum and formatting instructions, so it takes highest precedence.

The clause MUST be loaded dynamically from the `LearnfyraConfig` DynamoDB table using
`configKey: "ai/guardrail/systemClause"`. If the config key is missing, the handler
MUST use the hardcoded default clause defined in `src/ai/guardrails/guardrailConfig.js`
and log a WARNING. The handler MUST NOT silently skip the guardrail.

Token budget for the guardrail clause: maximum 120 tokens as measured by the Anthropic
tokenizer. If a Super Admin saves a clause that exceeds 120 tokens, the admin API MUST
reject it with a 400 error and a descriptive message.

**Acceptance Criteria:**

Given `buildSystemPrompt({ grade: 1, subject: 'Math', topic: 'Counting' })` is called
When the resulting prompt string is inspected
Then it begins with the guardrail clause loaded from config (or the hardcoded default)
And the clause contains the grade level ("Grade 1") and age range ("age 6-7")
And the clause explicitly forbids violence, mature themes, stereotypes, and advertising
And the clause is present before any curriculum alignment or formatting instruction.

Given `buildSystemPrompt({ grade: 10, subject: 'ELA', topic: 'Persuasive Writing' })` is called
When the resulting prompt string is inspected
Then it contains the guardrail clause referencing "Grade 10" and "age 15-16"
And the clause is token-counted and does not exceed 120 tokens.

Given the `ai/guardrail/systemClause` key is absent from the DynamoDB Config table
When `buildSystemPrompt()` is called
Then it uses the hardcoded default clause from `guardrailConfig.js`
And logs a WARNING at level WARN via `src/utils/logger.js`
And does NOT throw an error or abort generation.

---

#### FR-GUARD-002 — Grade Band Strictness Differentiation
**Priority:** P0

The guardrail clause and output validation filters MUST apply stricter rules for lower
grade bands, reflecting the younger age of students and the more limited cognitive and
emotional maturity expected.

Grade band definitions:
- **Band 1 (Grades 1–3, ages 6–9):** Strictest. No ambiguous social scenarios, no
  conflict narratives, no competitive or comparative framing (e.g., "who is faster" is
  allowed; "who is a loser" is not). Reading-level appropriate vocabulary only.
- **Band 2 (Grades 4–6, ages 9–12):** Moderate. Age-appropriate social scenarios
  permitted. Still no political opinion, religious doctrine, or adult relationship themes.
- **Band 3 (Grades 7–10, ages 12–16):** Standard. Broader topic range allowed
  including historical conflicts (factual only), civics, and human biology as required
  by CCSS/NGSS curriculum. Still no graphic violence, explicit sexual content, or
  discriminatory framing.

Grade band MUST be computed from the `grade` field in the generation request and passed
to both `promptGuardrail.js` (prompt injection) and `outputValidator.js` (scan filters).

**Acceptance Criteria:**

Given grade=1 and subject='Science'
When the guardrail clause is built
Then the clause contains Band 1 strictness markers (no conflict narratives, no
comparative framing beyond educational comparison)
And the system prompt instructs the model to use only vocabulary appropriate for age 6–7.

Given grade=7 and subject='Social Studies'
When the guardrail clause is built
Then the clause allows factual historical conflict content in the Band 3 scope
And still explicitly forbids graphic violence, explicit sexual content, and
discriminatory language.

Given grade=5 (Band 2) and subject='ELA'
When a generated question contains the phrase "God told him to..."
Then the output scanner flags it as RELIGION category
And the question is rejected and regeneration is triggered regardless of grade band.

---

#### FR-GUARD-003 — Bias and Inclusivity Instruction
**Priority:** P1

Every AI prompt MUST include an instruction clause directing the model to:
- Use gender-neutral language and avoid gender stereotyping in roles, occupations,
  and scenarios (e.g., scientists, doctors, athletes may be any gender).
- Use ethnically and culturally diverse names and scenarios proportional to US
  demographic representation.
- Avoid assumptions about family structure (e.g., do not assume all families have two
  parents, or that all students celebrate the same holidays).
- Not conflate nationality, race, or culture with intelligence, achievement, or
  socioeconomic status.

The bias instruction clause MUST be a separate config key `ai/guardrail/biasClause`
in the DynamoDB Config table so it can be updated independently of the main safety
clause.

**Acceptance Criteria:**

Given `buildSystemPrompt()` is called for any grade or subject
When the resulting prompt is inspected
Then it contains both `ai/guardrail/systemClause` and `ai/guardrail/biasClause` content
And both clauses are present before curriculum alignment instructions.

Given a generated question uses only male pronouns for scientists across a 10-question
worksheet
When the output validator bias check runs
Then it logs a WARN-level bias signal (not a hard reject in v1 — see Open Questions)
And the signal is recorded in the moderation log for review.

---

### Group B — Output Validation

#### FR-GUARD-004 — Mandatory Post-Generation Content Scan
**Priority:** P0

After every AI generation call and before any question is stored in the question bank
or returned in the worksheet response, ALL generated content (question text, options,
answer, explanation) for EVERY question MUST be scanned by `outputValidator.js`.

The scan MUST check for the following categories:

| Category ID | Category Name | Description |
|---|---|---|
| CAT-01 | PROFANITY | Profane, obscene, or vulgar language |
| CAT-02 | HATE_SPEECH | Hate speech, slurs, dehumanizing language |
| CAT-03 | VIOLENCE | References to graphic physical violence or gore |
| CAT-04 | SEXUAL | Sexually suggestive or explicit content |
| CAT-05 | SELF_HARM | Content relating to self-harm or suicide |
| CAT-06 | RELIGION | Religious doctrine presented as factual instruction (distinct from historical/cultural reference in Band 3) |
| CAT-07 | POLITICS | Political opinion, partisan framing, electoral content |
| CAT-08 | ADVERTISING | Brand names, product promotion, commercial endorsement |
| CAT-09 | PII | Personally identifiable information in question text |
| CAT-10 | FACTUAL_ERROR | Answers that are demonstrably incorrect against stored curriculum standards |

A question MUST be rejected (not stored, not returned) if it triggers CAT-01 through
CAT-09 at any confidence threshold above the per-category minimum defined in config
(default 0.85).

CAT-10 (FACTUAL_ERROR) is a WARN-level signal in v1 (see Open Questions OQ-05).
Factually flagged questions are returned but logged for human review.

**Acceptance Criteria:**

Given a generated question containing the word "damn"
When `outputValidator.js` scans the question
Then it returns `{ flagged: true, category: 'PROFANITY', confidence: 0.97 }`
And the question is excluded from the worksheet and question bank
And the rejection is logged to the moderation log DynamoDB table.

Given a Grade 3 Math worksheet where all 10 generated questions pass the scan
When the scan completes
Then all 10 questions are stored in the question bank and returned in the response
And `metadata.moderationResult = { flagged: false, questionsScanned: 10, questionsRejected: 0 }`
is present in the API response.

Given a scan that flags 2 of 10 generated questions
When the assembler receives the scan result
Then the 2 flagged questions are discarded
And the assembler requests 2 replacement questions from the AI using the strict prompt
And if replacement questions also fail the scan, the assembler falls back to the
question bank for those slots (consistent with existing AI-generation-fallback behavior).

Given an OPTIONS preflight request to any guardrail admin endpoint
When the request is processed
Then the response is 200 with standard CORS headers and no body.

---

#### FR-GUARD-005 — Grade-Context Calibrated Scan Thresholds
**Priority:** P1

Output validation thresholds MUST be tighter for lower grade bands. The per-category
confidence thresholds used to trigger rejection MUST be loaded from DynamoDB Config
and MUST default to the values in the table below:

| Category | Band 1 (Gr 1–3) Threshold | Band 2 (Gr 4–6) Threshold | Band 3 (Gr 7–10) Threshold |
|---|---|---|---|
| PROFANITY | 0.80 | 0.85 | 0.85 |
| HATE_SPEECH | 0.70 | 0.75 | 0.80 |
| VIOLENCE | 0.75 | 0.80 | 0.85 |
| SEXUAL | 0.70 | 0.75 | 0.80 |
| SELF_HARM | 0.70 | 0.70 | 0.70 |
| RELIGION | 0.80 | 0.85 | 0.90 |
| POLITICS | 0.80 | 0.85 | 0.90 |
| ADVERTISING | 0.85 | 0.85 | 0.85 |
| PII | 0.85 | 0.85 | 0.85 |

Config key format: `ai/guardrail/threshold/{categoryId}/{bandNumber}`
Example: `ai/guardrail/threshold/HATE_SPEECH/1` = 0.70

Super Admin MUST be able to update thresholds individually via the admin API.
No threshold may be set above 0.99 or below 0.50 — the admin API MUST reject values
outside this range with a 400 error.

**Acceptance Criteria:**

Given grade=2 (Band 1) and a question with VIOLENCE confidence score of 0.76
When the output validator applies Band 1 thresholds
Then the question is flagged (0.76 > 0.75 threshold for Band 1 VIOLENCE)
And the rejection is logged.

Given grade=8 (Band 3) and a question with VIOLENCE confidence score of 0.76
When the output validator applies Band 3 thresholds
Then the question is NOT flagged (0.76 < 0.85 threshold for Band 3 VIOLENCE)
And the question proceeds to the bank.

Given a Super Admin calls PUT /api/admin/guardrails/thresholds with HATE_SPEECH/1 = 0.40
When the admin API validates the request
Then it returns 400 with code INVALID_THRESHOLD and message "Threshold must be between 0.50 and 0.99"
And no change is written to the Config table.

---

### Group C — Content Moderation

#### FR-GUARD-006 — Moderation Adapter Integration
**Priority:** P1

`src/ai/guardrails/moderationAdapter.js` MUST provide a single consistent interface
for content scanning regardless of the underlying moderation service. Phase 1 targets
**AWS Comprehend** (already within the Learnfyra AWS account; no additional vendor
onboarding required).

The adapter interface:

```javascript
/**
 * @param {string} text - Content to scan (question + options + answer + explanation concatenated)
 * @param {Object} context - { grade, subject, gradeBand }
 * @returns {Promise<ModerationResult>}
 */
async function scanContent(text, context) {}

/**
 * ModerationResult shape:
 * {
 *   flagged: boolean,
 *   categories: [{ id: 'PROFANITY', confidence: 0.97, threshold: 0.85, triggered: true }],
 *   scanDurationMs: number,
 *   service: 'aws-comprehend' | 'custom' | 'mock'
 * }
 */
```

The adapter MUST:
- Concatenate question text, all options, the answer, and the explanation into a single
  string before sending to the moderation service (to detect cross-field injection).
- Apply the grade-band-calibrated thresholds from FR-GUARD-005.
- Return a structured `ModerationResult` regardless of the underlying service.
- Fall back to a custom keyword filter (hardcoded list in `guardrailConfig.js`) if
  AWS Comprehend is unavailable or returns an error. Log a WARN when falling back.
- NEVER block generation entirely if the moderation service fails — log the failure,
  apply the keyword fallback, and proceed. Content safety is best-effort when the
  moderation service is unavailable.

The active moderation service is configured via DynamoDB Config key
`ai/guardrail/moderationService` (`aws-comprehend` | `custom` | `mock`).
The `mock` value is for local development and test environments only.

**Acceptance Criteria:**

Given `MODERATION_SERVICE=aws-comprehend` (via DynamoDB Config)
When `scanContent("damn it all", { grade: 3, subject: 'Math', gradeBand: 1 })` is called
Then AWS Comprehend `DetectSentiment` or equivalent is called
And the result is normalized into a `ModerationResult` object
And if the result exceeds the Band 1 PROFANITY threshold, `flagged: true` is returned.

Given AWS Comprehend returns an HTTP 500 error
When `scanContent()` handles the error
Then it logs WARN: "Moderation service unavailable, falling back to keyword filter"
And it applies the hardcoded keyword filter
And it returns a `ModerationResult` with `service: 'custom'`
And generation is NOT aborted.

Given `NODE_ENV=development` or `MODERATION_SERVICE=mock`
When `scanContent()` is called
Then it uses the mock adapter (returns `flagged: false` for all content unless the
content contains the test trigger phrase "FORCE_FLAG_FOR_TEST")
And no AWS Comprehend call is made.

---

#### FR-GUARD-007 — Moderation Log Persistence
**Priority:** P0

Every moderation scan result MUST be persisted to a DynamoDB table
`LearnfyraModerationLog-{env}` with the following schema:

| Attribute | Type | Description |
|---|---|---|
| logId | String | UUID v4 (PK) |
| worksheetId | String | Associated worksheet UUID |
| questionNumber | Number | Question index within the worksheet |
| scannedAt | String | ISO-8601 timestamp |
| grade | Number | 1–10 |
| subject | String | Subject enum |
| gradeBand | Number | 1, 2, or 3 |
| flagged | Boolean | True if any category exceeded threshold |
| categories | List | Array of `{ id, confidence, threshold, triggered }` |
| action | String | `ACCEPTED` | `REJECTED` | `RETRIED` | `BANK_FALLBACK` |
| service | String | `aws-comprehend` | `custom` | `mock` |
| scanDurationMs | Number | Moderation call latency |
| ttl | Number | Epoch seconds; 3 years from `scannedAt` (COPPA-09 compliance) |

The `ttl` field MUST be set to exactly 3 years from `scannedAt` to comply with
COPPA-09 (3-year consent record and audit log retention requirement).

Writes to this table MUST be non-blocking (fire and async) — a DynamoDB write failure
MUST NOT block worksheet delivery. Log the DynamoDB error at ERROR level and continue.

**Acceptance Criteria:**

Given a question passes all moderation checks
When the log writer runs
Then a record is written to `LearnfyraModerationLog-{env}` with `action: 'ACCEPTED'`
And the `ttl` attribute equals the current epoch time plus 94,608,000 seconds (3 years).

Given a question fails moderation
When the log writer runs
Then a record is written with `action: 'REJECTED'` and the triggered category details.

Given the DynamoDB write to `LearnfyraModerationLog-{env}` fails
When the log writer catches the error
Then it logs `ERROR: ModerationLog write failed: {worksheetId}`
And the question proceeds normally (write failure does not affect content delivery).

Given a Data/Compliance Admin calls `GET /api/admin/moderation/logs`
When they filter by `flagged=true` and a date range
Then they receive a paginated list of moderation log records
And each record includes worksheetId, questionNumber, categories, action, and scannedAt.

---

### Group D — Admin Controls

#### FR-GUARD-008 — View Active Prompt Templates (Read)
**Priority:** P0

Super Admin, Ops Admin, and Data/Compliance Admin MUST be able to retrieve the
currently active prompt template configuration via a protected API endpoint.

Endpoint: `GET /api/admin/guardrails/prompts`

Response shape:
```json
{
  "systemClause": {
    "value": "string — current guardrail system clause",
    "updatedBy": "admin@learnfyra.com",
    "updatedAt": "ISO-8601",
    "version": 3,
    "tokenCount": 98
  },
  "biasClause": {
    "value": "string — current bias/inclusivity clause",
    "updatedBy": "admin@learnfyra.com",
    "updatedAt": "ISO-8601",
    "version": 1,
    "tokenCount": 72
  },
  "strictRetryClause": {
    "value": "string — more restrictive clause used on retry",
    "updatedBy": "admin@learnfyra.com",
    "updatedAt": "ISO-8601",
    "version": 2,
    "tokenCount": 110
  }
}
```

The `tokenCount` field MUST be computed server-side using the Anthropic tokenizer and
returned with every read so admins can see the current token budget usage.

**Acceptance Criteria:**

Given a Super Admin calls `GET /api/admin/guardrails/prompts` with a valid admin JWT
When the handler processes the request
Then it returns 200 with the current values of all three prompt clauses from DynamoDB
And each clause object includes `version`, `updatedBy`, `updatedAt`, and `tokenCount`.

Given a Support Admin (who has no guardrail read permission) calls the same endpoint
When the handler processes the request
Then it returns 403 with `{ code: 'INSUFFICIENT_ROLE' }`.

Given the DynamoDB Config table is missing the `ai/guardrail/systemClause` key
When the handler processes the request
Then it returns the hardcoded default value with `version: 0` and `updatedBy: 'system'`
And it does NOT return 404 or 500.

---

#### FR-GUARD-009 — Update Prompt Templates (Write)
**Priority:** P0

Only Super Admin MUST be able to update prompt template clauses. Ops Admin MUST NOT
have write access to prompt templates (see RBAC Matrix in Section 5).

Endpoint: `PUT /api/admin/guardrails/prompts/{clauseName}`

`{clauseName}` is one of: `systemClause`, `biasClause`, `strictRetryClause`.

Request body:
```json
{
  "value": "string — new clause text",
  "reason": "string — reason for change (required, min 10 chars)"
}
```

The handler MUST:
1. Validate the clause name is one of the three allowed values (400 if unknown).
2. Validate the `value` field is not empty (400 if empty).
3. Count the tokens in `value` using the Anthropic tokenizer. Reject with 400 if over
   120 tokens.
4. Validate `reason` is present and at least 10 characters (400 if missing or too short).
5. Read the current value from DynamoDB and store it as `previousValue` in the update.
6. Increment `version` by 1.
7. Write the new value, `updatedBy` (from JWT), `updatedAt` (ISO-8601 now), `version`,
   and `previousValue` to DynamoDB.
8. Write an audit log entry to `LearnfyraAuditLog-{env}` via `src/admin/auditLogger.js`.
9. Return 200 with the updated clause object including new `version` and `tokenCount`.

Changes take effect on the NEXT generation request — no Lambda restart required
(same hot-swap pattern as existing AI model config per DEC-ADMIN-001).

**Acceptance Criteria:**

Given a Super Admin calls `PUT /api/admin/guardrails/prompts/systemClause` with a valid
new value under 120 tokens and a reason of at least 10 characters
When the handler processes the request
Then DynamoDB is updated with the new value, version incremented by 1, and previousValue
set to the prior clause text
And an audit log entry is written with action `GUARDRAIL_PROMPT_UPDATED`
And the response is 200 with the updated clause object.

Given the new clause value contains 145 tokens
When the handler validates the request
Then it returns 400 with `{ code: 'TOKEN_LIMIT_EXCEEDED', tokenCount: 145, limit: 120 }`
And no change is written to DynamoDB.

Given `reason` is "ok" (less than 10 characters)
When the handler validates the request
Then it returns 400 with `{ code: 'REASON_TOO_SHORT', minLength: 10 }`.

Given a Super Admin updates `systemClause`
When the NEXT `POST /api/generate` request is processed
Then `buildSystemPrompt()` reads the updated clause from DynamoDB Config
And the new clause is used for the generation (no Lambda redeploy required).

Given an Ops Admin calls `PUT /api/admin/guardrails/prompts/systemClause`
When the handler processes the request
Then it returns 403 with `{ code: 'INSUFFICIENT_ROLE' }`
And no change is written.

---

#### FR-GUARD-010 — View and Update Moderation Thresholds
**Priority:** P1

Super Admin and Ops Admin MUST be able to read moderation thresholds.
Only Super Admin MUST be able to update them.

Read endpoint: `GET /api/admin/guardrails/thresholds`
Update endpoint: `PUT /api/admin/guardrails/thresholds/{categoryId}/{bandNumber}`

Update request body:
```json
{
  "threshold": 0.82,
  "reason": "Tightening HATE_SPEECH for Band 1 based on Q1 moderation review"
}
```

Constraints:
- `threshold` must be a number between 0.50 and 0.99 inclusive.
- `bandNumber` must be 1, 2, or 3.
- `categoryId` must be one of the 9 defined categories (CAT-01 through CAT-09).
- `reason` must be present and at least 10 characters.
- Every update must write an audit log entry.

**Acceptance Criteria:**

Given a Super Admin calls `GET /api/admin/guardrails/thresholds`
When the handler processes the request
Then it returns all 27 threshold values (9 categories x 3 bands) with their current
config values, `updatedBy`, `updatedAt`, and `version`.

Given a Super Admin calls `PUT /api/admin/guardrails/thresholds/PROFANITY/1` with
`threshold: 0.78` and a valid reason
When the handler processes the request
Then DynamoDB key `ai/guardrail/threshold/PROFANITY/1` is updated to 0.78
And an audit log entry is written with action `GUARDRAIL_THRESHOLD_UPDATED`
And the change takes effect on the next generation request.

Given an Ops Admin calls the update endpoint
When the handler processes the request
Then it returns 403.

---

#### FR-GUARD-011 — Prompt Template Version History and Rollback
**Priority:** P1

Super Admin MUST be able to view the version history of any prompt clause and roll back
to any prior version.

History endpoint: `GET /api/admin/guardrails/prompts/{clauseName}/history`

Returns an array of up to 50 versions, most recent first:
```json
[
  {
    "version": 3,
    "value": "...",
    "updatedBy": "admin@learnfyra.com",
    "updatedAt": "ISO-8601",
    "reason": "Tightened language for Band 1"
  }
]
```

Rollback endpoint: `POST /api/admin/guardrails/prompts/{clauseName}/rollback`

Request body:
```json
{
  "targetVersion": 2,
  "reason": "Version 3 caused false positives on Science vocabulary"
}
```

Rollback MUST:
1. Read the specified version from the audit log.
2. Write the rolled-back value as a NEW version (not by overwriting history).
3. Record the rollback action in the audit log with `action: GUARDRAIL_ROLLBACK`.
4. Return 200 with the new (post-rollback) clause object.

Rollback MUST NOT delete or mutate any historical version records.

**Acceptance Criteria:**

Given 3 versions of `systemClause` exist
When `GET /api/admin/guardrails/prompts/systemClause/history` is called
Then it returns 3 entries ordered by version descending
And each entry includes value, updatedBy, updatedAt, and reason.

Given a Super Admin calls rollback to version 2
When the handler processes the request
Then the current active value is set to the version 2 content
And a new version 4 entry is created (not version 2 overwritten)
And an audit log entry is written with `action: GUARDRAIL_ROLLBACK` and
`targetVersion: 2`.

---

#### FR-GUARD-012 — AI Model Management (Existing M07, Extended Here)
**Priority:** P0

The existing AI model management endpoints in M07 (`GET/POST/PUT /api/admin/models`)
MUST be extended to enforce that only Super Admin and Ops Admin can change the active
model. This is already partially specified in M07 (RBAC-008, RBAC-009) but is repeated
here for completeness and to ensure the guardrails feature does not regress it.

Additionally, the model change audit log entry MUST now include the `reason` field
(currently optional in M07, MUST be required for model changes after this feature).

**Acceptance Criteria:**

Given a Super Admin switches the active model from `claude-sonnet-4-6` to
`claude-haiku-4-5-20251001`
When `PUT /api/admin/models/{id}/activate` is called
Then the DynamoDB Config key `ai/activeModel` is updated
And an audit log entry is written with action `MODEL_ACTIVATED`, `updatedBy`,
`previousModel`, `newModel`, and `reason`
And the next generation request uses the new model.

Given a request body missing the `reason` field
When the handler processes the request
Then it returns 400 with `{ code: 'REASON_REQUIRED' }`
And no model change is applied.

---

### Group E — Audit and Logging

#### FR-GUARD-013 — Audit Log for All Guardrail Admin Actions
**Priority:** P0

Every admin action on guardrail resources (prompt templates, thresholds, moderation
config) MUST be written to the existing `LearnfyraAuditLog-{env}` DynamoDB table via
`src/admin/auditLogger.js`. No new table is required.

Required audit actions for this feature:

| Action String | Trigger |
|---|---|
| `GUARDRAIL_PROMPT_UPDATED` | Prompt clause written via PUT /api/admin/guardrails/prompts/{name} |
| `GUARDRAIL_PROMPT_ROLLBACK` | Rollback applied via POST /api/admin/guardrails/prompts/{name}/rollback |
| `GUARDRAIL_THRESHOLD_UPDATED` | Threshold updated via PUT /api/admin/guardrails/thresholds/{cat}/{band} |
| `GUARDRAIL_MODERATION_SERVICE_CHANGED` | Moderation service config updated |
| `WORKSHEET_FLAGGED_BY_TEACHER` | Teacher submits content report (FR-GUARD-015) |
| `FLAGGED_WORKSHEET_REVIEWED` | Admin resolves a teacher-submitted content report |

Each audit record MUST include: `logId` (UUID), `action`, `actorId`, `actorEmail`,
`actorRole`, `targetResourceId`, `targetResourceType`, `previousValue`, `newValue`,
`reason`, `timestamp` (ISO-8601), `ipAddress` (from API Gateway request context).

**Acceptance Criteria:**

Given a Super Admin updates `systemClause` via the API
When the update handler completes
Then a record exists in `LearnfyraAuditLog-{env}` with:
- `action: 'GUARDRAIL_PROMPT_UPDATED'`
- `actorEmail` matching the JWT subject
- `previousValue` matching the clause text that was active before the update
- `newValue` matching the submitted clause text
- `reason` matching the submitted reason string.

Given a Data/Compliance Admin calls `GET /api/admin/audit/logs?action=GUARDRAIL_PROMPT_UPDATED`
When the handler processes the request
Then it returns a paginated list of all prompt update audit records
And each record includes all required fields listed above.

---

#### FR-GUARD-014 — Generation Metadata: Moderation Summary in API Response
**Priority:** P1

The existing `POST /api/generate` and `POST /api/generate-questions` response bodies
MUST be extended with a `moderationSummary` field in the `metadata` object:

```json
{
  "worksheetId": "uuid",
  "metadata": {
    "moderationSummary": {
      "questionsScanned": 10,
      "questionsRejected": 1,
      "questionsRetried": 1,
      "questionsBankFallback": 0,
      "anyFlagged": false,
      "service": "aws-comprehend"
    }
  }
}
```

`anyFlagged` is `false` once the final assembled worksheet has passed all checks —
even if intermediate questions were rejected and replaced. This field tells the caller
that the DELIVERED content is clean, not that zero flags occurred during generation.

The raw per-question flag details MUST NOT be returned to non-admin callers (only
written to the moderation log). Teachers see only the summary.

**Acceptance Criteria:**

Given a worksheet is generated where 2 questions fail moderation and are replaced
When the generation response is returned to the teacher
Then `metadata.moderationSummary.questionsRejected` equals 2
And `metadata.moderationSummary.questionsRetried` equals 2
And `metadata.moderationSummary.anyFlagged` equals false (delivered content is clean)
And no per-question flag detail is present in the non-admin response.

Given `POST /api/generate` is called by a student (guest or authenticated)
When the response is returned
Then `metadata.moderationSummary` is present with summary counts only
And no category names, confidence scores, or raw flag data is exposed.

---

### Group F — Teacher Reporting

#### FR-GUARD-015 — Teacher Content Report Submission
**Priority:** P1

Teachers MUST be able to submit a content report for any worksheet they have access to.

Endpoint: `POST /api/worksheets/{worksheetId}/report`

Request body:
```json
{
  "reportType": "INAPPROPRIATE_CONTENT | FACTUAL_ERROR | BIAS | OTHER",
  "description": "string (required, min 10 chars, max 500 chars)",
  "questionNumbers": [1, 3]
}
```

The handler MUST:
1. Verify the caller has the `teacher` role.
2. Verify the worksheetId exists in S3 metadata.
3. Write the report to `LearnfyraContentReports-{env}` DynamoDB table.
4. Set the worksheet's `metadata.json` flag: `{ flagged: true, flagReason: reportType, flaggedAt, flaggedBy }`.
5. Write an audit log entry with action `WORKSHEET_FLAGGED_BY_TEACHER`.
6. Return 201 with `{ reportId, status: 'PENDING_REVIEW' }`.

Teachers MUST receive a 200 (not an error) even if the S3 metadata write fails — the
report is the primary record. Log the S3 write failure at ERROR level.

**Acceptance Criteria:**

Given a teacher calls `POST /api/worksheets/{id}/report` with `reportType: INAPPROPRIATE_CONTENT`
and a description of at least 10 characters
When the handler processes the request
Then a record is written to `LearnfyraContentReports-{env}`
And the worksheet `metadata.json` is updated with `flagged: true`
And an audit log entry is written with `action: WORKSHEET_FLAGGED_BY_TEACHER`
And the response is 201 with `{ reportId, status: 'PENDING_REVIEW' }`.

Given a student (not a teacher) calls `POST /api/worksheets/{id}/report`
When the handler processes the request
Then it returns 403 with `{ code: 'INSUFFICIENT_ROLE' }`.

Given the description is "bad" (under 10 characters)
When the handler validates the request
Then it returns 400 with `{ code: 'DESCRIPTION_TOO_SHORT', minLength: 10 }`.

---

#### FR-GUARD-016 — Admin Review Queue for Teacher Reports
**Priority:** P1

Super Admin, Ops Admin, and Support Admin MUST be able to view and resolve teacher
content reports. This extends the existing worksheet oversight endpoints in M07.

List endpoint: `GET /api/admin/content-reports?status=PENDING_REVIEW`
Resolve endpoint: `POST /api/admin/content-reports/{reportId}/resolve`

Resolve request body:
```json
{
  "resolution": "CONTENT_REMOVED | GUARDRAIL_UPDATED | NO_ACTION",
  "reviewNotes": "string (required, min 10 chars)",
  "removeWorksheet": false
}
```

If `removeWorksheet: true`, the handler MUST call the existing worksheet deletion logic
(consistent with M07 FR-ADMIN-018) to remove the S3 files.

**Acceptance Criteria:**

Given 3 pending teacher reports exist
When an Ops Admin calls `GET /api/admin/content-reports?status=PENDING_REVIEW`
Then it returns all 3 reports with worksheetId, reportType, description, questionNumbers,
reportedBy, and reportedAt.

Given an Ops Admin resolves a report with `resolution: CONTENT_REMOVED` and
`removeWorksheet: true`
When the handler processes the request
Then the worksheet S3 files are deleted
And the report record is updated to `status: RESOLVED`
And an audit log entry is written with `action: FLAGGED_WORKSHEET_REVIEWED`.

Given a Support Admin tries to resolve a report with `removeWorksheet: true`
When the handler processes the request
Then it returns 403 because worksheet deletion requires Ops Admin or higher.

---

### Group G — Fallback and Retry

#### FR-GUARD-017 — Automatic Retry on Moderation Failure
**Priority:** P0

When a generated question fails the content moderation scan, the assembler MUST
automatically retry generation for that specific question using the `strictRetryClause`
prompt (a more restrictive version of the system clause). The retry uses the same model
that produced the failing question.

Retry behavior:
- Attempt 1: regenerate with `strictRetryClause` injected (same model).
- Attempt 2 (if attempt 1 also fails): escalate to Sonnet (if not already on Sonnet).
- Attempt 3 (if attempt 2 fails): mark the slot as `BANK_FALLBACK` and draw from the
  question bank.
- If the question bank also has no question for the slot: mark the slot as `SKIPPED`
  and reduce `questionCount` by 1. Return the worksheet with fewer questions and include
  `moderationSummary.questionsSkipped` in the response metadata.

The total moderation retry budget per generation request MUST NOT exceed 5 retries
across all questions (to bound latency). If the budget is exhausted, remaining failing
slots proceed directly to bank fallback or skip.

**Acceptance Criteria:**

Given a generated question fails the Band 1 PROFANITY check
When the assembler handles the failure
Then it calls the AI again with the `strictRetryClause` for that question slot
And logs `MODERATION_RETRY` at INFO level with the question number and category.

Given the strict retry also fails the scan
When the assembler handles the second failure
Then it escalates to Sonnet (if the original model was Haiku)
And logs `MODERATION_ESCALATION` at INFO level.

Given all 3 attempts for a question slot fail
When the assembler handles the final failure
Then it draws from the question bank for that slot
And the moderation log records `action: BANK_FALLBACK` for that questionNumber.

Given a 10-question worksheet where 6 slots fail moderation on every attempt and there
are no bank questions available
When the assembler hits the 5-retry budget limit
Then it returns the worksheet with fewer than 10 questions (minimum 5)
And `moderationSummary.questionsSkipped` is greater than 0
And the response status is 200 (not 500).

Given a Grade 10 ELA worksheet with all 30 requested questions passing moderation
When the generation completes
Then `moderationSummary.questionsRejected` equals 0
And `moderationSummary.questionsSkipped` equals 0
And all 30 questions are returned.

---

#### FR-GUARD-018 — Minimum Deliverable Question Count Gate
**Priority:** P1

If the assembler cannot produce at least 5 questions after all moderation retries and
bank fallbacks, the generation request MUST fail gracefully.

Response for this case: HTTP 400
```json
{
  "success": false,
  "code": "WG_INSUFFICIENT_CLEAN_CONTENT",
  "moderationSummary": {
    "questionsRequested": 10,
    "questionsDeliverable": 3,
    "questionsRejected": 7,
    "retriesExhausted": true
  },
  "message": "Could not generate enough safe content for this topic. Try a different topic or difficulty."
}
```

An SNS admin notification MUST be sent (same mechanism as AI-generation-fallback
feature) when this condition occurs.

**Acceptance Criteria:**

Given only 3 clean questions can be produced for a requested worksheet of 10
When the assembler determines the deliverable count is below 5
Then it returns HTTP 400 with `code: WG_INSUFFICIENT_CLEAN_CONTENT`
And an SNS notification is published with grade, subject, topic, and moderation stats.

Given grade=1 (lower boundary) and a 5-question request with only 4 clean questions
When the assembler determines the deliverable count is below 5
Then it returns HTTP 400 with the insufficient content error.

Given grade=10 (upper boundary) and a 30-question request with 28 clean questions
When the assembler determines 28 is above the 5-question minimum
Then it returns the worksheet with 28 questions and status 200.

---

## 4. Non-Functional Requirements

### 4.1 Performance

#### NFR-GUARD-001 — Moderation Latency Budget
**Priority:** P0

The content moderation scan (including the AWS Comprehend call and threshold evaluation)
for a single question MUST complete in under **500 ms** at the 95th percentile.

For a full 10-question worksheet, total moderation latency MUST be under **2,000 ms**
(questions are scanned in parallel, up to 5 concurrent scans).

For a 30-question worksheet, total moderation latency MUST be under **4,000 ms**.

The moderation scan runs asynchronously relative to other generation steps where
possible. It MUST NOT add latency to the export (PDF/DOCX/HTML) step.

CloudWatch metrics MUST be emitted for:
- `ModerationScanDuration` (per question, P50/P95/P99)
- `ModerationFlagRate` (% of questions flagged, by grade band and subject)
- `ModerationServiceErrors` (count of fallback activations)

Lambda function `learnfyra-generate` timeout is 60 seconds (existing). The total
moderation overhead including retries MUST consume no more than 20 seconds of this
budget in the worst case (all 30 questions flagged, all retried once).

#### NFR-GUARD-002 — Admin API Latency
**Priority:** P1

All guardrail admin API endpoints (`GET /api/admin/guardrails/*`, `PUT /api/admin/guardrails/*`)
MUST respond in under **1,000 ms** at the 95th percentile. These are DynamoDB read/write
operations and MUST NOT call the AI model or moderation service.

### 4.2 Security

#### NFR-GUARD-003 — Prompt Injection Defense
**Priority:** P0

The current worksheet generation flow does NOT accept user-supplied free-text that is
passed into AI prompts. All prompt parameters (grade, subject, topic, difficulty) are
validated against strict enumerations before use. This provides inherent prompt
injection protection.

The following MUST remain true after this feature is implemented:
- No teacher-supplied text (e.g., class name, student name) is ever interpolated into
  the AI system prompt or user prompt.
- Topic selection MUST remain a validated enum from the curriculum map (`src/ai/topics.js`).
  No free-text topic field MUST be passed to the AI raw.
- If free-text teacher input is ever introduced in a future feature, a full prompt
  injection risk assessment MUST be conducted and a mitigation plan MUST be approved
  by the BA and Security lead before implementation.

The CI pipeline MUST include a lint rule that flags any interpolation of request body
fields into prompt strings unless the field is first validated against a whitelist.

#### NFR-GUARD-004 — Admin Endpoint Authentication and Authorization
**Priority:** P0

All `GET /api/admin/guardrails/*` and `PUT /api/admin/guardrails/*` endpoints MUST be
protected by the existing `apiAuthorizerHandler.js` Lambda authorizer. No request with
a missing, expired, or invalid JWT MUST reach the guardrail handler.

The RBAC check MUST occur at the application layer (not just the authorizer) to defend
against authorizer misconfiguration. Each handler MUST call `rbacUtils.assertRole()`
or equivalent before executing any logic.

#### NFR-GUARD-005 — No AI Prompt Content in Non-Admin API Responses
**Priority:** P0

The raw text of prompt templates and guardrail clauses MUST NOT be included in any
API response sent to teacher, student, parent, or guest callers. Only admin-authenticated
callers (`GET /api/admin/guardrails/*`) may receive the prompt clause text.

The `moderationSummary` included in generation responses (FR-GUARD-014) MUST contain
only aggregate counts, never category names, confidence scores, or clause text.

### 4.3 Compliance

#### NFR-GUARD-006 — Content Safety for Minors (COPPA / FTC)
**Priority:** P0

This feature directly addresses the FTC Section 5 "unfair practice" risk identified in
LFR-AUDIT-001 (requirement AI-03). The following are mandatory for compliance:

- Zero worksheets containing CAT-01 (PROFANITY) through CAT-05 (SELF_HARM) content
  MUST be delivered to students in any grade band. This is a hard requirement with no
  acceptable exception.
- The moderation log retention period of 3 years (FR-GUARD-007) satisfies COPPA-09.
- No PII (CAT-09) in AI-generated question text satisfies COPPA-04 and AI-02.
- The audit trail for all admin changes (FR-GUARD-013) satisfies COPPA-09 and internal
  governance requirements.

#### NFR-GUARD-007 — AI Transparency (California AB 2013)
**Priority:** P0 (must ship before any public release to California users)

California AB 2013 (effective January 2026) requires disclosure when educational content
is AI-generated. This feature does not own the disclosure label implementation (that is
owned by the worksheet export pipeline), but it MUST ensure that the `moderationSummary`
in the generation response includes `"generatedByAI": true` so the exporter can
conditionally render the disclosure label.

The AI transparency label on the worksheet itself is tracked separately under AI-01
in LFR-AUDIT-001.

---

## 5. RBAC Matrix

This matrix extends the existing M07 RBAC table. All existing M07 RBAC rules remain
in force. Only new actions introduced by this feature are listed here.

| Action | Super Admin | Ops Admin | Support Admin | Data/Compliance Admin | Teacher | Parent | Student | Guest |
|---|---|---|---|---|---|---|---|---|
| Read prompt templates | YES | YES | NO | YES | NO | NO | NO | NO |
| Update prompt templates | YES | NO | NO | NO | NO | NO | NO | NO |
| Rollback prompt templates | YES | NO | NO | NO | NO | NO | NO | NO |
| View prompt version history | YES | YES | NO | YES | NO | NO | NO | NO |
| Read moderation thresholds | YES | YES | NO | YES | NO | NO | NO | NO |
| Update moderation thresholds | YES | NO | NO | NO | NO | NO | NO | NO |
| Change moderation service config | YES | YES | NO | NO | NO | NO | NO | NO |
| View moderation logs | YES | YES | NO | YES | NO | NO | NO | NO |
| View audit log (guardrail actions) | YES | YES | NO | YES | NO | NO | NO | NO |
| Submit content report | NO | NO | NO | NO | YES | NO | NO | NO |
| View content reports queue | YES | YES | YES | YES | NO | NO | NO | NO |
| Resolve content report (no removal) | YES | YES | YES | NO | NO | NO | NO | NO |
| Resolve content report + remove worksheet | YES | YES | NO | NO | NO | NO | NO | NO |

RBAC test cases for QA agent (extend tests/unit/rbacUtils.test.js):

| Test ID | Actor | Action | Expected |
|---|---|---|---|
| RBAC-GUARD-001 | Super Admin | GET /api/admin/guardrails/prompts | 200 |
| RBAC-GUARD-002 | Ops Admin | GET /api/admin/guardrails/prompts | 200 |
| RBAC-GUARD-003 | Support Admin | GET /api/admin/guardrails/prompts | 403 |
| RBAC-GUARD-004 | Data Admin | GET /api/admin/guardrails/prompts | 200 |
| RBAC-GUARD-005 | Teacher | GET /api/admin/guardrails/prompts | 403 |
| RBAC-GUARD-006 | Super Admin | PUT /api/admin/guardrails/prompts/systemClause | 200 |
| RBAC-GUARD-007 | Ops Admin | PUT /api/admin/guardrails/prompts/systemClause | 403 |
| RBAC-GUARD-008 | Data Admin | PUT /api/admin/guardrails/prompts/systemClause | 403 |
| RBAC-GUARD-009 | Teacher | POST /api/worksheets/{id}/report | 201 |
| RBAC-GUARD-010 | Student | POST /api/worksheets/{id}/report | 403 |
| RBAC-GUARD-011 | Parent | POST /api/worksheets/{id}/report | 403 |
| RBAC-GUARD-012 | Support Admin | POST /api/admin/content-reports/{id}/resolve | 200 (no removal) |
| RBAC-GUARD-013 | Support Admin | POST /api/admin/content-reports/{id}/resolve (removeWorksheet:true) | 403 |
| RBAC-GUARD-014 | Super Admin | PUT /api/admin/guardrails/thresholds/HATE_SPEECH/1 | 200 |
| RBAC-GUARD-015 | Ops Admin | PUT /api/admin/guardrails/thresholds/HATE_SPEECH/1 | 403 |

---

## 6. Acceptance Criteria — Comprehensive End-to-End

The following criteria cover complete user journeys. They supplement the per-FR
criteria in Section 3 and are the primary test cases for the QA agent.

### AC-GUARD-E2E-001 — Grade 1 Safe Worksheet Generation (Happy Path)
Given a teacher requests a Grade 1 Math worksheet on "Counting" with 5 questions
When `POST /api/generate` is called
Then the AI prompt contains the Band 1 guardrail clause referencing "Grade 1, age 6-7"
And all 5 generated questions are scanned by the moderation adapter
And all 5 pass with no flags
And the response includes `metadata.moderationSummary.questionsScanned: 5` and
`anyFlagged: false`
And the worksheet is delivered within the 60-second Lambda timeout.

### AC-GUARD-E2E-002 — Grade 10 ELA Maximum Question Count (Boundary)
Given a teacher requests a Grade 10 ELA worksheet on "Persuasive Writing" with 30 questions
When `POST /api/generate` is called
Then the Band 3 guardrail clause is injected into the prompt
And 30 questions are scanned in parallel (max 5 concurrent)
And total moderation scan time is under 4,000 ms
And the response includes `moderationSummary.questionsScanned: 30`.

### AC-GUARD-E2E-003 — Moderation Rejection and Retry Success
Given a Grade 3 Science worksheet is requested
And the AI generates a question containing a profanity word on the first attempt
When the moderation scan runs
Then the question is rejected (CAT-01 PROFANITY flagged)
And the assembler retries with `strictRetryClause`
And the replacement question passes the scan
And the final delivered worksheet contains no flagged content
And `moderationSummary: { questionsRejected: 1, questionsRetried: 1, anyFlagged: false }`
is in the response.

### AC-GUARD-E2E-004 — Admin Updates Prompt Template, Next Generation Uses It
Given a Super Admin calls `PUT /api/admin/guardrails/prompts/systemClause` with a new
clause under 120 tokens and a reason of at least 10 characters
And the update returns 200 with version incremented
When the next `POST /api/generate` request arrives
Then `buildSystemPrompt()` reads the new clause from DynamoDB
And the new clause text is present in the prompt sent to the AI model
And no Lambda redeploy occurs between the admin update and the generation request.

### AC-GUARD-E2E-005 — Teacher Reports Inappropriate Content
Given a teacher encounters an inappropriate question in a delivered worksheet
When they call `POST /api/worksheets/{worksheetId}/report` with
`reportType: INAPPROPRIATE_CONTENT` and a description of 20 characters
Then the response is 201 with `{ reportId, status: 'PENDING_REVIEW' }`
And the worksheet `metadata.json` on S3 is updated with `flagged: true`
And an audit log entry with `action: WORKSHEET_FLAGGED_BY_TEACHER` is written
And the report appears in `GET /api/admin/content-reports?status=PENDING_REVIEW`.

### AC-GUARD-E2E-006 — Admin Resolves Report and Removes Worksheet
Given a pending content report exists for worksheetId "abc-123"
When a Super Admin calls `POST /api/admin/content-reports/{reportId}/resolve` with
`resolution: CONTENT_REMOVED`, `removeWorksheet: true`, and review notes of 20 chars
Then the worksheet S3 files are deleted
And the report status is updated to `RESOLVED`
And an audit log entry with `action: FLAGGED_WORKSHEET_REVIEWED` and
`resolution: CONTENT_REMOVED` is written.

### AC-GUARD-E2E-007 — Rollback Prompt Template After Quality Regression
Given version 3 of `systemClause` is active and is causing false-positive rejections
on Grade 7 Science vocabulary
When a Super Admin calls `POST /api/admin/guardrails/prompts/systemClause/rollback`
with `targetVersion: 2` and a reason
Then a new version 4 entry is created containing the version 2 value
And the audit log records `action: GUARDRAIL_ROLLBACK` with `targetVersion: 2`
And the next generation request uses version 4 (the rolled-back content)
And version 3 is still present in the history (not deleted).

### AC-GUARD-E2E-008 — Moderation Service Unavailable (Degraded Mode)
Given AWS Comprehend returns a 500 error
When `scanContent()` is called during worksheet generation
Then the moderation adapter falls back to the keyword filter
And logs WARN: "Moderation service unavailable, falling back to keyword filter"
And the keyword filter is applied
And the worksheet generation completes (not aborted)
And `moderationSummary.service: 'custom'` is in the response metadata.

### AC-GUARD-E2E-009 — Grade 1 Boundary: 5 Questions, All Clean
Given a Grade 1 worksheet request for 5 questions (minimum question count)
When all 5 questions pass the Band 1 (strictest) moderation scan
Then the response contains exactly 5 questions
And `moderationSummary.questionsScanned: 5`, `questionsRejected: 0`, `anyFlagged: false`.

### AC-GUARD-E2E-010 — AWS Deployment: Lambda IAM Permissions
Given the feature is deployed to any environment (dev, staging, prod)
When the `learnfyra-generate` Lambda executes
Then its execution role includes:
- `dynamodb:GetItem` on `LearnfyraConfig-{env}` (read guardrail config and thresholds)
- `dynamodb:PutItem` on `LearnfyraModerationLog-{env}` (write scan results)
- `comprehend:DetectSentiment` and `comprehend:DetectDominantLanguage` on `*` (AWS Comprehend calls)
And the `learnfyra-admin` Lambda execution role includes:
- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:Query`
  on `LearnfyraConfig-{env}` and `LearnfyraAuditLog-{env}`
- `dynamodb:Query` and `dynamodb:GetItem` on `LearnfyraModerationLog-{env}` (read-only).

---

## 7. Out of Scope

The following items are explicitly excluded from this feature specification. They may
be addressed in future phases.

| Item | Reason for Exclusion |
|---|---|
| Real-time content streaming with per-token moderation | Learnfyra does not use streaming responses. Not applicable. |
| Human review workflow with SLA timers for moderation queue | The teacher reporting queue (FR-GUARD-015/016) provides basic review. Full SLA-tracked workflow is Phase 2. |
| Automated bias scoring with NLP-based bias detection | Bias instruction in the prompt (FR-GUARD-003) and WARN-level logging is v1 scope. Automated NLP bias scoring is Phase 2. |
| OpenAI Moderation API as an alternative moderation service | AWS Comprehend is the Phase 1 target. OpenAI Moderation API would require a new vendor relationship and COPPA DPA review. |
| Per-student content history and personalized moderation | No student-level moderation customization in v1. |
| Worksheet content export with moderation annotations | The exported PDF/DOCX/HTML is clean content only; moderation metadata stays server-side. |
| ML model fine-tuning for education-domain moderation | Custom ML model training is Phase 3+. |
| Admin console UI for guardrail management | Phase 2. v1 is API-only (consistent with M07 Phase 1 approach per DEC-ADMIN principle). |
| Multilingual content moderation | Learnfyra is US English only. Out of scope until international expansion. |
| Teacher ability to customize guardrail thresholds | Only Super Admin can modify thresholds (enforced by RBAC). Teachers have no guardrail configuration access. |
| GDPR-specific content moderation requirements | US-only launch. See LFR-AUDIT-001 GDPR classification. |

---

## 8. Dependencies

### 8.1 Internal Dependencies

| Dependency | Module/File | Status | Notes |
|---|---|---|---|
| `buildSystemPrompt()` | `src/ai/promptBuilder.js` | EXISTS | Extend with guardrail clause injection |
| `buildUserPrompt()` | `src/ai/promptBuilder.js` | EXISTS | No change required |
| `buildStrictUserPrompt()` | `src/ai/promptBuilder.js` | EXISTS | Maps to `strictRetryClause` from config |
| `generateWorksheet()` | `src/ai/generator.js` | EXISTS | Add post-generation scan call |
| `assembleWorksheet()` | `src/ai/assembler.js` | EXISTS | Wire moderation result into retry logic |
| `handler()` | `backend/handlers/generateHandler.js` | EXISTS | Add `moderationSummary` to response |
| `handler()` | `backend/handlers/adminHandler.js` | EXISTS | Add guardrail CRUD endpoints |
| `auditLogger.js` | `src/admin/auditLogger.js` | EXISTS | Extend with new action strings |
| `rbacUtils.js` | `backend/utils/rbacUtils.js` | EXISTS | Add guardrail action permissions |
| `LearnfyraConfig-{env}` | DynamoDB | EXISTS | New config keys required (see Section 3) |
| `LearnfyraAuditLog-{env}` | DynamoDB | EXISTS | New action strings; no schema change |
| AI generation fallback (SNS alert) | `src/ai/assembler.js` | EXISTS | Reuse for FR-GUARD-018 insufficient content alert |
| `apiAuthorizerHandler.js` | `backend/handlers/` | EXISTS | No change; existing authorizer covers new endpoints |

### 8.2 New Infrastructure Dependencies

| Dependency | Type | Status | Owner |
|---|---|---|---|
| `LearnfyraModerationLog-{env}` DynamoDB table | New DynamoDB table | NOT BUILT | IaC Agent |
| `LearnfyraContentReports-{env}` DynamoDB table | New DynamoDB table | NOT BUILT | IaC Agent |
| AWS Comprehend IAM permissions on `learnfyra-generate` Lambda role | IAM policy extension | NOT BUILT | IaC Agent |
| AWS Comprehend IAM permissions on `learnfyra-admin` Lambda role | IAM policy extension | NOT BUILT | IaC Agent |
| DynamoDB Config keys for guardrail clauses (initial seed) | Config seed script | NOT BUILT | DEV Agent |

### 8.3 External Dependencies

| Dependency | Notes |
|---|---|
| AWS Comprehend | Available in all Learnfyra AWS regions. No additional vendor agreement required. Standard AWS pricing applies. Estimate: ~$0.0001 per 100 characters scanned. For a 30-question worksheet (~15,000 chars), cost per worksheet is approximately $0.015. |
| Anthropic Tokenizer | Required for token counting in FR-GUARD-001 and FR-GUARD-008. Use `@anthropic-ai/tokenizer` npm package or equivalent. |

---

## 9. Open Questions

These questions MUST be resolved before DEV starts implementation. The BA agent will
facilitate the decision and update this document.

| ID | Question | Impact | Owner | Target Date |
|---|---|---|---|---|
| OQ-01 | Should the bias check (FR-GUARD-003) result in a hard reject (like HATE_SPEECH) or a WARN-only log in v1? Hard reject may cause false positives on legitimate content (e.g., a history question about a historical male figure). | Determines whether `biasClause` violations block delivery or just get logged. | Product / BA | Before DEV starts Group C |
| OQ-02 | Should AWS Comprehend be called per-question (10 separate API calls for 10 questions) or should all questions in a worksheet be batched into a single Comprehend call? Batching is cheaper but loses per-question attribution. | Affects moderation log granularity and cost calculation. | DEV / BA | Before DEV starts moderationAdapter.js |
| OQ-03 | What is the hardcoded keyword fallback list in `guardrailConfig.js`? The BA can define an initial list but it needs legal/editorial review before shipping. | Determines v1 fallback safety coverage when Comprehend is unavailable. | Legal / BA | Before first deploy to staging |
| OQ-04 | Should the `strictRetryClause` be a separate config key (as specified) or should it be derived automatically by adding more restrictive language to the `systemClause`? Separate config gives more admin control but adds complexity. | Affects FR-GUARD-009 (update API) and FR-GUARD-017 (retry logic). | BA / DEV | Before DEV starts promptGuardrail.js |
| OQ-05 | CAT-10 (FACTUAL_ERROR) is WARN-only in v1. What is the Phase 2 plan for automated factual validation? Options: (a) validate answers against CCSS/NGSS knowledge base, (b) use Sonnet as a fact-checker via the existing answer validator (M08 answerValidator.js), (c) defer indefinitely. | Determines whether M08 answerValidator.js can be reused here. | Product / BA | Phase 2 planning |
| OQ-06 | For the teacher content report (FR-GUARD-015), should the teacher receive an email confirmation of their report? Currently only a 201 response is specified. Notification would require SES integration not currently in scope. | Affects whether SES is an infrastructure dependency. | Product | Before FR-GUARD-015 DEV starts |
| OQ-07 | Should moderation scan results be included in the DynamoDB `LearnfyraGenerationLog` table (as additional attributes) or stay exclusively in `LearnfyraModerationLog`? Combining them simplifies queries; separating them keeps the generation log clean. | DynamoDB schema decision; affects IaC and DEV. | DBA / BA | Before IaC starts new table provisioning |
| OQ-08 | What is the expected volume of teacher content reports per month? This determines whether the `LearnfyraContentReports` table needs a GSI for status-based queries or if a scan with filter is sufficient at launch volume. | DynamoDB GSI provisioning decision. | Product / DBA | Before IaC starts |
| OQ-09 | The token limit for guardrail clauses is set at 120 tokens. Is this the right budget? It needs to be enough to be effective but not so large that it significantly increases Claude API costs. At $3/million input tokens (Sonnet), 120 extra tokens per request adds $0.00036/request — negligible. Should the limit be higher (e.g., 200 tokens)? | Affects FR-GUARD-001 validation and admin UX. | Product / BA | Before FR-GUARD-009 DEV starts |
| OQ-10 | Should the `LearnfyraModerationLog` table use DynamoDB TTL (3 years) or be moved to S3 Glacier after 30 days for cost optimization? At estimated volume of 1,000 worksheets/day x 10 questions each = 10,000 records/day. After 3 years = ~11 million records. DynamoDB cost at $0.25/GB: manageable but not free. | Infrastructure cost vs. query flexibility. | DevOps / DBA | Before IaC starts table provisioning |

---

*End of document. Version 1.0. Next review: when OQ-01 through OQ-10 are resolved or DEV implementation begins, whichever comes first.*

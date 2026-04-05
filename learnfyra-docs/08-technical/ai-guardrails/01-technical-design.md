# AI Prompt Guardrails & Admin Controls — Technical Design

**Status:** Draft
**Author:** Architect Agent
**Date:** 2026-04-04
**Requirement:** `learnfyra_document/AI-PROMPT-GUARDRAIL-ADMIN-REQUIREMENT.md`
**FRD:** `learnfyra-docs/07-requirements/ai-guardrails/FEATURE_SPEC.md`

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ WORKSHEET GENERATION PIPELINE (with Guardrails)                      │
│                                                                      │
│  POST /api/generate                                                  │
│   │                                                                  │
│   ▼                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────────┐           │
│  │ promptBuilder.js     │────▶│ guardrailsBuilder.js     │           │
│  │ (existing)           │     │ (NEW — injects context-  │           │
│  │                      │◀────│  aware guardrail clause)  │           │
│  └─────────────────────┘     └──────────────────────────┘           │
│   │                              │                                   │
│   │  Reads guardrail policy      │ Reads template from               │
│   │  + template from DynamoDB    │ LearnfyraConfig table             │
│   ▼                                                                  │
│  ┌─────────────────────┐                                            │
│  │ generator.js         │  Claude API call with guardrail-injected  │
│  │ (existing — modified)│  system prompt                             │
│  └─────────────────────┘                                            │
│   │                                                                  │
│   ▼                                                                  │
│  ┌─────────────────────────────────────────┐                        │
│  │ outputValidator.js (NEW)                 │                        │
│  │  ├── profanityFilter.js    (word lists)  │                        │
│  │  ├── sensitiveTopicFilter.js (grade-aware)│                       │
│  │  └── factualValidator.js   (hooks, v2)   │                        │
│  └─────────────────────────────────────────┘                        │
│   │                                                                  │
│   ├── PASS ──▶ Deliver worksheet                                     │
│   │                                                                  │
│   └── FAIL ──▶ Retry with stricter guardrail (up to 3x)             │
│                  │                                                   │
│                  └── All retries fail ──▶ Return error to user       │
│                                                                      │
│  ┌─────────────────────┐                                            │
│  │ auditLogger.js       │  Logs every attempt: guardrailLevel,      │
│  │ (existing — extended)│  validationResult, promptHash, retryCount  │
│  └─────────────────────┘                                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ ADMIN CONTROL PLANE (Super Admin / Platform Admin only)              │
│                                                                      │
│  GET/PUT  /api/admin/guardrails/policy      → guardrail level,      │
│                                                retry limit, filters  │
│  GET/PUT  /api/admin/guardrails/templates   → prompt templates       │
│  POST     /api/admin/guardrails/test        → dry-run validation     │
│  GET      /api/admin/audit/guardrail-events → moderation audit log   │
│                                                                      │
│  All changes → LearnfyraAuditLog (existing table)                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Design

### 2.1 Guardrail Prompt Injection Layer

**File:** `src/ai/guardrails/guardrailsBuilder.js` (NEW)

**Purpose:** Build a context-aware guardrail clause to append to the system prompt before every Claude API call.

**How it hooks in:** `generator.js` calls `buildGuardrailSuffix(options)` and appends the result to the system prompt built by `promptBuilder.js`. The existing `buildSystemPrompt()` is unchanged.

```javascript
// src/ai/guardrails/guardrailsBuilder.js

/**
 * @param {Object} options
 * @param {number} options.grade - 1-10
 * @param {string} options.subject - Math|ELA|Science|Social Studies|Health
 * @param {string} [options.guardrailLevel] - 'medium' | 'strict' (from policy)
 * @returns {string} guardrail clause to append to system prompt
 */
export function buildGuardrailSuffix(options) { ... }
```

**Grade-band strictness:**

| Grade Band | Guardrail Level | Token Budget | Notes |
|---|---|---|---|
| 1-3 (ages 6-9) | strict | ~280 tokens | Zero tolerance for violence, mature themes |
| 4-6 (ages 9-12) | medium | ~200 tokens | Age-appropriate historical context allowed |
| 7-10 (ages 12-16) | medium | ~200 tokens | Academic discussion of sensitive topics allowed |

**DynamoDB config for templates:**

| configKey | Value |
|---|---|
| `guardrail:policy` | `{ guardrailLevel, retryLimit, enableAwsComprehend, validationFilters }` |
| `guardrail:medium:template` | Template string with `[grade]`, `[subject]`, `[age]` placeholders |
| `guardrail:strict:template` | Stricter template string |

**Cache strategy:** Read from DynamoDB once per Lambda cold start, cache in module-level variable. TTL: 5 minutes (re-read after expiry).

**File:** `src/ai/guardrails/guardrailsPolicy.js` (NEW)

```javascript
/**
 * Load guardrail policy from DynamoDB Config table.
 * Cached per Lambda invocation (5-minute TTL).
 * Falls back to hardcoded default if DynamoDB read fails.
 * @returns {Promise<GuardrailPolicy>}
 */
export async function getGuardrailPolicy() { ... }

/**
 * Load guardrail template for given level.
 * @param {'medium'|'strict'} level
 * @returns {Promise<string>} Template string
 */
export async function getGuardrailTemplate(level) { ... }
```

### 2.2 Output Validation Engine

**File:** `src/ai/validation/outputValidator.js` (NEW)

**Purpose:** Orchestrate post-response validation. Runs all configured filters against the generated worksheet. Returns pass/fail with reasons.

```javascript
/**
 * @param {Object} worksheet - Parsed worksheet JSON from Claude response
 * @param {Object} context - { grade, subject, guardrailLevel }
 * @returns {Promise<ValidationResult>}
 */
export async function validateWorksheetOutput(worksheet, context) { ... }

// ValidationResult:
// { safe: boolean, failureReason: string|null, failureDetails: string|null, validatorsRun: string[] }
```

**Validation pipeline (runs sequentially, stops on first failure):**

1. `profanityFilter.js` — Word-list-based scan of all question text, options, answers, explanations
2. `sensitiveTopicFilter.js` — Grade-aware topic detection (9 content categories)
3. `factualValidator.js` — Placeholder for Phase 2 (warn-only in v1)

**File:** `src/ai/validation/profanityFilter.js` (NEW)

- Loads word lists from `src/ai/validation/wordlists/` (text files, one word per line)
- Scans: question, options, answer, explanation fields
- Case-insensitive, handles common substitutions (e.g., `@` for `a`)
- Returns `{ safe: boolean, matches: string[] }`

**File:** `src/ai/validation/sensitiveTopicFilter.js` (NEW)

- 9 content categories: violence, politics, religion, sexuality, drugs, self-harm, discrimination, mature-themes, profanity
- Grade-band thresholds: K-3 blocks all categories; 4-6 allows historical context; 7-10 allows academic discussion
- Pattern-based detection (regex + keyword lists per category)

### 2.3 Content Moderation Integration

**Phase 1:** Local validators only (profanity + sensitive topic filters).

**Phase 2 (optional):** AWS Comprehend integration for toxicity detection.

```javascript
// Future: src/ai/validation/comprehendModerator.js
// Calls AWS Comprehend DetectToxicContent API
// Timeout: 5s, fail-open (log and continue if Comprehend unavailable)
// Gated by config: guardrail:policy.enableAwsComprehend = true
```

**Cost estimate:** ~$0.015 per 30-question worksheet via Comprehend. At 10,000 worksheets/month = $150/month. Disabled by default.

### 2.4 Retry & Fallback Strategy

**Modified file:** `src/ai/generator.js`

```
Attempt 1: Generate with current guardrailLevel (e.g., medium)
  └── Validate output
      ├── PASS → return worksheet
      └── FAIL → log failure, escalate guardrailLevel

Attempt 2: Generate with strict guardrailLevel
  └── Validate output
      ├── PASS → return worksheet
      └── FAIL → log failure

Attempt 3: Generate with strict guardrailLevel + reduced question count
  └── Validate output
      ├── PASS → return worksheet
      └── FAIL → return error to user
```

**Configuration:** `retryLimit` in `guardrail:policy` config (default: 3, admin-configurable).

**Circuit breaker:** If >10% of generations in a 5-minute window require retries, log alert to CloudWatch.

### 2.5 Admin Control Plane Extensions

**File:** `backend/handlers/guardrailsAdminHandler.js` (NEW)

| Endpoint | Method | RBAC | Description |
|---|---|---|---|
| `/api/admin/guardrails/policy` | GET | Super Admin, Platform Admin | Get current guardrail policy |
| `/api/admin/guardrails/policy` | PUT | Super Admin, Platform Admin | Update guardrail policy |
| `/api/admin/guardrails/templates` | GET | Super Admin, Platform Admin | List all guardrail templates |
| `/api/admin/guardrails/templates/:level` | PUT | Super Admin, Platform Admin | Update template for level |
| `/api/admin/guardrails/test` | POST | Super Admin, Platform Admin | Dry-run validation on sample worksheet |
| `/api/admin/audit/guardrail-events` | GET | Super Admin, Data/Compliance Admin | Query moderation audit log |
| `/api/admin/audit/generation-stats` | GET | Super Admin, Data/Compliance Admin | Aggregated generation stats |

All changes logged to `LearnfyraAuditLog` table with: `actorId`, `timestamp`, `action`, `previousValue`, `newValue`, `reason`.

---

## 3. Data Design

### 3.1 DynamoDB Config Entries (LearnfyraConfig-{env})

```javascript
// Guardrail policy
{
  configKey: "guardrail:policy",           // PK
  value: JSON.stringify({
    guardrailLevel: "medium",              // "medium" | "strict"
    retryLimit: 3,                         // 0-5
    enableAwsComprehend: false,            // boolean
    comprehToxicityThreshold: 0.75,        // 0.0-1.0
    validationFilters: ["profanity", "sensitiveTopics"]
  }),
  updatedAt: "2026-04-04T00:00:00Z",
  updatedBy: "system"                      // or admin userId
}

// Guardrail templates
{
  configKey: "guardrail:medium:template",  // PK
  value: "You are generating educational worksheets for Grade [grade] students (ages [age]). All content must be safe, factual, age-appropriate, and aligned with US educational standards. Avoid violence, politics, religion, mature themes, stereotypes, or culturally insensitive material.",
  version: 1,
  updatedAt: "2026-04-04T00:00:00Z",
  updatedBy: "system"
}

{
  configKey: "guardrail:strict:template",  // PK
  value: "You are generating educational worksheets for young students in Grade [grade] (ages [age]). Content MUST be completely safe and appropriate for children. Use only simple, positive, and encouraging language. Do NOT include any references to violence, conflict, politics, religion, death, illness, mature themes, stereotypes, or any potentially frightening or upsetting content. All examples must use age-appropriate scenarios (family, school, nature, animals, everyday activities).",
  version: 1,
  updatedAt: "2026-04-04T00:00:00Z",
  updatedBy: "system"
}
```

### 3.2 Audit Log Entries (LearnfyraAuditLog-{env})

**Generation moderation event (written by generator.js):**

```javascript
{
  auditId: "uuid",                         // PK
  timestamp: "2026-04-04T10:30:00Z",
  eventType: "generation.moderation",
  actorId: "requesting-user-id",
  action: "worksheet_generated",
  target: { type: "worksheet", id: "worksheet-uuid" },
  details: {
    grade: 3,
    subject: "Math",
    guardrailLevel: "medium",
    promptHashSha256: "abc123...",
    validationResult: { safe: true, validatorsRun: ["profanity", "sensitiveTopics"] },
    retryCount: 0,
    modelUsed: "claude-sonnet-4-20250514"
  },
  status: "success"
}
```

**Admin policy update event:**

```javascript
{
  auditId: "uuid",
  timestamp: "2026-04-04T10:31:00Z",
  eventType: "admin.guardrail_policy_updated",
  actorId: "admin-user-id",
  actorRole: "PLATFORM_ADMIN",
  action: "guardrail_policy_updated",
  target: { type: "guardrail_policy", id: "guardrail:policy" },
  details: {
    changes: {
      guardrailLevel: { from: "medium", to: "strict" },
      retryLimit: { from: 3, to: 2 }
    },
    reason: "Tightening for K-2 content"
  },
  status: "success"
}
```

---

## 4. API Contracts (Summary)

### GET /api/admin/guardrails/policy

**Auth:** Bearer token (Super Admin or Platform Admin)

**Response 200:**
```json
{
  "policy": {
    "guardrailLevel": "medium",
    "retryLimit": 3,
    "enableAwsComprehend": false,
    "comprehToxicityThreshold": 0.75,
    "validationFilters": ["profanity", "sensitiveTopics"],
    "updatedAt": "2026-04-04T10:30:00Z",
    "updatedBy": "admin-user-id"
  }
}
```

### PUT /api/admin/guardrails/policy

**Auth:** Bearer token (Super Admin or Platform Admin)

**Request:**
```json
{
  "guardrailLevel": "strict",
  "retryLimit": 2,
  "reason": "Tightening for younger audience"
}
```

**Response 200:**
```json
{
  "success": true,
  "policy": { ... },
  "auditId": "uuid",
  "changes": { "guardrailLevel": { "from": "medium", "to": "strict" } }
}
```

### GET /api/admin/guardrails/templates

**Response 200:**
```json
{
  "templates": {
    "medium": { "content": "...", "version": 2, "updatedAt": "...", "updatedBy": "..." },
    "strict": { "content": "...", "version": 1, "updatedAt": "...", "updatedBy": "..." }
  }
}
```

### PUT /api/admin/guardrails/templates/:level

**Request:**
```json
{
  "content": "You are generating worksheets for Grade [grade] students (ages [age])...",
  "reason": "Adding inclusivity emphasis"
}
```

**Validation:** Template MUST contain `[grade]` and `[age]` placeholders.

### POST /api/admin/guardrails/test

**Request:**
```json
{
  "worksheet": { "grade": 3, "subject": "Math", "questions": [...] },
  "guardrailLevel": "strict"
}
```

**Response 200:**
```json
{
  "validationResult": { "safe": true, "failureReason": null, "validatorsRun": ["profanityFilter", "sensitiveTopicFilter"] }
}
```

---

## 5. File Structure

### New Files

```
src/ai/guardrails/
  guardrailsBuilder.js          Build guardrail suffix strings
  guardrailsPolicy.js           Load/cache guardrail policy from DynamoDB

src/ai/validation/
  outputValidator.js             Validation orchestrator
  profanityFilter.js             Word-list profanity detection
  sensitiveTopicFilter.js        Grade-aware topic detection
  factualValidator.js            Factual checking hooks (v2 placeholder)

src/ai/validation/wordlists/
  profanity.txt                  Common profanity words
  slurs.txt                      Slurs and hate terms
  sensitive-topics.txt           Sensitive topic keywords by category

backend/handlers/
  guardrailsAdminHandler.js      Admin API endpoints

tests/unit/
  guardrailsBuilder.test.js
  profanityFilter.test.js
  sensitiveTopicFilter.test.js
  outputValidator.test.js
  guardrailsAdminHandler.test.js

tests/integration/
  guardrails-workflow.test.js    Full generation → validation → retry flow
```

### Existing Files to Modify

```
src/ai/generator.js              Add guardrail injection + retry on validation failure
src/admin/auditLogger.js         Add guardrail audit event types
backend/handlers/adminHandler.js Route guardrail endpoints to new handler
server.js                        Add Express routes for guardrail admin endpoints
```

---

## 6. Security Considerations

- **Prompt injection defense:** Guardrail templates are admin-controlled, not user-supplied. No user text enters the system prompt. Placeholders (`[grade]`, `[age]`) are populated from validated enums only.
- **Admin access control:** All guardrail endpoints require `requireRole(decoded, ['SUPER_ADMIN', 'PLATFORM_ADMIN'])`.
- **Audit trail:** Every generation logs guardrailLevel + validationResult. Every admin change logs actorId + reason + diff.
- **Token leakage:** Prompts stored as SHA256 hash in audit log, not plaintext.

---

## 7. Performance & Cost

| Component | Latency Impact | Notes |
|---|---|---|
| Guardrail injection | <1ms | String concatenation |
| Claude API call | 800-1500ms | Unchanged from baseline |
| Output validation | 50-100ms | Regex matching |
| AWS Comprehend (optional) | 200-400ms | Disabled by default |
| Audit log (async) | 0ms | Non-blocking DynamoDB put |
| **Total added** | **50-100ms** | Without Comprehend |

**Token overhead:** ~200-280 tokens per generation for guardrail suffix (7-10% overhead). Negligible cost impact.

**Retry cost:** ~2x-3x tokens per failed generation. Expected retry rate <5%.

---

## 8. Dependencies & Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Guardrail template cached too long | Medium | 5-minute TTL, `?refresh=true` for testing |
| Retry loop causes high latency | Medium | Configurable `retryLimit`, 60s handler timeout |
| Word lists become stale | Low | Admin endpoint to update, quarterly review |
| AWS Comprehend unavailable | Low | Disabled by default, fail-open if enabled |
| Admin disables all guardrails | High | Enum validation (`medium`/`strict` only, no `none`) |

**Hard dependencies:** Node.js 18+, Anthropic Claude API, DynamoDB (all existing).
**No new npm packages required.**

---

## 9. Rollout Plan

1. **Phase 1 (Local):** Build guardrailsBuilder, outputValidator, profanityFilter, sensitiveTopicFilter. Wire into generator.js. Test on localhost.
2. **Phase 2 (Admin API):** Build guardrailsAdminHandler.js. Wire into server.js. Test via Postman.
3. **Phase 3 (AWS):** Add Lambda function to CDK stack. Deploy to dev. Seed DynamoDB config.
4. **Phase 4 (Optional):** Enable AWS Comprehend integration.

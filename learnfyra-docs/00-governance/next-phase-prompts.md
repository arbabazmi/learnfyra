# Next Phase — Implementation Agent Prompts

**Date:** 2026-04-04
**Features:** AI Prompt Guardrails + Question Bank Repeat Cap
**Phase:** Implementation (post-architecture, post-BA spec)

These prompts are designed to be copy-pasted into Claude Code sessions with the appropriate agent type. Execute in the order listed.

---

## Prompt 1: DEV Agent — AI Guardrails Core (Track A)

```
You are the DEV agent for Learnfyra. Implement the AI Prompt Guardrails core modules.

## Context
Read these documents FIRST:
- Technical design: learnfyra-docs/08-technical/ai-guardrails/01-technical-design.md
- Feature spec: learnfyra-docs/07-requirements/ai-guardrails/FEATURE_SPEC.md
- Existing promptBuilder: src/ai/promptBuilder.js
- Existing generator: src/ai/generator.js
- Existing auditLogger: src/admin/auditLogger.js

## What to Build (LOCAL ONLY — no AWS deploy)

### Track A: Guardrail Injection + Output Validation

1. Create `src/ai/guardrails/guardrailsBuilder.js`
   - buildGuardrailSuffix(options) — returns context-aware guardrail clause
   - Grade-band strictness: 1-3 strict, 4-6 medium, 7-10 medium
   - Load template from DynamoDB Config (or local mock)
   - Token budget: ~200-280 tokens per suffix

2. Create `src/ai/guardrails/guardrailsPolicy.js`
   - getGuardrailPolicy() — reads from DynamoDB Config, cached 5 min
   - getGuardrailTemplate(level) — reads template from Config
   - Falls back to hardcoded default if DynamoDB fails

3. Create `src/ai/validation/outputValidator.js`
   - validateWorksheetOutput(worksheet, context) → { safe, failureReason, validatorsRun }
   - Orchestrates profanityFilter + sensitiveTopicFilter

4. Create `src/ai/validation/profanityFilter.js`
   - Word-list-based scan of question, options, answer, explanation
   - Case-insensitive, common substitution handling
   - Load word lists from src/ai/validation/wordlists/

5. Create `src/ai/validation/sensitiveTopicFilter.js`
   - 9 content categories (violence, politics, religion, etc.)
   - Grade-band thresholds for each category
   - Pattern-based detection (regex + keywords)

6. Create word list files in `src/ai/validation/wordlists/`
   - profanity.txt, slurs.txt, sensitive-topics.txt

7. Modify `src/ai/generator.js`
   - Import guardrailsBuilder, inject suffix into system prompt
   - Import outputValidator, validate after generation
   - Add retry logic: fail → escalate guardrailLevel → retry (up to 3x)
   - Log each attempt via auditLogger

8. Extend `src/admin/auditLogger.js`
   - Add event types: generation.moderation, admin.guardrail_policy_updated, admin.guardrail_template_updated

## Coding Standards
- ESM imports (import/export), no require()
- Lazy imports for Lambda cold start optimization
- No hardcoded secrets
- Follow existing patterns in src/ai/ directory
- All functions must have JSDoc with @param and @returns

## DO NOT
- Deploy to AWS
- Modify CDK stack
- Create frontend pages
- Write tests (QA agent handles that)
```

---

## Prompt 2: DEV Agent — Repeat Cap Refactor (Track B)

```
You are the DEV agent for Learnfyra. Refactor the Question Bank Repeat Cap to be admin-configurable.

## Context
Read these documents FIRST:
- Technical design: learnfyra-docs/08-technical/question-bank-repeat-cap/01-technical-design.md
- Feature spec: learnfyra-docs/07-requirements/question-bank/FEATURE_SPEC.md
- Current repeat cap: src/ai/repeatCapPolicy.js
- Current assembler: src/ai/assembler.js
- Admin handler: backend/handlers/adminHandler.js
- DynamoDB design: learnfyra-docs/03-data-design/dynamodb-design.md

## What to Build (LOCAL ONLY — no AWS deploy)

### Track B: Repeat Cap Resolution + Assembly Refactor

1. Refactor `src/ai/repeatCapPolicy.js`
   - resolveRepeatCap({ studentId, parentId, teacherId }) → effective cap %
   - Precedence: student override → parent → teacher → global default
   - Read from DynamoDB Config (configKey patterns: repeatCap:global, repeatCap:override:*)
   - Fallback to 20% if DynamoDB read fails
   - calculateAllocation(questionCount, capPercent) → { maxRepeat, minUnseen }

2. Create `src/ai/exposure/exposureTracker.js`
   - getExposedQuestionIds(userId, grade, subject, topic) → Set<questionId>
   - recordExposure(userId, grade, subject, topic, questionIds) → fire-and-forget
   - Uses LearnfyraQuestionExposure table (or local JSON for dev)

3. Refactor `src/ai/assembler.js`
   - REMOVE hardcoded: const minUnseen = Math.ceil(questionCount * 0.8)
   - REPLACE with: const { maxRepeat, minUnseen } = calculateAllocation(questionCount, capPercent)
   - New flow: unseen from bank → repeat from bank (up to cap) → AI backfill
   - Return bankStats: { fromBankUnseen, fromBankRepeat, fromAi, effectiveCapPercent }

4. Extend `backend/handlers/adminHandler.js`
   - GET /api/admin/repeat-cap — return global + overrides
   - PUT /api/admin/repeat-cap — update global default (value 0-100, reason required)
   - POST /api/admin/repeat-cap/override — create scope override
   - DELETE /api/admin/repeat-cap/override/:scope/:scopeId — remove override
   - RBAC: Super Admin or Platform Admin only
   - Audit log every change

5. Wire routes into `server.js`
   - Add Express routes for repeat-cap admin endpoints

6. Extend `src/admin/auditLogger.js`
   - Add event types: admin.repeat_cap_updated, admin.repeat_cap_override_created, admin.repeat_cap_override_deleted

## Key Constraint
The hardcoded 80/20 rule in assembler.js (~line 347) MUST be replaced. Grep for 0.8 and 0.2 in all assembler-related files to ensure nothing is missed.

## DO NOT
- Deploy to AWS or modify CDK stack
- Create the LearnfyraQuestionExposure DynamoDB table (use local JSON adapter for dev)
- Write tests (QA agent handles that)
```

---

## Prompt 3: DEV Agent — Guardrails Admin Handler (Track C)

```
You are the DEV agent for Learnfyra. Build the Guardrails Admin API handler.

## Context
Read these documents FIRST:
- API contracts: learnfyra-docs/04-api-contracts/guardrails-api.md
- Technical design: learnfyra-docs/08-technical/ai-guardrails/01-technical-design.md
- Existing admin handler: backend/handlers/adminHandler.js (follow same patterns)
- Auth middleware: backend/middleware/authMiddleware.js

## What to Build

1. Create `backend/handlers/guardrailsAdminHandler.js`
   - Lambda-compatible handler (same pattern as adminHandler.js)
   - Endpoints per API contract (guardrails-api.md Section A)
   - RBAC: requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN'])
   - All changes logged via auditLogger

2. Wire into `server.js`
   - Add Express routes: /api/admin/guardrails/*

3. Follow the exact request/response schemas from guardrails-api.md
   - Validation: guardrailLevel enum, retryLimit range, reason required
   - Template validation: must contain [grade] and [age] placeholders

## DO NOT
- Write tests (QA agent)
- Deploy to AWS
- Modify the guardrail core modules (Track A handles those)
```

---

## Prompt 4: QA Agent — Guardrails Tests

```
You are the QA agent for Learnfyra. Write tests for the AI Guardrails feature.

## Context
Read these documents FIRST:
- Feature spec: learnfyra-docs/07-requirements/ai-guardrails/FEATURE_SPEC.md
- Technical design: learnfyra-docs/08-technical/ai-guardrails/01-technical-design.md
- API contracts: learnfyra-docs/04-api-contracts/guardrails-api.md

## What to Test

### Unit Tests:
1. `tests/unit/guardrailsBuilder.test.js`
   - Grade 1-3 uses strict template
   - Grade 4-10 uses medium template
   - Token budget not exceeded
   - Handles missing DynamoDB config (fallback)

2. `tests/unit/profanityFilter.test.js`
   - Detects profanity in question, options, answer, explanation
   - Case-insensitive matching
   - Common substitutions (@ for a, etc.)
   - Clean content passes
   - Edge: empty string, null fields

3. `tests/unit/sensitiveTopicFilter.test.js`
   - Violence blocked for Grade 1-3
   - Historical violence context allowed for Grade 7-10
   - All 9 content categories tested
   - Grade-band threshold differences

4. `tests/unit/outputValidator.test.js`
   - Orchestrates profanity + sensitive topic filters
   - Returns correct ValidationResult schema
   - First failure stops pipeline

5. `tests/unit/guardrailsAdminHandler.test.js`
   - GET policy returns current config
   - PUT policy updates and returns changes
   - PUT with invalid guardrailLevel → 400
   - Template update validates placeholders
   - Non-admin → 403
   - All changes create audit log entries

### Integration Tests:
6. `tests/integration/guardrails-workflow.test.js`
   - Full flow: generate → validate → pass
   - Full flow: generate → validate fail → retry with strict → pass
   - Full flow: all retries fail → error returned
   - Audit log entries created for each attempt

## Test Patterns
- Use aws-sdk-client-mock for DynamoDB mocking
- Mock Lambda events with mockEvent() helper
- Follow existing test patterns in tests/unit/
- Boundary: Grade 1 + 5 questions, Grade 10 + 30 questions
```

---

## Prompt 5: QA Agent — Repeat Cap Tests

```
You are the QA agent for Learnfyra. Write tests for the Question Bank Repeat Cap feature.

## Context
Read these documents FIRST:
- Feature spec: learnfyra-docs/07-requirements/question-bank/FEATURE_SPEC.md
- Technical design: learnfyra-docs/08-technical/question-bank-repeat-cap/01-technical-design.md
- API contracts: learnfyra-docs/04-api-contracts/guardrails-api.md (Section B)

## What to Test

### Unit Tests:
1. `tests/unit/repeatCapPolicy.test.js` (EXTEND existing)
   - resolveRepeatCap with student override → returns student value
   - resolveRepeatCap with parent override (no student) → returns parent value
   - resolveRepeatCap with only global → returns global value
   - resolveRepeatCap with DynamoDB failure → returns 20% fallback
   - Expired override is skipped
   - calculateAllocation formula verification:
     - (10, 20%) → { maxRepeat: 2, minUnseen: 8 }
     - (10, 0%) → { maxRepeat: 0, minUnseen: 10 }
     - (10, 100%) → { maxRepeat: 10, minUnseen: 0 }
     - (5, 20%) → { maxRepeat: 1, minUnseen: 4 }
     - (30, 20%) → { maxRepeat: 6, minUnseen: 24 }

2. `tests/unit/exposureTracker.test.js`
   - getExposedQuestionIds returns Set of questionIds
   - recordExposure writes batch to DynamoDB
   - Empty exposure history returns empty Set
   - Guest user ID works

3. `tests/unit/assembler.repeat-cap.test.js`
   - 10 questions, 20% cap, 8 unseen available → 8 unseen + 2 repeat
   - 10 questions, 20% cap, 5 unseen available → 5 unseen + 2 repeat + 3 AI
   - 10 questions, 0% cap → all unseen or AI
   - 10 questions, 100% cap → no exposure filtering
   - New student (no exposure) → all from bank
   - Empty bank → all from AI

### Integration Tests:
4. `tests/integration/repeat-cap-admin.test.js`
   - GET /api/admin/repeat-cap returns global + overrides
   - PUT /api/admin/repeat-cap updates global, creates audit entry
   - POST override creates entry
   - DELETE override removes entry
   - Teacher cannot access (403)
   - Invalid value (101, -1, "abc") → 400

5. `tests/integration/repeat-cap-assembly.test.js`
   - Full flow: set cap → generate worksheet → verify allocation matches cap
   - Override precedence: student override wins over global

## Acceptance Criteria from Spec (MUST cover all):
- AC-01: Global admin configuration
- AC-02: Dynamic behavior (10 questions, 20% cap → max 2 repeat)
- AC-03: No teacher/parent edit access
- AC-04: Override precedence
- AC-05: Audit log
```

---

## Prompt 6: DevOps Agent — CDK + Deployment (Phase 3, LATER)

```
You are the DevOps agent for Learnfyra. Update the CDK stack for the Guardrails and Repeat Cap features.

## Context
- CDK stack: infra/cdk/lib/learnfyra-stack.ts
- Technical designs in learnfyra-docs/08-technical/

## What to Deploy (ONLY after local implementation is complete and tested)

1. Add `guardrailsAdminHandler` Lambda function
   - Memory: 256MB, Timeout: 15s
   - Grant: read/write LearnfyraConfig, write LearnfyraAuditLog

2. Create `LearnfyraQuestionExposure-{env}` DynamoDB table
   - PK: userId (S), SK: exposureKey (S)
   - BillingMode: PAY_PER_REQUEST
   - Prod: RemovalPolicy.RETAIN

3. Seed initial DynamoDB config entries
   - guardrail:policy (default medium, retryLimit 3)
   - guardrail:medium:template
   - guardrail:strict:template
   - repeatCap:global (default 20)

4. Add API Gateway routes for new endpoints

5. Add CloudWatch alarms for new Lambda functions

6. Update GitHub Actions workflows to include new handlers in deploy

## DO NOT run until DEV and QA confirm all local tests pass.
```

---

## Execution Order

```
Phase 1 — Implementation (parallel tracks):
  Track A: DEV → Prompt 1 (Guardrails Core)
  Track B: DEV → Prompt 2 (Repeat Cap Refactor)
  Track C: DEV → Prompt 3 (Guardrails Admin Handler)
  (A, B, C can run in parallel — no file conflicts)

Phase 2 — Testing (after Phase 1 complete):
  Track D: QA → Prompt 4 (Guardrails Tests)
  Track E: QA → Prompt 5 (Repeat Cap Tests)
  (D, E can run in parallel)

Phase 3 — AWS Deployment (after Phase 2 passes):
  Track F: DevOps → Prompt 6 (CDK + Deploy)

Phase 4 — Verification:
  BA reviews QA results against acceptance criteria
  Confirm "done" or send back for fixes
```

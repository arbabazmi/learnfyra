# Learnfyra Platform Module Breakdown and Requirements (Auth-First)
# File: docs/specs/platform/platform-module-breakdown-auth-first.md
# Version: 0.1 (Discussion Draft)
# Date: 2026-03-25

## Purpose
Define the module-first blueprint for Learnfyra, starting with teacher/student/parent login via public OAuth, then worksheet generation and all dependent modules.

This document is now a master overview. Detailed requirements are split into modular docs for token-efficient execution.

## Detailed Module Specs
1. [modules/M01-auth-identity-spec.md](modules/M01-auth-identity-spec.md)
2. [modules/M02-question-bank-spec.md](modules/M02-question-bank-spec.md)
3. [modules/M03-worksheet-generator-spec.md](modules/M03-worksheet-generator-spec.md)
4. [modules/M04-solve-submit-spec.md](modules/M04-solve-submit-spec.md)
5. [modules/M05-progress-reporting-spec.md](modules/M05-progress-reporting-spec.md)
6. [modules/M06-class-relationship-spec.md](modules/M06-class-relationship-spec.md)
7. [modules/M07-admin-control-plane-spec.md](modules/M07-admin-control-plane-spec.md)

## Goals
1. Start with secure multi-role authentication.
2. Support Google OAuth and at least one additional public OAuth provider.
3. Build worksheet generation around reuse (Question Bank) before regeneration.
4. Keep local-first implementation with AWS-ready architecture.
5. Produce clear module boundaries, requirements, and build sequence.

## Module Map (High Level)

### Module 1: Auth and Identity
Purpose: Sign-in, identity, roles, and session enforcement.

Scope:
- Roles: teacher, student, parent.
- OAuth providers: Google + one additional public provider (GitHub or Microsoft).
- Local email/password fallback.
- JWT session handling and role-based access.

Outputs consumed by other modules:
- `userId`, `role`, `provider`, `class scope`.

### Module 2: Question Bank
Purpose: Store and reuse validated questions.

Scope:
- Question entity storage and retrieval.
- Tagging by grade, subject, topic, difficulty, type, standard.
- Deduplication and reuse counters.

Outputs consumed by generator module:
- Candidate question pool for assembly.

### Module 3: Worksheet Generator (Attached Architecture Aligned)
Purpose: Build worksheets using bank-first strategy with model fallback.

Scope:
- Pipeline: request -> bank lookup -> generate missing -> validate -> store -> return JSON.
- Multi-model policy: default cheap model, fallback model, advanced model for complex prompts.
- Dynamic assembly and randomization.
- Structured JSON output for UI/PDF/DOCX rendering.

### Module 4: Solve and Submit
Purpose: Interactive worksheet solving and scoring.

Scope:
- Timed and untimed modes.
- Per-type input mapping.
- Submit and score with explanation feedback.
- Persist attempt linked to authenticated user.

### Module 5: Progress and Reporting
Purpose: Student, teacher, and parent performance visibility.

Scope:
- Student history and weak-topic insights.
- Teacher class analytics.
- Parent child-linked progress view.
- Online and offline score ingestion.

### Module 6: Class and Relationship Management
Purpose: Teacher-managed classes and parent-child linking.

Scope:
- Class creation and join flow.
- Membership mapping.
- Assignment scope and access boundaries.

### Module 7: Admin Control Plane
Purpose: Operational controls and model governance.

Scope:
- Model selection policy.
- Budget and prompt controls.
- Validation rules and platform-level overrides.

## Auth-First Requirements (Phase 1 Priority)

### User Story
As a teacher, student, or parent,
I want to log in with Google or another public OAuth provider,
so that I can securely access role-specific platform features without creating extra credentials.

### Functional Requirements
1. System must support Google OAuth login.
2. System must support one additional public OAuth provider (GitHub or Microsoft).
3. System must support local email/password account creation as fallback.
4. System must issue JWT with role claims (`teacher|student|parent`).
5. System must enforce auth on online solve/submit and dashboard APIs.
6. Guest users may generate/download worksheets but cannot store online attempts.
7. Parent role must be linked to child account before progress data access.

### Acceptance Criteria (Auth)
Given a teacher clicks "Sign in with Google"
When OAuth succeeds
Then the system creates/links the account and returns a valid role-scoped session.

Given a student is not authenticated
When the student clicks "Solve Online"
Then the system shows an auth gate and blocks solve submission until sign-in completes.

Given a parent logs in successfully
When no child is linked
Then progress endpoints return a guided link-child state instead of student data.

## Worksheet Generator Module Requirements

### User Story
As a teacher,
I want the platform to reuse existing high-quality questions and generate only when needed,
so that worksheet quality stays high and generation cost stays low.

### Functional Requirements
1. System must query Question Bank first for requested criteria.
2. System must assemble worksheet from bank questions when sufficient inventory exists.
3. System must generate only the missing question count.
4. System must validate generated questions before storing and reuse.
5. System must store generated and validated questions in Question Bank.
6. System must return structured worksheet JSON for rendering.
7. System must track model used and generation metadata for each question.

### Acceptance Criteria (Generator)
Given request criteria has enough matching bank questions
When worksheet generation is requested
Then worksheet is assembled without calling premium model generation.

Given request criteria has insufficient matching bank questions
When worksheet generation is requested
Then system generates only deficit questions, validates them, stores them, and returns a complete worksheet.

Given a generated worksheet is returned
When metadata is inspected
Then each question includes provenance fields (bank-reused or generated, and model used if generated).

## Core Data Contracts (Module-Level)

### User
- `userId`, `email`, `role`, `provider`, `providerId`, `createdAt`, `lastLoginAt`

### Question
- `questionId`, `grade`, `subject`, `topic`, `difficulty`, `type`
- `question`, `options?`, `answer`, `explanation`, `standards[]`
- `modelUsed`, `createdAt`, `reuseCount`

### Worksheet
- `worksheetId`, `metadata`, `questionIds[]`, `questions[]`, `generatedAt`

### Attempt
- `attemptId`, `worksheetId`, `studentId`, `answers[]`, `score`, `timeTaken`, `submittedAt`

## High-Level API Surface

### Auth
- `POST /api/auth/oauth/google`
- `POST /api/auth/oauth/github` (or Microsoft)
- `GET /api/auth/callback/:provider`
- `POST /api/auth/login` (local)
- `POST /api/auth/register` (local)
- `POST /api/auth/logout`

### Generation and Bank
- `POST /api/generate`
- `GET /api/qb/questions`
- `POST /api/qb/questions`

### Solve
- `GET /api/solve/:worksheetId`
- `POST /api/submit`

### Progress
- `GET /api/progress/history`
- `GET /api/analytics/class/:id`

## Build Sequence (Recommended)

### Phase A: Identity Foundation
1. OAuth and local auth finalization.
2. Role enforcement across protected APIs.
3. Parent-child linking contract.

### Phase B: Question Reuse Core
1. Question Bank schema and CRUD.
2. Bank-first retrieval and dedupe.
3. Generation fallback and validation.

### Phase C: Solve + Progress Integration
1. Auth-bound submission persistence.
2. Online/offline progress feed alignment.
3. Role-based dashboards.

### Phase D: Admin Controls
1. Model routing controls.
2. Budget and prompt governance.
3. Validation policy controls.

## AWS Architecture Alignment
Frontend -> API Gateway -> Lambda -> Step Functions ->
- DynamoDB (Question Bank, metadata)
- Bedrock (generation)
- Lambda validation
- S3 storage and artifacts
- Assembly and response JSON

## Out of Scope (This Draft Iteration)
1. Full school district SSO and LMS integrations.
2. Advanced adaptive difficulty personalization algorithms.
3. Full gamification policy details.

## Open Questions for Next Iteration
1. Second OAuth provider preference: GitHub or Microsoft?
2. Should Question Bank be globally reusable or tenant-isolated by default?
3. Is parent-child linking invitation-based, code-based, or teacher-approved?
4. What are the exact admin guardrails for premium model escalation?
5. What minimum analytics must be in first production release?

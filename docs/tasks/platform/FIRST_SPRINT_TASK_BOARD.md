# First Sprint Task Board (M01-M03)

Purpose: Provide exact, parallelizable work items for the first sprint using the new frontend/backend agent split.

Companion prompt file:
- `docs/operations/FIRST_FOUR_TICKET_PROMPTS.md`

Scope:
- M01 Auth and Identity
- M02 Question Bank
- M03 Worksheet Generator

Sprint mode: contract-first, low-token, module-scoped execution

## Sprint Goal
Establish the core platform foundation so authenticated users can enter the system, backend contracts are stable, and the worksheet generator can evolve toward bank-first assembly.

## Lane Owners
- Frontend lead: `frontend-developer-agent`
- Frontend design partner: `ui-agent`
- Backend lead: `backend-developer-agent`
- Backend design partner: `architect-agent`
- QA: `qa-agent`
- Claude focus: requirements, architecture, UX direction, validation review
- Copilot focus: implementation, wiring, tests, focused refactors

## Sequence Rule
1. Backend contract is defined first for each slice.
2. Frontend starts once contract is frozen for that slice.
3. QA validates slice before status changes to done.

---

## Module M01: Auth and Identity

### M01-BE-01
- Title: Define OAuth and local auth API contracts
- Owner: `architect-agent` + `backend-developer-agent`
- Primary executor: Claude for contract definition, Copilot for follow-up implementation handoff
- Status: todo
- Priority: P0
- Inputs:
  - `docs/specs/modules/M01-auth-identity-spec.md`
  - `backend/handlers/authHandler.js`
- Deliverables:
  - final endpoint list
  - request/response schema
  - role claim structure
  - auth error model
- Acceptance:
  - Google OAuth flow contract defined
  - second provider placeholder contract defined
  - local register/login contract defined

### M01-BE-02
- Title: Implement auth backend foundation
- Owner: `backend-developer-agent`
- Primary executor: Copilot
- Status: todo
- Depends on: `M01-BE-01`
- Files target:
  - `backend/handlers/authHandler.js`
  - `src/auth/`
  - related auth middleware/tests
- Deliverables:
  - handler updates for contract-aligned auth flow
  - role claim issuance
  - protected route support hooks
  - tests for login/register/logout and token validation
- Acceptance:
  - valid auth responses match contract
  - invalid auth returns predictable errors
  - tests updated

### M01-FE-01
- Title: Define auth UX flow and page states
- Owner: `ui-agent` + `frontend-developer-agent`
- Primary executor: Claude for UX definition, Copilot for implementation handoff
- Status: todo
- Priority: P0
- Inputs:
  - `docs/specs/modules/M01-auth-identity-spec.md`
  - auth-related frontend pages/scripts
- Deliverables:
  - login entry flow
  - OAuth button layout guidance
  - local auth fallback state guidance
  - parent no-child-linked empty state guidance
- Acceptance:
  - UX states documented for sign-in, loading, error, success

### M01-FE-02
- Title: Implement auth frontend flow
- Owner: `frontend-developer-agent`
- Primary executor: Copilot
- Status: todo
- Depends on: `M01-BE-01`, `M01-FE-01`
- Files target:
  - `frontend/login.html`
  - relevant frontend auth JS/CSS
- Deliverables:
  - sign-in UI with Google + second provider placeholders
  - local auth form
  - auth gate UI for protected flows
  - API integration to backend auth routes
- Acceptance:
  - frontend follows backend contract
  - loading/error states work
  - auth gate blocks solve until signed in

### M01-QA-01
- Title: Validate auth slice
- Owner: `qa-agent`
- Primary executor: Claude or Copilot QA pass
- Status: todo
- Depends on: `M01-BE-02`, `M01-FE-02`
- Deliverables:
  - auth test matrix
  - happy/error/boundary results
  - regression summary
- Acceptance:
  - auth slice passes functional QA

---

## Module M02: Question Bank

### M02-BE-01
- Title: Define question bank schema and API contracts
- Owner: `architect-agent` + `backend-developer-agent`
- Primary executor: Claude
- Status: todo
- Priority: P0
- Inputs:
  - `docs/specs/modules/M02-question-bank-spec.md`
  - `docs/specs/modules/M03-worksheet-generator-spec.md`
- Deliverables:
  - Question entity schema
  - search/filter contract
  - dedupe rule summary
  - reuse count update behavior
- Acceptance:
  - contract supports generator consumption

### M02-BE-02
- Title: Implement question bank backend CRUD/search
- Owner: `backend-developer-agent`
- Primary executor: Copilot
- Status: todo
- Depends on: `M02-BE-01`
- Files target:
  - new `src/questionBank/` files
  - new/updated handler files
  - tests
- Deliverables:
  - question storage abstraction
  - search and retrieval
  - dedupe logic
  - tests for create/get/search
- Acceptance:
  - duplicate prevention works
  - search returns filter-correct results

### M02-FE-01
- Title: Define question bank teacher UX scope
- Owner: `ui-agent` + `frontend-developer-agent`
- Primary executor: Claude
- Status: todo
- Priority: P1
- Deliverables:
  - decide whether sprint includes full manager UI or minimal internal flow support
  - define search/filter interaction if UI included
- Acceptance:
  - scope decision documented to prevent unnecessary frontend expansion

### M02-FE-02
- Title: Implement minimal question bank frontend integration
- Owner: `frontend-developer-agent`
- Primary executor: Copilot
- Status: todo
- Depends on: `M02-BE-01`, `M02-FE-01`
- Deliverables:
  - only required UI for current sprint scope
  - no oversized manager UI unless approved
- Acceptance:
  - frontend changes remain minimal and aligned to scope

### M02-QA-01
- Title: Validate question bank slice
- Owner: `qa-agent`
- Primary executor: Claude or Copilot QA pass
- Status: todo
- Depends on: `M02-BE-02`, `M02-FE-02`
- Acceptance:
  - CRUD/search/dedupe behavior verified

---

## Module M03: Worksheet Generator

### M03-BE-01
- Title: Define bank-first generator contract
- Owner: `architect-agent` + `backend-developer-agent`
- Primary executor: Claude
- Status: completed
- Priority: P0
- Inputs:
  - `docs/specs/modules/M03-worksheet-generator-spec.md`
  - `docs/architecture/diagrams/worksheet_architecture.md`
  - `src/ai/generator.js`
- Deliverables:
  - generator request contract updates
  - bank lookup -> generate missing -> validate -> store flow
  - provenance metadata contract
- Acceptance:
  - contract supports current generator and future bank-first path

### M03-BE-02
- Title: Implement generator preparation slice
- Owner: `backend-developer-agent`
- Primary executor: Copilot
- Status: completed
- Depends on: `M03-BE-01`, `M02-BE-02`
- Files target:
  - `src/ai/generator.js`
  - new assembler/validation helpers as needed
  - handler tests
- Deliverables:
  - request shape extensions for bank-first mode
  - generator flow hooks for bank lookup and provenance
  - tests for backward compatibility
- Acceptance:
  - existing generation flow remains stable
  - new contract is accepted without breaking old clients

### M03-FE-01
- Title: Define worksheet generation form UX changes
- Owner: `ui-agent` + `frontend-developer-agent`
- Primary executor: Claude
- Status: todo
- Priority: P1
- Deliverables:
  - determine if current sprint exposes assembly mode controls to users
  - if yes, define minimal form additions
- Acceptance:
  - no unnecessary UI complexity added

### M03-FE-02
- Title: Implement generation form integration updates
- Owner: `frontend-developer-agent`
- Primary executor: Copilot
- Status: todo
- Depends on: `M03-BE-01`, `M03-FE-01`
- Deliverables:
  - minimal UI changes required for new request fields
  - API request update
  - backward-compatible submit flow
- Acceptance:
  - generation still works for current default flow

### M03-QA-01
- Title: Validate generator slice
- Owner: `qa-agent`
- Primary executor: Claude or Copilot QA pass
- Status: todo
- Depends on: `M03-BE-02`, `M03-FE-02`
- Acceptance:
  - current generation remains stable
  - new request options behave as designed

---

## Recommended Sprint Order
1. `M01-BE-01`
2. `M01-FE-01`
3. `M01-BE-02` and `M01-FE-02`
4. `M01-QA-01`
5. `M02-BE-01`
6. `M02-BE-02`
7. `M02-FE-01` and `M02-FE-02`
8. `M02-QA-01`
9. `M03-BE-01`
10. `M03-BE-02`
11. `M03-FE-01` and `M03-FE-02`
12. `M03-QA-01`

## Simple Status Board

| Task ID | Module | Owner | Primary Executor | Status |
|---|---|---|---|---|
| M01-BE-01 | Auth | architect-agent + backend-developer-agent | Claude | todo |
| M01-FE-01 | Auth | ui-agent + frontend-developer-agent | Claude | todo |
| M01-BE-02 | Auth | backend-developer-agent | Copilot | todo |
| M01-FE-02 | Auth | frontend-developer-agent | Copilot | todo |
| M01-QA-01 | Auth | qa-agent | Claude/Copilot | todo |
| M02-BE-01 | Question Bank | architect-agent + backend-developer-agent | Claude | todo |
| M02-BE-02 | Question Bank | backend-developer-agent | Copilot | todo |
| M02-FE-01 | Question Bank | ui-agent + frontend-developer-agent | Claude | todo |
| M02-FE-02 | Question Bank | frontend-developer-agent | Copilot | todo |
| M02-QA-01 | Question Bank | qa-agent | Claude/Copilot | todo |
| M03-BE-01 | Generator | architect-agent + backend-developer-agent | Claude | completed |
| M03-BE-02 | Generator | backend-developer-agent | Copilot | completed |
| M03-FE-01 | Generator | ui-agent + frontend-developer-agent | Claude | todo |
| M03-FE-02 | Generator | frontend-developer-agent | Copilot | todo |
| M03-QA-01 | Generator | qa-agent | Claude/Copilot | todo |

## Prompt-Ready Assignments

### Backend prompt template
```
Module: M0X
Task ID: <task id>
Goal: implement backend slice only
Inputs: one module spec, one backend file, one test file
Partner: architect-agent for contract decisions
Output: endpoints changed, files changed, tests updated
```

### Frontend prompt template
```
Module: M0X
Task ID: <task id>
Goal: implement frontend slice only
Inputs: one module spec, one page file, one script/style file
Partner: ui-agent for UX direction
Output: UI states, files changed, backend dependencies
```

## Sprint Exit Criteria
1. M01 auth foundation is working end-to-end.
2. M02 question bank schema and backend core are available.
3. M03 generator contract is extended without breaking current flows.
4. QA has validated each completed slice.
5. Deployment guardrail evidence exists: local validation done, then dev deployment validated before any production request.

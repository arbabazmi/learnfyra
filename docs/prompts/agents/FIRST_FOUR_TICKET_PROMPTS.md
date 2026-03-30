# First Four Ticket Prompts

Purpose: Copy-paste prompts for immediate execution of the first four sprint tickets.

## 1) M01-BE-01

Use with Claude.

Agents:
- `architect-agent`
- `backend-developer-agent`

Prompt:
```
Module: M01
Task ID: M01-BE-01
Goal: define OAuth and local auth API contracts.

Inputs:
1. docs/specs/modules/M01-auth-identity-spec.md
2. backend/handlers/authHandler.js
3. docs/operations/FIRST_SPRINT_TASK_BOARD.md

Required output:
- final endpoint list for Google OAuth, second OAuth provider, local register/login/logout
- request/response schema
- JWT role claim structure
- auth error model
- implementation handoff notes for backend-developer-agent

Constraints:
- local-first
- no implementation yet unless needed for contract examples
- keep scope to M01 only
```

## 2) M01-FE-01

Use with Claude.

Agents:
- `ui-agent`
- `frontend-developer-agent`

Prompt:
```
Module: M01
Task ID: M01-FE-01
Goal: define auth UX flow and page states.

Inputs:
1. docs/specs/modules/M01-auth-identity-spec.md
2. frontend/login.html
3. docs/operations/FIRST_SPRINT_TASK_BOARD.md

Required output:
- sign-in UX flow
- OAuth button placement and messaging
- local auth fallback flow
- loading, error, success, and auth-gate states
- implementation handoff notes for frontend-developer-agent

Constraints:
- keep current product direction consistent
- do not redesign unrelated screens
- keep scope to M01 only
```

## 3) M01-BE-02

Use with Copilot.

Agent:
- `backend-developer-agent`

Prompt:
```
Module: M01
Task ID: M01-BE-02
Goal: implement auth backend foundation from approved contract.

Inputs:
1. docs/specs/modules/M01-auth-identity-spec.md
2. backend/handlers/authHandler.js
3. docs/operations/FIRST_SPRINT_TASK_BOARD.md

Required output:
- contract-aligned auth handler updates
- role claim issuance updates
- protected route support hooks if needed
- tests for login/register/logout and token validation

Constraints:
- Lambda-compatible handler pattern
- preserve CORS consistency
- no scope creep beyond M01
```

## 4) M01-FE-02

Use with Copilot.

Agent:
- `frontend-developer-agent`

Prompt:
```
Module: M01
Task ID: M01-FE-02
Goal: implement auth frontend flow from approved UX and backend contract.

Inputs:
1. docs/specs/modules/M01-auth-identity-spec.md
2. frontend/login.html
3. docs/operations/FIRST_SPRINT_TASK_BOARD.md

Required output:
- sign-in UI with Google and second provider placeholders
- local auth form and states
- auth gate UI for protected flows
- backend auth API integration

Constraints:
- preserve existing JS wiring where applicable
- align strictly to backend contract
- no unrelated UI changes
```

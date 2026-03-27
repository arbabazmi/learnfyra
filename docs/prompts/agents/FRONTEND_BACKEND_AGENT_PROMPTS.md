# Frontend and Backend Agent Prompt Pack

Use these prompts to run parallel execution with controlled scope and low token usage.

Reference board:
- `docs/operations/FIRST_SPRINT_TASK_BOARD.md`
- `docs/operations/FIRST_FOUR_TICKET_PROMPTS.md`

## 1) Backend Design + Build Prompt

Agents:
- Primary: `backend-developer-agent`
- Partner: `architect-agent`

Prompt:
```
Mode: standard
Module: <M01..M07>
Goal: implement backend slice for this module.

Step 1 (architect-agent):
- define endpoint(s), auth model, request/response contract, and error codes.

Step 2 (backend-developer-agent):
- implement handlers/middleware/services per approved contract
- add or update tests
- keep CORS and validation consistent

Input files (max 3):
- one module spec file
- one related handler file
- one related test file

Output:
- changed backend files
- endpoint contract summary
- tests updated
```

## 2) Frontend Design + Build Prompt

Agents:
- Primary: `frontend-developer-agent`
- Partner: `ui-agent`

Prompt:
```
Mode: standard
Module: <M01..M07>
Goal: implement frontend slice for this module.

Step 1 (ui-agent):
- define UX behavior, form states, and responsive expectations.

Step 2 (frontend-developer-agent):
- implement HTML/CSS/JS updates
- integrate approved backend endpoints
- preserve existing wiring IDs/classes

Input files (max 3):
- one module spec file
- one frontend page file
- one frontend script/style file

Output:
- changed frontend files
- UX decisions applied
- backend dependencies confirmed
```

## 3) Parallel Slice Prompt (Backend + Frontend)

Prompt:
```
Module: <M01..M07>
Run backend and frontend in parallel with strict contract-first flow.

Track A:
- architect-agent + backend-developer-agent
- deliver endpoint contract and backend implementation with tests

Track B:
- ui-agent + frontend-developer-agent
- deliver UX decisions and frontend implementation aligned to backend contract

Rules:
- no contract drift
- one module only
- report blockers early
```

## 4) Sprint Kickoff Prompt

Prompt:
```
Use docs/operations/FRONTEND_BACKEND_DISTRIBUTION.md as execution policy.
Select one module from docs/specs/modules/.
Create two parallel work items:
1) backend contract + implementation
2) frontend UX + integration
Return:
- owners
- files
- acceptance criteria mapping
- expected test coverage
```

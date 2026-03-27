# Frontend and Backend Agent Distribution

Purpose: Define how work is split between frontend and backend developer agents, and how they collaborate with UI/UX and architecture agents.

## Team Lanes

### Frontend Lane
- Lead: `frontend-developer-agent`
- Design partner: `ui-agent`
- Core responsibilities:
  - page flows and interaction behavior
  - responsive implementation
  - form/validation/loading/error states
  - integration with approved APIs

### Backend Lane
- Lead: `backend-developer-agent`
- Design partner: `architect-agent`
- Core responsibilities:
  - endpoint and handler development
  - auth and authorization implementation
  - request/response validation and contracts
  - storage and service logic

## Decision Ownership Matrix

| Decision Area | Primary Owner | Required Partner |
|---|---|---|
| UX layout and visual system | ui-agent | frontend-developer-agent |
| Frontend interaction behavior | frontend-developer-agent | ui-agent |
| API endpoint shape | architect-agent | backend-developer-agent |
| Auth flow and role permissions | architect-agent | backend-developer-agent |
| Handler and middleware code | backend-developer-agent | architect-agent |
| Frontend API consumption | frontend-developer-agent | backend-developer-agent |

## Build Workflow Per Slice
1. BA defines requirements for one module slice.
2. Architect defines API/auth contract.
3. Backend implements endpoints and tests.
4. UI defines UX behavior and visuals.
5. Frontend implements UI and API integration.
6. QA validates full slice.

## Handoff Rules
1. Backend must publish endpoint contract before frontend starts integration.
2. Frontend must report integration gaps as contract issues, not ad hoc changes.
3. Any API contract change requires a synchronized backend + frontend update.

## Done Criteria
1. Contract approved (architect + backend).
2. UX behavior approved (ui + frontend).
3. Backend tests pass.
4. Frontend flow tested against endpoint responses.
5. QA signs off slice.

## Starter Board
- First sprint task board: `docs/operations/FIRST_SPRINT_TASK_BOARD.md`

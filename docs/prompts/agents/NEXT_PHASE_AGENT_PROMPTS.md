# Next Phase Agent Prompts

Use these prompts directly in Claude Code. Each prompt supports a mode to avoid overkill.

Modes:
- `lite` = shortest useful output
- `standard` = default balance
- `deep` = full detail

Use `standard` by default.

## 0) Full Folder Technical Refresh (Recommended First Run)

Agent: `program-orchestrator-agent`

Prompt:
```
Mode: standard
Refresh the complete docs folder technical status package.

Update these files as source-of-truth:
1) docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md
2) docs/operations/NEXT_PHASE_EXECUTION_BACKLOG.md
3) docs/operations/NEXT_PHASE_AGENT_PROMPTS.md

Required output coverage:
- full workflow catalog
- architecture baseline
- completed vs pending matrix per module
- technologies inventory (runtime, backend, frontend, data, testing, infra)
- risk matrix and go/no-go gates
- P0/P1/P2 backlog with owner and test mapping

Do not over-document. Keep it execution-ready.
```

## 1) Program Orchestrator Agent

Agent: `program-orchestrator-agent`

Prompt:
```
Mode: standard
Prepare the complete next-phase package for Learnfyra.

Deliver and update these files:
1) docs/operations/planning/NEXT_PHASE_MASTER_DOSSIER.md
2) docs/operations/NEXT_PHASE_EXECUTION_BACKLOG.md
3) docs/operations/NEXT_PHASE_AGENT_PROMPTS.md

Include:
- done/partial/pending/blocked status
- normalized requirements
- architecture and contracts
- P0/P1/P2 backlog with owners
- acceptance criteria to test mapping
- go/no-go checklist

Keep it actionable and avoid over-documenting.
```

Variant for full technical audit:
```
Mode: deep
Produce a technical audit view for all active streams and include:
- code evidence summary
- docs evidence summary
- workflow health score per stream
- pending implementation and pending deployment split
```

## 2) BA Agent

Agent: `ba-agent`

Prompt:
```
Mode: standard
Normalize requirements for this feature slice:
[paste spec path(s)]

Deliver:
- user stories
- Given/When/Then acceptance criteria
- in-scope/out-of-scope
- dependencies
- open questions

Keep requirements testable and implementation-ready.
```

## 3) Architect Agent

Agent: `architect-agent`

Prompt:
```
Mode: standard
Using BA output, produce technical design for this slice:
[feature name]

Deliver:
- API contracts
- data contracts/schema notes
- file/component plan
- risks and mitigations
- validation plan for QA
```

## 4) DEV Agent

Agent: `dev-agent`

Prompt:
```
Mode: standard
Implement this approved slice:
[slice name]

Requirements:
- list exact files before coding
- implement minimal complete change
- add/update tests
- run checks
- report changed files + why

Do not expand scope beyond this slice.
```

## 5) QA Agent

Agent: `qa-agent`

Prompt:
```
Mode: standard
Validate this slice against acceptance criteria:
[paste criteria]

Deliver:
- test mapping per criterion
- happy/error/boundary results
- regression risks
- pass/fail decision with blockers
```

## 6) Code Reviewer Agent

Agent: `code-reviewer-agent`

Prompt:
```
Mode: standard
Review the changed files for this slice:
[paste files]

Output findings by severity:
- critical
- warnings
- suggestions

Prioritize correctness, security, performance, and regressions.
```

## 7) UI Agent

Agent: `ui-agent`

Prompt:
```
Mode: standard
Execute UI updates for this scope:
[page/feature]

Deliver:
- updated structure and styling decisions
- mobile + desktop behavior
- accessibility notes
- validation that JS-wired IDs/classes remain intact
```

## 8) DevOps Agent

Agent: `devops-agent`

Prompt:
```
Mode: standard
Prepare deployment readiness for completed local features:
[feature list]

Deliver:
- CI/CD changes
- env vars and secrets checklist
- rollout plan (dev -> staging -> prod)
- monitoring and rollback plan

Do not deploy unless explicitly asked.
```

## 9) Recommended Operating Rhythm
1. Run `program-orchestrator-agent` weekly or at phase start.
2. Run BA + Architect before any implementation slice.
3. Run DEV + QA + Reviewer for each slice.
4. Run UI only when UX files are in scope.
5. Run DevOps only after local completion gate passes.

## 10) Folder Update Cadence
1. Update dossier and backlog after every merged feature slice.
2. Re-run full technical refresh before sprint planning.
3. Re-run full technical refresh before any staging or production promotion.

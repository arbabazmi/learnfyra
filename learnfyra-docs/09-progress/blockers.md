# Blockers & Impediments

**Last updated: 2026-03-28**

---

## Active Blockers

### BLOCKER-001: M02 Question Bank not started
**Severity:** High
**Blocking:** M03-BE-05 (bank-first generation), M03-TEST-04

**Description:** The bank-first worksheet assembly (M03-BE-05) cannot be implemented until the Question Bank adapters (M02) are built. Currently all worksheet generations are ai-only mode.

**Impact:** Every generation calls Claude AI. No deduplication. No cost savings. No per-student repeat caps.

**Resolution path:**
1. Build `src/questionBank/localAdapter.js` (no AWS dependencies — can start immediately)
2. Build `src/questionBank/dynamoAdapter.js` (needs CDK DynamoDB table first)
3. Build `src/questionBank/index.js` (factory — depends on both adapters)
4. Add DynamoDB table CDK construct (QB-CDK-001)
5. Integrate into generator.js (M03-BE-05)

**Owner:** DEV agent
**Estimated effort:** 4-5 days

---

### BLOCKER-002: M04 Solve & Submit not started
**Severity:** Medium (solve-data.json is already being written — data is ready)
**Blocking:** M05 progress tracking (needs WorksheetAttempt records)

**Description:** The solve and submit handlers are not yet built. The frontend has no "Solve Online" capability. Students cannot solve worksheets online.

**Resolution path:**
1. Build `src/solve/scorer.js` — no dependencies, start here
2. Build `src/solve/resultBuilder.js`
3. Build `backend/handlers/solveHandler.js`
4. Build `backend/handlers/submitHandler.js`
5. Wire routes in `server.js`
6. Build `frontend/solve.html` + `js/solve.js` + `css/solve.css`

**Owner:** DEV agent + UI agent
**Estimated effort:** 3-4 days

---

### BLOCKER-003: M01 Frontend not built
**Severity:** Medium
**Blocking:** Authenticated user flows (progress, classes, assignments)

**Description:** Login, register, and auth UI pages are not built. Users cannot log in via the web interface. All testing is via API/curl with manually generated tokens.

**Resolution path:**
1. Build `frontend/login.html` + `frontend/js/auth.js` (PKCE client-side code)
2. Build `frontend/register.html`
3. Wire token storage + auto-refresh in auth.js
4. Add logout button to existing index.html

**Owner:** UI agent
**Estimated effort:** 2-3 days

---

## Resolved Blockers

### RESOLVED: AWS Resource Naming Conflict (edusheet → learnfyra)
**Resolved:** 2026-03-20
**Resolution:** Full rebrand migration runbook executed. All edusheet-* resources deleted in correct dependency order. All learnfyra-* resources deployed fresh. Zero downtime.

### RESOLVED: CloudFront Origin Access Identity for S3
**Resolved:** 2026-03-22
**Resolution:** Upgraded to OAC (Origin Access Control) from deprecated OAI. S3 bucket policy updated via CDK.

### RESOLVED: Lambda ESM Module Loading in Node.js 18
**Resolved:** 2026-03-15
**Resolution:** All handlers use `"type": "module"` ESM imports. Lambda runtime set to Node.js 18.x. esbuild bundling handles all transpilation.

---

## Risks (not yet blockers)

### RISK-001: DynamoDB Table Design Changes
**Severity:** Low
**Description:** If DynamoDB table designs change after CDK deployment, migrating existing data requires careful handling. Current mitigation: all tables are DESTROY mode on dev, making schema iteration low-risk.

### RISK-002: Anthropic API Rate Limits
**Severity:** Low (current scale)
**Description:** High traffic could hit Anthropic API rate limits. The bank-first approach (M02) is the primary mitigation — reduces Claude calls significantly. Haiku fallback available via M07 model switch.

### RISK-003: Cold Start Latency on Generate Lambda
**Severity:** Low
**Description:** The generate Lambda (1024MB) may have cold start latency of 2-4 seconds. Lazy imports and esbuild bundling minimize this. If sustained p99 cold starts > 5s, consider provisioned concurrency.

### RISK-004: Coverage Gate Failure After M02/M04 Addition
**Severity:** Low
**Description:** Adding new handler files without tests will lower coverage below 80%. Mitigation: always write tests in the same PR as new handlers.

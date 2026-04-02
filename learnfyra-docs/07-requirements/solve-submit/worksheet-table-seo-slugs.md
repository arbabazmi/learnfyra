# Feature: DynamoDB Worksheet Table + SEO-Friendly Solve URLs

**Spec Version:** 1.0
**Date:** 2026-04-01
**Author:** BA Agent
**Status:** Ready for DEV + IaC parallel work
**Related Module:** M04 — Solve and Submit
**Supersedes:** solve-data.json S3 strategy in CLAUDE.md v3.0 and DATABASE_AND_STORAGE_ARCHITECTURE.md

---

## User Stories

### Story 1 — Teacher shares a worksheet link
As a teacher,
I want the "Solve Online" link to use a human-readable URL like
`/solve/grade-3-math-multiplication-easy-a1b2c3`,
So that I can share it in emails or post it on a class board without students seeing a raw UUID.

### Story 2 — Student opens a solve link
As a student,
I want both a slug URL and a UUID URL to open the same worksheet,
So that older shared links still work after the slug feature is released.

### Story 3 — Developer / system
As a backend developer,
I want the solve and submit handlers to look up worksheet data from DynamoDB with a single key read (no S3 ListObjects),
So that latency is lower, costs are reduced, and the code is simpler.

---

## Acceptance Criteria

### AC-01 — Slug is generated and returned at generation time
Given a teacher submits a valid worksheet generation request
When POST /api/generate succeeds
Then the response body includes a `slug` field alongside the existing `id` (UUID) field
And `slug` conforms to the format `grade-{N}-{subject}-{topic}-{difficulty}-{shortId}`
Where `{shortId}` is the first 6 hex characters of the UUID (e.g., `a1b2c3`)
And `slug` is lowercase with hyphens only (no spaces, no special characters other than hyphens)
And the response also includes `solveUrl` set to `/solve/{slug}`.

### AC-02 — Worksheet data is written to DynamoDB on generation
Given a worksheet has been generated and exported
When the generate handler saves storage artifacts
Then a new item is written to the `LearnfyraWorksheets-{env}` DynamoDB table
And the item contains `worksheetId` (UUID, PK), `slug` (GSI PK), all question data with answers, and all metadata fields defined in the DynamoDB schema below
And the DynamoDB write occurs in the same handler invocation before the success response is returned
And if the DynamoDB write fails the handler returns a 500 error — the worksheet is not considered successfully generated.

### AC-03 — solve-data.json is no longer written to S3
Given the DynamoDB write succeeds
When POST /api/generate completes
Then `solve-data.json` is NOT uploaded to S3
And only the rendered artifact files (worksheet.html, answer-key.html, etc.) remain in the S3 date-prefixed key path.

### AC-04 — Solve handler resolves by UUID
Given a worksheet exists in DynamoDB
When GET /api/solve/{worksheetId} is called with the UUID
Then the handler performs a DynamoDB `GetItem` on the primary key `worksheetId`
And returns the solve payload (questions stripped of answers and explanations) within 500 ms p99 under normal load
And does not call `S3 ListObjectsV2` at any point during the request.

### AC-05 — Solve handler resolves by slug
Given a worksheet exists in DynamoDB with a slug
When GET /api/solve/{slug} is called where the path segment does not match the UUID v4 pattern
Then the handler performs a DynamoDB `Query` on the `slug-index` GSI
And returns the same solve payload as AC-04
And does not call `S3 ListObjectsV2` at any point during the request.

### AC-06 — Submit handler resolves by UUID only
Given a worksheet exists in DynamoDB
When POST /api/submit is called with a `worksheetId` UUID in the request body
Then the handler performs a DynamoDB `GetItem` on the primary key
And scores the submission using the stored authoritative answers
And does not call `S3 ListObjectsV2` at any point during the request.

### AC-07 — Backward compatibility for UUID solve URLs
Given a worksheet was generated before this feature was released (no slug exists)
When GET /api/solve/{worksheetId} is called with its UUID
Then the handler returns the worksheet solve payload correctly (UUID lookup is primary path and is unchanged in behavior).

### AC-08 — Slug uniqueness is guaranteed by construction
Given two worksheets with the same grade, subject, topic, and difficulty are generated
When their slugs are constructed
Then the slugs differ because the `{shortId}` suffix is derived from the unique UUID
And no deduplication or uniqueness check against DynamoDB is required at write time.

### AC-09 — DynamoDB TTL expires worksheet data after 7 days
Given a worksheet item is written to DynamoDB
When 7 days have elapsed since `generatedAt`
Then DynamoDB TTL deletes the item automatically
And the `ttl` attribute on the item is set to `Math.floor(generatedAt_epoch_ms / 1000) + 604800` (7 days in seconds)
And this matches the existing S3 lifecycle rule so both storage layers expire together.

### AC-10 — Local dev uses JSON file adapter (no DynamoDB required)
Given `APP_RUNTIME` is not `aws` (local development mode)
When any handler that previously read/wrote `solve-data.json` runs
Then worksheet data is read from and written to `worksheets-local/{uuid}/worksheet-record.json`
And the local adapter exposes the same interface as the DynamoDB adapter so handler code has no branching on storage type
And no real DynamoDB call is made.

### AC-11 — Slug is treated as case-insensitive on inbound requests
Given a student copies a slug URL and changes the case (e.g., `Grade-3-Math`)
When GET /api/solve/{slug} is called
Then the handler normalizes the inbound slug to lowercase before the GSI query
And the worksheet is found and returned.

### AC-12 — Invalid slug format returns 400
Given a path segment is provided that is neither a valid UUID v4 nor matches the slug pattern
When GET /api/solve/{id} is called
Then the handler returns HTTP 400 with `code: "SOLVE_INVALID_IDENTIFIER"` and CORS headers.

### AC-13 — AWS Lambda — DynamoDB table name injected via environment variable
Given the Lambda function is deployed by CDK
When the handler reads the table name
Then it reads `process.env.WORKSHEET_TABLE_NAME` — never a hardcoded string
And the CDK stack sets `WORKSHEET_TABLE_NAME` to `LearnfyraWorksheets-{env}` on each Lambda that requires worksheet access.

---

## DynamoDB Table Schema

### Table: `LearnfyraWorksheets-{env}`

**Partition Key:** `worksheetId` (String, UUID v4)
**Sort Key:** none
**TTL Attribute:** `ttl` (Number, Unix epoch seconds)

#### Attributes

| Attribute | Type | Description |
|---|---|---|
| worksheetId (PK) | String | UUID v4 — primary identifier |
| slug | String | SEO slug, e.g. `grade-3-math-multiplication-easy-a1b2c3` |
| generatedAt | String | ISO-8601 timestamp |
| ttl | Number | Unix epoch seconds — DynamoDB auto-deletes at this time |
| teacherId | String | FK to Users.userId |
| studentId | String or null | Optional student association |
| parentId | String or null | Optional parent association |
| studentKey | String or null | Composite key for repeat-cap tracking |
| grade | Number | Integer 1–10 |
| subject | String | Math, ELA, Science, Social Studies, Health |
| topic | String | Free text topic name |
| difficulty | String | Easy, Medium, Hard, Mixed |
| estimatedTime | String | e.g. "20 minutes" |
| timerSeconds | Number | e.g. 1200 |
| totalPoints | Number | Sum of all question points |
| standards | List of String | CCSS or NGSS codes |
| questionCount | Number | Number of questions (denormalized for metadata reads) |
| questions | List of Map | Full question objects including answer and explanation (see question map below) |
| repeatCapPolicy | Map | `{ effectiveCapPercent, appliedBy, sourceId }` |
| bankStats | Map | Provenance stats from assembler |
| s3BaseKey | String | S3 path prefix, e.g. `worksheets/2026/04/01/{uuid}` — used by download handler to build presigned URLs |
| formats | List of String | e.g. `["html"]` — formats exported and stored in S3 |
| includeAnswerKey | Boolean | Whether an answer-key artifact was uploaded |

#### Question Map (stored inside `questions` list attribute)

| Field | Type | Description |
|---|---|---|
| number | Number | 1-based question number |
| type | String | multiple-choice, fill-in-the-blank, short-answer, true-false, matching, show-your-work, word-problem |
| question | String | Question text |
| options | List of String | Present only for multiple-choice (exactly 4 items) |
| answer | String | Authoritative correct answer — never returned by solve endpoint |
| explanation | String | Answer explanation — never returned by solve endpoint |
| points | Number | Points value for this question |
| prompt | String | Optional — for show-your-work and word-problem types |
| pairs | List of Map | Optional — for matching type |
| leftItems | List of String | Optional — for matching type |
| rightItems | List of String | Optional — for matching type |

#### Global Secondary Indexes

**GSI 1: `slug-index`**
- Partition Key: `slug` (String)
- Projection: ALL
- Purpose: Resolve slug to full worksheet record in solve handler
- Expected read volume: equal to solve endpoint call volume
- On-demand billing — no provisioned capacity required

**GSI 2: `teacherId-index`**
- Partition Key: `teacherId` (String)
- Sort Key: `generatedAt` (String — ISO-8601 sorts lexicographically)
- Projection: KEYS_ONLY + `slug`, `grade`, `subject`, `topic`, `difficulty`, `questionCount`, `formats`, `s3BaseKey`
- Purpose: Teacher dashboard lists their generated worksheets
- Note: This GSI is future-use for the dashboard feature. Define it now so it is available without a table rebuild.

#### Capacity

- Billing mode: PAY_PER_REQUEST (on-demand) for all environments
- Prod versioning: not applicable to DynamoDB (versioning is an S3 concept)
- TTL: enabled on `ttl` attribute across all environments

---

## Slug Format Specification

### Format
```
grade-{N}-{normalizedSubject}-{normalizedTopic}-{normalizedDifficulty}-{shortId}
```

### Rules
1. All segments are lowercase.
2. Spaces and non-alphanumeric characters in subject, topic, and difficulty are replaced with hyphens.
3. Multiple consecutive hyphens are collapsed to a single hyphen.
4. Leading and trailing hyphens on any segment are stripped.
5. `{N}` is the integer grade level with no zero-padding (e.g., `3`, `10`).
6. `{shortId}` is the first 6 characters of the UUID, e.g., UUID `a1b2c3d4-...` gives shortId `a1b2c3`.
7. Maximum total slug length is 120 characters. If the constructed slug exceeds this, the `normalizedTopic` segment is truncated to fit before the `{shortId}` suffix.

### Examples
| Input | Slug |
|---|---|
| Grade 3, Math, Multiplication, Easy, UUID starts with a1b2c3 | `grade-3-math-multiplication-easy-a1b2c3` |
| Grade 10, ELA, Figurative Language, Hard, UUID starts with ff9900 | `grade-10-ela-figurative-language-hard-ff9900` |
| Grade 1, Science, Living vs Non-Living Things, Medium, UUID starts with 00cafe | `grade-1-science-living-vs-non-living-things-medium-00cafe` |
| Grade 7, Social Studies, The American Revolution, Mixed, UUID starts with 3d4e5f | `grade-7-social-studies-the-american-revolution-mixed-3d4e5f` |

### Slug Generation — New Module
A new utility `src/utils/slugBuilder.js` must be created with a single exported function:

```
buildWorksheetSlug({ grade, subject, topic, difficulty, uuid }) → string
```

This function is called by `generateHandler.js` after the UUID is created, before the DynamoDB write.

---

## API Changes

### POST /api/generate — Response additions

The existing success response body gains two new fields. All existing fields are preserved unchanged.

```json
{
  "success": true,
  "worksheetKey": "worksheets/2026/04/01/{uuid}/worksheet.html",
  "answerKeyKey": "worksheets/2026/04/01/{uuid}/answer-key.html",
  "metadata": {
    "id": "{uuid}",
    "slug": "grade-3-math-multiplication-easy-a1b2c3",
    "solveUrl": "/solve/grade-3-math-multiplication-easy-a1b2c3",
    "generatedAt": "...",
    "..."
  }
}
```

Note: `metadata.solveUrl` previously resolved to `/solve/{uuid}`. After this feature it resolves to `/solve/{slug}`. UUID-based solve URLs continue to work (see AC-07).

### GET /api/solve/{id} — Extended identifier acceptance

The path parameter `{id}` now accepts either:
- A UUID v4 string (existing behavior, primary path — DynamoDB GetItem)
- A slug string matching pattern `grade-{N}-{subject}-{topic}-{difficulty}-{shortId}` (new — DynamoDB GSI Query)

The handler detects which form was received using the existing UUID regex. If the input does not match the UUID regex, it is treated as a slug.

Slug validation pattern (applied before the GSI query):
```
/^grade-\d{1,2}-[a-z0-9][a-z0-9\-]{0,110}[a-z0-9]-[0-9a-f]{6}$/
```

Any input that matches neither the UUID pattern nor the slug pattern returns HTTP 400 with `code: "SOLVE_INVALID_IDENTIFIER"`.

### POST /api/submit — No request schema changes

The submit handler still accepts `worksheetId` as a UUID v4 in the request body. Slug-based submission is out of scope. The internal data source changes from S3 `solve-data.json` to DynamoDB, but the external API contract is unchanged.

---

## What Gets Removed

| Item | Current Location | Action |
|---|---|---|
| `solve-data.json` upload in `generateHandler.js` | `backend/handlers/generateHandler.js` lines 532–555 | Remove the `uploadJsonToS3(solveDataKey, solveData)` call and the `uploadJsonToS3` helper if it has no other callers |
| `ListObjectsV2Command` import in `solveHandler.js` | `backend/handlers/solveHandler.js` line 13 | Remove import and the `fetchFromS3` function body that calls `ListObjectsV2` |
| `ListObjectsV2Command` import in `submitHandler.js` | `backend/handlers/submitHandler.js` line 13 | Same removal |
| `fetchFromS3` function in `solveHandler.js` | Lines 31–59 | Replace entirely with a DynamoDB GetItem or GSI Query call |
| `fetchFromS3` function in `submitHandler.js` | Lines 31–58 | Replace entirely with a DynamoDB GetItem call |
| `worksheets-local/{uuid}/solve-data.json` local file writes | `server.js` or any local handler that writes `solve-data.json` | Replace with write to `worksheets-local/{uuid}/worksheet-record.json` |
| `solve-data.json` reads in local dev path of both handlers | `solveHandler.js` line 180, `submitHandler.js` line 228 | Replace with read from `worksheets-local/{uuid}/worksheet-record.json` |

---

## What Stays

| Item | Reason |
|---|---|
| `worksheet.html` in S3 | Rendered artifact — used by download handler for presigned URL delivery |
| `answer-key.html` in S3 | Rendered artifact — teacher download only |
| `worksheet.pdf` and `worksheet.docx` in S3 | Rendered artifacts if generated |
| `answer-key.pdf` and `answer-key.docx` in S3 | Rendered artifacts if generated |
| `metadata.json` in S3 | Lightweight sidecar used by download and list handlers — no change needed now. Open question on deprecation noted below |
| S3 date-prefixed key structure `worksheets/{year}/{month}/{day}/{uuid}/` | Unchanged — all artifact files keep this path |
| S3 7-day lifecycle rule on `worksheets/` prefix | Unchanged — artifact files still expire |
| UUID as the primary worksheet identifier in submit request body | Unchanged — submit API contract is stable |
| `src/solve/scorer.js` and `src/solve/resultBuilder.js` | Scoring logic is independent of storage layer — no changes required |
| `toPublicQuestion` whitelist in `solveHandler.js` | Answer-stripping logic is unchanged |
| CORS headers on all handler responses | Unchanged |
| Lambda handler response shape `{ statusCode, headers, body }` | Unchanged |
| `context.callbackWaitsForEmptyEventLoop = false` | Unchanged |

---

## Backward Compatibility

| Scenario | Behavior |
|---|---|
| GET /api/solve/{uuid} with UUID from a worksheet generated before this feature | Handled: UUID is the primary DynamoDB key — GetItem works regardless of whether a slug exists |
| GET /api/solve/{uuid} where the item was generated before DynamoDB (S3 only) | Returns 404 — old S3-only worksheets do not have DynamoDB records. This is acceptable: those worksheets expire within 7 days of generation under the existing lifecycle rule |
| POST /api/submit with UUID from before this feature | Same as above — 404 for pre-migration worksheets, handled gracefully |
| Existing test files that mock `fetchFromS3` / `ListObjectsV2Command` | Those mocks must be updated to mock `DynamoDBDocumentClient` instead — see test impact below |

---

## AWS Services Involved

| Service | Usage | Notes |
|---|---|---|
| DynamoDB | New table `LearnfyraWorksheets-{env}` | On-demand billing; TTL enabled; `slug-index` GSI; `teacherId-index` GSI |
| DynamoDB DocumentClient | Handler-level SDK | Use `@aws-sdk/lib-dynamodb` `DynamoDBDocumentClient` — simpler marshaling than raw `DynamoDBClient` |
| S3 (worksheets bucket) | Artifact storage only — `solve-data.json` is removed | No new S3 operations are added |
| Lambda — `learnfyra-generate` | Adds DynamoDB PutItem + slug generation | Memory stays 1024 MB; timeout stays 60 s |
| Lambda — `learnfyra-solve` | Replaces S3 ListObjects+GetObject with DynamoDB GetItem or GSI Query | Expected p99 latency drops from ~300–800 ms to ~10–50 ms |
| Lambda — `learnfyra-submit` | Replaces S3 ListObjects+GetObject with DynamoDB GetItem | Same latency improvement |
| CDK Stack | New DynamoDB construct; `WORKSHEET_TABLE_NAME` env var injected into generate, solve, and submit Lambdas; DynamoDB table IAM grants added to all three | IaC agent works in parallel with DEV agent |
| Secrets Manager / SSM | No changes | API key loading is unaffected |
| CloudFront | No changes | Slug URLs are handled by the existing routing rules |

### IAM Permissions Required (CDK grants)
- `learnfyra-generate`: `dynamodb:PutItem` on `LearnfyraWorksheets-{env}`
- `learnfyra-solve`: `dynamodb:GetItem`, `dynamodb:Query` on `LearnfyraWorksheets-{env}` and its GSIs
- `learnfyra-submit`: `dynamodb:GetItem` on `LearnfyraWorksheets-{env}`

---

## Files to Create

| File | Purpose |
|---|---|
| `src/utils/slugBuilder.js` | `buildWorksheetSlug({ grade, subject, topic, difficulty, uuid })` — pure function, no AWS dependencies |
| `src/db/worksheetTableAdapter.js` | DynamoDB adapter for worksheet records: `putWorksheet(record)`, `getWorksheetById(uuid)`, `getWorksheetBySlug(slug)` |
| `src/db/worksheetLocalAdapter.js` | Local JSON file adapter implementing the same interface as `worksheetTableAdapter.js` |
| `tests/unit/slugBuilder.test.js` | Unit tests for all slug normalization rules and boundary cases |
| `tests/unit/worksheetTableAdapter.test.js` | Unit tests for adapter with mocked DynamoDB DocumentClient |

## Files to Modify

| File | Change Summary |
|---|---|
| `backend/handlers/generateHandler.js` | (1) Import `buildWorksheetSlug` and `worksheetTableAdapter`; (2) Build slug after UUID creation; (3) Replace `uploadJsonToS3(solveDataKey, solveData)` with `worksheetTableAdapter.putWorksheet(record)`; (4) Add `slug` and updated `solveUrl` to the metadata response object |
| `backend/handlers/solveHandler.js` | (1) Replace `fetchFromS3` with calls to `worksheetTableAdapter`; (2) Add slug pattern detection and GSI query path; (3) Update `WORKSHEET_ID_REGEX` validation gate to also pass slugs to the slug path; (4) Remove `ListObjectsV2Command` import |
| `backend/handlers/submitHandler.js` | (1) Replace `fetchFromS3` with `worksheetTableAdapter.getWorksheetById(worksheetId)`; (2) Remove `ListObjectsV2Command` import |
| `tests/unit/solveHandler.test.js` | Replace `S3Client` / `ListObjectsV2Command` mocks with `DynamoDBDocumentClient` mocks |
| `tests/unit/submitHandler.test.js` | Same mock replacement as solve handler tests |
| `tests/integration/solve.test.js` | Update generate → solve → submit flow to assert `slug` in generate response and to exercise slug-based solve URL |
| `infra/lib/learnfyra-stack.ts` (or constructs) | Add DynamoDB table construct, GSIs, TTL, IAM grants, `WORKSHEET_TABLE_NAME` env var on three Lambdas |

---

## Out of Scope

1. **Vanity slug customization** — teachers cannot edit or choose their own slug. Slugs are always auto-generated from worksheet metadata.
2. **Slug collision resolution** — because `{shortId}` derives from the UUID, true collisions are astronomically unlikely. No deduplication query is required.
3. **Slug-based submit** — POST /api/submit continues to accept UUID only in the request body. Students arrive at the solve page via the slug URL but the solve page renders the UUID into the form for submission.
4. **Migration of pre-existing worksheets** — worksheets generated before this feature was deployed are not back-filled into DynamoDB. They expire via the existing S3 lifecycle rule within 7 days.
5. **DynamoDB Streams or CDC** — no change data capture is needed for this feature.
6. **Full-text search on topic** — the `slug-index` GSI supports exact slug lookup only. Fuzzy or substring search is not in scope.
7. **Analytics or aggregation on the worksheet table** — the `teacherId-index` GSI is defined now but its consuming endpoint (teacher dashboard worksheet list) is a separate feature.
8. **Soft delete or archive of worksheet records** — TTL handles expiry. No `isDeleted` flag is introduced.
9. **Rate limiting on slug-based solve URLs** — existing API Gateway throttling applies. No new limits are defined here.
10. **Changing the S3 key structure** — the date-prefixed key path is unchanged. `s3BaseKey` stored in DynamoDB allows the download handler to reconstruct artifact paths without a ListObjects call (but updating the download handler to use this field is a separate optimization task).

---

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| M04-solve-submit-spec.md | Upstream spec | This feature amends M04. The scoring contract and answer-stripping rules in M04 are unchanged. |
| `src/db/index.js` and existing adapter pattern | Existing code | The new `worksheetTableAdapter` follows the same adapter factory pattern used by `dynamoAdapter.js` and `localAdapter.js` |
| `@aws-sdk/lib-dynamodb` | New npm dependency | Must be added to `package.json`. Check whether it is already a transitive dependency via another handler — if so, confirm the version. |
| `aws-sdk-client-mock` | Existing test dependency | Used by QA agent to mock `DynamoDBDocumentClient` in unit tests |
| CDK construct for DynamoDB | IaC dependency | DEV can build and test handler code locally using the local adapter without waiting for CDK. IaC and DEV work in parallel. |
| `src/utils/slugBuilder.js` | New utility | Must be created before modifying `generateHandler.js` |

---

## Open Questions

| # | Question | Impact if Unresolved | Suggested Default |
|---|---|---|---|
| OQ-01 | Should `metadata.json` in S3 be deprecated now or in a follow-on ticket? It duplicates some of what is now in DynamoDB. | Low — it currently does not block anything. The download handler may still read it. | Deprecate in a follow-on ticket; do not remove in this feature. |
| OQ-02 | Should the solve page (frontend) display the slug URL in the browser address bar and use it for the page `<title>` and `<meta>` tags? | SEO and shareability benefit depends on this being implemented in `solve.html` / `solve.js`. | Yes — the UI agent should update `solve.html` to push the slug URL via `history.replaceState` if the page was opened with a UUID URL. This is a UI task, not a backend task. |
| OQ-03 | Should the submit handler also accept a `slug` in the request body as an alternative to `worksheetId` (UUID)? | If yes, adds a GSI lookup in the submit path. If no, the frontend must always resolve slug to UUID before submitting. | No — the solve handler returns the UUID in its response payload; the frontend uses the UUID for submission. This keeps the submit path simple and avoids a second GSI lookup. |
| OQ-04 | Is `@aws-sdk/lib-dynamodb` already present in the project's `package.json` as a direct or peer dependency? | If it is absent the IaC and CI/CD agents must account for the new dependency in their steps. | DEV agent must check `package.json` before implementing and add it if absent. |
| OQ-05 | What is the DynamoDB table's provisioned vs on-demand billing mode for prod? | Cost and scaling decision. | On-demand (PAY_PER_REQUEST) for all environments. Revisit if read/write volume exceeds 1 million requests/day. |
| OQ-06 | Should `teacherId-index` GSI projection be ALL or KEYS_ONLY + selected attributes? | ALL doubles storage cost but simplifies future dashboard queries. KEYS_ONLY + attributes is cheaper but requires explicit projection list maintenance. | KEYS_ONLY + selected metadata attributes as listed in the schema above. Questions list is excluded from the projection. |
| OQ-07 | Does the solve handler need to support slugs for the local dev (non-AWS) path, or only UUID-based lookup? | If local dev only supports UUID, it is simpler but inconsistent with production. | Support both in local dev — the local JSON adapter can scan `worksheets-local/` directories and match on the `slug` field in `worksheet-record.json`. |

---

## Test Boundary Cases (for QA Agent)

The following cases must be covered by unit and integration tests:

| Case | Handler/Module | Expected Behavior |
|---|---|---|
| Grade 1 worksheet, 5 questions | slugBuilder, generateHandler | Slug `grade-1-{subject}-{topic}-{difficulty}-{shortId}` generated correctly |
| Grade 10 worksheet, 30 questions | slugBuilder, generateHandler | Slug `grade-10-...` with no zero-padding |
| Topic with spaces: "The American Revolution" | slugBuilder | Normalizes to `the-american-revolution` |
| Topic with special characters: "Living vs. Non-Living!" | slugBuilder | Normalizes to `living-vs-non-living` |
| Topic that would produce a slug over 120 chars | slugBuilder | Topic segment is truncated; `{shortId}` suffix is preserved intact |
| GET /api/solve/{uuid} — UUID path | solveHandler | DynamoDB GetItem called; ListObjectsV2 never called |
| GET /api/solve/{slug} — slug path | solveHandler | DynamoDB Query on slug-index GSI called; UUID regex does not match slug |
| GET /api/solve/{slug} with mixed case | solveHandler | Normalized to lowercase before GSI query; worksheet returned |
| GET /api/solve/{slug} — slug not found in GSI | solveHandler | Returns 404 with `code: "SOLVE_NOT_FOUND"` |
| GET /api/solve/not-a-valid-format | solveHandler | Returns 400 with `code: "SOLVE_INVALID_IDENTIFIER"` |
| POST /api/submit with UUID — DynamoDB path | submitHandler | DynamoDB GetItem called; ListObjectsV2 never called |
| POST /api/generate — DynamoDB PutItem fails | generateHandler | Returns 500; no success response returned |
| OPTIONS preflight on all three endpoints | generateHandler, solveHandler, submitHandler | Returns 200 with CORS headers |
| worksheetId UUID not found in DynamoDB | submitHandler | Returns 404 with `code: "SUBMIT_NOT_FOUND"` |
| Local dev — slug lookup in filesystem adapter | worksheetLocalAdapter | Scans `worksheets-local/` and matches `slug` field in `worksheet-record.json` |

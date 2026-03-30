# M03: Worksheet Generator Spec
Status: implementation-ready contract
Priority: P0
Owner: Generator Platform Team

## Purpose
Define the bank-first worksheet generation contract that:
- preserves the current POST /api/generate client contract,
- formalizes the internal assembler contract used by the handler,
- documents bank lookup -> generate-missing -> validate -> store behavior,
- introduces additive provenance metadata without breaking existing renderers or clients.

## Scope
- Bank-first worksheet assembly.
- AI generation only for uncovered question slots.
- Validation of AI-generated questions before worksheet assembly and before bank storage.
- Reuse tracking for banked questions.
- Structured worksheet JSON for exporters, solve flow, and future API consumers.
- Additive provenance and bank statistics metadata.

## Out Of Scope
- Frontend form changes.
- Exporter rendering changes.
- Solve/submit scoring contracts.
- AWS infrastructure changes.
- Breaking changes to existing POST /api/generate consumers.

## Contract Goals
1. Existing clients that send the current generate request body must continue to work unchanged.
2. Existing clients that read success, worksheetKey, answerKeyKey, and metadata from POST /api/generate must continue to work unchanged.
3. Bank-first assembly must be expressible without changing the canonical worksheet content used by exporters.
4. Provenance must be additive and ignorable by downstream consumers that do not need it.

## Public API Contract

### Endpoint
- POST /api/generate

### Request Body

Required fields:

```json
{
	"grade": 3,
	"subject": "Math",
	"topic": "Multiplication Facts (1–10)",
	"difficulty": "Medium",
	"questionCount": 10,
	"format": "PDF"
}
```

Optional fields already supported:

```json
{
	"includeAnswerKey": true,
	"studentName": "Ava Johnson",
	"worksheetDate": "2026-03-24",
	"teacherName": "Ms. Carter",
	"period": "2nd",
	"className": "Algebra Readiness"
}
```

Optional additive M03 fields reserved for bank-first/provenance behavior:

```json
{
	"generationMode": "auto",
	"provenanceLevel": "summary"
}
```

Rules:
- generationMode is optional.
- generationMode values: auto | bank-first.
- Default generationMode is auto.
- In M03, auto and bank-first resolve to the same bank-first flow.
- provenanceLevel is optional.
- provenanceLevel values: none | summary | full.
- Default provenanceLevel is summary.
- Unknown additive fields must be ignored unless and until explicitly validated in a later slice.

Validation rules preserved from the current handler:
- grade must be an integer from 1 to 10.
- subject must be one of Math, ELA, Science, Social Studies, Health.
- topic must be a non-empty string.
- difficulty must be one of Easy, Medium, Hard, Mixed.
- questionCount must be an integer from 5 to 30.
- format must be one of PDF, Word (.docx), HTML.

### Success Response

The public response shape remains backward compatible:

```json
{
	"success": true,
	"worksheetKey": "worksheets/2026/03/26/uuid/worksheet.pdf",
	"answerKeyKey": "worksheets/2026/03/26/uuid/answer-key.pdf",
	"metadata": {
		"id": "uuid-v4",
		"generatedAt": "2026-03-26T10:15:00.000Z",
		"grade": 3,
		"subject": "Math",
		"topic": "Multiplication Facts (1–10)",
		"difficulty": "Medium",
		"questionCount": 10,
		"format": "PDF",
		"bankStats": {
			"fromBank": 6,
			"generated": 4,
			"totalStored": 4
		},
		"provenanceSummary": {
			"mode": "bank-first",
			"level": "summary",
			"usedBank": true,
			"usedGeneration": true,
			"bankedQuestionIds": ["qb_101", "qb_102"],
			"generatedByModel": "claude-haiku-4-5-20251001"
		},
		"studentDetails": {
			"studentName": "Ava Johnson",
			"worksheetDate": "2026-03-24",
			"teacherName": "Ms. Carter",
			"period": "2nd",
			"className": "Algebra Readiness"
		},
		"expiresAt": "2026-04-02T10:15:00.000Z"
	}
}
```

Response rules:
- success, worksheetKey, answerKeyKey, and metadata remain required on successful responses.
- metadata.bankStats remains additive but is considered part of the stable M03 contract.
- metadata.provenanceSummary is additive and optional.
- studentDetails may be returned to the caller but must not be persisted in stored metadata artifacts.
- Full worksheet JSON is not returned by POST /api/generate; it remains an internal/export pipeline artifact.

## Internal Assembler Contract

### Function
- assembleWorksheet(options)

### Request Contract

```json
{
	"grade": 3,
	"subject": "Math",
	"topic": "Multiplication Facts (1–10)",
	"difficulty": "Medium",
	"questionCount": 10,
	"generationMode": "auto",
	"provenanceLevel": "summary"
}
```

Assembler input rules:
- grade, subject, topic, difficulty, and questionCount are required.
- generationMode and provenanceLevel are optional.
- The assembler must not require format or student detail fields.
- The assembler owns question sourcing and worksheet composition only.

### Response Contract

```json
{
	"worksheet": {
		"title": "Grade 3 Math: Multiplication Facts (1–10)",
		"grade": 3,
		"subject": "Math",
		"topic": "Multiplication Facts (1–10)",
		"difficulty": "Medium",
		"estimatedTime": "20 minutes",
		"timerSeconds": 1200,
		"instructions": "Answer each question carefully. Show your work where asked.",
		"totalPoints": 10,
		"questions": [
			{
				"number": 1,
				"type": "multiple-choice",
				"question": "What is 6 x 7?",
				"options": ["A. 36", "B. 42", "C. 48", "D. 54"],
				"answer": "B",
				"explanation": "6 x 7 = 42",
				"points": 1,
				"provenance": {
					"source": "bank",
					"questionId": "qb_101",
					"reuseRecorded": true
				}
			}
		]
	},
	"bankStats": {
		"fromBank": 6,
		"generated": 4,
		"totalStored": 4
	},
	"provenance": {
		"mode": "bank-first",
		"level": "summary",
		"selectedBankCount": 6,
		"generatedCount": 4,
		"storedGeneratedCount": 4,
		"generatedByModels": ["claude-haiku-4-5-20251001"]
	}
}
```

Assembler response rules:
- worksheet is required.
- bankStats is required.
- provenance is additive and optional for compatibility, but M03-BE-02 should populate it when requested.
- Extra fields on worksheet.questions must be safe for exporters and solve serialization to ignore.

## Bank-First Assembly Flow

1. Validate normalized request input.
2. Query the question bank using grade, subject, topic, and difficulty.
3. Randomly select up to questionCount banked questions from the candidate set.
4. Compute missingCount = questionCount - selectedBankCount.
5. If missingCount is 0, skip model generation entirely.
6. If missingCount is greater than 0, select a model based on missingCount and difficulty.
7. Generate exactly missingCount questions.
8. Validate each generated question against the canonical worksheet question schema.
9. Re-validate generated questions before storage as a defense-in-depth step.
10. Attempt addIfNotExists for every validated generated question.
11. Record reuse for every banked question used in the worksheet.
12. Merge banked and generated questions.
13. Renumber questions sequentially from 1..N.
14. Compute totalPoints, estimatedTime, and timerSeconds.
15. Return worksheet, bankStats, and requested provenance metadata.

## Model Selection Contract
- missingCount less than or equal to 5: low-cost model.
- missingCount from 6 to 15: default Claude model.
- missingCount greater than 15: premium model.
- Hard difficulty with questionCount greater than 10: premium model.

Current implementation-aligned defaults:
- LOW_COST_MODEL defaults to claude-haiku-4-5-20251001.
- CLAUDE_MODEL remains the default mid-tier model.
- PREMIUM_MODEL defaults to CLAUDE_MODEL unless explicitly configured.

## Provenance Contract

### Summary-Level Provenance
Summary-level provenance is safe to expose in handler metadata and should include:
- mode: bank-first.
- level: none | summary | full.
- usedBank: boolean.
- usedGeneration: boolean.
- bankedQuestionIds: array of question IDs actually used, when available.
- generatedByModel or generatedByModels: model identifiers used for missing-question generation.
- selectedBankCount.
- generatedCount.
- storedGeneratedCount.

### Question-Level Provenance
Question-level provenance is additive and internal by default.

Per-question provenance shape:

```json
{
	"source": "bank",
	"questionId": "qb_101",
	"reuseRecorded": true,
	"modelUsed": null,
	"storedToBank": false
}
```

Rules:
- source is required and must be bank or generated.
- questionId is required for bank-sourced questions when available.
- modelUsed is required for generated questions when available.
- storedToBank indicates whether a generated question was newly stored.
- reuseRecorded indicates whether reuse tracking was attempted for bank questions.

### Storage Rules
- solve-data.json and equivalent internal worksheet artifacts may include full question-level provenance.
- Exporters may ignore provenance fields.
- Stored metadata.json must not include student PII.
- Public handler metadata should expose summary provenance only.

## Error Model

### Public Error Response
The existing public error contract must remain valid:

```json
{
	"success": false,
	"error": "Worksheet generation failed. Please try again."
}
```

### Additive Error Codes
M03 introduces optional machine-readable codes without removing the existing error string.

```json
{
	"success": false,
	"error": "topic must be a non-empty string.",
	"code": "WG_INVALID_REQUEST"
}
```

Canonical codes:
- WG_INVALID_REQUEST: request validation failed.
- WG_BANK_LOOKUP_FAILED: question bank query failed.
- WG_GENERATION_EMPTY_RESPONSE: model returned empty content.
- WG_GENERATION_TRUNCATED: model response hit max tokens.
- WG_GENERATION_COUNT_MISMATCH: generated question count did not equal missingCount.
- WG_GENERATION_REFUSED: model refused the prompt.
- WG_VALIDATION_FAILED: generated question schema failed validation.
- WG_STORAGE_FAILED: storing generated questions failed.
- WG_EXPORT_FAILED: exporter failed.
- WG_UPLOAD_FAILED: file upload failed.

Mapping rules:
- 400 for WG_INVALID_REQUEST.
- 500 for infrastructure, storage, upload, or bank lookup failures in the current handler contract.
- Future slices may refine infrastructure failures to 502 or 503 without removing success/error semantics.

## Backward Compatibility Notes
- No existing required request fields are removed or renamed.
- No existing success response fields are removed or renamed.
- New request fields must be optional.
- New response metadata fields must be additive.
- The canonical worksheet JSON shape used by exporters remains intact; provenance is additive only.
- Existing clients that ignore metadata.bankStats and metadata.provenanceSummary must continue to function.
- Existing clients that call POST /api/generate without generationMode or provenanceLevel must receive equivalent behavior.

## Implementation Notes For M03-BE-02
- Preserve validateGenerateBody compatibility.
- Thread optional generationMode and provenanceLevel through handler -> assembler without making them required.
- Populate metadata.bankStats from assembler output.
- Add summary provenance to metadata only after confirming frontend callers ignore unknown metadata fields.
- Keep full question-level provenance inside worksheet/solve artifacts, not public response payloads.

## Acceptance Criteria
Given a valid current POST /api/generate request
When the request omits all new M03 fields
Then worksheet generation remains successful with the existing response shape.

Given enough bank inventory exists for the requested filter set
When assembly runs
Then no AI generation call is made and bankStats.generated equals 0.

Given only partial bank inventory exists
When assembly runs
Then only the missingCount questions are generated, validated, merged, and eligible for storage.

Given generated questions are used to fill uncovered slots
When the assembler stores them
Then bankStats.totalStored reflects only newly stored non-duplicate questions.

Given banked questions are used in the worksheet
When assembly completes
Then reuse recording is attempted for the selected bank question IDs.

Given provenanceLevel is summary or full
When generation succeeds
Then additive provenance metadata is available without changing the canonical worksheet content contract.

Given request validation fails
When POST /api/generate returns an error
Then the response preserves success false and error string semantics, with optional machine-readable code support.

# M02: Question Bank Spec
Status: draft
Priority: P0
Owner: Generator Platform Team

## Scope
- Store reusable questions.
- Query by curriculum metadata.
- Deduplicate and track reuse.

## Core Contract
Question fields:
- `questionId`, `grade`, `subject`, `topic`, `difficulty`, `type`
- `question`, `options?`, `answer`, `explanation`, `standards[]`
- `modelUsed`, `createdAt`, `reuseCount`

## Functional Requirements
1. Query bank before generation.
2. Support filters: grade, subject, topic, difficulty, type.
3. Prevent duplicate inserts.
4. Increment reuse count when assembled into worksheet.

## API Surface
- `GET /api/qb/questions`
- `POST /api/qb/questions`
- `GET /api/qb/questions/:id`

## Acceptance Criteria
Given matching questions exist
When generation starts
Then system reuses bank questions before generating new ones.

Given duplicate question is submitted
When save is attempted
Then duplicate is rejected or merged based on dedupe policy.

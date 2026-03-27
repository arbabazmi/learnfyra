# LearnFyra – Worksheet Generation Engine Architecture (Module 2)

## Purpose
Design a scalable, cost-efficient, and reliable Worksheet Generation Engine that:
- Supports up to 50 questions per worksheet
- Uses AI + Question Bank reuse
- Operates asynchronously to avoid API timeouts
- Produces high-quality, curriculum-aligned content

## Core Design Principle
Strict separation of concerns:
- Generator Service (Async)
- Presenter Service (Sync)

## High-Level Architecture
Client -> API Gateway -> Lambda -> DynamoDB -> Step Functions ->
[Bank Lookup -> AI Generation -> Validation -> Assembly] ->
DynamoDB + S3 -> Presenter API -> Client

## API

### Create Worksheet
POST /worksheet

Request:
{
  "grade": 5,
  "subject": "Math",
  "topics": ["Fractions"],
  "questionTypes": ["MCQ", "FILL_BLANK"],
  "totalQuestions": 50,
  "difficulty": "medium"
}

Response:
{
  "worksheetId": "uuid",
  "status": "PENDING"
}

### Get Worksheet
GET /worksheet/{id}

Response:
PENDING:
{ "status": "PENDING" }

COMPLETED:
{ "status": "COMPLETED", "downloadUrl": "s3-url" }

## Pipeline

1. Request Intake
2. Question Bank Lookup
3. AI Generation (Batch + Parallel)
4. Validation
5. Assembly
6. Store Output

## AI Generation Strategy

- Batch size: 5
- Parallel execution via Step Functions Map
- Example:
  32 questions -> 7 batches

## Data Model

### Questions Table
- questionId
- grade
- subject
- topic
- type
- difficulty
- questionText
- options
- answer
- explanation
- standard
- hash

### Worksheets Table
- worksheetId
- status
- criteria
- totalQuestions
- s3Path
- timestamps

## Constraints

- No synchronous generation beyond 5–8 questions
- Must use batching
- Must support retries per batch
- Must deduplicate questions

## AWS Services

- API Gateway
- Lambda
- Step Functions
- DynamoDB
- S3
- Bedrock (Nova, Claude)

## Final Note

Do NOT generate 50 questions in a single API call. Use async pipeline with batching.

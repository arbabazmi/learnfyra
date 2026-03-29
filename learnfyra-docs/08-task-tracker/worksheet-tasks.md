# Worksheet Tasks — M02 + M03 + M04

## M02 — Question Bank

### QB-IMPL-001: DynamoDB Table CDK Construct (TODO)

Create `LearnfyraQuestionBank-{env}` in the CDK stack.

**CDK code to add in `infra/lib/constructs/database.ts`:**
```typescript
const questionBankTable = new dynamodb.Table(this, 'QuestionBankTable', {
  tableName: `LearnfyraQuestionBank-${props.env}`,
  partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy,
  pointInTimeRecovery: isProd,
});

questionBankTable.addGlobalSecondaryIndex({
  indexName: 'GSI-1',
  partitionKey: { name: 'lookupKey', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'typeDifficulty', type: dynamodb.AttributeType.STRING },
});
```

### QB-IMPL-002: Local Adapter (TODO)

`src/questionBank/localAdapter.js`

Reads/writes JSON files in `worksheets-local/question-bank/` directory.

Key: `{grade}-{subject}-{topic}.json` (e.g., `3-math-multiplication.json`), lowercase, hyphens.

### QB-IMPL-003: DynamoDB Adapter (TODO)

`src/questionBank/dynamoAdapter.js`

Uses `@aws-sdk/client-dynamodb` with `QueryCommand` on GSI-1.

### QB-IMPL-004: Adapter Factory (TODO)

`src/questionBank/index.js`

```javascript
import { localAdapter } from './localAdapter.js';
import { dynamoAdapter } from './dynamoAdapter.js';

export const getQBAdapter = () => {
  return process.env.QB_ADAPTER === 'dynamodb' ? dynamoAdapter : localAdapter;
};
```

### QB-IMPL-005: dedupeHash (TODO)

`src/questionBank/utils.js`

```javascript
import { createHash } from 'crypto';

export function computeDedupeHash(question) {
  const normalized = [
    question.grade,
    question.subject.toLowerCase(),
    question.topic.toLowerCase(),
    question.type,
    question.question.toLowerCase().replace(/\s+/g, ' ').trim()
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}
```

---

## M03 — Worksheet Generator

### M03-BE-05: Bank-First Assembly (BLOCKED — needs M02)

Modify `src/ai/generator.js`:
1. Import QB adapter factory
2. Before Claude call: `const banked = await qb.getQuestions({grade, subject, topic, ...})`
3. Compute gap = questionCount - banked.length
4. If gap > 0: call Claude for gap questions only
5. After Claude returns: for each new question, call `qb.saveQuestion(q)` if dedupeHash is new
6. Merge banked + AI questions
7. Set `generationMode` and `provenanceLevel` on the worksheet JSON

---

## M04 — Online Solve & Submit

### M04-BE-01: solveHandler.js (TODO)

```javascript
/**
 * @file backend/handlers/solveHandler.js
 * @description Lambda handler for GET /api/solve/:worksheetId
 * Returns worksheet questions without answers or explanations
 */

import { validateWorksheetId } from '../../src/solve/worksheetIdValidator.js';
import { readSolveData } from '../../src/solve/storageAdapter.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  try {
    const worksheetId = validateWorksheetId(event.pathParameters?.worksheetId);
    const solveData = await readSolveData(worksheetId);
    // Strip answer and explanation from each question
    const sanitized = {
      ...solveData,
      questions: solveData.questions.map(({ answer, explanation, ...q }) => q)
    };
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(sanitized) };
  } catch (err) {
    const status = err.code === 'WORKSHEET_NOT_FOUND' ? 404 :
                   err.code === 'INVALID_WORKSHEET_ID' ? 400 : 500;
    return { statusCode: status, headers: corsHeaders, body: JSON.stringify({ error: err.message, code: err.code }) };
  }
};
```

### M04-BE-02: submitHandler.js (TODO)

Key implementation notes:
- Read solve-data.json (authoritative answers)
- Call scorer.scoreAnswer() per question
- Call resultBuilder.buildResult()
- If user is authenticated (event.requestContext.authorizer.userId exists): write WorksheetAttempt + update aggregates
- Return full result JSON

### M04-BE-03: scorer.js (TODO)

Implements all 7 scoring strategies. See `06-workflows/evaluation-flow.md` for the full logic.

### M04-BE-04: resultBuilder.js (TODO)

Assembles the result object from scored answers. See `02-modules/online-solving.md` for the response schema.

### M04-BE-05: worksheetIdValidator.js (TODO)

```javascript
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateWorksheetId(id) {
  if (!id || !UUID_V4_PATTERN.test(id)) {
    const err = new Error('Invalid worksheet ID');
    err.code = 'INVALID_WORKSHEET_ID';
    throw err;
  }
  return id;
}
```

### M04-BE-06: server.js Routes (TODO)

Add to `server.js`:
```javascript
import { handler as solveHandler } from './backend/handlers/solveHandler.js';
import { handler as submitHandler } from './backend/handlers/submitHandler.js';

app.get('/api/solve/:worksheetId', async (req, res) => {
  const event = {
    httpMethod: 'GET',
    pathParameters: { worksheetId: req.params.worksheetId },
    headers: req.headers,
    body: null,
    queryStringParameters: req.query
  };
  const result = await solveHandler(event, mockContext);
  res.status(result.statusCode).set(result.headers).send(result.body);
});

app.post('/api/submit', async (req, res) => {
  const event = {
    httpMethod: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
    pathParameters: null,
    queryStringParameters: null,
    requestContext: req.user ? { authorizer: req.user } : {}
  };
  const result = await submitHandler(event, mockContext);
  res.status(result.statusCode).set(result.headers).send(result.body);
});
```

### AI worksheet generation tasks (AI-1 to AI-20)

The following AI worksheet tasks track Claude prompt quality improvements. All are TODO:

| Task | Description |
|---|---|
| AI-1 | Add Bloom's taxonomy levels to prompts for difficulty calibration |
| AI-2 | Add question diversity rule (prevent same pattern repeated) |
| AI-3 | Add explanation quality rule (1-2 sentences, include reasoning) |
| AI-4 | Explicit matching question format guidance in prompt |
| AI-5 | Grade-appropriate vocabulary validation against wordlist |
| AI-6 | NGSS performance expectation codes in science prompts |
| AI-7 | C3 inquiry arc alignment for Social Studies prompts |
| AI-8 | NHES performance indicator alignment for Health prompts |
| AI-9 | Word problem context variety rule (not all "bakery" problems) |
| AI-10 | Show-your-work rubric guidance in prompts |
| AI-11 through AI-20 | Curriculum expansion: add 20 new topic combinations to topics.js |

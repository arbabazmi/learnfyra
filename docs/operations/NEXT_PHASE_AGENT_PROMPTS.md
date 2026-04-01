# Next Phase Agent Prompts: Question Bank Production Migration
**Created:** 2026-03-27  
**Purpose:** Ready-to-run prompts for each specialist agent  
**Usage:** Copy prompt → paste into agent session → agent executes task  

---

## 🔧 DEV-AGENT Prompts

### Prompt 1: Implement DynamoDB Question Bank Adapter

```
Task ID: QB-IMPL-001
Priority: P0
Estimated effort: 2-3 hours

Implement the DynamoDB adapter for the question bank following the exact interface defined in src/questionBank/localQuestionBankAdapter.js.

**Create file:** src/questionBank/dynamoQuestionBankAdapter.js

**Requirements:**
1. Implement all 6 interface methods matching the local adapter:
   - addQuestion(question)
   - addIfNotExists(candidate, question)
   - getQuestion(questionId)
   - listQuestions(filters)
   - questionExists(candidate)
   - incrementReuseCount(questionId)

2. Use AWS SDK v3 (@aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb):
   - Lazy-load DynamoDBClient and DynamoDBDocumentClient (cold start optimization)
   - Use DocumentClient for simplified reads/writes

3. Environment variables:
   - QB_TABLE_NAME (required)
   - AWS_REGION (default: us-east-1)

4. Key generation patterns:
   - questionId: randomUUID() (partition key)
   - dedupeHash: SHA256 of normalized "grade|subject|topic|type|question"
   - lookupKey: "grade#{grade}#subject#{subject}#topic#{topic}" (GSI-1 partition key)
   - typeDifficulty: "difficulty#{difficulty}#type#{type}" (GSI-1 sort key)

5. Normalization function (match local adapter):
   ```javascript
   function norm(val) {
     return typeof val === 'string' ? val.trim().toLowerCase() : '';
   }
   ```

6. Method implementations:
   - **addQuestion**: PutItemCommand with generated questionId, createdAt, dedupeHash, lookupKey, typeDifficulty
   - **addIfNotExists**: Use TransactWriteItems for atomic dedupe check + insert OR check via queryByDedupeHash then PutItem
   - **getQuestion**: GetItemCommand by questionId
   - **listQuestions**: QueryCommand on GSI-1 (QuestionLookupIndex) with lookupKey, filter results in-memory for exact match on difficulty/type/grade
   - **questionExists**: QueryCommand on GSI-1 or dedupe index by dedupeHash, return true if Count > 0
   - **incrementReuseCount**: UpdateItemCommand with ADD expression for reuseCount attribute

7. Error handling:
   - Catch DynamoDB service errors and rethrow with clear messages
   - Validate required environment variables on module load
   - Return null for not-found cases (match local adapter behavior)

**Acceptance criteria:**
- File created with all 6 methods implemented
- Uses DynamoDB SDK v3 with correct command patterns
- Lazy client initialization (no global client instance outside function scope)
- Error messages match local adapter format
- Ready for unit testing

**Reference files:**
- src/questionBank/localQuestionBankAdapter.js (interface to match)
- src/questionBank/index.js (factory that will import this adapter)
- backend/handlers/questionBankHandler.js (handler that uses the adapter)

Start implementation. Use best practices for Lambda cold start optimization and DynamoDB query patterns.
```

---

### Prompt 2: Update Adapter Factory for DynamoDB Mode

```
Task ID: QB-IMPL-002
Priority: P0
Estimated effort: 30 minutes
Dependencies: QB-IMPL-001 complete

Update the question bank adapter factory to support DynamoDB mode.

**File to update:** src/questionBank/index.js

**Changes needed:**
1. Add new branch in getQuestionBankAdapter() function for 'dynamodb' mode:
   ```javascript
   if (mode === 'dynamodb') {
     const mod = await import('./dynamoQuestionBankAdapter.js');
     _adapter = {
       addQuestion:          mod.addQuestion,
       addIfNotExists:       mod.addIfNotExists,
       getQuestion:          mod.getQuestion,
       listQuestions:        mod.listQuestions,
       questionExists:       mod.questionExists,
       incrementReuseCount:  mod.incrementReuseCount,
     };
     return _adapter;
   }
   ```

2. Validate required environment variable when mode=dynamodb:
   - Check process.env.QB_TABLE_NAME is set
   - Throw clear error if missing: "QB_TABLE_NAME environment variable is required when QB_ADAPTER=dynamodb"

3. Update error message for unsupported modes:
   - Change from: `Unknown QB_ADAPTER value: "${mode}". Supported values: local`
   - To: `Unknown QB_ADAPTER value: "${mode}". Supported values: local, dynamodb`

4. Update JSDoc comment at top of file to document 'dynamodb' mode

**Acceptance criteria:**
- Factory correctly routes to dynamoQuestionBankAdapter when QB_ADAPTER=dynamodb
- Clear error for missing QB_TABLE_NAME
- No breaking changes to existing QB_ADAPTER=local usage
- JSDoc updated with new mode

**Test:**
After changes, verify:
- QB_ADAPTER=local still works (existing behavior)
- QB_ADAPTER=dynamodb loads new adapter
- Missing QB_TABLE_NAME throws clear error

Proceed with implementation.
```

---

## 🏗️ DEVOPS-AGENT Prompts

### Prompt 1: Add DynamoDB Table to CDK Stack

```
Task ID: QB-CDK-001
Priority: P0
Estimated effort: 1-2 hours

Add DynamoDB table for question bank to the CDK stack with proper configuration for all environments.

**File to update:** infra/cdk/lib/learnfyra-stack.ts

**Implementation:**

1. Add DynamoDB table definition after S3 buckets section:
   ```typescript
   // ── DynamoDB: Question Bank ───────────────────────────────────────────
   const questionBankTable = new dynamodb.Table(this, 'QuestionBankTable', {
     tableName: `learnfyra-${appEnv}-questionbank`,
     partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
     billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
     pointInTimeRecovery: appEnv === 'prod',
     removalPolicy: appEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
   });
   ```

2. Add Global Secondary Index for filtered queries:
   ```typescript
   questionBankTable.addGlobalSecondaryIndex({
     indexName: 'QuestionLookupIndex',
     partitionKey: { name: 'lookupKey', type: dynamodb.AttributeType.STRING },
     sortKey: { name: 'typeDifficulty', type: dynamodb.AttributeType.STRING },
     projectionType: dynamodb.ProjectionType.ALL,
   });
   ```

3. Add CloudWatch alarm for throttling (production only):
   ```typescript
   if (appEnv === 'prod') {
     questionBankTable.metricUserErrors().createAlarm(this, 'QuestionBankErrorAlarm', {
       threshold: 10,
       evaluationPeriods: 2,
       alarmDescription: 'Question bank DynamoDB errors',
     });
   }
   ```

4. Apply CDK tags:
   ```typescript
   cdk.Tags.of(questionBankTable).add('Project', 'learnfyra');
   cdk.Tags.of(questionBankTable).add('Component', 'question-bank');
   ```

**Acceptance criteria:**
- Table definition added to CDK stack
- GSI-1 configured for query filtering
- Billing mode: PAY_PER_REQUEST (cost-effective at low scale)
- Point-in-time recovery enabled for prod only
- Removal policy: RETAIN for prod, DESTROY for dev/staging
- CloudWatch alarm configured for prod
- CDK tags applied

**Test:**
1. Run `cd infra && npm install` (if needed)
2. Run `npx cdk synth --context env=dev` — should pass with zero warnings
3. Run `npx cdk diff --context env=dev` — should show new DynamoDB table will be created
4. Review diff output and confirm:
   - Table name: learnfyra-dev-questionbank
   - Partition key: questionId
   - GSI present: QuestionLookupIndex
   - Billing mode: PAY_PER_REQUEST

Proceed with implementation. Do NOT deploy yet — just synth and diff.
```

---

### Prompt 2: Grant IAM Permissions and Add Environment Variables

```
Task ID: QB-CDK-002 + QB-CDK-003
Priority: P0
Estimated effort: 45 minutes
Dependencies: QB-CDK-001 complete

Grant DynamoDB permissions to Lambda functions and add required environment variables.

**File to update:** infra/cdk/lib/learnfyra-stack.ts

**Implementation:**

1. Find the generateLambda definition (search for "learnfyra-generate")

2. After questionBankTable definition, add IAM grants:
   ```typescript
   // Grant question bank access to generate Lambda
   questionBankTable.grantReadWriteData(generateLambda);
   
   // Grant question bank access to admin Lambda
   questionBankTable.grantReadWriteData(adminLambda);
   ```

3. Add environment variables to generateLambda:
   ```typescript
   generateLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
   generateLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
   ```

4. Add environment variables to adminLambda:
   ```typescript
   adminLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
   adminLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
   ```

5. Verify existing QB_ADAPTER=local in local server.js is NOT changed (local dev should remain local)

**Acceptance criteria:**
- Both Lambda functions have grantReadWriteData on questionBankTable
- Both Lambda functions have QB_ADAPTER=dynamodb environment variable
- Both Lambda functions have QB_TABLE_NAME environment variable set to table name
- IAM policies use least privilege (no admin permissions, no DeleteTable)
- Local development (server.js) still uses QB_ADAPTER=local from .env

**Test:**
1. Run `npx cdk synth --context env=dev`
2. Review CloudFormation template output (infra/cdk/cdk.out/LearnfyraStackDev.template.json)
3. Search for "QB_ADAPTER" and "QB_TABLE_NAME" — should appear in both Lambda environment sections
4. Search for IAM policy statements — should include dynamodb:PutItem, GetItem, Query, UpdateItem permissions
5. No errors or warnings in synth output

**Verification:**
After synth passes, run:
```bash
npx cdk diff --context env=dev
```

Expected output should show:
- IAM role policy changes for generate Lambda (added DynamoDB permissions)
- IAM role policy changes for admin Lambda (added DynamoDB permissions)
- Environment variable changes for both Lambdas

Proceed with implementation. Test thoroughly with synth + diff before marking complete.
```

---

### Prompt 3: Deploy to Dev Environment

```
Task ID: QB-DEPLOY-001
Priority: P0
Estimated effort: 1 hour
Dependencies: QB-IMPL-001, QB-IMPL-002, QB-CDK-001, QB-CDK-002, QB-CDK-003, QB-TEST-001 (all complete)

Deploy the question bank DynamoDB infrastructure to dev environment.

**Pre-deployment checklist:**
- [ ] All unit tests pass: `npm test`
- [ ] CDK synth passes: `cd infra && npx cdk synth --context env=dev`
- [ ] CDK diff reviewed and approved
- [ ] Code changes committed to branch: feature/question-bank-dynamodb
- [ ] Branch pushed to GitHub

**Deployment steps:**

1. Navigate to GitHub Actions: https://github.com/arbabazmi/learnfyra/actions

2. Select workflow: "Deploy Dev"

3. Click "Run workflow"
   - Branch: feature/question-bank-dynamodb
   - Confirm environment: dev

4. Monitor workflow execution:
   - Wait for "Run tests" step to complete
   - Wait for "CDK deploy" step to complete
   - Watch for CloudFormation events in AWS console (optional)

5. Verify deployment success:
   - Workflow status: green check mark
   - CloudFormation stack status: UPDATE_COMPLETE or CREATE_COMPLETE
   - No rollback events

6. Post-deployment verification (see QB-VERIFY-001 prompt):
   - Check DynamoDB table exists in AWS console
   - Check Lambda environment variables updated
   - Run smoke test

**Rollback procedure (if deployment fails):**
1. Check CloudFormation stack events for error details
2. If table creation fails, delete stack and redeploy
3. If Lambda update fails, check IAM permissions
4. Consult CloudWatch logs for detailed errors

**AWS Console checks:**
1. Navigate to DynamoDB console → Tables
2. Verify table exists: learnfyra-dev-questionbank
3. Verify GSI exists: QuestionLookupIndex
4. Navigate to Lambda console
5. Check generateLambda environment variables include:
   - QB_ADAPTER=dynamodb
   - QB_TABLE_NAME=learnfyra-dev-questionbank
6. Check adminLambda environment variables (same)

**CloudWatch logs location:**
- /aws/lambda/learnfyra-dev-lambda-generate
- /aws/lambda/learnfyra-dev-lambda-admin

Proceed with deployment. Document any issues encountered.
```

---

## 🧪 QA-AGENT Prompts

### Prompt 1: Write Unit Tests for DynamoDB Adapter

```
Task ID: QB-TEST-001
Priority: P0
Estimated effort: 2-3 hours
Dependencies: QB-IMPL-001 complete

Write comprehensive unit tests for the DynamoDB question bank adapter using aws-sdk-client-mock.

**Create file:** tests/unit/dynamoQuestionBankAdapter.test.js

**Test framework:** Jest with aws-sdk-client-mock

**Setup:**
```javascript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  process.env.QB_TABLE_NAME = 'test-questionbank';
  process.env.AWS_REGION = 'us-east-1';
});

afterEach(() => {
  delete process.env.QB_TABLE_NAME;
  delete process.env.AWS_REGION;
});
```

**Test suites required:**

1. **addQuestion()**
   - ✅ Generates questionId (UUID format)
   - ✅ Generates createdAt (ISO-8601 timestamp)
   - ✅ Generates dedupeHash (SHA256 hex string)
   - ✅ Generates lookupKey (format: "grade#N#subject#X#topic#Y")
   - ✅ Generates typeDifficulty (format: "difficulty#X#type#Y")
   - ✅ Sets reuseCount to 0 by default
   - ✅ Preserves all input question fields
   - ✅ Calls PutCommand with correct table name
   - ✅ Returns stored question object

2. **addIfNotExists()**
   - ✅ Returns { stored: null, duplicate: true } when question exists
   - ✅ Returns { stored: Object, duplicate: false } when question is new
   - ✅ Uses QueryCommand to check for duplicates by dedupeHash
   - ✅ Calls addQuestion internally when no duplicate found

3. **getQuestion()**
   - ✅ Returns question object when found
   - ✅ Returns null when not found
   - ✅ Calls GetCommand with questionId as key
   - ✅ Handles DynamoDB client errors gracefully

4. **listQuestions()**
   - ✅ Returns all questions when no filters provided
   - ✅ Filters by grade (exact match)
   - ✅ Filters by subject (case-insensitive)
   - ✅ Filters by topic (case-insensitive)
   - ✅ Filters by difficulty (case-insensitive)
   - ✅ Filters by type (case-insensitive)
   - ✅ Combines multiple filters (AND logic)
   - ✅ Uses QueryCommand on GSI-1 (QuestionLookupIndex)
   - ✅ Returns empty array when no matches

5. **questionExists()**
   - ✅ Returns true when matching question found
   - ✅ Returns false when no matching question
   - ✅ Uses dedupeHash for lookup
   - ✅ Normalizes comparison (case-insensitive, trimmed)

6. **incrementReuseCount()**
   - ✅ Returns updated question with incremented reuseCount
   - ✅ Returns null when questionId not found
   - ✅ Uses UpdateCommand with ADD expression
   - ✅ Atomic increment (no read-modify-write race condition)

**Mock patterns:**

```javascript
// Mock successful PutCommand
ddbMock.on(PutCommand).resolves({});

// Mock successful GetCommand (found)
ddbMock.on(GetCommand).resolves({
  Item: { questionId: 'test-id', question: 'What is 2+2?', ... }
});

// Mock GetCommand (not found)
ddbMock.on(GetCommand).resolves({ Item: undefined });

// Mock QueryCommand results
ddbMock.on(QueryCommand).resolves({
  Items: [{ questionId: 'q1', ... }, { questionId: 'q2', ... }],
  Count: 2
});

// Mock UpdateCommand
ddbMock.on(UpdateCommand).resolves({
  Attributes: { questionId: 'test-id', reuseCount: 5 }
});
```

**Acceptance criteria:**
- 20+ tests covering all methods
- All tests pass: `npm run test:unit -- dynamoQuestionBankAdapter.test.js`
- Code coverage ≥ 90% for dynamoQuestionBankAdapter.js
- Uses aws-sdk-client-mock correctly (no real AWS calls)
- Tests match behavior of local adapter tests (test parity)

**Reference:**
- tests/unit/localQuestionBankAdapter.test.js (if exists)
- src/questionBank/localQuestionBankAdapter.js (expected behavior)

Start implementation. Focus on test clarity and comprehensive coverage.
```

---

### Prompt 2: Execute Smoke Test in Dev Environment

```
Task ID: QB-VERIFY-001
Priority: P0
Estimated effort: 30 minutes
Dependencies: QB-DEPLOY-001 complete

Execute smoke test to verify question bank works end-to-end in dev environment.

**Smoke test procedure:**

1. **Test worksheet generation:**
   ```bash
   # Use curl or Postman to test the generate endpoint
   curl -X POST https://dev.learnfyra.app/api/generate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <VALID_TEACHER_JWT>" \
     -d '{
       "grade": 3,
       "subject": "Math",
       "topic": "Multiplication",
       "difficulty": "Medium",
       "questionCount": 10,
       "format": "pdf"
     }'
   ```

   Expected response:
   - Status: 200
   - Body contains: worksheetId, success: true, worksheetKey, answerKeyKey

2. **Verify CloudWatch logs:**
   - Navigate to CloudWatch Logs → /aws/lambda/learnfyra-dev-lambda-generate
   - Search for most recent log stream
   - Look for log line: "Using QB adapter: dynamodb"
   - Confirm no error messages related to question bank

3. **Verify DynamoDB table:**
   - Navigate to DynamoDB console → Tables → learnfyra-dev-questionbank
   - Click "Explore table items"
   - Verify questions exist:
     - questionId present (UUID format)
     - grade = 3
     - subject = "Math" or "math"
     - topic = "Multiplication" or similar
     - dedupeHash present (64-char hex string)
     - lookupKey present (format: "grade#3#subject#math#topic#multiplication")
     - reuseCount = 0 (first time stored)

4. **Test question reuse:**
   - Generate second worksheet with identical parameters (same grade/subject/topic)
   - Response should still be 200
   - Check CloudWatch logs for "fromBank" count > 0 in metadata
   - Check DynamoDB table — reuseCount should be incremented for queried questions

5. **Test question bank API:**
   ```bash
   # List questions for grade 3 Math
   curl -X GET "https://dev.learnfyra.app/api/qb/questions?grade=3&subject=Math" \
     -H "Authorization: Bearer <VALID_TEACHER_JWT>"
   ```

   Expected response:
   - Status: 200
   - Body: array of questions matching filters
   - Each question has all required fields

**Pass criteria:**
- All 5 test steps completed successfully
- No errors in CloudWatch logs
- Questions stored and retrieved from DynamoDB
- Bank-first assembly uses DynamoDB adapter correctly
- reuseCount increments on second generation

**Document findings:**
Create smoke test report in tests/reports/smoke-test-dev-YYYY-MM-DD.md with:
- Test execution timestamp
- Pass/fail status for each step
- Screenshots of CloudWatch logs and DynamoDB table
- Any issues encountered and resolution

Mark task complete when all tests pass.
```

---

### Prompt 3: Write Integration Tests for DynamoDB Adapter

```
Task ID: QB-TEST-002
Priority: P1
Estimated effort: 2 hours
Dependencies: QB-VERIFY-001 complete (smoke test passed)

Write integration tests for the full generation flow using DynamoDB adapter.

**Option A: Extend existing integration test**

File to update: tests/integration/generateFlow.test.js

Add new test suite:
```javascript
describe('Bank-first generation with DynamoDB adapter', () => {
  beforeAll(() => {
    process.env.QB_ADAPTER = 'dynamodb';
    process.env.QB_TABLE_NAME = 'test-questionbank';
  });

  afterAll(() => {
    delete process.env.QB_ADAPTER;
    delete process.env.QB_TABLE_NAME;
  });

  beforeEach(() => {
    // Mock DynamoDB SDK calls
    ddbMock.reset();
    s3Mock.reset();
  });

  it('queries DynamoDB question bank before calling AI', async () => {
    // Mock QueryCommand to return 5 banked questions
    ddbMock.on(QueryCommand).resolves({
      Items: Array.from({ length: 5 }, (_, i) => ({
        questionId: `qid-bank-${i}`,
        grade: 3,
        subject: 'Math',
        question: `Bank question ${i}`,
        // ... other fields
      })),
      Count: 5
    });

    // Mock Anthropic AI response for remaining 5 questions
    // ... (use existing mock pattern)

    const result = await handler(mockEvent, mockContext);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.metadata.bankStats.fromBank).toBe(5);
    expect(body.metadata.bankStats.generated).toBe(5);
  });

  it('stores validated AI questions to DynamoDB', async () => {
    // Mock empty bank
    ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });
    
    // Mock AI response with valid questions
    // ...

    // Mock PutCommand for storing questions
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(mockEvent, mockContext);
    
    expect(result.statusCode).toBe(200);
    expect(ddbMock.commandCalls(PutCommand).length).toBeGreaterThan(0);
  });

  it('increments reuseCount for banked questions used', async () => {
    // Mock QueryCommand returns banked questions
    // Mock UpdateCommand for reuseCount increment
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { reuseCount: 2 }
    });

    const result = await handler(mockEvent, mockContext);
    
    expect(result.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand).length).toBeGreaterThan(0);
  });
});
```

**Option B: Create new integration test file**

File to create: tests/integration/questionBankDynamodb.test.js

Focus on question bank operations in isolation:
- Store questions via addQuestion
- Query questions via listQuestions with various filters
- Check duplicates via questionExists
- Increment reuse count via incrementReuseCount
- Full flow: query empty bank → generate with AI → store to bank → query again

**Acceptance criteria:**
- Integration tests cover DynamoDB adapter code paths
- Tests use aws-sdk-client-mock (no real AWS credentials needed)
- Tests can run in CI: `npm run test:integration`
- Coverage maintained at ≥ 80%
- No test flakiness or intermittent failures

**Test execution:**
```bash
npm run test:integration
```

Expected output:
- All tests pass
- No skipped tests
- No timeout errors

Mark task complete when all integration tests pass in CI.
```

---

## 📊 CODE-REVIEWER-AGENT Prompt

### Security and Performance Review

```
Task ID: QB-REVIEW-001
Priority: P1
Estimated effort: 1 hour
Dependencies: QB-IMPL-001, QB-TEST-001 complete

Conduct security and performance review of the DynamoDB question bank adapter implementation.

**Files to review:**
- src/questionBank/dynamoQuestionBankAdapter.js
- src/questionBank/index.js (factory updates)
- infra/cdk/lib/learnfyra-stack.ts (DynamoDB table and IAM sections)

**Security review checklist:**

1. **Input validation:**
   - [ ] Adapter validates questionId format (UUID)
   - [ ] Adapter sanitizes string inputs (no DynamoDB injection risks)
   - [ ] DedupeHash generation uses cryptographic hash (SHA256)
   - [ ] No user-controlled data in table/index names

2. **IAM permissions:**
   - [ ] Lambda IAM policies use least privilege
   - [ ] No wildcard actions (dynamodb:*)
   - [ ] No DeleteTable permission granted
   - [ ] Permissions scoped to specific table ARN

3. **Data protection:**
   - [ ] Encryption at rest enabled (DynamoDB default)
   - [ ] No sensitive data logged (question content not logged in CloudWatch)
   - [ ] No API keys or credentials in code

4. **Error handling:**
   - [ ] DynamoDB errors don't leak stack traces to client
   - [ ] Clear error messages without exposing internal structure
   - [ ] No unhandled promise rejections

**Performance review checklist:**

1. **Cold start optimization:**
   - [ ] DynamoDB client lazy-loaded (not in global scope)
   - [ ] No synchronous I/O in module load
   - [ ] Minimal dependencies imported

2. **Query optimization:**
   - [ ] listQuestions uses GSI (no table scan)
   - [ ] Query partition key specified (lookupKey)
   - [ ] Filter expressions used where appropriate
   - [ ] No full table scans

3. **Cost efficiency:**
   - [ ] PAY_PER_REQUEST billing mode (appropriate for scale)
   - [ ] No unnecessary DynamoDB operations
   - [ ] Batch operations used where applicable (if any)

4. **Atomic operations:**
   - [ ] incrementReuseCount uses atomic ADD expression (no race condition)
   - [ ] addIfNotExists prevents duplicates atomically

**Review findings template:**

Create file: docs/reviews/question-bank-dynamodb-review.md

```markdown
# Question Bank DynamoDB Implementation Review
Reviewer: code-reviewer-agent
Date: 2026-03-27

## Summary
[Overall assessment: APPROVED / APPROVED WITH CONDITIONS / CHANGES REQUIRED]

## Security Findings

### Critical (must fix before deploy)
- [ ] None identified

### High (fix before staging)
- [ ] [Issue description]

### Medium (fix in next iteration)
- [ ] [Issue description]

### Low (consider for future)
- [ ] [Issue description]

## Performance Findings

### Critical (must fix before deploy)
- [ ] None identified

### High (fix before staging)
- [ ] [Issue description]

### Medium (monitor in production)
- [ ] [Issue description]

## Code Quality

### Strengths
- [What was done well]

### Recommendations
- [Suggestions for improvement]

## Approval Status
[X] APPROVED for deployment to dev
[ ] APPROVED for deployment to staging (after fixes)
[ ] APPROVED for deployment to prod (after staging verification)

## Sign-off
Reviewed by: code-reviewer-agent
Approved by: [Project Lead / Architect]
```

**Acceptance criteria:**
- Review completed for all files in scope
- All critical/high findings documented
- Recommendations provided for each finding
- Sign-off decision documented
- Review report committed to repository

**Next steps after review:**
1. If critical findings: dev-agent fixes → re-review
2. If high findings: schedule fixes before staging deploy
3. If medium/low only: approved for dev deploy, track in backlog

Proceed with review. Be thorough but pragmatic — focus on real risks, not theoretical perfection.
```

---

## 📋 BA-AGENT Prompt

### Document Migration Strategy

```
Task ID: QB-DEPLOY-002
Priority: P1
Estimated effort: 1 hour
Dependencies: QB-VERIFY-001 complete (dev smoke test passed)

Document the question bank migration strategy and operational runbook.

**Create file:** docs/runbooks/question-bank-migration.md

**Content structure:**

```markdown
# Question Bank Migration Runbook
Version: 1.0
Last Updated: 2026-03-27

## Overview
This runbook covers migration of the question bank from local JSON storage to DynamoDB.

## Current State Assessment
- Local mode (QB_ADAPTER=local): In-memory storage, data lost on Lambda restart
- Production mode (QB_ADAPTER=dynamodb): Persistent storage in DynamoDB
- Migration required: [YES / NO / TBD]

### Decision: Do we have existing question bank data to migrate?
- [ ] YES — questions exist in data-local/questions.json → proceed with migration
- [ ] NO — fresh start, no migration needed → skip to deployment section

## Pre-Migration Checklist
- [ ] Backup existing question bank data (if any)
- [ ] DynamoDB table deployed to target environment
- [ ] Lambda functions updated with QB_ADAPTER=dynamodb
- [ ] IAM permissions verified
- [ ] Smoke test passed in dev environment

## Migration Steps (if YES above)

### Step 1: Export Existing Questions
```bash
# If questions exist in local JSON file
cp data-local/questions.json backup-questions-YYYY-MM-DD.json
```

### Step 2: Transform Data Format
- Local format: flat JSON array
- DynamoDB format: requires questionId, dedupeHash, lookupKey, typeDifficulty
- Use transformation script: scripts/migrate-questions-to-dynamodb.js (to be created)

### Step 3: Bulk Import to DynamoDB
```javascript
// Pseudo-code for migration script
const AWS = require('@aws-sdk/client-dynamodb');
const questions = require('./backup-questions.json');

for (const q of questions) {
  const item = {
    questionId: randomUUID(),
    ...q,
    dedupeHash: generateDedupeHash(q),
    lookupKey: generateLookupKey(q),
    typeDifficulty: generateTypeDifficulty(q),
    createdAt: new Date().toISOString(),
  };
  await ddb.putItem({ TableName: 'learnfyra-prod-questionbank', Item: item });
}
```

### Step 4: Verify Migration
- Query DynamoDB table: item count matches source
- Spot-check 10 random questions: all fields present
- Test question bank API: GET /api/qb/questions returns results

### Step 5: Switch Lambda to DynamoDB Mode
- Update CDK: QB_ADAPTER=dynamodb
- Deploy via GitHub Actions workflow
- Monitor CloudWatch logs for "Using QB adapter: dynamodb"

## Rollback Procedure

### When to rollback:
- DynamoDB errors in CloudWatch logs
- Question bank queries failing
- Performance degradation (latency > 2s)
- Cost spike (> $50/day)

### Rollback steps:
1. Revert CDK changes:
   ```typescript
   generateLambda.addEnvironment('QB_ADAPTER', 'local');
   ```
2. Deploy rollback via CI/CD
3. Verify CloudWatch logs show "Using QB adapter: local"
4. Test generate endpoint works

### Rollback time: < 10 minutes

## Post-Migration Validation

### Functional tests:
- [ ] Generate worksheet uses DynamoDB questions
- [ ] Bank-first assembly prioritizes banked questions
- [ ] reuseCount increments on second generation
- [ ] Question bank API returns correct results

### Performance tests:
- [ ] Generate latency < 10s p95
- [ ] DynamoDB query latency < 500ms p95
- [ ] No DynamoDB throttling events in CloudWatch

### Cost monitoring:
- [ ] DynamoDB read/write units within expected range
- [ ] No unexpected AWS charges
- [ ] Set up billing alarm: alert if daily cost > $10

## Operational Procedures

### How to query question bank manually:
```bash
aws dynamodb query \
  --table-name learnfyra-prod-questionbank \
  --index-name QuestionLookupIndex \
  --key-condition-expression "lookupKey = :lk" \
  --expression-attribute-values '{":lk":{"S":"grade#3#subject#math#topic#multiplication"}}'
```

### How to manually insert a question:
Use POST /api/qb/questions endpoint with admin JWT

### How to delete a question:
Not yet implemented — requires new endpoint POST /api/qb/questions/:id/delete

## Monitoring

### CloudWatch alarms:
- DynamoDB read throttling > 10
- DynamoDB write throttling > 10
- Lambda errors > 5 in 5 minutes

### Log queries:
- Search for "QB adapter error" in /aws/lambda/learnfyra-*-lambda-generate
- Search for "DynamoDB" in logs to track operations

### Metrics to track:
- Question bank size (item count)
- Average reuseCount per question
- Query latency (DynamoDB + Lambda)
- Cost per 1000 requests

## Troubleshooting

### Issue: "QB_TABLE_NAME not set" error
- Cause: Lambda environment variable missing
- Fix: Verify CDK deployed correctly, check Lambda config in AWS console

### Issue: "AccessDeniedException" from DynamoDB
- Cause: IAM permissions not granted
- Fix: Verify CDK grantReadWriteData applied to Lambda

### Issue: Questions not found in bank
- Cause: GSI query not working or empty bank
- Fix: Check DynamoDB table items, verify lookupKey format matches query

## Contact

For assistance: [Project Lead] or [DevOps Team]
On-call rotation: [PagerDuty / Slack channel]
```

**Acceptance criteria:**
- Runbook created with all sections completed
- Migration decision documented (migrate vs fresh start)
- Rollback procedure tested in dev environment
- Operational procedures validated
- Reviewed and approved by devops-agent

**Review checklist:**
- [ ] Runbook is clear and actionable
- [ ] All commands have been tested
- [ ] Rollback time estimate is realistic
- [ ] Monitoring alarms are sufficient

Mark complete when runbook is reviewed and approved.
```

---

## 🎯 Quick Reference: Task Sequencing

### Serial execution (if working alone):
```
1. dev-agent:     QB-IMPL-001 → QB-IMPL-002 (3 hours)
2. devops-agent:  QB-CDK-001 → QB-CDK-002 → QB-CDK-003 (2 hours)
3. qa-agent:      QB-TEST-001 (3 hours)
4. devops-agent:  QB-DEPLOY-001 (1 hour)
5. qa-agent:      QB-VERIFY-001 (30 min)
6. code-reviewer: QB-REVIEW-001 (1 hour)
7. qa-agent:      QB-TEST-002 (2 hours)
8. ba-agent:      QB-DEPLOY-002 (1 hour)
9. devops-agent:  QB-DEPLOY-003 → QB-DEPLOY-004 (1.5 hours)

Total: ~15 hours serial
```

### Parallel execution (if working as team):
```
Day 1:
├─ dev-agent:     QB-IMPL-001 → QB-IMPL-002
└─ devops-agent:  QB-CDK-001 → QB-CDK-002 → QB-CDK-003

Day 2:
├─ qa-agent:      QB-TEST-001
├─ devops-agent:  QB-DEPLOY-001 (after tests pass)
└─ qa-agent:      QB-VERIFY-001 (after deploy)

Day 3:
├─ code-reviewer: QB-REVIEW-001
├─ qa-agent:      QB-TEST-002
├─ ba-agent:      QB-DEPLOY-002
└─ devops-agent:  QB-DEPLOY-003 → QB-DEPLOY-004

Total: 3 days with parallel streams
```

---

## 📝 Usage Instructions

1. **Choose your agent mode:**
   - Copy the relevant prompt section above
   - Paste into a new agent session
   - Agent executes the task independently

2. **Cross-agent coordination:**
   - Use task IDs (QB-IMPL-001, etc.) to track dependencies
   - Mark tasks DONE in NEXT_PHASE_EXECUTION_BACKLOG.md when complete
   - Update status before next agent starts dependent task

3. **Completion verification:**
   - Each prompt includes acceptance criteria
   - Each prompt includes test commands
   - Mark complete only when all criteria met

4. **Escalation:**
   - Blockers: Report to orchestrator (this agent)
   - Clarifications: Consult NEXT_PHASE_MASTER_DOSSIER.md
   - Decisions: Escalate to architect-agent or ba-agent

---

**End of Agent Prompts Document**

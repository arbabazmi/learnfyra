# Next Phase Master Dossier: Question Bank — Production Migration
**Created:** 2026-03-27  
**Scope:** Question Bank DynamoDB adapter and AWS deployment  
**Mode:** standard (balanced plan)  
**Status:** local implementation complete, production storage pending  

---

## 1) Current State Snapshot

### ✅ DONE: Local Question Bank Implementation
- **src/questionBank/localQuestionBankAdapter.js**: In-memory adapter with full interface
  - Methods: `addQuestion`, `addIfNotExists`, `getQuestion`, `listQuestions`, `questionExists`, `incrementReuseCount`
  - Dedupe logic: grade + subject + topic + type + question text (case-insensitive)
  - reuseCount tracking functional
- **src/questionBank/index.js**: Factory pattern with QB_ADAPTER environment variable
- **src/questionBank/reuseHook.js**: Post-generation hook to increment reuse counts
- **src/questionBank/errorModel.js**: Standardized error codes (QB_*)
- **backend/handlers/questionBankHandler.js**: Lambda-compatible REST API handler
  - Routes: GET/POST `/api/qb/questions`, GET `/api/qb/questions/:id`, POST `/api/qb/questions/:id/reuse`
  - Full input validation and CORS handling
- **src/ai/assembler.js**: Bank-first assembly pipeline integrated
  - Query bank → select matching questions → AI fills gaps → validate → store to bank
- **tests/unit/assembler.test.js**: 25+ tests covering bank-first flow
- **tests/integration/generateFlow.test.js**: 75 tests including bank integration paths
- **tests/integration/questionBankRoutes.test.js**: API handler integration tests
- **server.js**: Local Express routes wired for question bank API

### ⚠️ PARTIAL: Infrastructure
- **infra/cdk/**: Question bank admin Lambda defined (`learnfyra-{env}-lambda-admin`)
  - QB_ADAPTER=local environment variable set
  - NO DynamoDB table defined
  - NO IAM permissions for DynamoDB access
- **Local mode works**: Generate flow successfully uses localQuestionBankAdapter
- **Production mode blocked**: QB_ADAPTER=dynamodb not implemented, Lambda cannot access data-local/ in-memory store

### ❌ PENDING: Production Storage
- **DynamoDB adapter**: src/questionBank/dynamoQuestionBankAdapter.js not implemented
- **DynamoDB table**: No CDK table definition
- **IAM permissions**: Generate Lambda + Admin Lambda need grantReadWriteData
- **Adapter selection**: QB_ADAPTER=dynamodb branch in index.js not implemented
- **Integration tests**: DynamoDB adapter has no test coverage
- **Deployment docs**: No runbook for migrating question bank data

### 🚫 BLOCKED: None
All dependencies are met. Can proceed with DynamoDB implementation.

---

## 2) Canonical Requirements

### REQ-QB-001: Production Storage Adapter (P0)
**Status:** MISSING  
**Requirement:** System must support DynamoDB-backed question bank for production use  
**Acceptance Criteria:**
- Given QB_ADAPTER=dynamodb environment variable
- When question bank operations are invoked
- Then DynamoDB adapter is used instead of local adapter
- And all interface methods (addQuestion, getQuestion, listQuestions, questionExists, incrementReuseCount, addIfNotExists) work identically to local adapter

### REQ-QB-002: DynamoDB Table Design (P0)
**Status:** MISSING  
**Requirement:** DynamoDB table must support efficient query patterns for question bank use cases  
**Acceptance Criteria:**
- Primary key: `questionId` (partition key)
- GSI-1: `grade#subject#topic` (partition) + `difficulty#type` (sort) for filtered queries
- Supports dedupe check: query by grade+subject+topic+type+question hash
- reuseCount updates via atomic increment
- createdAt timestamp for audit

### REQ-QB-003: CDK Infrastructure (P0)
**Status:** MISSING  
**Requirement:** CDK stack must define question bank table and grant access to Lambda functions  
**Acceptance Criteria:**
- DynamoDB table `learnfyra-{env}-questionbank` created via CDK
- Generate Lambda has grantReadWriteData on table
- Admin Lambda has grantReadWriteData on table
- Table name passed via TABLE_NAME environment variable
- Billing mode: PAY_PER_REQUEST for cost efficiency at low scale
- Point-in-time recovery enabled for production

### REQ-QB-004: Adapter Interface Consistency (P0)
**Status:** DONE (local), MISSING (dynamodb)  
**Requirement:** DynamoDB adapter must match local adapter interface exactly  
**Acceptance Criteria:**
- All public methods present: addQuestion, addIfNotExists, getQuestion, listQuestions, questionExists, incrementReuseCount
- Return types and error handling match local adapter
- Tests can swap adapters via environment variable without code changes

### REQ-QB-005: Integration Test Coverage (P1)
**Status:** MISSING  
**Requirement:** DynamoDB adapter must have integration tests using DynamoDB Local or mocks  
**Acceptance Criteria:**
- Test suite exercises all adapter methods
- Dedupe logic validated
- Query filters validated (AND-ed filters)
- ReuseCount atomic increment validated
- Tests use aws-sdk-client-mock or DynamoDB Local container

---

## 3) Architecture and Contracts

### 3.1 DynamoDB Table Schema

```typescript
Table: learnfyra-{env}-questionbank

Partition Key: questionId (String)

Attributes:
  questionId:    String (UUID)
  grade:         Number (1-10)
  subject:       String (enum)
  topic:         String
  difficulty:    String (enum)
  type:          String (enum: multiple-choice, fill-in-the-blank, etc.)
  question:      String
  options:       List (optional, for multiple-choice)
  answer:        String
  explanation:   String
  standards:     List (CCSS/NGSS codes)
  modelUsed:     String (claude-sonnet-4-20250514, etc.)
  createdAt:     String (ISO-8601)
  reuseCount:    Number (default 0)
  dedupeHash:    String (SHA256 of normalized grade+subject+topic+type+question)

GSI-1: QuestionLookupIndex
  Partition Key: lookupKey (String) = "grade#{grade}#subject#{subject}#topic#{topic}"
  Sort Key:      typeDifficulty (String) = "difficulty#{difficulty}#type#{type}"
  ProjectionType: ALL
  
Purpose: Enable efficient filtered queries for bank-first assembly
Example query: grade=3, subject=Math, topic=Multiplication → returns all questions, then filter by difficulty/type in-memory
```

### 3.2 Adapter Interface Contract

```javascript
/**
 * Question Bank Adapter Interface (both local and dynamodb must implement)
 */
interface QuestionBankAdapter {
  /**
   * Add question to bank. Generates questionId and createdAt.
   * @returns {Object} Stored question with questionId + createdAt
   */
  addQuestion(question: Object): Promise<Object>

  /**
   * Atomic dedupe + insert. Checks for duplicate before adding.
   * @returns {{ stored: Object|null, duplicate: boolean }}
   */
  addIfNotExists(candidate: Object, question: Object): Promise<{ stored: Object|null, duplicate: boolean }>

  /**
   * Get question by ID.
   * @returns {Object|null}
   */
  getQuestion(questionId: string): Promise<Object|null>

  /**
   * List questions with AND-ed filters.
   * Supported filters: grade, subject, topic, difficulty, type
   * @returns {Object[]}
   */
  listQuestions(filters: Object): Promise<Object[]>

  /**
   * Check if question exists (dedupe check).
   * @returns {boolean}
   */
  questionExists(candidate: Object): Promise<boolean>

  /**
   * Increment reuseCount by 1 atomically.
   * @returns {Object|null} Updated question or null if not found
   */
  incrementReuseCount(questionId: string): Promise<Object|null>
}
```

### 3.3 Environment Variable Contract

```bash
# Local development (.env)
QB_ADAPTER=local                     # Uses localQuestionBankAdapter

# Production (Lambda environment via CDK)
QB_ADAPTER=dynamodb                  # NEW: Uses dynamoQuestionBankAdapter
QB_TABLE_NAME=learnfyra-prod-questionbank  # DynamoDB table name
AWS_REGION=us-east-1                 # AWS SDK region
```

### 3.4 CDK Integration Points

```typescript
// infra/cdk/lib/learnfyra-stack.ts changes needed

// 1. Create DynamoDB table
const questionBankTable = new dynamodb.Table(this, 'QuestionBankTable', {
  tableName: `learnfyra-${appEnv}-questionbank`,
  partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: appEnv === 'prod',
  removalPolicy: appEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// 2. Add GSI for filtered queries
questionBankTable.addGlobalSecondaryIndex({
  indexName: 'QuestionLookupIndex',
  partitionKey: { name: 'lookupKey', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'typeDifficulty', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// 3. Grant permissions to Generate Lambda
questionBankTable.grantReadWriteData(generateLambda);

// 4. Grant permissions to Admin Lambda
questionBankTable.grantReadWriteData(adminLambda);

// 5. Add environment variables
generateLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
generateLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
adminLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
adminLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
```

---

## 4) Execution Workflow (Phase-by-Phase)

### Phase 1: Design & Spec (COMPLETE)
- ✅ Define DynamoDB schema with GSI strategy
- ✅ Document adapter interface contract
- ✅ Define acceptance criteria for each adapter method
- ✅ Identify CDK changes needed

### Phase 2: DynamoDB Adapter Implementation
**Owner:** dev-agent  
**Dependencies:** Phase 1 complete  
**Deliverables:**
- src/questionBank/dynamoQuestionBankAdapter.js with full interface
- Dedupe check using dedupeHash attribute
- Query implementation using GSI-1
- Atomic reuseCount increment using UpdateExpression
- Error handling matching local adapter pattern

### Phase 3: Adapter Factory Update
**Owner:** dev-agent  
**Dependencies:** Phase 2 complete  
**Deliverables:**
- src/questionBank/index.js updated to support QB_ADAPTER=dynamodb
- Lazy import of dynamoQuestionBankAdapter
- Environment variable validation

### Phase 4: CDK Infrastructure
**Owner:** devops-agent  
**Dependencies:** Phase 2 complete  
**Deliverables:**
- DynamoDB table definition in infra/cdk/lib/learnfyra-stack.ts
- GSI-1 added for query filtering
- IAM permissions granted to generate + admin Lambda
- Environment variables added (QB_ADAPTER, QB_TABLE_NAME)
- CDK synth passes with zero warnings
- CDK diff reviewed and approved

### Phase 5: Testing
**Owner:** qa-agent  
**Dependencies:** Phase 2, 3, 4 complete  
**Deliverables:**
- tests/unit/dynamoQuestionBankAdapter.test.js using aws-sdk-client-mock
- Validate all interface methods work correctly
- Validate dedupe logic using dedupeHash
- Validate GSI query patterns
- Validate atomic increment
- Integration test using real DynamoDB Local container (optional stretch)
- All existing tests still pass with QB_ADAPTER=local

### Phase 6: Deployment & Verification
**Owner:** devops-agent  
**Dependencies:** Phase 5 complete, all tests passing  
**Deliverables:**
- Deploy to dev environment via deploy-dev.yml workflow
- Smoke test: POST /api/generate with QB_ADAPTER=dynamodb
- Verify question bank queries work in Lambda logs
- Verify DynamoDB table has questions stored
- Deploy to staging
- Smoke test staging
- Manual approval + deploy to prod

---

## 5) Backlog and Priorities

### P0 (Blocking Production Use)
1. **QB-IMPL-001**: Implement dynamoQuestionBankAdapter.js with full interface
2. **QB-CDK-001**: Add DynamoDB table to CDK stack with GSI
3. **QB-CDK-002**: Grant IAM permissions to generate + admin Lambda
4. **QB-CDK-003**: Add QB_ADAPTER=dynamodb and QB_TABLE_NAME env vars to Lambda
5. **QB-TEST-001**: Unit tests for dynamoQuestionBankAdapter using aws-sdk-client-mock

### P1 (Hardening)
6. **QB-TEST-002**: Integration test for full bank-first flow with DynamoDB adapter
7. **QB-DEPLOY-001**: Add smoke tests to deploy-dev.yml for question bank verification
8. **QB-DEPLOY-002**: Document question bank data migration strategy (if needed)
9. **QB-MONITOR-001**: Add CloudWatch alarms for DynamoDB throttling and errors

### P2 (Future Enhancements)
10. **QB-PERF-001**: Add caching layer for frequently queried questions
11. **QB-ADMIN-001**: Build admin UI for question bank management (query/edit/delete)
12. **QB-EXPORT-001**: Add bulk export/import for question bank data

---

## 6) Agent Ownership Matrix

| Component | Owner | Notes |
|---|---|---|
| DynamoDB adapter implementation | dev-agent | Core implementation |
| CDK table definition | devops-agent | Infrastructure as code |
| IAM permissions | devops-agent | Grant statements in CDK |
| Unit tests (adapter) | qa-agent | Mock DynamoDB SDK calls |
| Integration tests | qa-agent | Test full workflow |
| Deployment workflows | devops-agent | Smoke tests + rollout |
| Code review | code-reviewer-agent | Security + performance review |
| Documentation | ba-agent | Runbook + migration guide |

---

## 7) Test and QA Mapping

### Unit Test Coverage Required
- **dynamoQuestionBankAdapter.test.js**
  - ✅ addQuestion: generates questionId, createdAt, dedupeHash
  - ✅ addIfNotExists: returns duplicate=true when exists, stores when new
  - ✅ getQuestion: returns question by ID, returns null when not found
  - ✅ listQuestions: filters by grade/subject/topic/difficulty/type (AND-ed)
  - ✅ questionExists: returns true when duplicate found, false otherwise
  - ✅ incrementReuseCount: atomically increments by 1, returns updated question
  - ✅ Error handling: DynamoDB service errors propagate correctly

### Integration Test Coverage Required
- **generateFlow.test.js** (extend existing)
  - ✅ Test with QB_ADAPTER=dynamodb environment variable set
  - ✅ Verify bank-first assembly uses DynamoDB adapter
  - ✅ Verify questions stored to DynamoDB after generation
  - ✅ Verify reuseCount incremented in DynamoDB

### Smoke Test Coverage Required
- **deploy-dev.yml** (add post-deploy step)
  - ✅ POST /api/generate with valid request
  - ✅ Verify response contains worksheetId
  - ✅ Query DynamoDB table for stored questions
  - ✅ Verify reuseCount > 0 for banked questions

---

## 8) Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| DynamoDB adapter has different behavior from local adapter | HIGH | Comprehensive unit tests with parity checks; integration tests run against both adapters |
| GSI query performance degrades with large question bank | MEDIUM | Monitor query latency; add caching layer in Phase 2 if needed |
| DynamoDB costs spike with high traffic | MEDIUM | Use PAY_PER_REQUEST billing; set up cost alarms; consider provisioned throughput for prod if cost becomes issue |
| Dedupe logic fails due to hash collisions | LOW | SHA256 hash collision probability is negligible; add unique constraint validation |
| Lambda timeout on batch question inserts | LOW | Current design inserts questions one-at-a-time; batch operations not needed for MVP |
| Migration of local questions to DynamoDB | MEDIUM | Document export/import process; provide one-time migration script if data exists in local |

---

## 9) Go/No-Go Checklist

Before deploying to production, confirm:

- [ ] DynamoDB adapter fully implements QuestionBankAdapter interface
- [ ] All adapter unit tests pass (local + dynamodb)
- [ ] Integration tests pass with QB_ADAPTER=dynamodb
- [ ] CDK synth passes with zero warnings
- [ ] CDK diff reviewed and approved by devops-agent + architect-agent
- [ ] IAM permissions tested in dev environment
- [ ] Generate Lambda successfully queries and writes to DynamoDB in dev
- [ ] Question bank API handler works in dev with DynamoDB backend
- [ ] Smoke tests pass in staging
- [ ] CloudWatch alarms configured for DynamoDB throttling and errors
- [ ] Rollback plan documented (revert CDK stack, set QB_ADAPTER=local)
- [ ] Code review completed by code-reviewer-agent (security + performance)

---

## 10) Open Questions

### ❓ Q1: Data Migration Strategy
**Question:** Do we need to migrate existing questions from local JSON files to DynamoDB?  
**Impact:** If yes, need one-time migration script  
**Owner:** ba-agent  
**Deadline:** Before staging deployment  
**Status:** OPEN

### ❓ Q2: Question Bank Ownership
**Question:** Should questions be scoped to teacher (multi-tenant) or shared globally?  
**Impact:** If scoped, need teacherId in partition key  
**Owner:** architect-agent  
**Deadline:** Before DynamoDB schema finalized  
**Status:** OPEN (assumption: shared global bank for now)

### ❓ Q3: Question Versioning
**Question:** Should we track question edits as versions or allow in-place updates?  
**Impact:** If versioning, need version field + migration plan  
**Owner:** ba-agent  
**Deadline:** Phase 2 (post-MVP)  
**Status:** DEFER to Phase 2

### ❓ Q4: Bulk Operations
**Question:** Should adapter support batch insert/update operations?  
**Impact:** Performance optimization for large imports  
**Owner:** architect-agent  
**Deadline:** Phase 2 (post-MVP)  
**Status:** DEFER to Phase 2

---

## Summary

**Current Status:** Local question bank fully implemented and tested. Production DynamoDB adapter is the only blocking item.

**Next Steps:**
1. dev-agent: Implement dynamoQuestionBankAdapter.js
2. devops-agent: Add DynamoDB table to CDK stack
3. qa-agent: Write adapter unit tests using aws-sdk-client-mock
4. devops-agent: Deploy to dev and run smoke tests
5. code-reviewer-agent: Security and performance review
6. devops-agent: Deploy to staging → prod with manual approval

**Timeline Estimate (standard mode):**
- Phase 2 (Adapter): 2-3 hours
- Phase 3 (Factory): 30 minutes
- Phase 4 (CDK): 1-2 hours
- Phase 5 (Testing): 2-3 hours
- Phase 6 (Deployment): 1 hour per environment
- **Total: 8-12 hours of focused work**

**Risk Level:** LOW — well-defined scope, clear acceptance criteria, strong test coverage already in place for local implementation.

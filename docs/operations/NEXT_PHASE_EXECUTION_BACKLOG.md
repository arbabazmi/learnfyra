# Next Phase Execution Backlog: Question Bank Production Migration
**Created:** 2026-03-27  
**Sprint Focus:** DynamoDB adapter + CDK infrastructure + deployment  
**Estimated Effort:** 8-12 hours total  

---

## Sprint Goal
Enable question bank to work in AWS production environment by implementing DynamoDB adapter, deploying infrastructure, and verifying end-to-end functionality.

---

## P0: Blocking Production (Must Complete)

### QB-IMPL-001: Implement DynamoDB Question Bank Adapter
**Owner:** dev-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 2-3 hours  
**Dependencies:** None  

**Acceptance Criteria:**
- [ ] File created: `src/questionBank/dynamoQuestionBankAdapter.js`
- [ ] All interface methods implemented:
  - [ ] `addQuestion(question)` → stores to DynamoDB with generated questionId, createdAt, dedupeHash
  - [ ] `addIfNotExists(candidate, question)` → atomic dedupe check + insert via TransactWriteItems
  - [ ] `getQuestion(questionId)` → GetItem by questionId
  - [ ] `listQuestions(filters)` → Query using GSI-1 with grade#subject#topic + filter results
  - [ ] `questionExists(candidate)` → Query by dedupeHash
  - [ ] `incrementReuseCount(questionId)` → UpdateItem with ADD expression
- [ ] DedupeHash generation: SHA256 of normalized `grade|subject|topic|type|question`
- [ ] LookupKey generation: `grade#{grade}#subject#{subject}#topic#{topic}`
- [ ] TypeDifficulty generation: `difficulty#{difficulty}#type#{type}`
- [ ] Error handling matches local adapter pattern
- [ ] Environment variables used: `QB_TABLE_NAME`, `AWS_REGION`
- [ ] Lazy loading pattern for DynamoDB client (cold start optimization)

**Definition of Done:**
- Implementation complete with all 6 methods
- Code follows Lambda-compatible patterns (lazy imports, no global state)
- Error messages match local adapter format
- Ready for unit testing

---

### QB-IMPL-002: Update Adapter Factory for DynamoDB Mode
**Owner:** dev-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 30 minutes  
**Dependencies:** QB-IMPL-001  

**Acceptance Criteria:**
- [ ] File updated: `src/questionBank/index.js`
- [ ] Add branch for `QB_ADAPTER=dynamodb`:
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
- [ ] Validate required environment variables when mode=dynamodb:
  - [ ] Throw clear error if QB_TABLE_NAME is missing
- [ ] Update error message for unsupported modes to include `dynamodb`

**Definition of Done:**
- Factory correctly routes to dynamoQuestionBankAdapter when QB_ADAPTER=dynamodb
- Clear error messages for missing configuration
- No breaking changes to existing local adapter usage

---

### QB-CDK-001: Add DynamoDB Table to CDK Stack
**Owner:** devops-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 1-2 hours  
**Dependencies:** None  

**Acceptance Criteria:**
- [ ] File updated: `infra/cdk/lib/learnfyra-stack.ts`
- [ ] DynamoDB Table resource created:
  ```typescript
  const questionBankTable = new dynamodb.Table(this, 'QuestionBankTable', {
    tableName: `learnfyra-${appEnv}-questionbank`,
    partitionKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecovery: appEnv === 'prod',
    removalPolicy: appEnv === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  });
  ```
- [ ] GSI-1 added:
  ```typescript
  questionBankTable.addGlobalSecondaryIndex({
    indexName: 'QuestionLookupIndex',
    partitionKey: { name: 'lookupKey', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'typeDifficulty', type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL,
  });
  ```
- [ ] Tags applied: `Project=learnfyra`, `Env=${appEnv}`, `ManagedBy=cdk`
- [ ] CDK tags helper applied to table resource
- [ ] CloudWatch alarm for read/write throttling events (prod only)

**Definition of Done:**
- `npx cdk synth` passes with zero warnings
- `npx cdk diff --context env=dev` shows table will be created
- Table schema matches design in NEXT_PHASE_MASTER_DOSSIER.md

---

### QB-CDK-002: Grant Question Bank IAM Permissions to Lambdas
**Owner:** devops-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 30 minutes  
**Dependencies:** QB-CDK-001  

**Acceptance Criteria:**
- [ ] Generate Lambda permissions:
  ```typescript
  questionBankTable.grantReadWriteData(generateLambda);
  ```
- [ ] Admin Lambda permissions:
  ```typescript
  questionBankTable.grantReadWriteData(adminLambda);
  ```
- [ ] CDK synth validates IAM policies are correct
- [ ] Least privilege principle: only ReadWriteData, no table management permissions

**Definition of Done:**
- IAM policies attached to both Lambda execution roles
- CDK synth shows correct IAM policy statements
- No overly permissive wildcard actions

---

### QB-CDK-003: Add Environment Variables to Lambdas
**Owner:** devops-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 15 minutes  
**Dependencies:** QB-CDK-001  

**Acceptance Criteria:**
- [ ] Generate Lambda environment updated:
  ```typescript
  generateLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
  generateLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
  ```
- [ ] Admin Lambda environment updated:
  ```typescript
  adminLambda.addEnvironment('QB_ADAPTER', 'dynamodb');
  adminLambda.addEnvironment('QB_TABLE_NAME', questionBankTable.tableName);
  ```
- [ ] Verify QB_ADAPTER=local remains in local server.js for dev mode

**Definition of Done:**
- Environment variables visible in CDK synth output
- Lambda functions will receive correct table name at runtime
- Local development unaffected (still uses QB_ADAPTER=local from .env)

---

### QB-TEST-001: Unit Tests for DynamoDB Adapter
**Owner:** qa-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 2-3 hours  
**Dependencies:** QB-IMPL-001, QB-IMPL-002  

**Acceptance Criteria:**
- [ ] File created: `tests/unit/dynamoQuestionBankAdapter.test.js`
- [ ] Use `aws-sdk-client-mock` to mock DynamoDB client
- [ ] Test coverage for all methods:
  - [ ] `addQuestion`: mocks PutItemCommand, verifies questionId/createdAt/dedupeHash generated
  - [ ] `addIfNotExists`: mocks QueryCommand (dedupe check) + TransactWriteItems (insert)
  - [ ] `getQuestion`: mocks GetItemCommand, tests found + not found cases
  - [ ] `listQuestions`: mocks QueryCommand on GSI-1, validates filter logic
  - [ ] `questionExists`: mocks QueryCommand by dedupeHash, tests true/false cases
  - [ ] `incrementReuseCount`: mocks UpdateItemCommand, validates ADD expression
- [ ] Test error handling: DynamoDB service errors propagate correctly
- [ ] Test environment validation: missing QB_TABLE_NAME throws clear error
- [ ] All tests pass: `npm run test:unit -- dynamoQuestionBankAdapter.test.js`

**Definition of Done:**
- 20+ tests covering all adapter methods
- Code coverage ≥ 90% for dynamoQuestionBankAdapter.js
- Tests use correct DynamoDB SDK v3 syntax (@aws-sdk/client-dynamodb)
- No actual AWS calls made in unit tests

---

### QB-DEPLOY-001: Deploy to Dev Environment
**Owner:** devops-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 1 hour  
**Dependencies:** QB-IMPL-001, QB-IMPL-002, QB-CDK-001, QB-CDK-002, QB-CDK-003, QB-TEST-001 (all passing)  

**Acceptance Criteria:**
- [ ] All unit tests pass: `npm test`
- [ ] CDK synth passes: `cd infra && npx cdk synth`
- [ ] Deploy to dev: `github.com/.../actions` → Run deploy-dev.yml workflow
- [ ] CloudFormation stack update succeeds
- [ ] DynamoDB table created: `learnfyra-dev-questionbank`
- [ ] Lambdas updated with new environment variables
- [ ] Smoke test passes (see QB-VERIFY-001)

**Definition of Done:**
- Dev environment deployed successfully
- No CloudFormation rollback or errors
- DynamoDB table visible in AWS console
- Lambdas have QB_ADAPTER=dynamodb in environment

---

### QB-VERIFY-001: Smoke Test Question Bank in Dev
**Owner:** qa-agent  
**Priority:** P0  
**Status:** TODO  
**Effort:** 30 minutes  
**Dependencies:** QB-DEPLOY-001  

**Acceptance Criteria:**
- [ ] POST `/api/generate` with valid request (grade=3, subject=Math, topic=Multiplication)
- [ ] Response returns 200 with worksheetId
- [ ] CloudWatch logs show "Using QB adapter: dynamodb"
- [ ] Query DynamoDB table `learnfyra-dev-questionbank` in AWS console
- [ ] Verify questions stored with correct attributes (questionId, grade, subject, lookupKey, dedupeHash)
- [ ] Generate second worksheet with same parameters
- [ ] Verify banked questions reused (reuseCount incremented)
- [ ] GET `/api/qb/questions?grade=3&subject=Math` returns questions from DynamoDB

**Definition of Done:**
- End-to-end flow works in dev environment
- Questions stored and retrieved from DynamoDB
- Bank-first assembly uses DynamoDB adapter correctly
- No errors in CloudWatch logs

---

## P1: Hardening (Should Complete)

### QB-TEST-002: Integration Test for DynamoDB Adapter
**Owner:** qa-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 2 hours  
**Dependencies:** QB-VERIFY-001  

**Acceptance Criteria:**
- [ ] Extend `tests/integration/generateFlow.test.js`:
  - [ ] Add test suite that sets `QB_ADAPTER=dynamodb` in environment
  - [ ] Mock DynamoDB SDK calls for integration test (use aws-sdk-client-mock)
  - [ ] Test full generation flow: bank query → AI fill → store to bank → reuse tracking
  - [ ] Verify metadata.bankStats reflects DynamoDB queries
- [ ] OR create new file: `tests/integration/questionBankDynamodb.test.js`
- [ ] Tests pass in CI: `npm run test:integration`

**Definition of Done:**
- Integration tests cover DynamoDB adapter code paths
- Tests can run in CI without real AWS credentials
- Coverage maintained at ≥ 80%

---

### QB-DEPLOY-002: Document Question Bank Migration
**Owner:** ba-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 1 hour  
**Dependencies:** QB-VERIFY-001  

**Acceptance Criteria:**
- [ ] File created: `docs/runbooks/question-bank-migration.md`
- [ ] Document covers:
  - [ ] How to export questions from local JSON (if exists)
  - [ ] How to bulk import questions to DynamoDB
  - [ ] Rollback procedure (revert CDK, set QB_ADAPTER=local)
  - [ ] Data validation steps after migration
- [ ] Decision documented: Do we need to migrate existing data? (currently no local data in prod)

**Definition of Done:**
- Runbook reviewed and approved by devops-agent
- Migration steps tested in dev environment
- Rollback procedure validated

---

### QB-MONITOR-001: Add CloudWatch Alarms for Question Bank
**Owner:** devops-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 1 hour  
**Dependencies:** QB-DEPLOY-001  

**Acceptance Criteria:**
- [ ] CDK alarm for DynamoDB read throttling (prod only):
  ```typescript
  questionBankTable.metricConsumedReadCapacityUnits().createAlarm(...)
  ```
- [ ] CDK alarm for DynamoDB write throttling (prod only)
- [ ] CDK alarm for Lambda errors related to question bank queries
- [ ] SNS topic for alarm notifications (if not already exists)
- [ ] Alarms tested in dev by triggering throttle condition

**Definition of Done:**
- Alarms visible in CloudWatch console
- SNS notifications received when alarm triggered
- No false positives in normal operation

---

### QB-REVIEW-001: Code Review for DynamoDB Adapter
**Owner:** code-reviewer-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 1 hour  
**Dependencies:** QB-IMPL-001, QB-TEST-001  

**Acceptance Criteria:**
- [ ] Review dynamoQuestionBankAdapter.js for:
  - [ ] Security: No SQL injection risks (N/A for DynamoDB), input sanitization
  - [ ] Performance: Query optimization, avoid full table scans
  - [ ] Error handling: Graceful degradation, clear error messages
  - [ ] Cold start optimization: Lazy client initialization
  - [ ] Cost efficiency: PAY_PER_REQUEST billing appropriate for scale
- [ ] Review CDK changes for:
  - [ ] IAM least privilege principle
  - [ ] Encryption at rest enabled (DynamoDB default)
  - [ ] Backup strategy (point-in-time recovery for prod)
- [ ] Findings documented in review report
- [ ] Critical/high findings must be resolved before staging deploy

**Definition of Done:**
- Code review completed with no unresolved critical findings
- Review report added to `docs/reviews/question-bank-dynamodb-review.md`
- All recommendations implemented or tracked as future work

---

### QB-DEPLOY-003: Deploy to Staging
**Owner:** devops-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 30 minutes  
**Dependencies:** QB-REVIEW-001, QB-TEST-002, QB-DEPLOY-002 (all complete)  

**Acceptance Criteria:**
- [ ] All tests pass in CI
- [ ] Code review approved
- [ ] Deploy to staging: Run deploy-staging.yml workflow
- [ ] Smoke test passes in staging
- [ ] Manual testing by QA in staging environment
- [ ] Performance validation: Generate worksheet latency < 10s

**Definition of Done:**
- Staging environment fully functional with DynamoDB question bank
- QA sign-off received
- Ready for production deployment

---

### QB-DEPLOY-004: Deploy to Production
**Owner:** devops-agent  
**Priority:** P1  
**Status:** TODO  
**Effort:** 1 hour  
**Dependencies:** QB-DEPLOY-003 (staging validated)  

**Acceptance Criteria:**
- [ ] Manual approval step in GitHub Actions completed
- [ ] Deploy to prod: Run deploy-prod.yml workflow
- [ ] Monitor CloudWatch logs for first 30 minutes post-deploy
- [ ] Smoke test in production (limited scope)
- [ ] Verify DynamoDB table created with point-in-time recovery enabled
- [ ] Verify CloudWatch alarms active
- [ ] No error spike in CloudWatch metrics
- [ ] Rollback plan ready (documented procedure)

**Definition of Done:**
- Production deployment successful
- Question bank operational in production
- No critical errors in first hour post-deploy
- Monitoring confirms normal operation

---

## P2: Future Enhancements (Post-MVP)

### QB-PERF-001: Add Caching Layer for Question Bank
**Owner:** architect-agent → dev-agent  
**Priority:** P2  
**Status:** BACKLOG  
**Effort:** 4-6 hours  

**Scope:**
- Add in-memory cache for frequently queried questions (Lambda execution context reuse)
- Cache TTL: 5 minutes
- Cache key: grade+subject+topic+difficulty+type
- Evaluate ElastiCache Redis if DynamoDB query latency becomes issue

**Defer until:** DynamoDB query metrics show latency > 500ms p95

---

### QB-ADMIN-001: Build Admin UI for Question Bank Management
**Owner:** ui-agent → frontend-developer-agent  
**Priority:** P2  
**Status:** BACKLOG  
**Effort:** 8-12 hours  

**Scope:**
- Admin dashboard page: `/admin/question-bank`
- Features: Search, filter, edit, delete, bulk import
- Role restriction: admin only
- Uses existing `/api/qb/questions` API endpoints

**Defer until:** After production deployment stable for 1 week

---

### QB-EXPORT-001: Bulk Export/Import for Question Bank
**Owner:** dev-agent  
**Priority:** P2  
**Status:** BACKLOG  
**Effort:** 3-4 hours  

**Scope:**
- Add GET `/api/qb/export` → returns all questions as JSON
- Add POST `/api/qb/import` → bulk insert questions from JSON
- Admin role required
- Include validation and deduplication during import

**Defer until:** Admin UI complete (QB-ADMIN-001)

---

## Sprint Board (Kanban View)

### TODO
- QB-IMPL-001: Implement DynamoDB Adapter
- QB-CDK-001: Add DynamoDB Table to CDK

### IN PROGRESS
- (None — ready to start)

### IN REVIEW
- (None)

### DONE
- ✅ NEXT_PHASE_MASTER_DOSSIER.md created
- ✅ NEXT_PHASE_EXECUTION_BACKLOG.md created
- ✅ Local question bank implementation complete
- ✅ Bank-first assembly pipeline integrated
- ✅ Question bank API handler implemented
- ✅ Unit tests for local adapter complete
- ✅ Integration tests for generate flow complete

---

## Daily Standup Format

**What did I complete yesterday?**
- (List completed task IDs)

**What am I working on today?**
- (List task IDs in progress)

**Any blockers?**
- (List blockers with task IDs)

**Next up in queue:**
- (List next 2-3 tasks to be picked up)

---

## Definition of Done (Sprint Level)

Sprint is complete when:
- [ ] All P0 tasks have status=DONE
- [ ] All unit tests pass: `npm test`
- [ ] All integration tests pass: `npm run test:integration`
- [ ] Code coverage ≥ 80%: `npm run test:coverage`
- [ ] CDK synth passes with zero warnings
- [ ] Dev environment deployed and smoke tested
- [ ] Staging environment deployed and smoke tested
- [ ] Production environment deployed and verified
- [ ] CloudWatch alarms configured and tested
- [ ] Code review completed with no critical findings
- [ ] Documentation updated (runbooks, ADRs)
- [ ] Go/No-Go checklist in NEXT_PHASE_MASTER_DOSSIER.md completed

---

## Estimated Timeline

**Assuming serial execution (single developer):**
- P0 tasks: 8-12 hours
- P1 tasks: 6-8 hours
- **Total: 14-20 hours (2-3 days of focused work)**

**With parallel execution (team of 3):**
- Day 1: dev-agent (QB-IMPL-001, QB-IMPL-002) + devops-agent (QB-CDK-001, QB-CDK-002, QB-CDK-003)
- Day 2: qa-agent (QB-TEST-001) + devops-agent (QB-DEPLOY-001) + qa-agent (QB-VERIFY-001)
- Day 3: code-reviewer-agent (QB-REVIEW-001) + qa-agent (QB-TEST-002) + devops-agent (QB-DEPLOY-003, QB-DEPLOY-004)
- **Total: 3 days with parallel workflow**

**Recommended approach:** Parallel execution with daily sync to coordinate dependencies.

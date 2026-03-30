# Admin QA Spec

## RBAC Test Matrix

| ID | Actor | Endpoint | Expected HTTP | Expected Code |
|---|---|---|---|---|
| RBAC-001 | Super Admin | PUT /api/admin/users/{id}/role | 200 | — |
| RBAC-002 | Ops Admin | PUT /api/admin/users/{id}/role | 403 | INSUFFICIENT_ROLE |
| RBAC-003 | Support Admin | POST /api/admin/users/{id}/suspend | 200 | — |
| RBAC-004 | Data Admin | GET /api/admin/users | 200 | — |
| RBAC-005 | Data Admin | POST /api/admin/users/{id}/suspend | 403 | INSUFFICIENT_ROLE |
| RBAC-006 | Teacher | GET /api/admin/users | 403 | INSUFFICIENT_ROLE |
| RBAC-007 | Student | GET /api/admin/users | 403 | INSUFFICIENT_ROLE |
| RBAC-008 | Ops Admin | PUT /api/admin/models/{id}/activate | 200 | — |
| RBAC-009 | Support Admin | PUT /api/admin/models/{id}/activate | 403 | INSUFFICIENT_ROLE |
| RBAC-010 | Super Admin | DELETE /api/admin/users/{id} | 200 | — |
| RBAC-011 | Ops Admin | DELETE /api/admin/users/{id} | 403 | INSUFFICIENT_ROLE |
| RBAC-012 | Ops Admin | PUT /api/admin/config/platform/maintenanceMode | 200 | — |
| RBAC-013 | Support Admin | PUT /api/admin/config/platform/maintenanceMode | 403 | INSUFFICIENT_ROLE |
| RBAC-014 | Data Admin | GET /api/admin/reports/usage | 200 | — |
| RBAC-015 | Teacher | GET /api/admin/reports/usage | 403 | INSUFFICIENT_ROLE |

## Model Management Tests

| ID | Scenario | Expected |
|---|---|---|
| MODEL-001 | GET /api/admin/models — list models | 200, activeModel present, models array |
| MODEL-002 | Activate a different model | 200, previousModel and activeModel in response |
| MODEL-003 | Activate same model (no-op) | 200, no change to audit log |
| MODEL-004 | Activate non-existent model | 404 MODEL_NOT_FOUND |
| MODEL-005 | Rollback with no history | 400 NO_ROLLBACK_AVAILABLE |
| MODEL-006 | Rollback with history | 200, rolledBackTo is previous model |
| MODEL-007 | Audit log shows recent switch | GET /api/admin/models/audit → entry with correct fields |
| MODEL-008 | Model switch propagates within 60s | Config table updated, next generation uses new model |
| MODEL-009 | CORS headers on model endpoints | All responses include Access-Control-Allow-Origin |
| MODEL-010 | OPTIONS preflight on model endpoint | 200 |
| MODEL-011 | Unauthorized model activate | 403 INSUFFICIENT_ROLE for non-Ops Admin |
| MODEL-012 | Concurrent model switches | Last write wins (DynamoDB conditional write) |
| MODEL-013 | Audit log is append-only | PUT on audit record returns 405 |
| MODEL-014 | Model switch returns full response | Response includes switchedAt, switchedBy, reason |

## User Management Tests

| ID | Scenario | Expected |
|---|---|---|
| USER-001 | List users no filters | 200, users array, count |
| USER-002 | List users filter by role=teacher | 200, only teacher accounts |
| USER-003 | List users search by email | 200, matching user(s) |
| USER-004 | Get specific user | 200, full user detail |
| USER-005 | Get non-existent user | 404 USER_NOT_FOUND |
| USER-006 | Suspend active user | 200, user disabled in Cognito |
| USER-007 | Suspend already suspended user | 409 or 200 (idempotent) |
| USER-008 | Unsuspend suspended user | 200, user active in Cognito |
| USER-009 | Soft delete user | 200, user's PII fields nulled |
| USER-010 | Get deleted user | 200, email=null, name=null, deletedAt present |

## Config Tests

| ID | Scenario | Expected |
|---|---|---|
| CONFIG-001 | Get all config | 200, array of all config keys |
| CONFIG-002 | Update maintenanceMode to true | 200, next API request returns 503 |
| CONFIG-003 | Update maintenanceMode to false | 200, API requests return normal responses |
| CONFIG-004 | Get/api/health during maintenance | 200 (health exempt from maintenance mode) |
| CONFIG-005 | Update ai/activeModel via config | 200, equivalent to model activate endpoint |
| CONFIG-006 | Read previousValue on config | PUT response includes previousValue |

## Admin Handler Test Pattern

```javascript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { handler } from '../../../backend/handlers/adminHandler.js';

const dynamoMock = mockClient(DynamoDBClient);

beforeEach(() => dynamoMock.reset());

const mockAdminEvent = (method, path, body = {}) => ({
  httpMethod: method,
  path,
  headers: {
    'Content-Type': 'application/json',
    // Authorizer context injected by API Gateway:
    'requestContext': {
      authorizer: { userId: 'admin-uuid', role: 'admin', email: 'admin@test.com' }
    }
  },
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {
    authorizer: { userId: 'admin-uuid', role: 'admin', email: 'admin@test.com' }
  }
});

it('returns 200 listing users', async () => {
  dynamoMock.on(ScanCommand).resolves({
    Items: [
      { userId: { S: 'uuid-1' }, email: { S: 'user@test.com' }, role: { S: 'teacher' } }
    ],
    Count: 1
  });
  const result = await handler(mockAdminEvent('GET', '/api/admin/users'));
  expect(result.statusCode).toBe(200);
  const body = JSON.parse(result.body);
  expect(body.users).toHaveLength(1);
});

it('returns 403 for teacher trying admin route', async () => {
  const teacherEvent = {
    ...mockAdminEvent('GET', '/api/admin/users'),
    requestContext: {
      authorizer: { userId: 'teacher-uuid', role: 'teacher', email: 'teacher@test.com' }
    }
  };
  const result = await handler(teacherEvent);
  expect(result.statusCode).toBe(403);
  expect(JSON.parse(result.body).code).toBe('INSUFFICIENT_ROLE');
});

it('returns 503 during maintenance mode', async () => {
  // Simulates Config table returning maintenanceMode = true
  dynamoMock.on(GetItemCommand, { Key: { configKey: { S: 'platform/maintenanceMode' } } })
    .resolves({ Item: { value: { S: 'true' }, message: { S: 'Maintenance' } } });
  const result = await handler(mockAdminEvent('GET', '/api/admin/users'));
  expect(result.statusCode).toBe(503);
});
```

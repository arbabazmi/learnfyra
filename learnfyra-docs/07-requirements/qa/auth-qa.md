# Auth QA Spec

## Guest Mode Tests

| ID | Scenario | Input | Expected |
|---|---|---|---|
| AUTH-G-001 | Generate without token | POST /api/generate, no Authorization header | 200, worksheetId present |
| AUTH-G-002 | Solve without token | GET /api/solve/:id, no Authorization header | 200, questions array, no answers |
| AUTH-G-003 | Submit without token | POST /api/submit | 200, scored results, no attemptId in response |
| AUTH-G-004 | Access progress without token | GET /api/progress/me | 401 NO_TOKEN |
| AUTH-G-005 | Access classes without token | GET /api/classes/me | 401 NO_TOKEN |
| AUTH-G-006 | CORS preflight without token | OPTIONS /api/generate | 200, CORS headers present |
| AUTH-G-007 | Generate with OPTIONS | OPTIONS /api/generate, Authorization present | 200, no Lambda invoked |
| AUTH-G-008 | Health without token | GET /api/health | 200, {status: ok} |
| AUTH-G-009 | Admin without token | GET /api/admin/users | 401 NO_TOKEN |
| AUTH-G-010 | Download without token | GET /api/download?worksheetId=... | 200, presigned URL returned |

## Login Tests

| ID | Scenario | Input | Expected |
|---|---|---|---|
| AUTH-L-001 | Valid email/password | POST /api/auth/token {provider:email, email, password} | 200, accessToken, refreshToken, role |
| AUTH-L-002 | Wrong password | POST /api/auth/token {wrong password} | 401 INVALID_CREDENTIALS |
| AUTH-L-003 | Non-existent email | POST /api/auth/token {email: nobody@x.com} | 401 INVALID_CREDENTIALS |
| AUTH-L-004 | Missing email field | POST /api/auth/token {provider:email, password} | 400 INVALID_REQUEST |
| AUTH-L-005 | Missing password field | POST /api/auth/token {provider:email, email} | 400 INVALID_REQUEST |
| AUTH-L-006 | Suspended user login | POST /api/auth/token (suspended account) | 401 ACCOUNT_SUSPENDED |
| AUTH-L-007 | Valid refresh | POST /api/auth/refresh {refreshToken: valid} | 200, new accessToken |
| AUTH-L-008 | Invalid refresh token | POST /api/auth/refresh {refreshToken: garbage} | 401 INVALID_REFRESH_TOKEN |
| AUTH-L-009 | Expired refresh token | POST /api/auth/refresh (30+ day old token) | 401 INVALID_REFRESH_TOKEN |
| AUTH-L-010 | Logout | POST /api/auth/logout with valid token | 200, {message: Logged out} |
| AUTH-L-011 | Use token after logout | GET /api/progress/me with revoked refresh | 401 TOKEN_REVOKED (on next refresh attempt) |
| AUTH-L-012 | Get profile | GET /api/auth/me with valid token | 200, userId, email, name, role |
| AUTH-L-013 | Update name | PUT /api/auth/me {name: New Name} | 200, updated userId and name |
| AUTH-L-014 | Name too long | PUT /api/auth/me {name: 101-char string} | 400 INVALID_NAME |
| AUTH-L-015 | CORS headers on all responses | Any auth endpoint | Access-Control-Allow-Origin header present |

## Teacher/Parent Tests

| ID | Scenario | Input | Expected |
|---|---|---|---|
| AUTH-T-001 | Teacher creates class | POST /api/classes with teacher token | 200 |
| AUTH-T-002 | Student tries to create class | POST /api/classes with student token | 403 INSUFFICIENT_ROLE |
| AUTH-T-003 | Parent links child | POST /api/auth/link-child with parent token | 200, status: pending_confirmation |
| AUTH-T-004 | Student tries to link child | POST /api/auth/link-child with student token | 403 INSUFFICIENT_ROLE |
| AUTH-T-005 | Admin accesses admin route | GET /api/admin/users with admin token | 200 |

## Lambda Handler Test Pattern

```javascript
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, AdminInitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { handler } from '../../../backend/handlers/authHandler.js';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

beforeEach(() => cognitoMock.reset());

const mockEvent = (body, method = 'POST') => ({
  httpMethod: method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null
});

const mockContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'learnfyra-auth-test',
  getRemainingTimeInMillis: () => 15000
};

it('returns 200 with valid email/password', async () => {
  cognitoMock.on(AdminInitiateAuthCommand).resolves({
    AuthenticationResult: {
      AccessToken: 'mock-access-token',
      RefreshToken: 'mock-refresh-token',
      IdToken: 'mock-id-token'
    }
  });
  const result = await handler(mockEvent({
    provider: 'email',
    email: 'test@test.com',
    password: 'TestPass123!'
  }), mockContext);
  expect(result.statusCode).toBe(200);
  const body = JSON.parse(result.body);
  expect(body).toHaveProperty('accessToken');
  expect(body).toHaveProperty('refreshToken');
  expect(body).toHaveProperty('role');
});

it('returns 200 for OPTIONS preflight', async () => {
  const result = await handler({...mockEvent({}), httpMethod: 'OPTIONS'}, mockContext);
  expect(result.statusCode).toBe(200);
  expect(result.headers['Access-Control-Allow-Origin']).toBeTruthy();
});

it('returns 401 for wrong password', async () => {
  cognitoMock.on(AdminInitiateAuthCommand).rejects({
    name: 'NotAuthorizedException'
  });
  const result = await handler(mockEvent({
    provider: 'email',
    email: 'test@test.com',
    password: 'wrongpassword'
  }), mockContext);
  expect(result.statusCode).toBe(401);
  const body = JSON.parse(result.body);
  expect(body.code).toBe('INVALID_CREDENTIALS');
});
```

## Lambda Authorizer Test Pattern

```javascript
import { handler as authorizer } from '../../../backend/middleware/authorizer.js';
import jwt from 'jsonwebtoken';

const LOCAL_JWT_SECRET = 'test-secret-minimum-32-characters-long';

function makeAuthorizerEvent(token) {
  return {
    authorizationToken: `Bearer ${token}`,
    methodArn: 'arn:aws:execute-api:us-east-1:123:abc/dev/GET/api/progress/me'
  };
}

it('returns Allow policy for valid student token', async () => {
  const token = jwt.sign({ sub: 'user-uuid', role: 'student', email: 'x@x.com' }, LOCAL_JWT_SECRET, { expiresIn: '1h' });
  const result = await authorizer(makeAuthorizerEvent(token));
  expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
  expect(result.context.role).toBe('student');
});

it('returns Deny policy for expired token', async () => {
  const token = jwt.sign({ sub: 'user-uuid', role: 'student' }, LOCAL_JWT_SECRET, { expiresIn: '-1h' });
  const result = await authorizer(makeAuthorizerEvent(token));
  expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
});
```

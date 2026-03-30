# Repeat-Cap Behavior & Admin Override Test Matrix
**Version:** 1.0  
**Date:** March 27, 2026  
**Agent:** qa-agent  
**Status:** Specification for TASK-GEN-015  
**Related Tasks:** TASK-GEN-014, TASK-GEN-015

---

## Overview

This document defines the complete QA coverage plan for:
1. **Future-session repeat cap enforcement** (default 10%)
2. **Admin override endpoints** for repeat-cap policy configuration
3. **Scope precedence resolution** (student > parent > teacher > default)

---

## Feature Requirements Summary

### REQ-GEN-025: Default Repeat Cap
- System MUST enforce a 10% repeat cap for future sessions
- Applies to same student + grade + difficulty combination
- Calculation: `maxRepeatQuestions = floor(questionCount * 0.10)`

### REQ-GEN-026: Admin Override Policy
- Admin MUST be able to configure repeat-cap overrides
- Scopes: student, teacher, parent
- Valid range: 0% to 100%
- Precedence: student > parent > teacher > default (10%)

### DEC-GEN-008: Resolution Strategy
- Use `effectiveRepeatCapPercent` field
- Validate range 0..100 at input
- Apply scope precedence at query time
- Store overrides in `repeatCapPolicies` table

---

## Test Matrix

### Unit Tests

#### 1. Repeat-Cap Calculation Logic (`src/ai/repeatCapResolver.js`)

| Test ID | Scenario | Input | Expected Output | Priority |
|---------|----------|-------|-----------------|----------|
| **RC-CALC-001** | Default 10% with 20 questions | `{ questionCount: 20, overrides: null }` | `maxRepeat: 2` | P0 |
| **RC-CALC-002** | Default 10% with 15 questions (floor) | `{ questionCount: 15, overrides: null }` | `maxRepeat: 1` | P0 |
| **RC-CALC-003** | Default 10% with 5 questions | `{ questionCount: 5, overrides: null }` | `maxRepeat: 0` | P0 |
| **RC-CALC-004** | 0% override with 20 questions | `{ questionCount: 20, override: 0 }` | `maxRepeat: 0` | P0 |
| **RC-CALC-005** | 100% override with 20 questions | `{ questionCount: 20, override: 100 }` | `maxRepeat: 20` | P0 |
| **RC-CALC-006** | 50% override with 10 questions | `{ questionCount: 10, override: 50 }` | `maxRepeat: 5` | P1 |
| **RC-CALC-007** | Edge: 1 question worksheet, 10% | `{ questionCount: 1, overrides: null }` | `maxRepeat: 0` | P1 |
| **RC-CALC-008** | Edge: 100 questions, 10% | `{ questionCount: 100, overrides: null }` | `maxRepeat: 10` | P1 |

#### 2. Scope Precedence Resolution (`src/ai/repeatCapResolver.js`)

| Test ID | Scenario | Student Override | Parent Override | Teacher Override | Expected | Priority |
|---------|----------|------------------|------------------|------------------|----------|----------|
| **RC-PREC-001** | Student override wins | 20% | 30% | 40% | 20% | P0 |
| **RC-PREC-002** | Parent override when no student | null | 30% | 40% | 30% | P0 |
| **RC-PREC-003** | Teacher override when no parent/student | null | null | 40% | 40% | P0 |
| **RC-PREC-004** | Default when no overrides | null | null | null | 10% | P0 |
| **RC-PREC-005** | Student 0% overrides higher scopes | 0% | 80% | 90% | 0% | P0 |
| **RC-PREC-006** | Student 100% overrides lower scopes | 100% | 20% | 10% | 100% | P0 |
| **RC-PREC-007** | Mixed: student + teacher, no parent | 25% | null | 60% | 25% | P1 |
| **RC-PREC-008** | Mixed: parent + teacher, no student | null | 35% | 60% | 35% | P1 |

#### 3. Admin Handler - Repeat-Cap Endpoints (`backend/handlers/adminHandler.js`)

| Test ID | HTTP Method | Path | Scenario | Expected Status | Expected Body | Priority |
|---------|-------------|------|----------|-----------------|---------------|----------|
| **RC-ADMIN-001** | POST | `/api/admin/repeat-cap/student` | Create student override (valid) | 201 | `{ message, policyId, scope, percent }` | P0 |
| **RC-ADMIN-002** | POST | `/api/admin/repeat-cap/student` | Invalid percent (101) | 400 | `{ error: "percent must be 0-100" }` | P0 |
| **RC-ADMIN-003** | POST | `/api/admin/repeat-cap/student` | Invalid percent (-5) | 400 | `{ error: "percent must be 0-100" }` | P0 |
| **RC-ADMIN-004** | POST | `/api/admin/repeat-cap/student` | Missing studentId | 400 | `{ error: "studentId required" }` | P0 |
| **RC-ADMIN-005** | POST | `/api/admin/repeat-cap/teacher` | Create teacher override | 201 | `{ message, policyId, scope, percent }` | P0 |
| **RC-ADMIN-006** | POST | `/api/admin/repeat-cap/parent` | Create parent override | 201 | `{ message, policyId, scope, percent }` | P0 |
| **RC-ADMIN-007** | GET | `/api/admin/repeat-cap/student/:id` | Fetch existing override | 200 | `{ studentId, percent, updatedAt, updatedBy }` | P1 |
| **RC-ADMIN-008** | GET | `/api/admin/repeat-cap/student/:id` | Not found | 404 | `{ error: "not found" }` | P1 |
| **RC-ADMIN-009** | PUT | `/api/admin/repeat-cap/student/:id` | Update existing override | 200 | `{ message, percent }` | P1 |
| **RC-ADMIN-010** | DELETE | `/api/admin/repeat-cap/student/:id` | Delete override (revert to default) | 200 | `{ message: "deleted" }` | P1 |
| **RC-ADMIN-011** | POST | `/api/admin/repeat-cap/student` | Non-admin role | 403 | `{ error: "Forbidden" }` | P0 |
| **RC-ADMIN-012** | POST | `/api/admin/repeat-cap/student` | Invalid token | 401 | `{ error: "Unauthorized" }` | P0 |
| **RC-ADMIN-013** | OPTIONS | `/api/admin/repeat-cap/student` | CORS preflight | 200 | Empty body | P0 |

#### 4. Assembler Integration (`src/ai/assembler.js`)

| Test ID | Scenario | Bank Has | Repeat Cap | Expected Behavior | Priority |
|---------|----------|----------|------------|-------------------|----------|
| **RC-ASM-001** | First session (no history) | 50 questions | 10% (default) | No cap applied, can use all 50 | P0 |
| **RC-ASM-002** | Second session, 10 questions in bank from student | 10 repeat + 40 new | 10% for 20q worksheet | Max 2 repeat questions | P0 |
| **RC-ASM-003** | Second session, student override 0% | 10 repeat + 40 new | 0% | Only new questions used | P0 |
| **RC-ASM-004** | Second session, student override 100% | 10 repeat + 40 new | 100% | Can reuse all 10 repeat | P0 |
| **RC-ASM-005** | Insufficient new questions for cap | 5 new + 20 repeat | 10% for 20q | Falls back to AI generation | P1 |
| **RC-ASM-006** | Teacher override 50% applied | 10 repeat + 40 new | 50% for 10q | Max 5 repeat questions | P1 |
| **RC-ASM-007** | Parent override 25% applied | 8 repeat + 50 new | 25% for 12q | Max 3 repeat questions | P1 |
| **RC-ASM-008** | Student context missing (anonymous) | 30 questions | 10% (default) | No repeat tracking, generates fresh | P2 |

---

### Integration Tests

#### 5. End-to-End Repeat-Cap Flow (`tests/integration/repeatCap.test.js`)

| Test ID | Flow | Setup | Actions | Assertions | Priority |
|---------|------|-------|---------|------------|----------|
| **RC-INT-001** | First + second session with default cap | Mock student, DynamoDB with history | 1) Generate worksheet #1<br>2) Generate worksheet #2 same params | #2 has ≤10% overlap with #1 | P0 |
| **RC-INT-002** | Admin sets student override to 0% | Mock admin, student with history | 1) Admin POST override 0%<br>2) Student generates worksheet | 0 questions repeat from history | P0 |
| **RC-INT-003** | Admin sets student override to 100% | Mock admin, student with history | 1) Admin POST override 100%<br>2) Student generates worksheet | Can have 100% repeat if bank sufficient | P0 |
| **RC-INT-004** | Scope precedence: student wins over teacher | Admin, student, teacher with overrides | 1) Admin sets teacher=50%, student=20%<br>2) Student generates | 20% cap applied (student wins) | P0 |
| **RC-INT-005** | Scope precedence: parent wins when no student | Admin, student, parent | 1) Admin sets parent=30%, teacher=60%<br>2) Student generates | 30% cap applied (parent wins) | P0 |
| **RC-INT-006** | Admin deletes override, reverts to default | Admin, student with 0% override | 1) Admin DELETE override<br>2) Student generates | 10% default cap applied | P1 |
| **RC-INT-007** | Cross-grade isolation | Student, multiple worksheets | 1) Generate grade 3<br>2) Generate grade 4 | No repeat cap between grades | P1 |
| **RC-INT-008** | Cross-difficulty isolation | Student, multiple worksheets | 1) Generate Easy<br>2) Generate Hard | No repeat cap between difficulties | P1 |

---

## Test Implementation Guide

### Mock Structures

#### DynamoDB Mock for Repeat-Cap Policies

```javascript
// tests/mocks/repeatCapPolicyData.js
export const mockRepeatCapPolicies = {
  'student:alice-id': {
    scope: 'student',
    scopeId: 'alice-id',
    percent: 20,
    updatedAt: '2026-03-20T10:00:00Z',
    updatedBy: 'admin-id',
  },
  'teacher:teacher-bob-id': {
    scope: 'teacher',
    scopeId: 'teacher-bob-id',
    percent: 50,
    updatedAt: '2026-03-15T08:00:00Z',
    updatedBy: 'admin-id',
  },
  'parent:parent-carol-id': {
    scope: 'parent',
    scopeId: 'parent-carol-id',
    percent: 30,
    updatedAt: '2026-03-10T12:00:00Z',
    updatedBy: 'admin-id',
  },
};
```

#### Student History Mock

```javascript
// tests/mocks/studentHistoryData.js
export const mockStudentHistory = {
  'alice-id': {
    grade3Math: {
      // question IDs previously seen in grade 3 Math Easy
      seenQuestionIds: ['q-001', 'q-002', 'q-003', 'q-004', 'q-005'],
      worksheetCount: 2,
      lastGenerated: '2026-03-15T14:00:00Z',
    },
  },
};
```

---

## Sample Test Files

### File 1: Unit Tests for Repeat-Cap Resolution

**Path:** `tests/unit/repeatCapResolver.test.js`

```javascript
/**
 * @file tests/unit/repeatCapResolver.test.js
 * @description Unit tests for repeat-cap calculation and scope precedence.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock DynamoDB adapter
const mockGetItem = jest.fn();
jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: mockGetItem,
  })),
}));

const { resolveRepeatCap, calculateMaxRepeat } = await import('../../src/ai/repeatCapResolver.js');

describe('calculateMaxRepeat', () => {
  it('RC-CALC-001: default 10% with 20 questions', () => {
    expect(calculateMaxRepeat(20, 10)).toBe(2);
  });

  it('RC-CALC-002: default 10% with 15 questions (floor)', () => {
    expect(calculateMaxRepeat(15, 10)).toBe(1);
  });

  it('RC-CALC-003: default 10% with 5 questions', () => {
    expect(calculateMaxRepeat(5, 10)).toBe(0);
  });

  it('RC-CALC-004: 0% override with 20 questions', () => {
    expect(calculateMaxRepeat(20, 0)).toBe(0);
  });

  it('RC-CALC-005: 100% override with 20 questions', () => {
    expect(calculateMaxRepeat(20, 100)).toBe(20);
  });

  it('RC-CALC-006: 50% override with 10 questions', () => {
    expect(calculateMaxRepeat(10, 50)).toBe(5);
  });

  it('RC-CALC-007: edge case 1 question, 10%', () => {
    expect(calculateMaxRepeat(1, 10)).toBe(0);
  });

  it('RC-CALC-008: edge case 100 questions, 10%', () => {
    expect(calculateMaxRepeat(100, 10)).toBe(10);
  });
});

describe('resolveRepeatCap - scope precedence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('RC-PREC-001: student override wins over parent and teacher', async () => {
    mockGetItem
      .mockResolvedValueOnce({ percent: 20 }) // student
      .mockResolvedValueOnce({ percent: 30 }) // parent
      .mockResolvedValueOnce({ percent: 40 }); // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: 'parent-1',
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(20);
    expect(result.appliedScope).toBe('student');
  });

  it('RC-PREC-002: parent override wins when no student override', async () => {
    mockGetItem
      .mockResolvedValueOnce(null)            // student
      .mockResolvedValueOnce({ percent: 30 }) // parent
      .mockResolvedValueOnce({ percent: 40 }); // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: 'parent-1',
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(30);
    expect(result.appliedScope).toBe('parent');
  });

  it('RC-PREC-003: teacher override wins when no parent or student', async () => {
    mockGetItem
      .mockResolvedValueOnce(null)            // student
      .mockResolvedValueOnce(null)            // parent
      .mockResolvedValueOnce({ percent: 40 }); // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: null,
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(40);
    expect(result.appliedScope).toBe('teacher');
  });

  it('RC-PREC-004: default 10% when no overrides', async () => {
    mockGetItem
      .mockResolvedValueOnce(null) // student
      .mockResolvedValueOnce(null) // parent
      .mockResolvedValueOnce(null); // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: null,
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(10);
    expect(result.appliedScope).toBe('default');
  });

  it('RC-PREC-005: student 0% overrides higher scopes', async () => {
    mockGetItem
      .mockResolvedValueOnce({ percent: 0 })  // student
      .mockResolvedValueOnce({ percent: 80 }) // parent
      .mockResolvedValueOnce({ percent: 90 }); // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: 'parent-1',
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(0);
    expect(result.appliedScope).toBe('student');
  });

  it('RC-PREC-006: student 100% overrides lower scopes', async () => {
    mockGetItem
      .mockResolvedValueOnce({ percent: 100 }) // student
      .mockResolvedValueOnce({ percent: 20 })  // parent
      .mockResolvedValueOnce({ percent: 10 });  // teacher

    const result = await resolveRepeatCap({
      studentId: 'student-1',
      parentId: 'parent-1',
      teacherId: 'teacher-1',
    });

    expect(result.effectivePercent).toBe(100);
    expect(result.appliedScope).toBe('student');
  });
});
```

### File 2: Admin Handler Tests for Repeat-Cap Endpoints

**Path:** `tests/unit/adminHandler.repeatCap.test.js`

```javascript
/**
 * @file tests/unit/adminHandler.repeatCap.test.js
 * @description Unit tests for admin repeat-cap override endpoints.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const ADMIN_ID = 'admin-uuid';
const STUDENT_ID = 'student-alice-uuid';
const TEACHER_ID = 'teacher-bob-uuid';
const PARENT_ID = 'parent-carol-uuid';

const mockVerifyToken = jest.fn();
const mockGetItem = jest.fn();
const mockPutItem = jest.fn();
const mockDeleteItem = jest.fn();

jest.unstable_mockModule('../../src/auth/index.js', () => ({
  getAuthAdapter: jest.fn(() => ({
    verifyToken: mockVerifyToken,
  })),
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  getDbAdapter: jest.fn(() => ({
    getItem: mockGetItem,
    putItem: mockPutItem,
    deleteItem: mockDeleteItem,
  })),
}));

const { handler } = await import('../../backend/handlers/adminHandler.js');

const adminDecoded = {
  sub: ADMIN_ID,
  email: 'admin@test.com',
  role: 'admin',
};

const teacherDecoded = {
  sub: TEACHER_ID,
  email: 'teacher@test.com',
  role: 'teacher',
};

const mockContext = { callbackWaitsForEmptyEventLoop: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyToken.mockReturnValue(adminDecoded);
  mockPutItem.mockResolvedValue({});
  mockDeleteItem.mockResolvedValue({});
});

describe('adminHandler - Repeat-Cap Endpoints', () => {
  describe('POST /api/admin/repeat-cap/student', () => {
    it('RC-ADMIN-001: creates student override with valid percent', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ studentId: STUDENT_ID, percent: 20 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('created');
      expect(body.scope).toBe('student');
      expect(body.percent).toBe(20);
      expect(mockPutItem).toHaveBeenCalledWith(
        'repeatCapPolicies',
        expect.objectContaining({
          policyId: `student:${STUDENT_ID}`,
          scope: 'student',
          scopeId: STUDENT_ID,
          percent: 20,
          updatedBy: ADMIN_ID,
        })
      );
    });

    it('RC-ADMIN-002: rejects percent > 100', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ studentId: STUDENT_ID, percent: 101 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('0-100');
    });

    it('RC-ADMIN-003: rejects negative percent', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ studentId: STUDENT_ID, percent: -5 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('0-100');
    });

    it('RC-ADMIN-004: requires studentId', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ percent: 20 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('studentId required');
    });

    it('RC-ADMIN-011: rejects non-admin role', async () => {
      mockVerifyToken.mockReturnValue(teacherDecoded);

      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer teacher-token' },
        body: JSON.stringify({ studentId: STUDENT_ID, percent: 20 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Forbidden');
    });

    it('RC-ADMIN-012: rejects invalid token', async () => {
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/student',
        headers: { authorization: 'Bearer bad-token' },
        body: JSON.stringify({ studentId: STUDENT_ID, percent: 20 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('Unauthorized');
    });
  });

  describe('POST /api/admin/repeat-cap/teacher', () => {
    it('RC-ADMIN-005: creates teacher override', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/teacher',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ teacherId: TEACHER_ID, percent: 50 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.scope).toBe('teacher');
      expect(body.percent).toBe(50);
      expect(mockPutItem).toHaveBeenCalledWith(
        'repeatCapPolicies',
        expect.objectContaining({
          policyId: `teacher:${TEACHER_ID}`,
          scope: 'teacher',
        })
      );
    });
  });

  describe('POST /api/admin/repeat-cap/parent', () => {
    it('RC-ADMIN-006: creates parent override', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/admin/repeat-cap/parent',
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ parentId: PARENT_ID, percent: 30 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.scope).toBe('parent');
      expect(body.percent).toBe(30);
    });
  });

  describe('GET /api/admin/repeat-cap/student/:id', () => {
    it('RC-ADMIN-007: fetches existing override', async () => {
      mockGetItem.mockResolvedValue({
        policyId: `student:${STUDENT_ID}`,
        scope: 'student',
        scopeId: STUDENT_ID,
        percent: 25,
        updatedAt: '2026-03-20T10:00:00Z',
        updatedBy: ADMIN_ID,
      });

      const event = {
        httpMethod: 'GET',
        path: `/api/admin/repeat-cap/student/${STUDENT_ID}`,
        pathParameters: { id: STUDENT_ID },
        headers: { authorization: 'Bearer admin-token' },
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.percent).toBe(25);
      expect(body.studentId).toBe(STUDENT_ID);
    });

    it('RC-ADMIN-008: returns 404 when not found', async () => {
      mockGetItem.mockResolvedValue(null);

      const event = {
        httpMethod: 'GET',
        path: `/api/admin/repeat-cap/student/${STUDENT_ID}`,
        pathParameters: { id: STUDENT_ID },
        headers: { authorization: 'Bearer admin-token' },
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('PUT /api/admin/repeat-cap/student/:id', () => {
    it('RC-ADMIN-009: updates existing override', async () => {
      mockGetItem.mockResolvedValue({
        policyId: `student:${STUDENT_ID}`,
        percent: 20,
      });

      const event = {
        httpMethod: 'PUT',
        path: `/api/admin/repeat-cap/student/${STUDENT_ID}`,
        pathParameters: { id: STUDENT_ID },
        headers: { authorization: 'Bearer admin-token' },
        body: JSON.stringify({ percent: 40 }),
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.percent).toBe(40);
      expect(mockPutItem).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/admin/repeat-cap/student/:id', () => {
    it('RC-ADMIN-010: deletes override', async () => {
      const event = {
        httpMethod: 'DELETE',
        path: `/api/admin/repeat-cap/student/${STUDENT_ID}`,
        pathParameters: { id: STUDENT_ID },
        headers: { authorization: 'Bearer admin-token' },
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('deleted');
      expect(mockDeleteItem).toHaveBeenCalledWith(
        'repeatCapPolicies',
        `student:${STUDENT_ID}`
      );
    });
  });

  describe('OPTIONS /api/admin/repeat-cap/student', () => {
    it('RC-ADMIN-013: handles CORS preflight', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        path: '/api/admin/repeat-cap/student',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
    });
  });
});
```

### File 3: Integration Tests for End-to-End Repeat-Cap Flow

**Path:** `tests/integration/repeatCap.test.js`

```javascript
/**
 * @file tests/integration/repeatCap.test.js
 * @description Integration tests for repeat-cap enforcement across student sessions.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

const mockMessagesCreate = jest.fn();
jest.unstable_mockModule('../../src/ai/client.js', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  getClaudeClient: jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

const { assembleWorksheet } = await import('../../src/ai/assembler.js');

describe('Repeat-Cap Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();

    // Default: no AI generation needed (bank has enough)
    mockMessagesCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ text: JSON.stringify({ questions: [] }) }],
    });
  });

  afterEach(() => {
    ddbMock.reset();
  });

  it('RC-INT-001: enforces 10% default cap on second session', async () => {
    const studentId = 'alice-uuid';
    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      teacherId: 'teacher-uuid',
    };

    // Mock: student has seen 10 questions before
    const seenQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      number: i + 1,
      type: 'fill-in-the-blank',
      question: `Seen question ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Previously seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    // Mock: bank has 40 new questions + 10 seen
    const newQuestions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `new-q-${i + 1}`,
      number: i + 11,
      type: 'fill-in-the-blank',
      question: `New question ${i + 1}`,
      answer: `${i + 11}`,
      explanation: 'New',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: [...seenQuestions, ...newQuestions],
    });

    // No repeat-cap override
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
    }).resolves({ Item: null });

    // Mock student history
    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    // Count how many questions are from the "seen" set
    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    // 10% of 20 = 2 max repeats
    expect(repeatCount).toBeLessThanOrEqual(2);
  });

  it('RC-INT-002: enforces 0% student override (no repeats)', async () => {
    const studentId = 'alice-uuid';
    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      teacherId: 'teacher-uuid',
    };

    const seenQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Seen ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    const newQuestions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `new-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `New ${i + 1}`,
      answer: `${i + 11}`,
      explanation: 'New',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: [...seenQuestions, ...newQuestions],
    });

    // Mock: student override = 0%
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `student:${studentId}` },
    }).resolves({
      Item: {
        policyId: `student:${studentId}`,
        scope: 'student',
        scopeId: studentId,
        percent: 0,
        updatedAt: '2026-03-20T10:00:00Z',
        updatedBy: 'admin-uuid',
      },
    });

    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    // NO questions should repeat
    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    expect(repeatCount).toBe(0);
  });

  it('RC-INT-003: allows 100% student override (all can repeat)', async () => {
    const studentId = 'alice-uuid';
    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      teacherId: 'teacher-uuid',
    };

    const seenQuestions = Array.from({ length: 20 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Seen ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: seenQuestions,
    });

    // Mock: student override = 100%
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `student:${studentId}` },
    }).resolves({
      Item: {
        policyId: `student:${studentId}`,
        scope: 'student',
        percent: 100,
      },
    });

    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    // All 20 can be repeats (100% cap)
    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    // Should be able to use all seen questions
    expect(repeatCount).toBeGreaterThan(0);
  });

  it('RC-INT-004: student scope wins over teacher scope', async () => {
    const studentId = 'alice-uuid';
    const teacherId = 'teacher-bob-uuid';
    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      teacherId,
    };

    const seenQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Seen ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    const newQuestions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `new-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `New ${i + 1}`,
      answer: `${i + 11}`,
      explanation: 'New',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: [...seenQuestions, ...newQuestions],
    });

    // Student override: 20%
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `student:${studentId}` },
    }).resolves({
      Item: { policyId: `student:${studentId}`, percent: 20 },
    });

    // Teacher override: 50% (should be ignored)
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `teacher:${teacherId}` },
    }).resolves({
      Item: { policyId: `teacher:${teacherId}`, percent: 50 },
    });

    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    // 20% of 20 = 4 max repeats (student scope, NOT teacher's 50%)
    expect(repeatCount).toBeLessThanOrEqual(4);
  });

  it('RC-INT-005: parent scope wins when no student override', async () => {
    const studentId = 'alice-uuid';
    const parentId = 'parent-carol-uuid';
    const teacherId = 'teacher-bob-uuid';

    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      parentId,
      teacherId,
    };

    const seenQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Seen ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    const newQuestions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `new-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `New ${i + 1}`,
      answer: `${i + 11}`,
      explanation: 'New',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: [...seenQuestions, ...newQuestions],
    });

    // No student override
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `student:${studentId}` },
    }).resolves({ Item: null });

    // Parent override: 30%
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `parent:${parentId}` },
    }).resolves({
      Item: { policyId: `parent:${parentId}`, percent: 30 },
    });

    // Teacher override: 60% (should be ignored)
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
      Key: { policyId: `teacher:${teacherId}` },
    }).resolves({
      Item: { policyId: `teacher:${teacherId}`, percent: 60 },
    });

    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    // 30% of 20 = 6 max repeats (parent scope, not teacher's 60%)
    expect(repeatCount).toBeLessThanOrEqual(6);
  });

  it('RC-INT-006: reverts to default 10% after admin deletes override', async () => {
    const studentId = 'alice-uuid';
    const request = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 20,
      studentId,
      teacherId: 'teacher-uuid',
    };

    const seenQuestions = Array.from({ length: 10 }, (_, i) => ({
      questionId: `seen-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Seen ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Seen',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 1,
    }));

    const newQuestions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `new-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `New ${i + 1}`,
      answer: `${i + 11}`,
      explanation: 'New',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand).resolves({
      Items: [...seenQuestions, ...newQuestions],
    });

    // Override was deleted — all GetCommand for policies return null
    ddbMock.on(GetCommand, {
      TableName: 'repeatCapPolicies',
    }).resolves({ Item: null });

    ddbMock.on(GetCommand, {
      TableName: 'studentHistory',
    }).resolves({
      Item: {
        studentId,
        grade3MathEasy: {
          seenQuestionIds: seenQuestions.map((q) => q.questionId),
        },
      },
    });

    const result = await assembleWorksheet(request);

    expect(result.questions).toHaveLength(20);

    const repeatCount = result.questions.filter((q) =>
      seenQuestions.some((seen) => seen.questionId === q.questionId)
    ).length;

    // 10% default = 2 max repeats
    expect(repeatCount).toBeLessThanOrEqual(2);
  });

  it('RC-INT-007: no repeat cap between different grades', async () => {
    const studentId = 'alice-uuid';

    // First worksheet: grade 3
    const request1 = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 10,
      studentId,
    };

    // Second worksheet: grade 4 (different grade, no cap applies)
    const request2 = {
      grade: 4,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 10,
      studentId,
    };

    const grade3Questions = Array.from({ length: 15 }, (_, i) => ({
      questionId: `g3-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Grade 3 question ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Grade 3',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    const grade4Questions = Array.from({ length: 15 }, (_, i) => ({
      questionId: `g4-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Grade 4 question ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Grade 4',
      points: 1,
      grade: 4,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    // Mock grade 3 query
    ddbMock.on(QueryCommand, {
      ExpressionAttributeValues: expect.objectContaining({ ':grade': 3 }),
    }).resolves({
      Items: grade3Questions,
    });

    // Mock grade 4 query
    ddbMock.on(QueryCommand, {
      ExpressionAttributeValues: expect.objectContaining({ ':grade': 4 }),
    }).resolves({
      Items: grade4Questions,
    });

    ddbMock.on(GetCommand).resolves({ Item: null });

    await assembleWorksheet(request1);
    const result2 = await assembleWorksheet(request2);

    // Grade 4 worksheet should not be constrained by grade 3 history
    expect(result2.questions).toHaveLength(10);
    expect(result2.questions.every((q) => q.grade === 4)).toBe(true);
  });

  it('RC-INT-008: no repeat cap between different difficulties', async () => {
    const studentId = 'alice-uuid';

    const requestEasy = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      questionCount: 10,
      studentId,
    };

    const requestHard = {
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Hard',
      questionCount: 10,
      studentId,
    };

    const easyQuestions = Array.from({ length: 15 }, (_, i) => ({
      questionId: `easy-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Easy question ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Easy',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Easy',
      reuseCount: 0,
    }));

    const hardQuestions = Array.from({ length: 15 }, (_, i) => ({
      questionId: `hard-q-${i + 1}`,
      type: 'fill-in-the-blank',
      question: `Hard question ${i + 1}`,
      answer: `${i + 1}`,
      explanation: 'Hard',
      points: 1,
      grade: 3,
      subject: 'Math',
      topic: 'Addition',
      difficulty: 'Hard',
      reuseCount: 0,
    }));

    ddbMock.on(QueryCommand, {
      ExpressionAttributeValues: expect.objectContaining({ ':difficulty': 'Easy' }),
    }).resolves({
      Items: easyQuestions,
    });

    ddbMock.on(QueryCommand, {
      ExpressionAttributeValues: expect.objectContaining({ ':difficulty': 'Hard' }),
    }).resolves({
      Items: hardQuestions,
    });

    ddbMock.on(GetCommand).resolves({ Item: null });

    await assembleWorksheet(requestEasy);
    const resultHard = await assembleWorksheet(requestHard);

    // Hard worksheet should not be constrained by Easy history
    expect(resultHard.questions).toHaveLength(10);
    expect(resultHard.questions.every((q) => q.difficulty === 'Hard')).toBe(true);
  });
});
```

---

## QA Execution Checklist

Use this checklist when running the test suite:

### Pre-Execution
- [ ] Ensure `src/ai/repeatCapResolver.js` exists
- [ ] Ensure `backend/handlers/adminHandler.js` has repeat-cap routes
- [ ] Ensure `repeatCapPolicies` DynamoDB table is defined in CDK
- [ ] Ensure `src/ai/assembler.js` calls `resolveRepeatCap` when `studentId` is provided
- [ ] Install dependencies: `npm install aws-sdk-client-mock --save-dev`

### Execution
```bash
# Run unit tests only
npm run test:unit -- tests/unit/repeatCapResolver.test.js
npm run test:unit -- tests/unit/adminHandler.repeatCap.test.js

# Run integration tests
npm run test:integration -- tests/integration/repeatCap.test.js

# Run full suite with coverage
npm run test:coverage
```

### Post-Execution
- [ ] All unit tests pass (RC-CALC, RC-PREC, RC-ADMIN series)
- [ ] All integration tests pass (RC-INT series)
- [ ] Coverage remains ≥80%
- [ ] No AWS credentials or secrets leaked in test files
- [ ] CORS headers present on all admin handler responses
- [ ] Verify repeat-cap enforcement in local dev: `npm run dev` → generate 2 worksheets

---

## Boundary Value Matrix

| Input | Boundary | Test Cases |
|-------|----------|------------|
| `questionCount` | Min | 1, 5 |
| `questionCount` | Max | 30, 100 |
| `percent` | Min | 0 |
| `percent` | Max | 100 |
| `percent` | Invalid low | -1, -100 |
| `percent` | Invalid high | 101, 200 |
| `effectiveRepeatCapPercent` | Default | 10 |
| Scope precedence | All combinations | student/parent/teacher/null |

---

## Acceptance Gate

Before marking TASK-GEN-015 as **done**, verify:

✅ All P0 tests pass (RC-CALC-001 through RC-INT-006)  
✅ All P1 tests pass  
✅ Coverage ≥80% on new code  
✅ CDK stack synth passes with repeatCapPolicies table  
✅ Admin handler responds with correct CORS headers  
✅ Default 10% cap is enforced when no overrides exist  
✅ 0% override prevents all repeats  
✅ 100% override allows all repeats  
✅ Scope precedence matches student > parent > teacher > default  
✅ Cross-grade and cross-difficulty worksheets are isolated  
✅ Integration tests run offline (no real AWS/Anthropic calls)  

---

## Notes for DEV Agent

When implementing `src/ai/repeatCapResolver.js`:

```javascript
/**
 * @file src/ai/repeatCapResolver.js
 * @description Resolve effective repeat-cap percentage based on scope precedence.
 */

import { getDbAdapter } from '../db/index.js';

const DEFAULT_REPEAT_CAP_PERCENT = 10;

/**
 * Calculate max repeat questions allowed.
 * @param {number} questionCount Total questions in worksheet
 * @param {number} percent Repeat cap percentage (0-100)
 * @returns {number} Max repeat questions (floored)
 */
export function calculateMaxRepeat(questionCount, percent) {
  return Math.floor((questionCount * percent) / 100);
}

/**
 * Resolve effective repeat-cap percent based on scope precedence.
 * Precedence: student > parent > teacher > default (10%)
 * @param {Object} context
 * @param {string} context.studentId
 * @param {string} [context.parentId]
 * @param {string} [context.teacherId]
 * @returns {Promise<{ effectivePercent: number, appliedScope: string }>}
 */
export async function resolveRepeatCap({ studentId, parentId, teacherId }) {
  const db = await getDbAdapter();

  // Check student scope
  if (studentId) {
    const studentPolicy = await db.getItem('repeatCapPolicies', `student:${studentId}`);
    if (studentPolicy && typeof studentPolicy.percent === 'number') {
      return { effectivePercent: studentPolicy.percent, appliedScope: 'student' };
    }
  }

  // Check parent scope
  if (parentId) {
    const parentPolicy = await db.getItem('repeatCapPolicies', `parent:${parentId}`);
    if (parentPolicy && typeof parentPolicy.percent === 'number') {
      return { effectivePercent: parentPolicy.percent, appliedScope: 'parent' };
    }
  }

  // Check teacher scope
  if (teacherId) {
    const teacherPolicy = await db.getItem('repeatCapPolicies', `teacher:${teacherId}`);
    if (teacherPolicy && typeof teacherPolicy.percent === 'number') {
      return { effectivePercent: teacherPolicy.percent, appliedScope: 'teacher' };
    }
  }

  // Default
  return { effectivePercent: DEFAULT_REPEAT_CAP_PERCENT, appliedScope: 'default' };
}
```

---

## References

- [REQUIREMENTS.md](../../REQUIREMENTS.md) — REQ-GEN-025, REQ-GEN-026
- [M01-M03-REQUIREMENTS-AND-TASKS.md](../../docs/tasks/backend/M01-M03-REQUIREMENTS-AND-TASKS.md) — TASK-GEN-014, TASK-GEN-015
- [module-breakdown-phase1.md](../../docs/requirements/platform/module-breakdown-phase1.md) — AC-GEN-004
- [worksheet-request-workflow-ascii.md](../../docs/architecture/workflows/worksheet-request-workflow-ascii.md) — Repeat-cap policy section

---

**END OF TEST MATRIX**

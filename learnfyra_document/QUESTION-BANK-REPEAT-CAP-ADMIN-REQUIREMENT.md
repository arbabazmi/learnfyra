# Requirement: Question Bank Repeat Cap and Admin Configurability

## Overview
Learnfyra must support configurable question reuse controls when generating worksheets from the question bank. The platform should prioritize unseen questions for the same learner while allowing a limited percentage of previously served questions when needed. This percentage must be centrally controlled by Platform Admin / Super Admin.

## Business Need
When a worksheet is generated for the same student/user, the system should avoid repeating old questions too often. However, a small percentage of previously served questions may be allowed to improve fill rate and avoid generation failures when the bank has limited inventory.

This reuse allowance must not remain hardcoded in the application. It must be configurable by authorized admins.

## Requirements

### 1. Bank-First Reuse Policy
- The worksheet generation flow must continue to check the question bank first for matching questions by:
  - grade
  - subject
  - topic
  - difficulty
- The system must prioritize unseen questions for the same learner before selecting already-served questions.

### 2. Configurable Repeat Cap
- The maximum percentage of previously served questions allowed in a newly generated worksheet must be configurable.
- Default value may be set by the platform, for example `20%`, but it must not be hardcoded as a fixed product rule.
- The effective cap must be applied during worksheet assembly for the same learner.

### 3. Admin Control
- Only **Platform Admin / Super Admin** may:
  - view the global repeat cap setting
  - update the global repeat cap setting
  - create overrides for specific scopes if needed
- Teachers and parents must **not** be allowed to change the repeat cap policy.

### 4. Override Scope Support
The repeat cap setting should support precedence-based overrides where applicable:
1. student-specific override
2. parent-specific override
3. teacher-specific override
4. global default

If overrides exist, the most specific applicable override must win.

### 5. Dynamic Calculation in Worksheet Assembly
- The worksheet assembly logic must derive unseen/repeat question allocation dynamically from the configured repeat cap.
- Example:
  - if repeat cap = `20%` and `questionCount = 10`
  - then maximum repeat questions allowed = `2`
  - minimum unseen target = `8`

### 6. Question Exposure Tracking
- The system must continue to record which questions were previously served to a learner.
- Repeat decisions must be based on stored exposure history, not only on bank inventory.

### 7. Auditability
- Any admin change to the repeat cap policy or override must be logged with:
  - who changed it
  - previous value
  - new value
  - timestamp
  - reason for change

### 8. Failure / Low Inventory Handling
- If the question bank does not contain enough unseen questions, the system may use repeat questions only up to the configured cap.
- If the bank still cannot satisfy the request, AI generation may be used for the missing count.

## Acceptance Criteria

### AC-01 — Global admin configuration
Given a Platform Admin updates the repeat cap to `20%`  
When a worksheet is generated for the same learner  
Then the assembly logic must allow at most `20%` repeated questions.

### AC-02 — Dynamic behavior
Given the question count is `10` and effective repeat cap is `20%`  
When the system assembles the worksheet  
Then it must target at least `8` unseen questions and allow at most `2` repeated questions.

### AC-03 — No teacher/parent edit access
Given a teacher or parent attempts to modify repeat cap settings  
When the request is submitted  
Then access must be denied.

### AC-04 — Override precedence
Given a student-specific override exists and differs from the global setting  
When a worksheet is generated for that student  
Then the student-specific override must take precedence.

### AC-05 — Audit log
Given an admin changes the repeat cap setting  
When the update succeeds  
Then an audit record must be written with old and new values.

## Current Code Observation
The current codebase already includes:
- repeat-cap policy handling in `backend/handlers/adminHandler.js`
- repeat policy resolution in `src/ai/repeatCapPolicy.js`
- question bank assembly in `src/ai/assembler.js`

However, the same-user unseen target is still partially hardcoded in the assembly logic using an `80/20` rule. This must be refactored so the behavior is driven entirely by the effective admin-configured repeat cap.

## Implementation Note
The hardcoded logic should be replaced with a dynamic formula derived from the effective configured percentage. This will ensure business behavior and admin settings remain aligned.

---

**Priority:** P0 / High  
**Owner:** Platform / Admin / Worksheet Generation modules  
**Status:** Requirement added for implementation alignment

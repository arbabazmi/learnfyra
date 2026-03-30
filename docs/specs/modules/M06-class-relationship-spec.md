# M06: Class and Relationship Management Spec
Status: draft
Priority: P1
Owner: Platform Team

## Scope
- Teacher class creation.
- Student class join flow.
- Parent-child linking model.

## Functional Requirements
1. Teachers can create classes and invite codes.
2. Students can join by valid class code.
3. Parent-child links are verified before parent data access.

## Acceptance Criteria
Given valid class code
When student joins
Then membership is created and reflected in class roster.

Given parent-child link is verified
When parent requests child progress
Then request is authorized and scoped to that child only.

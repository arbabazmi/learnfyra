# M05: Progress and Reporting Spec
Status: draft
Priority: P1
Owner: Analytics Team

## Scope
- Student progress history.
- Teacher class analytics.
- Parent child-linked progress view.
- Online and offline score merge.
- Completion certificate visibility and re-download (phase-dependent).

## Functional Requirements
1. Store each attempt with student and worksheet context.
2. Provide student weak-topic insights.
3. Provide teacher class-level performance summaries.
4. Restrict parent visibility to linked children only.
5. Support certificate listing and authorized re-download for eligible completions.

## Acceptance Criteria
Given teacher filters class and subject
When report is generated
Then weakest topics and trend summaries are returned.

Given parent is linked to child
When parent opens dashboard
Then only linked child progress is visible.

Given a student has an issued completion certificate
When student opens progress/certificate history
Then certificate appears with authorized download action.

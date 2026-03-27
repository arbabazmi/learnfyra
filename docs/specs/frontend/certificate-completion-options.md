# Completion Certificate Options
# File: docs/specs/frontend/certificate-completion-options.md
# Version: 1.0
# Date: 2026-03-25

## Goal
Provide downloadable completion certificates for students with flexible rollout options.

## Option Matrix

### Option A: Basic Download (MVP)
What it does:
- Show "Download Certificate" button on results page when score threshold is met.
- Generate PDF certificate on demand.
- No persistent certificate history.

Eligibility rule (default):
- Score >= 70% and question count >= 5.

Pros:
- Fastest to ship.
- Low implementation complexity.

Cons:
- No re-download history.
- No teacher-side certificate records.

### Option B: Persistent Certificates (Recommended)
What it does:
- Everything in Option A.
- Store certificate metadata and file path in storage.
- Student can re-download old certificates from profile/history.
- Teacher can view issued certificates per class/student.

Eligibility rule:
- Configurable by teacher/class or system default.

Pros:
- Better user value and auditability.
- Supports reporting and teacher workflows.

Cons:
- Medium complexity.

### Option C: Branded and Verifiable Certificates (Advanced)
What it does:
- Everything in Option B.
- School/teacher branding (logo/theme).
- Verification link or certificate code.
- Optional QR code that opens verification endpoint.

Pros:
- Best for school and parent trust.
- Strong long-term product value.

Cons:
- Highest complexity.
- Requires stronger data governance and verification lifecycle.

## Recommended Path
1. Ship Option A quickly.
2. Move to Option B in the next sprint.
3. Add Option C after branding and verification policies are finalized.

## Certificate Data Contract

```json
{
  "certificateId": "uuid-v4",
  "studentId": "uuid-v4",
  "worksheetId": "uuid-v4",
  "classId": "optional-uuid",
  "score": 85,
  "issuedAt": "2026-03-25T10:00:00Z",
  "template": "default-v1",
  "downloadUrl": "https://.../certificate.pdf",
  "verificationCode": "optional-string"
}
```

## API Options

### Generate and download
- `POST /api/certificates/generate`
  - Body: `worksheetId`, `studentId`, optional `classId`
  - Response: `certificateId`, `downloadUrl`

### Re-download by id (Option B+)
- `GET /api/certificates/:certificateId/download`

### List certificates (Option B+)
- `GET /api/certificates/student/:studentId`
- `GET /api/certificates/class/:classId` (teacher only)

### Verify certificate (Option C)
- `GET /api/certificates/verify/:verificationCode`

## UX Placement Options
1. Results page CTA: "Download Certificate".
2. Student profile tab: "My Certificates".
3. Teacher class view: "Issued Certificates".

## Security and Authorization
1. Student can download only own certificates.
2. Teacher can view/download only certificates for owned classes.
3. Parent can view/download linked child's certificates only.
4. Guest users do not receive persistent certificates unless policy explicitly allows anonymous certificates.

## Acceptance Criteria (Baseline)

### AC-CERT-01
Given an authenticated student completes a worksheet above threshold
When results page is shown
Then "Download Certificate" option is visible.

### AC-CERT-02
Given student clicks download
When certificate generation completes
Then student receives a valid PDF download.

### AC-CERT-03 (Option B+)
Given a certificate is issued
When student opens certificate history
Then issued certificate appears with re-download action.

### AC-CERT-04
Given a user requests another student's certificate
When authorization check runs
Then API returns forbidden.

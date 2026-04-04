# Learnfyra — Business Requirements Document (BRD)
# Compliance, Privacy, and Regulatory Requirements

**Document ID:** LFR-BRD-COMPLIANCE-001
**Version:** 1.1
**Date:** April 3, 2026
**Status:** Draft — Validated Against Codebase — Pending Legal Review
**Author:** Senior BA / Compliance Analyst
**Audience:** Product, Engineering, Legal, Executive Leadership
**Validated Against:** Commit `45050ef` on `main` branch (April 3, 2026)

---

## Table of Contents

1. [Business Objectives](#1-business-objectives)
2. [Scope](#2-scope)
3. [Stakeholders](#3-stakeholders)
4. [Current Implementation Status](#4-current-implementation-status)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Compliance Requirements](#7-compliance-requirements)
8. [Risks and Mitigation](#8-risks-and-mitigation)
9. [Assumptions](#9-assumptions)
10. [Appendix — Regulatory Reference Table](#10-appendix--regulatory-reference-table)

---

## 1. Business Objectives

| ID | Objective | Success Metric |
|---|---|---|
| BO-01 | Deliver a legally compliant K-12 EdTech platform that can operate in all 50 US states | Zero regulatory violations within 12 months of launch |
| BO-02 | Protect student and child data to the highest standard, earning parent and school trust | 100% of user data flows documented and auditable |
| BO-03 | Use AI-generated educational content responsibly with safeguards against harmful output | Zero incidents of inappropriate AI content reaching students |
| BO-04 | Enable market entry into school districts, which require vendor compliance certifications | Achieve Student Data Privacy Consortium (SDPC) readiness within 6 months |
| BO-05 | Build privacy-by-design into the architecture so compliance is structural, not bolted on | Every new feature passes a Privacy Impact Assessment (PIA) before launch |

---

## 2. Scope

### 2.1 In-Scope

- COPPA compliance for users under 13
- FERPA compliance for school-originated student data
- CCPA / CPRA compliance for California users (and state equivalents)
- GDPR readiness for future international expansion
- AI content safety and moderation requirements
- Authentication and identity management (Module M01 — already built)
- Data encryption at rest and in transit (AWS infrastructure)
- Cookie and tracking consent management
- Accessibility compliance (WCAG 2.1 AA)
- Terms of Service and Privacy Policy requirements
- Incident response and breach notification procedures
- Parental consent workflows
- Data retention and deletion policies

### 2.2 Out-of-Scope

- SOC 2 Type II certification (deferred to Phase 2; design for it now)
- HIPAA (no health data collected)
- PCI DSS (no payment processing in Phase 1; if added, will require separate BRD)
- International data transfer mechanisms (Standard Contractual Clauses) — deferred until EU launch
- School district single-sign-on federation (Phase 2+)
- Formal penetration testing engagement (recommended before production launch but not defined here)

---

## 3. Stakeholders

| Role | Name / Team | Responsibility |
|---|---|---|
| Product Owner | Learnfyra Leadership | Final approval on compliance scope and trade-offs |
| Engineering Lead | Dev Team | Implementation of technical controls |
| Legal Counsel | External (TBD) | Review Privacy Policy, ToS, COPPA compliance, breach procedures |
| Data Protection Officer (DPO) | To be appointed | Ongoing compliance monitoring, DSAR handling |
| Parents | End Users | Provide verifiable consent for children under 13 |
| Teachers | End Users (Phase 2) | Access student data within FERPA boundaries |
| Students | End Users | Primary data subjects; children under 13 require parental consent |
| AWS Solutions Architect | AWS | Infrastructure security review |
| QA Lead | QA Agent | Validate compliance controls in code and infrastructure |

---

## 4. Current Implementation Status

This section documents what is **already implemented** in the codebase as of commit `45050ef`. The BRD treats existing code as the source of truth and adjusts requirements accordingly.

### 4.1 What Is Built and Compliant

| Area | Status | Evidence | Compliance Impact |
|---|---|---|---|
| **Password hashing** | COMPLIANT | `src/auth/mockAuthAdapter.js` — bcryptjs, cost factor 10 | SEC-01 satisfied |
| **JWT secrets in Secrets Manager** | COMPLIANT | `infra/cdk/learnfyra-stack.ts:546-548` — JWT_SECRET via Secrets Manager | SEC-02 satisfied |
| **Token expiry (OAuth path)** | COMPLIANT | `src/auth/cognitoAdapter.js:295` — access token 1h, refresh 30d | SEC-03 satisfied for production (Cognito) |
| **Parent-child link enforcement** | COMPLIANT | `backend/middleware/authMiddleware.js:87-107` — `assertParentLink()` checks active link before parent accesses child data | NFR-05 partially satisfied |
| **AI prompt isolation from PII** | COMPLIANT | `src/ai/promptBuilder.js` — only sends grade, subject, topic, difficulty, questionCount to Claude. No student PII. | AI-02 satisfied, COPPA-07 partially satisfied |
| **Input validation** | COMPLIANT | `backend/middleware/validator.js:71-154` — validates grade 1-10, subject enum, topic max 200 chars, question count 5-30 | SEC-06 partially satisfied |
| **CORS headers on all handlers** | COMPLIANT | All 17 handlers in `backend/handlers/` include corsHeaders | SEC-05 structure in place |
| **S3 encryption at rest** | COMPLIANT | `learnfyra-stack.ts:173` — `BucketEncryption.S3_MANAGED` on worksheet bucket | NFR-01 partially satisfied |
| **HTTPS enforcement** | COMPLIANT | `learnfyra-stack.ts:517,526` — CloudFront `REDIRECT_TO_HTTPS` for frontend, `HTTPS_ONLY` for API | NFR-02 satisfied |
| **API Gateway access logging** | COMPLIANT | `learnfyra-stack.ts:444-478` — CloudWatch JSON logs with requestId, IP, timestamp, method, path, status, latency, user agent | FR-08 partially satisfied |
| **Auth rate limiting** | COMPLIANT | `learnfyra-stack.ts:484-492` — API Gateway throttle: 1 req/sec, 2 burst on register/login | SEC-04 satisfied |
| **WAF (prod)** | COMPLIANT | `learnfyra-stack.ts:2250-2271` — WAF rate limit on `/auth/guest`, 20 req/5min per IP | Best practice met for prod |
| **DynamoDB point-in-time recovery** | COMPLIANT | `learnfyra-stack.ts:215` — enabled for non-dev environments | Data durability met |
| **S3 worksheet lifecycle** | COMPLIANT | `learnfyra-stack.ts:176-180` — 7-day expiration on `worksheets/` prefix | NFR-04 partially satisfied |
| **No analytics/tracking SDKs** | COMPLIANT | `package.json` — zero Mixpanel, Segment, PostHog, GA, or telemetry dependencies | FR-06 low risk (no consent-triggering scripts exist) |
| **Dependency vulnerability scanning** | COMPLIANT | `.github/workflows/security-audit.yml` — `npm audit --audit-level=high`, Gitleaks secret scanning, license checker | SEC-07 satisfied |
| **CI coverage gate** | COMPLIANT | `.github/workflows/ci.yml` — 80% statements/functions/lines, 65% branches | QA baseline met |
| **Footer privacy/terms links** | PARTIAL | `learnfyra-app/src/components/layout/Footer.tsx:129-139` — links to `/privacy`, `/terms`, `/accessibility` | Routes exist but pages not yet implemented |
| **Account deletion UI** | PARTIAL | `learnfyra-app/src/pages/SettingsPage.tsx:696-712` — "Delete Account" button exists (TODO: confirmation modal, backend endpoint) | FR-07 UI started but not functional |
| **AI refusal detection** | PARTIAL | `src/ai/generator.js:470-479` — detects Claude refusals (< 200 chars + keywords) and throws error | FR-05 partially satisfied (structural validation only, no content safety) |

### 4.2 What Is NOT Built (Gaps)

| Area | Status | Required By | Priority |
|---|---|---|---|
| **Age gate / DOB collection** | NOT BUILT | COPPA (legally required) | P0 — Must have before launch |
| **Parental consent workflow (VPC)** | NOT BUILT | COPPA (legally required) | P0 — Must have before launch |
| **Privacy Dashboard for parents** | NOT BUILT | COPPA, CCPA (legally required) | P0 — Must have before launch |
| **Content safety filter (beyond structural)** | NOT BUILT | Best practice (FTC guidance) | P1 — Should have before launch |
| **Cookie consent banner** | NOT BUILT | CCPA, state laws (legally required) | P1 — Low urgency (no analytics SDKs currently) |
| **"Do Not Sell" link** | NOT BUILT | CCPA (legally required) | P1 — Add to footer |
| **DSAR form / endpoint** | NOT BUILT | CCPA, COPPA (legally required) | P1 — Must have before launch |
| **Account deletion backend** | NOT BUILT | CCPA, COPPA (legally required) | P1 — Must have before launch |
| **Data export endpoint** | NOT BUILT | CCPA, GDPR-readiness (legally required) | P1 |
| **Security response headers** | NOT BUILT | Best practice (OWASP) | P2 — Add CSP, HSTS, X-Frame-Options |
| **Immutable audit trail (beyond API logs)** | NOT BUILT | FERPA, COPPA record-keeping | P2 |
| **Privacy Policy page** | NOT BUILT | COPPA, CCPA (legally required) | P0 — Must have before launch |
| **Terms of Service page** | NOT BUILT | Best practice | P0 — Must have before launch |
| **Compliance-specific tests** | NOT BUILT | Best practice | P2 |
| **Consent record storage** | NOT BUILT | COPPA (legally required) | P0 |
| **3-year log retention** | NOT BUILT | COPPA 312.10 (legally required) | P1 — Current: 1-month CloudWatch |

### 4.3 Corrections to Original BRD Based on Code Audit

| Original BRD Claim | Actual Code State | BRD Correction |
|---|---|---|
| NFR-03 listed "Date of birth: Yes, collected" | User model has no DOB field. Registration collects: email, password, role, displayName only. | Corrected: DOB is NOT yet collected. FR-02 (age gate) is a new build, not an existing feature. |
| NFR-03 listed "Google OAuth: email, name, profile picture URL" | `cognitoAdapter.js` requests scope `openid email profile`. Collects: sub, email, name, email_verified. No profile picture. | Corrected: Google OAuth collects sub, email, name, email_verified. No profile picture URL. |
| SEC-03 stated "Access tokens: 1 hour" universally | Mock adapter path uses 7-day tokens (`tokenUtils.js:30`). Cognito path uses 1-hour tokens. | Corrected: Token expiry depends on auth mode. Mock (dev): 7d. Cognito (prod): 1h. BRD requirement applies to production only. |
| FR-08 stated "CloudWatch Logs with retention policy" | API Gateway logs have 1-month retention (`learnfyra-stack.ts`). BRD requires 3 years. | Corrected: Current retention is 1 month. Must be extended to 3 years for COPPA compliance. |
| NFR-01 stated "DynamoDB server-side encryption (AWS-managed KMS key)" | No explicit encryption setting in `createTable()`. Uses AWS default encryption (AES-256 with AWS-owned key). | Corrected: DynamoDB uses AWS default encryption, not customer-managed KMS. Sufficient for compliance but noted. |
| FR-06 implied analytics SDKs exist | No analytics SDKs in package.json or frontend. | Corrected: Cookie consent banner is lower priority since no analytics scripts exist. Still required by CCPA for the "Do Not Sell" link. |
| FR-07 stated "Delete Account" as not built | SettingsPage.tsx has Delete Account button (line 696-712) but backend endpoint is not implemented. | Corrected: UI exists (partial), backend is the gap. |

---

## 5. Functional Requirements

### FR-01: Parental Consent Workflow (COPPA)

**Description:** Before any child under 13 can create an account or have data collected, a parent or legal guardian must provide verifiable parental consent (VPC).

**Rationale:** COPPA Section 312.5 requires VPC before collecting personal information from children under 13. The FTC has fined EdTech companies millions for violations.

**Legal status:** Legally required (FTC/COPPA).

**Acceptance Criteria:**
- Given a user registers with a date of birth indicating age < 13, when the registration flow reaches the consent step, then the system blocks account activation until VPC is obtained.
- The system supports at least one FTC-approved VPC method:
  - **Recommended for MVP:** "Email Plus" — parent receives email with a link, must take an affirmative action (click confirm + enter their own details) to consent.
  - **Phase 2:** Credit card micro-transaction verification, signed consent form upload, video call verification.
- Consent records are stored immutably with timestamp, parent identity, child identity, and method used.
- If consent is not received within 48 hours, the child's pending account and any collected data are permanently deleted.

---

### FR-02: Age Gate at Registration

**Description:** All users must provide a date of birth during registration. The system uses this to determine the consent flow.

**Rationale:** Age determination is the first step in COPPA compliance. Without it, the platform cannot distinguish children from adults.

**Legal status:** Legally required (COPPA).

**Acceptance Criteria:**
- Date of birth is collected before any other personal information.
- Users under 13 are routed to the parental consent flow (FR-01).
- Users 13-17 see age-appropriate terms and a simplified privacy notice.
- Users 18+ proceed with standard registration.
- Date of birth is stored encrypted and used only for age verification — never shared with third parties or used for profiling.

---

### FR-03: Privacy Dashboard for Parents

**Description:** Parents must be able to view, download, and delete all data collected about their child.

**Rationale:** COPPA Section 312.6 grants parents the right to review, delete, and refuse further collection of their child's data. CCPA provides similar rights.

**Legal status:** Legally required (COPPA, CCPA).

**Acceptance Criteria:**
- Authenticated parents can view all data associated with their linked child accounts.
- A "Download My Child's Data" button exports all data as JSON/CSV within 24 hours.
- A "Delete My Child's Data" button triggers full account and data deletion within 72 hours (with a 24-hour grace period to cancel).
- Deleting a child's data revokes consent and prevents re-collection until new consent is given.
- All parent actions are logged in an immutable audit trail.

---

### FR-04: Data Subject Access Requests (DSAR)

**Description:** Any user (or parent of a child user) can request a copy of their data or request deletion.

**Rationale:** Required by CCPA (right to know, right to delete), GDPR (right of access, right to erasure), and COPPA (parental rights).

**Legal status:** Legally required (CCPA, GDPR, COPPA).

**Acceptance Criteria:**
- A DSAR can be submitted via an in-app form or by emailing privacy@learnfyra.com.
- Identity verification is required before fulfilling any DSAR (email confirmation + account login).
- Data export requests are fulfilled within 30 days (CCPA) / 30 days (GDPR).
- Deletion requests remove all personal data from primary storage within 30 days and from backups within 90 days.
- A DSAR log tracks all requests, actions taken, and completion dates.

---

### FR-05: AI Content Safety Guardrails

**Description:** All AI-generated worksheet content must be filtered for age-appropriateness, bias, factual accuracy, and harmful content before being presented to students.

**Rationale:** AI-generated content for children carries unique risks: inappropriate language, cultural bias, factual errors, and content that does not align with educational standards. No single regulation mandates this, but FTC guidance on AI and children, plus emerging state laws (e.g., California AB 2013), create strong expectations.

**Legal status:** Best practice (legally required in California under AB 2013 for AI transparency; FTC has signaled enforcement).

**Acceptance Criteria:**
- Every AI response is passed through a content safety filter before storage or display.
- The filter checks for: profanity, sexual content, violence, self-harm references, political bias, religious bias, factual errors against known curriculum standards.
- Content that fails the filter is rejected, logged, and never shown to the student. A replacement is generated automatically.
- AI-generated content is labeled: "Questions generated with AI assistance" (California AB 2013 transparency requirement).
- A human review queue exists for flagged content that is borderline (Phase 2: teacher review).
- The AI model is never given access to student personal data (name, age, performance history) in the prompt — only grade level and subject.

---

### FR-06: Consent Management for Cookies and Analytics

**Description:** The platform must obtain informed consent before setting any non-essential cookies or running analytics/tracking scripts.

**Rationale:** GDPR requires prior consent for non-essential cookies. CCPA requires a "Do Not Sell My Personal Information" link. Even for US-only launch, multiple states (Colorado, Connecticut, Virginia, Utah, Texas, Oregon, Montana) now have similar laws.

**Legal status:** Legally required (GDPR, CCPA, state privacy laws).

**Acceptance Criteria:**
- A cookie consent banner appears on first visit with clear Accept / Reject options.
- No analytics scripts (Google Analytics, Mixpanel, etc.) load until the user consents.
- Essential cookies (session, CSRF) are set without consent but are disclosed in the cookie policy.
- A "Cookie Preferences" link is accessible from the footer at all times.
- Consent choices are stored per user/browser and respected on subsequent visits.
- A "Do Not Sell or Share My Personal Information" link is visible on every page (CCPA requirement).

---

### FR-07: Account Deletion and Data Portability

**Description:** Users can delete their accounts and export their data.

**Rationale:** Right to deletion (CCPA, GDPR, COPPA) and right to data portability (GDPR).

**Legal status:** Legally required.

**Acceptance Criteria:**
- Users can initiate account deletion from their profile settings.
- Deletion is confirmed via email with a 7-day cooling-off period before execution.
- Upon deletion: all personal data, worksheets, scores, and usage analytics tied to the user are permanently removed.
- Anonymized aggregate data (e.g., "500 students completed Grade 3 Math worksheets") may be retained.
- Data export is available in machine-readable format (JSON) before deletion.

---

### FR-08: Audit Logging

**Description:** All security-relevant and data-access events must be logged immutably.

**Rationale:** Audit trails are required for breach investigation (all regulations), FERPA compliance (access logs for student records), and SOC 2 readiness.

**Legal status:** Legally required (FERPA, COPPA — record-keeping); best practice for SOC 2.

**Acceptance Criteria:**
- Logged events include: login/logout, failed login attempts, role changes, data access (who viewed which student's data), data export, data deletion, consent granted/revoked, DSAR requests, admin actions.
- Logs include timestamp, user ID, action, target resource, IP address, and user agent.
- Logs are stored in a tamper-proof store (CloudWatch Logs with retention policy or S3 with Object Lock).
- Logs are retained for a minimum of 3 years (COPPA record-keeping requirement: 312.10).
- Logs never contain raw personal data — use user IDs, not names/emails.

---

## 6. Non-Functional Requirements

### NFR-01: Encryption at Rest

**Description:** All personal data and student records must be encrypted at rest using AES-256 or equivalent.

**Rationale:** Industry standard for data protection; required by FERPA Technical Safeguards and state breach notification safe harbors (encrypted data is often exempt from breach notification).

**Legal status:** Best practice (legally advantageous — breach notification safe harbor).

**Current implementation (validated):** S3 worksheet bucket uses `BucketEncryption.S3_MANAGED` (AES-256, `learnfyra-stack.ts:173`). DynamoDB uses AWS default encryption (AES-256 with AWS-owned key — no explicit setting in `createTable()`). Secrets Manager uses default KMS encryption. All meet the AES-256 requirement. Customer-managed KMS keys are not used but are not required for compliance.

---

### NFR-02: Encryption in Transit

**Description:** All data in transit must be encrypted using TLS 1.2 or higher.

**Rationale:** Prevents interception of student data. Required by FERPA, expected by COPPA.

**Legal status:** Legally required (FERPA); best practice (COPPA).

**Current implementation (validated):** CloudFront enforces `REDIRECT_TO_HTTPS` for frontend and `HTTPS_ONLY` for API (`learnfyra-stack.ts:517,526`). API Gateway enforces TLS 1.2 minimum. No HTTP endpoints exist. Requirement satisfied.

---

### NFR-03: Data Minimization

**Description:** Collect only the minimum personal data necessary for the platform to function.

**Rationale:** GDPR Article 5(1)(c) principle of data minimization. COPPA Section 312.7 prohibits conditioning a child's participation on collecting more data than necessary.

**Legal status:** Legally required (COPPA, GDPR).

**Learnfyra-specific data inventory (validated against codebase):**

| Data Field | Collected | Source File | Purpose | Minimization Status |
|---|---|---|---|---|
| Email address | Yes | `mockAuthAdapter.js:76`, `cognitoAdapter.js:272` | Account creation, password reset | Required |
| Display name | Yes | `mockAuthAdapter.js:80`, `cognitoAdapter.js:289` | In-app identity | Required (first name only recommended for children) |
| Password hash | Yes (local auth only) | `mockAuthAdapter.js:73` | Authentication (bcrypt, 10 rounds) | Required for local accounts |
| Role | Yes | `authHandler.js:65` | Access control (student/teacher/parent) | Required |
| Auth type | Yes | `mockAuthAdapter.js:82` | Distinguish local vs OAuth (`local:email` / `oauth:google`) | Required |
| Google OAuth sub | Yes (if OAuth) | `cognitoAdapter.js:268` | Unique identity from Google | Required |
| Google email_verified | Yes (if OAuth) | `cognitoAdapter.js:272` | Email verification status | Required |
| Date of birth | **NOT YET COLLECTED** | N/A | Age verification for COPPA | **MUST ADD** — FR-02 |
| Grade level | Yes (per worksheet) | `validator.js:71` | Curriculum alignment | Required — not stored on user profile |
| Worksheet answers | Yes | `submitHandler.js` | Scoring and progress tracking | Required — tied to user ID |
| Score history | Yes | DynamoDB worksheets table | Progress tracking | Required |
| Guest session data | Yes | `authHandler.js:402-465` | Guest access (30-day TTL) | Minimal — guestId, role, timestamps |
| IP address | Logged | API Gateway access logs | Security, rate limiting | Retained 1 month (current) — target 90 days |
| User agent | Logged | API Gateway access logs | Security | Retained 1 month (current) |
| Student name | Optional input | `validator.js:128` | Worksheet header (passed to exporter, NOT to AI) | Review: may not be necessary |
| Teacher name | Optional input | `validator.js:132` | Worksheet header (passed to exporter, NOT to AI) | Review: may not be necessary |
| Class name / period | Optional input | `validator.js:133-134` | Worksheet header (passed to exporter, NOT to AI) | Review: may not be necessary |
| Location data | No | N/A | Not collected | N/A |
| Biometric data | No | N/A | Not collected | N/A |
| Social media profiles | No | N/A | Not collected | N/A |
| Phone number | No | N/A | Not collected | N/A |
| Profile picture | No | N/A | Not collected (not retrieved from Google OAuth) | N/A |

---

### NFR-04: Data Retention Policy

**Description:** Personal data is retained only as long as necessary and then permanently deleted.

**Rationale:** GDPR storage limitation principle (Article 5(1)(e)), COPPA Section 312.10.

**Legal status:** Legally required.

| Data Category | Current Retention | Required Retention | Gap | Justification |
|---|---|---|---|---|
| Active user account data | Indefinite (no auto-delete) | Duration of account + 30 days after deletion | **Needs deletion endpoint** | Operational need + cooling-off |
| Worksheet content (S3) | 7 days (lifecycle rule in CDK) | 7 days | None | Temporary educational content |
| Guest sessions (DynamoDB) | 30 days (TTL on `ttl` field) | 30 days | None | Automatic cleanup via DynamoDB TTL |
| Password reset tokens | TTL-based (DynamoDB `expiresAt`) | Short-lived | None | Auto-expires |
| Solve/score data | Indefinite | Duration of account | **Needs cascade delete** | Progress tracking |
| API Gateway access logs | 1 month (CloudWatch) | 3 years (COPPA 312.10) | **Must extend to 3 years** | COPPA record-keeping |
| Consent records | Not yet stored | 3 years after consent withdrawal | **Must build** | COPPA record-keeping |
| IP / device logs | 1 month (via API Gateway logs) | 90 days recommended | **Extend retention** | Security analysis |
| DynamoDB backups | Point-in-time recovery (non-dev) | 90 days post-deletion | Partial | Backup rotation |
| Anonymized aggregate data | N/A (not yet generated) | Indefinite | None | No PII — exempt from deletion |

---

### NFR-05: Access Control and Least Privilege

**Description:** Every system component and user role operates with the minimum permissions necessary.

**Rationale:** Defense in depth. FERPA requires that only authorized personnel access student records.

**Legal status:** Legally required (FERPA); best practice.

**Learnfyra-specific controls:**
- Students can only access their own worksheets, scores, and profile.
- Parents can access their linked children's data (enforced by `assertParentLink` middleware — already built).
- Teachers (Phase 2) can access data only for students in their assigned classes.
- Lambda functions have IAM roles scoped to specific S3 prefixes and DynamoDB tables.
- No Lambda function has `*` resource permissions.
- Admin role access requires MFA (Phase 2).

---

### NFR-06: Availability and Incident Response

**Description:** The platform targets 99.5% uptime and has a documented incident response plan.

**Rationale:** Downtime during school hours affects learning. Breach notification laws have strict timelines (72 hours GDPR, "without unreasonable delay" COPPA/most US states).

**Legal status:** Best practice (uptime); legally required (breach notification timelines).

**Incident response requirements:**
- Breach notification to affected users within 72 hours of confirmed breach.
- Breach notification to FTC (COPPA) and state AGs as required by applicable state laws.
- Breach notification to school districts if FERPA-covered data is involved.
- Incident response runbook documented and tested annually.
- Designated incident response lead (can be same as DPO for early stage).

---

## 7. Compliance Requirements

### 7.1 COPPA — Children's Online Privacy Protection Act

**Applicability:** Learnfyra is directed at children (K-12, including grades 1-5 which are predominantly under 13). COPPA applies to the entire platform, not just to individual users identified as under 13, because the platform is "directed to children" under FTC guidelines.

**Legal status:** All items below are **legally required**.

| ID | Requirement | Description | Implementation |
|---|---|---|---|
| COPPA-01 | Verifiable Parental Consent | Obtain VPC before collecting any personal information from a child under 13. | Age gate at registration (FR-02) routes under-13 users to parental consent flow (FR-01). Email Plus method for MVP. |
| COPPA-02 | Clear Privacy Notice to Parents | Provide a clear, prominent notice describing data collection practices specifically for children. | Dedicated "Children's Privacy" section in Privacy Policy. Link in parental consent email. Plain language, no legal jargon. |
| COPPA-03 | Parental Review and Deletion Rights | Parents can review, download, and delete their child's data at any time. | Privacy Dashboard (FR-03). Delete action removes all child data within 72 hours. |
| COPPA-04 | No More Data Than Necessary | Do not condition a child's participation on disclosing more information than reasonably necessary. | Data minimization audit (NFR-03). Only email, display name (first name), DOB, and grade level collected. |
| COPPA-05 | Reasonable Security | Maintain reasonable procedures to protect the confidentiality, security, and integrity of children's data. | Encryption at rest and in transit (NFR-01, NFR-02). IAM least privilege (NFR-05). Audit logging (FR-08). |
| COPPA-06 | Data Retention Limits | Retain children's data only as long as necessary. Delete when no longer needed. | Retention policy (NFR-04). Account data deleted within 30 days of request. Audit logs retained 3 years for compliance. |
| COPPA-07 | Service Provider Obligations | If using third-party services that receive children's data, they must agree to COPPA-compliant data handling. | AWS has a COPPA-compliant DPA. Anthropic API receives no PII (only grade level + subject in prompts). Verify all third-party SDKs (analytics, error tracking). |
| COPPA-08 | Safe Harbor (Optional) | Consider joining an FTC-approved COPPA Safe Harbor program (e.g., iKeepSafe, kidSAFE). | Evaluate after MVP launch. Provides some protection against FTC enforcement actions. |
| COPPA-09 | Record-Keeping | Maintain records of consent and compliance activities for 3 years. | Consent records stored in DynamoDB with immutable timestamps. Audit log retention of 3 years (FR-08). |

**Penalty context:** FTC fines for COPPA violations range from $50,120 per violation (2024 rate, adjusted annually). Epic Games/Fortnite was fined $275 million in 2022. EdTech companies Edmodo ($6M, 2023) and Epic/Fortnite ($275M, 2022) demonstrate active FTC enforcement in this sector.

---

### 7.2 FERPA — Family Educational Rights and Privacy Act

**Applicability:** FERPA applies if Learnfyra receives student data from schools or acts as a "school official" under a school's directory. In Phase 1 (direct-to-consumer), FERPA is not directly triggered. However, designing for FERPA now is critical because school district sales require it.

**Legal status:** Not legally required in Phase 1 (direct-to-consumer); **legally required if/when schools adopt the platform**.

| ID | Requirement | Description | Implementation |
|---|---|---|---|
| FERPA-01 | School Official Designation | When a school shares student data with Learnfyra, Learnfyra must operate under the "school official" exception. | Prepare a Data Processing Agreement (DPA) template that schools can execute. Include "legitimate educational interest" language. |
| FERPA-02 | No Re-disclosure | Student education records received from schools cannot be shared with third parties without consent. | Anthropic API never receives student PII. No third-party analytics on school-sourced data without school consent. |
| FERPA-03 | Parent/Eligible Student Rights | Parents (or students 18+) can inspect and request amendment of education records. | Privacy Dashboard (FR-03) and DSAR flow (FR-04) satisfy this. |
| FERPA-04 | Access Logging | Maintain a record of each party that accesses student education records. | Audit logging (FR-08) tracks every data access event with user ID, timestamp, and resource. |
| FERPA-05 | Directory Information Controls | If displaying student names or information to other users (e.g., leaderboards), schools must have designated this as directory information. | Phase 1: No leaderboards or public student-facing features. Phase 2: Require school opt-in before displaying any student info to peers. |

**Design-for-FERPA actions (do now, even in Phase 1):**
- Never send student names, emails, or performance data to Anthropic API prompts.
- Structure DynamoDB tables so school-sourced data can be logically isolated (partition key includes `schoolId` where applicable).
- Prepare a template Student Data Privacy Agreement (SDPA) aligned with the Student Data Privacy Consortium (SDPC) National DPA.

---

### 7.3 CCPA / CPRA — California Consumer Privacy Act

**Applicability:** Applies if Learnfyra has California users and meets revenue/data thresholds. Even below thresholds, compliance is recommended because (a) it builds trust and (b) similar laws now exist in 18+ states.

**Legal status:** Legally required if thresholds are met; **strong best practice** regardless.

| ID | Requirement | Description | Implementation |
|---|---|---|---|
| CCPA-01 | Right to Know | Users can request disclosure of what personal data is collected, used, and shared. | DSAR flow (FR-04). Privacy Policy lists categories of data collected. |
| CCPA-02 | Right to Delete | Users can request deletion of their personal data. | Account deletion (FR-07). Data purged within 30 days from primary, 90 days from backups. |
| CCPA-03 | Right to Opt-Out of Sale | Users can opt out of the "sale" of personal data. Learnfyra does not sell data, but must still provide the link. | "Do Not Sell or Share My Personal Information" link in footer (FR-06). Internal policy: Learnfyra never sells user data. |
| CCPA-04 | Non-Discrimination | Users who exercise privacy rights cannot be penalized with degraded service. | No feature gating based on privacy choices. Users who delete data lose only their own historical data, not platform access. |
| CCPA-05 | Privacy Policy Updates | Privacy Policy must be updated annually and list categories of data collected, purposes, and third parties. | Annual review process. Version-dated Privacy Policy. Link accessible from every page footer. |
| CCPA-06 | Minor-Specific Protections | CCPA Section 1798.120(c) prohibits sale of data for users under 16 without opt-in consent. Under 13 requires parental consent. | Learnfyra does not sell data (policy). COPPA parental consent (FR-01) satisfies the under-13 requirement. 13-15 year olds: explicit opt-in if any data sharing is introduced. |

---

### 7.4 GDPR — General Data Protection Regulation

**Applicability:** Not directly applicable for US-only launch. Included here for design-forward readiness because (a) international expansion is planned, and (b) GDPR principles (consent, minimization, portability) align with COPPA/CCPA and are good practice.

**Legal status:** Not legally required for US-only; **legally required if EU users are served**.

| ID | Requirement | Description | Implementation |
|---|---|---|---|
| GDPR-01 | Lawful Basis for Processing | Identify and document the legal basis for each data processing activity. | Consent (children), legitimate interest (security logging), contract performance (account services). Document in a Record of Processing Activities (ROPA). |
| GDPR-02 | Data Protection Impact Assessment | Required for high-risk processing (AI profiling of children). | Conduct DPIA before launching any adaptive learning or student profiling features. |
| GDPR-03 | Right to Data Portability | Users can receive their data in a structured, machine-readable format. | JSON export in DSAR flow (FR-04). |
| GDPR-04 | Data Protection by Design | Build privacy into the architecture, not as an afterthought. | Data minimization (NFR-03), encryption (NFR-01/02), access control (NFR-05). |
| GDPR-05 | Appoint a DPO | Required when processing children's data at scale. | Appoint DPO before EU launch. For US-only Phase 1, designate a privacy lead. |
| GDPR-06 | 72-Hour Breach Notification | Report personal data breaches to supervisory authority within 72 hours. | Incident response plan (NFR-06). Automated alerting on anomalous access patterns. |

---

### 7.5 AI-Specific Compliance

**Applicability:** Learnfyra generates educational content using LLMs (Anthropic Claude). The regulatory landscape for AI in education is evolving rapidly. California AB 2013 (effective January 2026) is the most relevant current law.

**Legal status:** Mix of legally required (CA AB 2013) and strong best practice.

| ID | Requirement | Description | Legal Status | Implementation |
|---|---|---|---|---|
| AI-01 | AI Transparency Disclosure | Inform users that content is generated by AI. | Legally required (CA AB 2013) | Display "Generated with AI assistance" on every worksheet. Disclose AI use in Terms of Service. |
| AI-02 | No Student PII in AI Prompts | Never send student personal data (name, email, DOB, scores) to the LLM. | Best practice (COPPA alignment, Anthropic terms) | Prompts contain only: grade level, subject, topic, difficulty, question count. Code review gate: grep for PII fields in prompt construction. |
| AI-03 | Content Safety Filtering | Filter AI output for inappropriate, biased, or harmful content before displaying to students. | Best practice (FTC guidance on AI and children) | Post-generation content filter (FR-05). Reject and regenerate on filter failure. Log all rejections for model improvement. |
| AI-04 | Factual Accuracy Validation | AI-generated questions and answers must be factually accurate and curriculum-aligned. | Best practice (educational standards) | Cross-reference generated content against CCSS/NGSS standards in `topics.js`. Teacher review queue for flagged content (Phase 2). |
| AI-05 | AI Model Documentation | Document which AI models are used, their capabilities, and limitations. | Best practice (emerging regulation) | Internal AI Model Card documenting: model (Claude), use case (question generation), limitations (may hallucinate, not a substitute for teacher), safety measures. |
| AI-06 | No Autonomous Decision-Making on Students | AI must not make consequential decisions about students (placement, grading for official records) without human oversight. | Best practice (EU AI Act alignment) | Learnfyra scores are for practice only — not official grades. Disclaim in ToS: "Scores are for self-assessment and do not constitute official academic records." |
| AI-07 | Bias Monitoring | Monitor AI output for demographic, cultural, or gender bias. | Best practice | Periodic audit of generated content across grade levels and subjects. Log question diversity metrics. |
| AI-08 | AI Vendor Due Diligence | Ensure the AI provider (Anthropic) has adequate data protection and does not train on student inputs. | Best practice (COPPA alignment) | Verify Anthropic's data retention and training policies. Use API options to disable training on inputs (Anthropic's default for API). Document in vendor risk assessment. |

---

### 7.6 Authentication and Security Compliance

**Applicability:** Authentication is already built (M01). These requirements ensure the existing implementation meets compliance standards.

| ID | Requirement | Description | Legal Status | Implementation |
|---|---|---|---|---|
| SEC-01 | Secure Password Storage | Passwords must be hashed with a strong algorithm (bcrypt, Argon2). Never stored in plaintext. | Best practice (industry standard) | `mockAuthAdapter.js` uses bcrypt. Verify cost factor >= 10. |
| SEC-02 | JWT Secret Management | JWT signing secrets must never be in source code or Lambda environment variables in plaintext. | Best practice (OWASP) | JWT_SECRET resolved from AWS Secrets Manager. Already enforced in M01 spec. |
| SEC-03 | Session Timeout | User sessions must expire after a reasonable period of inactivity. | Best practice | Access tokens: 1 hour. Refresh tokens: 30 days. Already implemented in `tokenUtils.js`. |
| SEC-04 | Rate Limiting | Auth endpoints must be rate-limited to prevent brute-force attacks. | Best practice | API Gateway Usage Plans on auth routes. Already specified in M01. |
| SEC-05 | CORS Restrictions | ALLOWED_ORIGIN must never be `*` in staging or production. | Best practice (OWASP) | CDK synth check enforces this. Already in M01 success metrics. |
| SEC-06 | Input Validation | All user inputs must be validated and sanitized to prevent XSS, SQLi, and injection attacks. | Best practice (OWASP Top 10) | `backend/middleware/validator.js` exists. Ensure all new endpoints (solve, submit) use it. |
| SEC-07 | Dependency Vulnerability Scanning | Third-party dependencies must be scanned for known vulnerabilities. | Best practice | Add `npm audit` to CI pipeline. Fail build on high/critical vulnerabilities. |
| SEC-08 | MFA for Admin and Teacher Roles | Multi-factor authentication for elevated roles. | Best practice (FERPA alignment) | Phase 2. Design auth flow to support MFA addition without breaking changes. |

---

### 7.7 Accessibility Compliance

**Applicability:** Section 508 (federal), ADA Title III (public accommodations), and WCAG 2.1 AA. Schools receiving federal funding require Section 508 compliance from vendors.

**Legal status:** Legally required for school district sales (Section 508); best practice for direct-to-consumer.

| ID | Requirement | Description | Implementation |
|---|---|---|---|
| A11Y-01 | WCAG 2.1 AA Compliance | All pages meet WCAG 2.1 Level AA success criteria. | Automated testing with axe-core in CI. Manual testing for keyboard navigation and screen reader compatibility. |
| A11Y-02 | Keyboard Navigation | All interactive elements are operable via keyboard alone. | Focus management in React components. Visible focus indicators. Tab order matches visual order. |
| A11Y-03 | Screen Reader Compatibility | All content is accessible to screen readers (ARIA labels, roles, live regions). | Semantic HTML. ARIA attributes on custom components. Test with NVDA/VoiceOver. |
| A11Y-04 | Color Contrast | Text and interactive elements meet minimum contrast ratios (4.5:1 normal text, 3:1 large text). | Verify Learnfyra theme colors (#3D9AE8 blue, #6DB84B green, #F5C534 yellow) against white/dark backgrounds. Yellow on white will likely fail — use only on dark backgrounds. |
| A11Y-05 | Alternative Text | All non-decorative images have descriptive alt text. | Enforce alt text on `<img>` elements in code review. Decorative images use `alt=""`. |
| A11Y-06 | Accessible Worksheets | AI-generated worksheets must be screen-reader compatible in HTML format. | Semantic question markup: `<fieldset>`, `<legend>`, `<label>`. Math expressions use MathML or descriptive text. |

---

### 7.8 State-Specific Privacy Laws

**Applicability:** As of 2026, 18+ US states have comprehensive privacy laws. Key ones beyond CCPA:

| State | Law | Key Learnfyra Implication |
|---|---|---|
| Virginia | VCDPA | Consent for children's data; data protection assessments for targeted advertising (Learnfyra does not do targeted advertising — low risk) |
| Colorado | CPA | Universal opt-out mechanism; data protection assessments |
| Connecticut | CTDPA | Consent for children under 13 (aligned with COPPA) |
| Texas | TDPSA | Applies to all businesses (no revenue threshold); COPPA-like consent |
| Oregon | OCPA | Sensitive data protections for children |
| New York | SHIELD Act | Reasonable security safeguards; breach notification within expedient timeframe |
| Illinois | SOPIPA | Student Online Personal Protection — prohibits use of student data for non-educational purposes |

**Mitigation strategy:** Comply with COPPA + CCPA as the baseline. This satisfies the core requirements of all current state laws. Monitor new legislation quarterly.

---

## 8. Risks and Mitigation

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | COPPA violation due to missing parental consent | High (if not built) | Critical — FTC fines up to $50K/violation | Implement age gate (FR-02) and VPC flow (FR-01) before public launch. Block under-13 signups until consent is implemented. |
| R-02 | AI generates inappropriate content shown to a child | Medium | High — reputational damage, potential FTC action | Content safety filter (FR-05). Conservative filter settings. Human review queue. Automated monitoring of filter rejection rates. |
| R-03 | Student PII leaks to Anthropic API | Low (if controls are enforced) | Critical — COPPA/FERPA violation | Code-level guardrails: prompt builder must never accept PII fields. Automated grep in CI for PII field names in prompt construction code. |
| R-04 | Data breach exposing student records | Low | Critical — breach notification obligations, fines, lawsuits | Encryption (NFR-01/02), least privilege (NFR-05), audit logging (FR-08), incident response plan (NFR-06). Consider cyber liability insurance. |
| R-05 | School district refuses to adopt due to missing compliance certifications | High (without SDPC/FERPA readiness) | High — blocks B2B revenue | Prepare SDPA template aligned with SDPC National DPA. Complete SDPC questionnaire. Achieve iKeepSafe or kidSAFE certification. |
| R-06 | Analytics/tracking SDK collects child data without consent | Medium | High — COPPA violation | Audit all third-party SDKs before inclusion. No analytics on child users without parental consent. Use privacy-preserving analytics (e.g., Plausible, Fathom) or server-side analytics. |
| R-07 | AI model provider changes data retention/training policies | Low | Medium — potential compliance gap | Monitor Anthropic policy updates. Include data processing terms in vendor agreement. Use API-level opt-out of training (Anthropic default). |
| R-08 | Cookie consent implementation is non-compliant | Medium | Medium — regulatory fines in EU/state | Use a reputable Consent Management Platform (CMP). Test consent flows across browsers. Audit consent records quarterly. |
| R-09 | Accessibility lawsuit (ADA Title III) | Medium (if not addressed) | Medium — legal costs, injunction | WCAG 2.1 AA compliance (6.7). Automated + manual accessibility testing. Publish a Voluntary Product Accessibility Template (VPAT). |
| R-10 | Employee/contractor accesses student data without authorization | Low | High — FERPA violation | Role-based access control. Background checks for team members with data access. Audit log monitoring with anomaly alerts. |

---

## 9. Assumptions

| ID | Assumption | Impact if Wrong |
|---|---|---|
| A-01 | Learnfyra will launch in the US market only for Phase 1. | If international users access the platform, GDPR applies immediately. Implement geo-blocking or GDPR consent flow. |
| A-02 | The platform is "directed to children" under COPPA, meaning COPPA applies to all users, not just verified children. | If the FTC agrees (likely, given K-12 focus), the entire platform must be COPPA-compliant from day one. |
| A-03 | Anthropic API does not train on API inputs by default. | If Anthropic changes this policy, student worksheet content could be used for training. Mitigated by keeping PII out of prompts. |
| A-04 | Phase 1 is direct-to-consumer (no school district contracts). | FERPA is not triggered in Phase 1. If a school starts using Learnfyra informally, FERPA gray area exists. |
| A-05 | No payment processing in Phase 1. | PCI DSS is out of scope. If payments are added, a separate compliance workstream is needed. |
| A-06 | Learnfyra does not use targeted advertising or sell user data. | CCPA "sale" provisions and COPPA advertising restrictions have minimal impact. If ad-supported model is considered, full re-assessment is needed. |
| A-07 | AWS infrastructure (us-east-1) provides adequate data residency for US users. | If state laws impose data localization requirements (none currently for EdTech), multi-region may be needed. |
| A-08 | Legal counsel will review Privacy Policy and Terms of Service before public launch. | If launched without legal review, risk of non-compliant legal documents. |

---

## 10. Appendix — Regulatory Reference Table

| Regulation | Full Name | Enforced By | Penalty Range | Learnfyra Applicability |
|---|---|---|---|---|
| COPPA | Children's Online Privacy Protection Act | FTC | Up to $50,120/violation | Directly applicable — platform directed at children |
| FERPA | Family Educational Rights and Privacy Act | US Dept. of Education | Loss of federal funding for partner schools | Applicable when schools adopt Learnfyra |
| CCPA/CPRA | California Consumer Privacy Act / California Privacy Rights Act | California AG, CPPA | $2,500/violation, $7,500/intentional, private right of action for breaches | Applicable for California users |
| GDPR | General Data Protection Regulation | EU DPAs | Up to 4% global revenue or EUR 20M | Not applicable Phase 1; applicable if EU users served |
| CA AB 2013 | California AI Transparency Act | California AG | Varies | Applicable — AI-generated content disclosure |
| Section 508 | Rehabilitation Act Section 508 | DOJ / Federal agencies | Lawsuits, contract loss | Applicable for school district sales |
| ADA Title III | Americans with Disabilities Act | DOJ / Private lawsuits | Injunctive relief, attorney fees | Applicable — web platform is a public accommodation |
| SOPIPA | Student Online Personal Protection Act (Illinois) | Illinois AG | Varies | Applicable if Illinois school users |
| NY SHIELD Act | Stop Hacks and Improve Electronic Data Security Act | NY AG | Varies | Applicable for New York users — security safeguards |
| TDPSA | Texas Data Privacy and Security Act | Texas AG | Up to $7,500/violation | Applicable for Texas users — no revenue threshold |

---

## Document Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| Product Owner | ________________ | ________ | ________ |
| Engineering Lead | ________________ | ________ | ________ |
| Legal Counsel | ________________ | ________ | ________ |
| Privacy Lead / DPO | ________________ | ________ | ________ |

---

*This document must be reviewed quarterly and updated whenever new regulations take effect or the platform's data practices change. Next scheduled review: July 2026.*

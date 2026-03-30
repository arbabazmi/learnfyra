# Learnfyra Super Admin: Platform Operations Specification
# File: docs/specs/super-admin-platform-operations-spec.md
# Version: 1.0 — Comprehensive Backend Operations Module
# Date: March 24, 2026
# Status: Business requirements specification — NO CODE

---

## Module Name

**Super Admin Platform Operations Center** — Complete Backend Management System

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/technical/platform/LOCAL_DEV_STRATEGY.md](docs/technical/platform/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)
3. Operations runbook companion: [docs/operations/runbooks/admin-control-plane-operations-spec.md](docs/operations/runbooks/admin-control-plane-operations-spec.md)

---

## Executive Summary

This specification expands Learnfyra's Super Admin module beyond AI model and key management into a **comprehensive platform operations center**. It defines four distinct admin roles (Super Admin, Ops Admin, Support Admin, Data/Compliance Admin) and covers all critical backend operations: user management, content moderation, inventory visibility, quality assurance, billing controls, incident response, support tooling, and system policy management.

**Existing Scope (already specified):**
- AI model provider routing and configuration
- API key management and secret rotation
- Model performance monitoring and cost tracking
- Multi-provider failover and canary deployments

**New Scope (this document):**
- User account lifecycle management
- Teacher/student content moderation and safety
- Worksheet and question bank inventory and analytics
- Answer key quality review and scoring validation
- Billing controls, quota enforcement, cost allocation
- Incident response controls and emergency overrides
- Support tools for troubleshooting user issues
- System-wide policy and configuration management

---

## Problem Statement

As Learnfyra scales from local CLI to multi-tenant AWS SaaS platform, operational complexity grows exponentially:

1. **User Management Gap**: No visibility into teacher/student accounts, no abuse prevention, no account lifecycle controls
2. **Content Safety Risk**: AI-generated worksheets lack moderation — risk of generating inappropriate content for K-10 students
3. **Quality Blind Spot**: No systematic review of answer key accuracy or scoring logic correctness
4. **Billing Chaos**: AWS costs accumulate with no per-user attribution, no quota enforcement, no chargeback reporting
5. **Support Dysfunction**: Support team has no tools to troubleshoot user issues, view user activity, or reset stuck workflows
6. **Incident Response Gap**: When production breaks, no emergency controls to disable features, throttle traffic, or override broken configs
7. **Policy Fragmentation**: System configurations scattered across CDK, environment variables, and hardcoded values — no central truth
8. **Audit Compliance Risk**: No comprehensive audit trail for admin actions across all operational domains

**Without a unified operations center:**
- Security incidents take hours to detect and days to remediate
- Support tickets escalate due to lack of diagnostic tooling
- AWS bills spiral without cost attribution or prevention
- Content quality degrades without systematic review
- Regulatory compliance (FERPA, COPPA, GDPR) remains unverifiable

---

## Strategic Goals

1. **Operational Visibility**: Single dashboard for platform health, user activity, content metrics, cost trends
2. **Proactive Risk Mitigation**: Automated alerts, policy enforcement, and pre-incident controls prevent problems before they escalate
3. **Rapid Incident Response**: Sub-5-minute response time from alert to emergency override, sub-30-minute rollback for any change
4. **Support Empowerment**: Support team resolves 80% of tickets without engineering escalation
5. **Cost Predictability**: AWS spend per user tracked, quota enforcement prevents runaway costs, chargeback reports enable business decisions
6. **Compliance Readiness**: Full audit trail, data access controls, automated compliance reporting for FERPA/COPPA/GDPR
7. **Quality Assurance**: Systematic answer key review, scoring validation, content moderation ensure educational integrity

---

## Role Definitions and Responsibilities

### Role 1: Super Admin

**Who Holds This Role:**
- CTO / Head of Engineering
- VP Product
- Founder / CEO
- Maximum 3-5 people across entire organization

**Responsibilities:**
1. **Overall Platform Control**: Approve all production configuration changes, manage environment promotions (dev → staging → prod)
2. **User Lifecycle**: Create/suspend/delete user accounts, assign roles, override account restrictions
3. **Emergency Response**: Execute emergency shutdowns, enable maintenance mode, override all system controls
4. **Policy Management**: Define and enforce system-wide policies (quota limits, rate limits, content policies, SLA guarantees)
5. **Compliance Oversight**: Review audit logs, manage data retention policies, approve data access requests
6. **Financial Control**: Set AWS budget thresholds, approve cost overrides, review chargeback allocation
7. **Team Management**: Grant/revoke admin access for Ops, Support, and Data/Compliance admins

**Access Level:**
- **Read**: All systems, all environments, all audit logs, all user data (PII redacted except when compliance requires)
- **Write**: All systems in dev/staging, production requires approval workflow except emergency overrides
- **Delete**: Can delete test data in dev/staging, production deletions require compliance review + approval

**Critical Restrictions:**
- Cannot bypass audit logging (all actions logged, no exceptions)
- Cannot access raw API keys (can rotate, cannot view plaintext)
- Cannot modify historical audit records
- Production changes require second Super Admin approval (two-person rule)
- Account suspension requires documented justification

---

### Role 2: Operations Admin (Ops Admin)

**Who Holds This Role:**
- DevOps engineers
- Site Reliability Engineers (SRE)
- On-call engineering rotation
- Team size: 3-10 people depending on scale

**Responsibilities:**
1. **System Health Monitoring**: Respond to CloudWatch alarms, investigate latency spikes, error rate increases, resource exhaustion
2. **Model Operations**: Configure and test AI model routing, manage canary deployments, execute rollbacks
3. **Infrastructure Management**: Monitor AWS service health, optimize Lambda memory/timeout, manage S3 lifecycle policies
4. **Incident Response**: Investigate production incidents, coordinate with Super Admin for emergency overrides, document post-mortems
5. **Performance Optimization**: Analyze CloudWatch metrics, identify bottlenecks, recommend infrastructure improvements
6. **Cost Optimization**: Identify cost anomalies, recommend service optimizations, implement cost-saving measures (after approval)

**Access Level:**
- **Read**: All operational metrics, logs, alarms across all environments; user activity logs (PII redacted); cost and billing data
- **Write**: Full write access to dev/staging; production read-only except emergency rollback (requires approval within 5 minutes)
- **Delete**: Can delete test resources in dev/staging, no production delete access

**Critical Restrictions:**
- Cannot view or manage user accounts (names, emails, profile data)
- Cannot access worksheet content or answer keys (only metadata and generation metrics)
- Cannot modify billing policies or quota limits (only recommend changes)
- Cannot grant or revoke admin privileges
- Emergency rollback requires incident ticket and post-mortem within 24 hours

---

### Role 3: Support Admin

**Who Holds This Role:**
- Customer support team
- Teacher success managers
- Technical support engineers
- Team size: 5-15 people depending on user base

**Responsibilities:**
1. **User Troubleshooting**: Investigate why teacher/student cannot generate worksheet, solve worksheet, or download files
2. **Account Recovery**: Reset forgotten passwords, unlock suspended accounts (after Super Admin approval), resend verification emails
3. **Worksheet Debugging**: View user's generated worksheets (content + metadata), replay solve sessions, investigate scoring discrepancies
4. **Content Moderation**: Review flagged worksheets for inappropriate content, escalate to Super Admin for content policy violations
5. **Usage Analytics**: Generate reports on teacher/class/school usage patterns, identify power users, detect anomalies
6. **Feature Support**: Help teachers use advanced features (batch generation, custom topics, timed mode), document common issues

**Access Level:**
- **Read**: User profile data (name, email, school, role), worksheet metadata (not full content unless needed for troubleshooting), solve session logs, support ticket history
- **Write**: Can reset passwords, update user profile (school name, grade taught), add internal notes to user accounts
- **Delete**: Cannot delete any user data; can flag content for Super Admin review

**Critical Restrictions:**
- Cannot view answer keys unless user explicitly grants access via support request
- Cannot modify billing or quota settings
- Cannot access system logs, infrastructure metrics, or cost data
- Cannot suspend or delete accounts (must escalate to Super Admin)
- All user data access logged in audit trail with justification

---

### Role 4: Data & Compliance Admin

**Who Holds This Role:**
- Data Protection Officer (DPO)
- Compliance manager
- Legal/privacy counsel
- Team size: 1-3 people

**Responsibilities:**
1. **Compliance Reporting**: Generate FERPA, COPPA, GDPR compliance reports, export audit logs for regulatory review
2. **Data Access Governance**: Review and approve data access requests from law enforcement, parents, schools
3. **Privacy Controls**: Manage data retention policies, approve data deletion requests, ensure PII protection
4. **Audit Trail Review**: Investigate suspicious admin activity, review access patterns, identify policy violations
5. **Quality Assurance**: Review answer key accuracy reports, validate scoring algorithm fairness, audit AI-generated content for bias
6. **Policy Enforcement**: Monitor compliance with content policies, usage policies, SLA commitments

**Access Level:**
- **Read**: Full audit logs (all admin actions), user data export (PII included for compliance), answer key quality metrics, content moderation logs
- **Write**: Can update data retention policies, approve/deny data access requests, flag non-compliant content
- **Delete**: Can approve user data deletion requests (GDPR right to erasure), cannot execute deletions directly

**Critical Restrictions:**
- Cannot modify system configurations or infrastructure
- Cannot access API keys or secrets
- Cannot perform support actions (password resets, account unlocks)
- Cannot execute emergency overrides
- All compliance actions require documented legal justification

---

## Feature Set: Critical Admin Capabilities

### 1. User Management

#### 1.1 Account Lifecycle Management

**User Stories:**

**US-UM-01**: As a Super Admin, I want to view a searchable list of all teacher and student accounts so that I can monitor platform adoption and identify anomalies.

**Given** the Super Admin is logged into the admin dashboard  
**When** they navigate to Users → All Accounts  
**Then** they see a paginated table with: UserID, Email, Name, Role (Teacher/Student), School, Grade(s), AccountStatus (Active/Suspended/Pending), CreatedDate, LastLoginDate, WorksheetCount, Solve SessionCount  
**And** they can search by email, name, or school  
**And** they can filter by role, status, or date range  
**And** they can export filtered results as CSV

---

**US-UM-02**: As a Super Admin, I want to suspend a user account with a documented reason so that I can prevent abusive users from accessing the platform.

**Given** a user account shows signs of abuse (e.g., 500 worksheets generated in 1 hour, flagged content)  
**When** the Super Admin clicks "Suspend Account" and enters a suspension reason  
**Then** the user's account status changes to "Suspended"  
**And** the user cannot log in or generate new content  
**And** existing worksheets remain accessible to the user (read-only) unless Super Admin also flags them for deletion  
**And** an audit log entry records: Admin UserID, Target UserID, Action="AccountSuspended", Reason, Timestamp  
**And** the user receives an email notification explaining the suspension and appeal process

---

**US-UM-03**: As a Super Admin, I want to delete a user account and all associated data so that I can fulfill GDPR data deletion requests.

**Given** a user submits a GDPR Article 17 "right to erasure" request  
**When** the Super Admin reviews the request and clicks "Delete Account + All Data"  
**Then** the system shows a confirmation modal listing: worksheets to delete, solve sessions to delete, S3 objects to delete, DynamoDB records to delete  
**And** the Super Admin must enter a compliance ticket number and re-authenticate  
**And** the system executes a cascading delete: S3 objects → DynamoDB records → user account record  
**And** an audit log records the deletion with compliance justification  
**And** the deletion completes within 7 days (per GDPR requirements)  
**And** a final confirmation email is sent to the user's registered email address

---

#### 1.2 Role and Permission Management

**US-UM-04**: As a Super Admin, I want to grant Support Admin access to a team member so that they can help troubleshoot user issues.

**Given** a new support team member needs admin access  
**When** the Super Admin navigates to Admin Users → Add Admin  
**And** selects "Support Admin" role and enters the team member's email  
**Then** the team member receives an invitation email with setup instructions  
**And** after setup, the team member can access only Support Admin features  
**And** an audit log records: GrantedBy (Super Admin ID), GrantedTo (email), Role="SupportAdmin", Timestamp

---

**US-UM-05**: As a Super Admin, I want to revoke admin access immediately when a team member leaves the company so that former employees cannot access the system.

**Given** a team member with Ops Admin access has left the company  
**When** the Super Admin clicks "Revoke Access" on the team member's admin account  
**Then** the admin account is immediately disabled  
**And** all active sessions for that admin are terminated  
**And** the former team member cannot log in  
**And** an audit log records the revocation  
**And** a security notification is sent to security@company.com

---

#### 1.3 Account Monitoring and Abuse Detection

**US-UM-06**: As an Ops Admin, I want to receive real-time alerts when a user exceeds normal usage thresholds so that I can investigate potential abuse before it impacts costs.

**Given** a teacher account's usage patterns are monitored  
**When** the account generates >100 worksheets in 1 hour (10x normal rate)  
**Then** CloudWatch triggers an alarm  
**And** the Ops Admin receives a Slack/email alert with: UserID, Email, WorksheetCount, TimeWindow, EstimatedCost  
**And** the alert includes a link to the user's activity dashboard  
**And** the Ops Admin can click "Flag for Review" to escalate to Super Admin

---

**US-UM-07**: As a Support Admin, I want to view a user's recent activity timeline so that I can troubleshoot their support request.

**Given** a teacher submits a support ticket "My worksheet won't generate"  
**When** the Support Admin looks up the user by email  
**Then** they see a timeline of recent events: login attempts, worksheet generation requests (with status/error), downloads, solve sessions  
**And** failed generation requests show error messages and Claude API response codes  
**And** the Support Admin can replay the generation request to reproduce the issue  
**And** all user data access is logged in the audit trail

---

### 2. Worksheet and Question Inventory Visibility

#### 2.1 Content Inventory Dashboard

**US-INV-01**: As a Super Admin, I want to see aggregate statistics on all worksheets generated across the platform so that I can understand usage patterns and identify popular topics.

**Given** the platform has been live for 3 months  
**When** the Super Admin views the Inventory Dashboard  
**Then** they see:
- Total worksheets generated (all-time, this month, this week)
- Breakdown by grade (bar chart showing distribution)
- Breakdown by subject (pie chart)
- Top 10 topics by generation count
- Average questions per worksheet
- Most common difficulty levels
- Worksheet format distribution (PDF/DOCX/HTML/Solve Online)
- Peak generation times (hour of day, day of week heatmap)

---

**US-INV-02**: As a Data & Compliance Admin, I want to search for worksheets by content keywords so that I can investigate flagged content or respond to removal requests.

**Given** a parent reports inappropriate content in a worksheet on "Chemical Reactions"  
**When** the Data Admin searches for worksheets with metadata containing "chemical reactions" and filters by Grade=8, Subject=Science  
**Then** they see a list of matching worksheets with: WorksheetID, GeneratedBy (UserID), GeneratedDate, Topic, QuestionCount, FlaggedCount  
**And** they can click to view full worksheet content (questions + answer key)  
**And** they can flag individual questions as "Inappropriate" and add admin notes  
**And** flagged worksheets are automatically queued for Super Admin review

---

#### 2.2 Answer Key Quality Metrics

**US-INV-03**: As a Data & Compliance Admin, I want to see aggregate accuracy metrics for AI-generated answer keys so that I can identify topics where answer quality is poor.

**Given** the platform has generated 10,000 worksheets with answer keys  
**When** the Data Admin views Answer Key Quality Dashboard  
**Then** they see:
- Overall answer key accuracy score (based on spot-check reviews)
- Accuracy breakdown by subject and topic
- Question types with lowest accuracy (e.g., "show-your-work" at 72% vs "multiple-choice" at 98%)
- Flagged answer keys pending review count
- Manual review completion rate

---

**US-INV-04**: As a Data & Compliance Admin, I want to manually review AI-generated answer keys for accuracy so that I can maintain educational quality.

**Given** the Data Admin selects "Answer Keys Pending Review" queue  
**When** they open a worksheet for review  
**Then** they see: Question, AI-Generated Answer, AI Explanation, Student Submissions (if any), Scoring Results  
**And** they can mark the answer as "Correct", "Incorrect", or "Needs Improvement"  
**And** they can add corrected answer + explanation  
**And** if marked "Incorrect", the worksheet is flagged and removed from public visibility  
**And** an audit log records the review outcome

---

#### 2.3 Content Moderation

**US-INV-05**: As a Support Admin, I want to view flagged worksheets reported by teachers or parents so that I can escalate inappropriate content.

**Given** a teacher clicks "Report Issue" on a generated worksheet  
**When** the Support Admin views the Moderation Queue  
**Then** they see: WorksheetID, ReportedBy (UserID), ReportReason, FlaggedDate, Status (Pending/Reviewed/Escalated)  
**And** they can view the full worksheet content  
**And** they can add internal notes and escalate to Super Admin or Data Admin  
**And** escalated reports trigger email notifications to Super Admin

---

**US-INV-06**: As a Super Admin, I want to immediately remove a worksheet from all users' accounts if it contains inappropriate content so that no student can access it.

**Given** a worksheet is confirmed to contain inappropriate content (e.g., incorrect history facts, offensive example text)  
**When** the Super Admin clicks "Remove Worksheet Globally"  
**Then** the worksheet's S3 objects are deleted  
**And** all download URLs are invalidated  
**And** any user who generated this worksheet sees "Worksheet removed by admin" in their history  
**And** an incident report is auto-generated with: WorksheetID, RemovalReason, AffectedUserCount, RemovalTimestamp  
**And** affected users receive a notification email with an apology and offer to regenerate

---

### 3. Billing and Cost Controls

#### 3.1 Cost Visibility and Attribution

**US-BILL-01**: As a Super Admin, I want to see real-time AWS cost per user so that I can identify high-cost accounts and optimize pricing.

**Given** AWS costs are tracked in CloudWatch  
**When** the Super Admin views the Billing Dashboard  
**Then** they see:
- Total AWS spend (today, this week, this month, projected monthly)
- Cost breakdown by service (Lambda, S3, API Gateway, CloudFront, Secrets Manager)
- Cost per user (total cost / active user count)
- Top 10 users by cost (UserID, Email, WorksheetCount, Est. Cost)
- Cost trend chart (daily spend over last 30 days)
- Claude API cost vs AWS infrastructure cost

---

**US-BILL-02**: As a Super Admin, I want to set monthly cost limits per user so that individual users cannot exceed budget thresholds.

**Given** the platform offers a free tier with limits  
**When** the Super Admin navigates to Settings → Quota Management  
**And** sets "Free Tier: 50 worksheets/month, $5 AWS cost limit"  
**Then** user accounts are automatically throttled when they reach 50 worksheets  
**And** if a user somehow exceeds $5 in attributed costs, their account is auto-suspended pending review  
**And** an alert is sent to Super Admin with: UserID, ExceededLimit, CurrentCost  
**And** the user receives an email explaining the limit and upgrade options

---

#### 3.2 Cost Alerts and Overrides

**US-BILL-03**: As an Ops Admin, I want to receive alerts when hourly AWS spend exceeds expected thresholds so that I can investigate runaway costs before they escalate.

**Given** CloudWatch monitors hourly spend  
**When** hourly spend exceeds $50 (dev: $5, staging: $10, prod: $50)  
**Then** an SNS alert triggers  
**And** Ops Admin receives Slack + email notification with: CurrentHourlyRate, ExpectedRate, CostDelta, TopCostContributors  
**And** the alert includes a direct link to AWS Cost Explorer filtered to the current hour  
**And** Ops Admin can click "Acknowledge" to silence repeated alerts or "Escalate" to notify Super Admin

---

**US-BILL-04**: As a Super Admin, I want to temporarily increase a user's quota for special events (e.g., teacher professional development workshop) so that they can generate more worksheets without upgrading.

**Given** a teacher requests a temporary quota increase for a 3-day workshop  
**When** the Super Admin navigates to the user's account → Quota Management  
**And** sets "Temporary Override: 200 worksheets, expires 2026-04-01"  
**Then** the user can generate up to 200 worksheets until April 1  
**And** after expiration, the quota reverts to default  
**And** an audit log records: Admin, User, OldQuota, NewQuota, Expiration, Reason

---

### 4. Incident Response and Emergency Controls

#### 4.1 Emergency Shutdowns and Maintenance Mode

**US-INC-01**: As a Super Admin, I want to enable maintenance mode immediately when a critical production incident occurs so that users cannot trigger additional failures.

**Given** a critical bug is discovered in the worksheet generation Lambda  
**When** the Super Admin clicks "Enable Maintenance Mode"  
**Then** the frontend displays a maintenance page to all users  
**And** all API requests return HTTP 503 Service Unavailable  
**And** existing worksheet downloads continue to work (S3 presigned URLs remain valid)  
**And** an incident record is created with: StartTime, Reason, EstimatedResolutionTime  
**And** a status page update is auto-posted (if integrated with status page service)  
**And** maintenance mode can be disabled with one click after the fix is deployed

---

**US-INC-02**: As an Ops Admin, I want to immediately roll back a failed deployment without waiting for approval so that service is restored quickly.

**Given** a deployment to production causes error rate to spike from 0.1% to 15%  
**When** the Ops Admin clicks "Emergency Rollback"  
**Then** the system rolls back to the last known good GitCommit SHA  
**And** Lambda functions are redeployed with the previous version  
**And** rollback completes within 60 seconds  
**And** the Ops Admin must file an incident report within 4 hours explaining the rollback  
**And** an audit log records: Admin, Environment, RollbackFrom (commit), RollbackTo (commit), Timestamp, Reason

---

#### 4.2 Feature Flags and Circuit Breakers

**US-INC-03**: As a Super Admin, I want to disable the "Solve Online" feature instantly if it's causing production issues so that other parts of the platform remain operational.

**Given** the online solve feature is experiencing high error rates due to a scoring bug  
**When** the Super Admin navigates to Feature Flags → Online Solve  
**And** toggles "Enabled" to "Disabled"  
**Then** the frontend hides the "Solve Online" button on all worksheets  
**And** any in-progress solve sessions show a graceful error message  
**And** the feature can be re-enabled with one toggle  
**And** an audit log records the feature flag change

---

**US-INC-04**: As an Ops Admin, I want to enable a circuit breaker on Claude API calls when error rate exceeds 10% so that the system fails fast instead of retrying and accumulating costs.

**Given** Claude API is experiencing an outage  
**When** error rate exceeds 10% over 5 minutes  
**Then** the circuit breaker automatically opens  
**And** all new generation requests return "Service temporarily unavailable, please try again in 5 minutes"  
**And** the system stops making Claude API calls (no retries)  
**And** the circuit breaker automatically closes after 5 minutes if error rate drops below 5%  
**And** Ops Admin is notified of circuit breaker state changes via Slack

---

### 5. Support Tools and User Troubleshooting

#### 5.1 Debugging User Issues

**US-SUP-01**: As a Support Admin, I want to replay a failed worksheet generation request so that I can reproduce the error and investigate the root cause.

**Given** a teacher reports "Worksheet generation failed with 'Internal Server Error'"  
**When** the Support Admin looks up the user's failed request in the activity log  
**And** clicks "Replay Request"  
**Then** the system re-executes the generation request with the same parameters  
**And** displays the Claude API request/response, Lambda logs, and error stack trace  
**And** the Support Admin can compare the replay result with the original failure  
**And** they can escalate to Ops Admin with full diagnostic data

---

**US-SUP-02**: As a Support Admin, I want to view a student's solve session step-by-step so that I can explain why their answer was marked incorrect.

**Given** a student complains "My math answer was correct but scored wrong"  
**When** the Support Admin looks up the solve session by WorksheetID + StudentName  
**Then** they see: 
- Each question with student's submitted answer, correct answer, scoring result, explanation
- Scoring algorithm used (exact match, case-insensitive, keyword match, etc.)
- Timestamp of submission
- Whether the student used timed or untimed mode
- Time taken per question (if available)  
**And** the Support Admin can flag the question for Data Admin review if scoring appears incorrect

---

#### 5.2 Account Recovery

**US-SUP-03**: As a Support Admin, I want to reset a user's password immediately so that they can regain access to their account without waiting for an automated email.

**Given** a teacher forgot their password and the automated reset email is not arriving (spam filter issue)  
**When** the Support Admin verifies the user's identity (email + school name match)  
**And** clicks "Send Manual Password Reset"  
**Then** the system generates a time-limited reset link (valid 1 hour)  
**And** the Support Admin copies the link and sends it via support ticket  
**And** an audit log records: Admin, User, Action="PasswordResetManual", Timestamp

---

**US-SUP-04**: As a Support Admin, I want to unlock a suspended account after confirming the user is not abusive so that legitimate users can resume using the platform.

**Given** a user's account was auto-suspended for exceeding rate limits (false positive: workshop event)  
**When** the Support Admin reviews the suspension reason and confirms it was not abuse  
**And** clicks "Unlock Account"  
**Then** the account status changes from "Suspended" to "Active"  
**And** the user receives an email notification that their account is restored  
**And** an audit log records: Admin, User, Action="AccountUnlocked", Reason

---

### 6. System Policy and Configuration Management

#### 6.1 Central Policy Management

**US-POL-01**: As a Super Admin, I want to update system-wide rate limits from a central dashboard so that I don't need to redeploy code to adjust throttling.

**Given** the platform experiences high traffic and needs temporary rate limiting  
**When** the Super Admin navigates to Settings → Rate Limits  
**And** updates "MaxWorksheetsPerHour" from 10 to 5 for free-tier users  
**Then** the change takes effect within 60 seconds (DynamoDB config cache TTL)  
**And** all Lambda functions read the new limit from DynamoDB config  
**And** an audit log records: Admin, PolicyChanged="MaxWorksheetsPerHour", OldValue, NewValue, Timestamp

---

**US-POL-02**: As a Super Admin, I want to define content policies (prohibited topics, age-appropriateness rules) in a central config so that the AI generation prompt builder enforces them.

**Given** the Super Admin wants to prohibit politically sensitive topics for Grade 1-5  
**When** they navigate to Settings → Content Policies  
**And** add "Prohibited Topics (K-5): Politics, Religion, Violence, Mature Themes"  
**Then** the AI prompt builder injects these constraints into every Claude API request  
**And** if Claude generates content matching prohibited keywords, the generation is rejected and retried  
**And** repeated policy violations by the AI trigger an alert to Ops Admin

---

#### 6.2 Environment Configuration

**US-POL-03**: As a Super Admin, I want to configure different quota limits per environment (dev/staging/prod) so that dev/staging have unlimited usage for testing.

**Given** the Super Admin is configuring environment-specific policies  
**When** they navigate to Settings → Environment Overrides  
**Then** they see:
- Dev: Unlimited worksheets, no cost limits, no rate limits
- Staging: 1000 worksheets/day, $100/day cost limit, 100 req/min rate limit
- Prod: Per-user quotas, cost tracking, 20 req/min per user  
**And** they can edit these values per environment  
**And** changes require second Super Admin approval for prod

---

### 7. Audit, Compliance, and Reporting

#### 7.1 Comprehensive Audit Trail

**US-AUD-01**: As a Data & Compliance Admin, I want to export a complete audit log of all admin actions for the past 90 days so that I can respond to compliance audits.

**Given** a school district requests an audit of all admin access to student data  
**When** the Data Admin navigates to Audit Logs → Export  
**And** selects date range (last 90 days) and filters for "User Data Access" events  
**Then** the system generates a CSV export with: Timestamp, AdminUserID, AdminRole, Action, TargetUserID (if applicable), IPAddress, UserAgent, Justification (if entered), Result  
**And** the export is downloaded or emailed to the Data Admin  
**And** the export request itself is logged in the audit trail

---

**US-AUD-02**: As a Data & Compliance Admin, I want to search audit logs for all times a specific user's data was accessed so that I can respond to GDPR data access requests.

**Given** a user submits a GDPR Article 15 "right to access" request  
**When** the Data Admin searches audit logs for TargetUserID = <user's ID>  
**Then** they see all admin actions involving this user: account views, password resets, worksheet views, data exports, support ticket access  
**And** they can export this filtered log as a PDF to send to the user  
**And** the search result shows PII access was performed by Support Admin on <dates> with justification "Support Ticket #12345"

---

#### 7.2 Compliance Reporting

**US-AUD-03**: As a Data & Compliance Admin, I want to generate a FERPA compliance report showing all instances of student data access so that schools can verify compliance.

**Given** the platform stores student names and solve session data  
**When** the Data Admin clicks "Generate FERPA Compliance Report" for date range Jan-Mar 2026  
**Then** the report shows:
- Total student accounts
- Student data access events (who accessed, when, why)
- Data export events (if any)
- Data deletion requests fulfilled
- Policy violations (if any)  
**And** the report is formatted per FERPA requirements  
**And** the report generation is audited

---

**US-AUD-04**: As a Super Admin, I want to see a dashboard of all compliance-related metrics so that I can proactively identify risks.

**Given** the platform must comply with FERPA, COPPA, GDPR  
**When** the Super Admin views the Compliance Dashboard  
**Then** they see:
- Student accounts under age 13 (COPPA-regulated) count
- Parental consent verification rate
- Data deletion request response time (avg days to fulfill)
- Audit log retention status (must retain 7 years per policy)
- PII encryption status (all student data encrypted at rest: ✅ or ❌)
- Recent compliance violations or warnings

---

## Acceptance Criteria Summary

### Must-Have for MVP (Phase 1)

✅ **User Management Core:**
- View all user accounts with search/filter
- Suspend/unsuspend accounts with documented reason
- Grant/revoke admin access (all 4 roles)
- Basic audit logging of admin actions

✅ **Incident Response:**
- Enable/disable maintenance mode
- Emergency rollback (Ops Admin)
- Feature flags to disable features instantly

✅ **Cost Controls:**
- Real-time AWS cost dashboard
- Per-user cost attribution
- Cost limit alerts (hourly threshold exceeded)

✅ **Support Tools:**
- View user activity timeline
- Replay failed worksheet generation
- Manual password reset

✅ **Inventory Visibility:**
- Aggregate worksheet statistics (count, grade/subject breakdown)
- Search worksheets by metadata

✅ **Audit Trail:**
- Log all admin actions to DynamoDB audit table
- Search audit logs by admin or target user

---

### Phase 2 Enhancements

🔮 **Advanced User Management:**
- Bulk account operations (import, suspend, delete)
- Automated abuse detection (ML-based anomaly detection)

🔮 **Content Quality:**
- Automated answer key accuracy scoring
- Manual answer key review workflow
- Content moderation queue with AI pre-screening

🔮 **Advanced Billing:**
- Per-school or per-district cost allocation
- Chargeback reports for cost recovery
- Dynamic quota adjustments based on usage patterns

🔮 **Advanced Support:**
- Full solve session replay (step-by-step student interaction)
- Automated troubleshooting (chatbot suggesting solutions)

🔮 **Advanced Compliance:**
- Automated FERPA/COPPA/GDPR compliance reporting
- Data retention policy automation (auto-delete after X years)
- Parental consent workflow

🔮 **Advanced Monitoring:**
- Predictive alerts (detect issues before they impact users)
- SLA monitoring and reporting
- User satisfaction metrics (CSAT, NPS integrated)

---

## Out of Scope

❌ **Billing and Payment Processing**: Stripe integration, invoicing, subscription management (separate module)  
❌ **Customer-Facing Self-Service**: This is internal admin tooling only — no teacher/student-facing admin features  
❌ **Real-Time Chat Support**: No live chat widget or ticketing system integration (use existing tools)  
❌ **Marketing Analytics**: No user acquisition funnels, conversion tracking, or growth metrics (separate product analytics tool)  
❌ **Advanced AI/ML Ops**: No model training, fine-tuning, or custom model pipelines (use existing Claude API)  
❌ **Multi-Tenancy**: No school district isolation, white-labeling, or per-tenant customization (future enterprise feature)

---

## AWS Services Involved

1. **User Management**: DynamoDB (user table, admin table), Cognito (authentication)
2. **Inventory**: DynamoDB (worksheet metadata table), S3 (worksheet content)
3. **Audit Trail**: DynamoDB (audit events table), CloudWatch Logs
4. **Billing**: CloudWatch (custom metrics), AWS Cost Explorer API
5. **Incident Response**: Lambda environment variables + DynamoDB config, S3 (feature flag config)
6. **Support Tools**: CloudWatch Logs Insights, DynamoDB query APIs
7. **Admin Dashboard**: API Gateway + Lambda (admin API), CloudFront + S3 (frontend)

---

## Dependencies

1. **Authentication System**: Cognito user pools for admin login (or Auth0)
2. **Existing AI Model Routing**: Extends `super-admin-backend-model-routing-master-spec.md`
3. **Worksheet Generation Pipeline**: Must exist before inventory visibility is useful
4. **Online Solve Feature**: Required for solve session debugging tools
5. **CDK Infrastructure**: All resources provisioned via CDK (no manual AWS console changes)

---

## Open Questions

1. **Q: Should Super Admin dashboard be a separate React SPA or integrated into existing frontend?**  
   A: Separate dashboard (admin.learnfyra.com) to isolate admin tooling from student-facing UI. Shared component library for consistency.

2. **Q: How do we verify admin identity for high-risk actions (account deletion, maintenance mode)?**  
   A: Require MFA re-authentication before executing any destructive action. Super Admin actions require second approval (two-person rule).

3. **Q: What is the policy for admin access to student PII?**  
   A: Follow principle of least privilege: Support Admin sees PII only when troubleshooting a specific ticket (with audit log). Data Admin sees PII for compliance requests only. Ops Admin never sees PII.

4. **Q: Should audit logs be stored in DynamoDB or S3 + Athena for cost optimization?**  
   A: DynamoDB for recent logs (last 90 days, fast search), auto-archive to S3 after 90 days for long-term retention + compliance (query via Athena).

5. **Q: How do we handle "shadow admin" risk (admin abusing access)?**  
   A: All admin actions audited in real-time, alerts on suspicious patterns (e.g., admin accessing 100+ user accounts in 1 hour), quarterly security review of audit logs by external auditor.

6. **Q: Do we need role-based access control (RBAC) granularity below the 4 admin roles?**  
   A: Not in MVP — 4 roles sufficient. Phase 2 can add custom permission sets if needed (e.g., "Support Admin - Read Only" vs "Support Admin - Password Reset Enabled").

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Admin onboarding time | <5 minutes from invite to first action | Track time between invite sent and first audit log entry |
| Incident response time | <5 minutes from alert to mitigation (maintenance mode or rollback) | CloudWatch alarm → audit log timestamp delta |
| Support ticket resolution without escalation | >80% | Count of tickets resolved by Support Admin vs escalated to engineering |
| Cost anomaly detection accuracy | >90% (low false positive rate) | Track alerts vs actual cost overruns |
| Audit log search latency | <2 seconds for 90-day search | DynamoDB query performance |
| GDPR data deletion fulfillment time | <7 days | Track from request submission to completion |
| Compliance report generation time | <60 seconds | Time to generate FERPA report for 10,000 users |

---

## Implementation Guidelines (for DEV/IaC/DevOps Agents)

### Admin Dashboard Architecture

```
admin.learnfyra.com (CloudFront + S3)
  ├── React SPA (admin UI)
  └── API Gateway → Lambda (admin API functions)
       ├── adminUserManagement.js (CRUD users)
       ├── adminInventory.js (search worksheets)
       ├── adminBilling.js (cost queries)
       ├── adminAudit.js (search logs)
       ├── adminIncident.js (maintenance mode, rollbacks)
       └── adminSupport.js (troubleshoot user issues)
```

### Database Schema Extensions

**New DynamoDB Tables:**
```
learnfyra-{env}-admin-users
  PK: AdminUserID (UUID)
  Attributes: Email, Name, Role (SuperAdmin|OpsAdmin|SupportAdmin|DataComplianceAdmin), 
              Status (Active|Suspended), CreatedAt, CreatedBy, MFAEnabled, LastLoginAt

learnfyra-{env}-audit-events
  PK: EventID (UUID)
  SK: Timestamp (sortable)
  GSI: AdminUserID-Timestamp-index
  GSI: TargetUserID-Timestamp-index
  Attributes: AdminUserID, AdminRole, Action, TargetUserID, TargetResource, 
              IPAddress, UserAgent, Justification, Result (Success|Failure), ErrorMessage

learnfyra-{env}-system-config
  PK: ConfigKey (e.g., "MaxWorksheetsPerHour", "MaintenanceMode", "FeatureFlags")
  Attributes: Value, Environment, UpdatedBy, UpdatedAt, TTL (for cache invalidation)
```

### Security Requirements

1. **Admin authentication**: Cognito user pool separate from teacher/student pool, MFA required
2. **API authorization**: Lambda authorizer validates JWT + checks admin role
3. **IP whitelisting**: Admin API only accessible from company VPN or approved IPs (configurable)
4. **Secrets**: All admin API keys in Secrets Manager, rotated every 90 days
5. **Audit immutability**: Audit log writes are append-only, no delete/update permissions granted to any role

---

## Appendix: Admin User Journey Examples

### Journey 1: Support Admin Troubleshoots Failed Worksheet
1. Teacher submits ticket: "Worksheet generation failed"
2. Support Admin logs into admin.learnfyra.com
3. Searches for user by email → views activity timeline
4. Sees failed generation request at 10:35 AM with error "Claude API timeout"
5. Clicks "Replay Request" → sees request succeeded on replay
6. Concludes: transient API issue, advises teacher to retry
7. Support Admin adds internal note to ticket, closes as resolved

### Journey 2: Super Admin Responds to Cost Alert
1. CloudWatch alarm fires: "Hourly spend $75 (expected $50)"
2. Super Admin receives Slack alert, clicks dashboard link
3. Sees cost spike due to one user (teacher@school.edu) generating 200 worksheets in 1 hour
4. Views user's account → sees workshop event in notes
5. Applies temporary quota increase: 500 worksheets, expires tomorrow
6. Adds note: "Science PD workshop at Lincoln High"
7. Alert acknowledged, incident closed

### Journey 3: Data Admin Fulfills GDPR Deletion Request
1. User submits GDPR deletion request via email
2. Data Admin logs into admin dashboard → opens Compliance → Data Requests
3. Creates new request: UserID, RequestType="Deletion", Justification="GDPR Article 17"
4. System shows impact: 43 worksheets, 12 solve sessions, 8 S3 objects
5. Data Admin reviews, clicks "Approve Deletion"
6. Super Admin (second approver) receives notification, reviews, approves
7. System executes deletion over 24 hours, sends confirmation email to user

---

**End of Specification**

---

## Document Metadata

| Field | Value |
|---|---|
| **Document Type** | Business Requirements Specification |
| **Approval Required** | Super Admin (CTO/VP Eng) + Product Lead |
| **Code Changes** | None (spec only) |
| **Next Steps** | DEV agent implements admin API, IaC agent provisions resources, QA agent writes tests |
| **Estimated Effort** | MVP (Phase 1): 4-6 weeks (2 backend devs, 1 frontend dev, 1 QA) |
| | Phase 2: 6-8 weeks (additional features) |

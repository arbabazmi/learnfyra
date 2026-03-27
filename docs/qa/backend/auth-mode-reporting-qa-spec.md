# Authentication, Mode Selection & Reporting — QA Specification
**Document Version:** 1.0  
**Created:** 2026-03-24  
**Project:** Learnfyra  
**Scope:** Auth + authorization, student modes (guest/login), offline/online workflows, weakness reporting  
**Author:** QA Agent  
**Status:** Specification — No Code  

---

## Executive Summary

This QA specification covers testing for Learnfyra's authentication system, student mode selection (guest vs. logged-in), online/offline worksheet solving flows, score management by teachers/parents, and weakness reporting aggregated by class and subject.

**Key Features Under Test:**
- Student guest mode (anonymous solve, no persistence)
- Student login mode (OAuth-first, local account fallback)
- Authorization: online solve requires login, offline solve allows guest
- Offline score updates submitted by teacher/parent accounts
- Online result storage with student association
- Weakness reports: class-level and subject-level analytics

**Testing Phases:**
1. Authentication & authorization flows
2. Mode selection and user journey routing
3. Data capture and storage (online/offline)
4. Offline workflow and reconciliation
5. Reporting correctness and privacy
6. Security, privacy, and data integrity
7. Edge cases and failure modes
8. User Acceptance Testing (UAT)

---

## 1. Test Matrix

### 1.1 Authentication — Student Guest Mode

| Test ID | User Type | Action | Expected Behavior | Verification |
|---------|-----------|--------|-------------------|--------------|
| **AUTH-G-001** | Anonymous student | Lands on solve?id=xyz | "Solve as Guest" button visible | No auth prompt, button clickable |
| **AUTH-G-002** | Anonymous student | Clicks "Solve as Guest" | Enters solve flow immediately, no login | Solve page loads, timer/questions render |
| **AUTH-G-003** | Anonymous student | Completes guest solve | Results shown, no save option | Results display, "Your results are not saved" message |
| **AUTH-G-004** | Anonymous student | Guest results page | "Create Account to Save Results" prompt shown | CTA button visible |
| **AUTH-G-005** | Anonymous student | Clicks "Create Account" post-solve | Account creation form opens, results held in session | Form modal/page, results preserved |
| **AUTH-G-006** | Anonymous student | Creates account after guest solve | Results saved to new account, associated with student ID | Database: score record has studentId |
| **AUTH-G-007** | Anonymous student | Closes tab after guest solve | No data persisted, no record in database | Database: no orphan records with null studentId |
| **AUTH-G-008** | Anonymous student | Guest solve, then login existing account | Prompted to link results or discard | Modal: "Save these results to [username]?" |
| **AUTH-G-009** | Anonymous student | Multiple guest solves in session | Each solve independent, no history shown | No solve history visible |
| **AUTH-G-010** | Anonymous student | Guest solve, online worksheet | Should be blocked — online requires login | Error message: "Please log in to solve this worksheet online" |

### 1.2 Authentication — Student Login (OAuth + Local)

| Test ID | Auth Method | Action | Expected Behavior | Verification |
|---------|-------------|--------|-------------------|--------------|
| **AUTH-L-001** | Google OAuth | Click "Sign in with Google" | OAuth consent screen opens in popup/redirect | Google OAuth flow initiated |
| **AUTH-L-002** | Google OAuth | Completes consent, returns token | User created/logged in, redirected to dashboard or solve page | JWT token in localStorage/cookie, user session active |
| **AUTH-L-003** | Google OAuth | OAuth fails (user cancels) | Returns to login screen, error message shown | "Sign-in cancelled" or similar |
| **AUTH-L-004** | Google OAuth | OAuth token expired mid-session | Silent refresh attempted, or re-auth prompt | No data loss, transparent re-auth |
| **AUTH-L-005** | Local account | Fills email + password, clicks "Sign Up" | Account created, verification email sent | Database: user record created, email status = pending |
| **AUTH-L-006** | Local account | Clicks verification link in email | Account verified, user redirected to login | email_verified = true, user can login |
| **AUTH-L-007** | Local account | Login with unverified email | Login succeeds, prompt to verify shown | User session active, banner: "Please verify your email" |
| **AUTH-L-008** | Local account | Incorrect password (3 attempts) | Account locked or rate limited | Error: "Too many attempts, try again in 15 minutes" |
| **AUTH-L-009** | Local account | Forgot password flow | Reset email sent, token valid 1 hour | User receives email, token link works once |
| **AUTH-L-010** | Local account | Password reset with expired token | Error message, prompt to request new token | "This link has expired" |
| **AUTH-L-011** | Mixed | Student logs in via OAuth, then adds local password | Both auth methods linked to same account | Database: user has oauth_id AND password_hash |
| **AUTH-L-012** | Mixed | Student has OAuth + local, deletes OAuth connection | Can still login with local password | OAuth disconnected, local auth unaffected |
| **AUTH-L-013** | Student (logged in) | Solves worksheet online | Results auto-saved to account | Database: results table has studentId, worksheetId, timestamp |
| **AUTH-L-014** | Student (logged in) | Views "My Results" page | All prior solve results listed | UI displays history, scores, dates |
| **AUTH-L-015** | Student (logged in) | Logout, then login again | Session restored, history persists | Same results visible after re-login |

### 1.3 Authentication — Teacher/Parent Login

| Test ID | User Type | Auth Method | Action | Expected Behavior | Verification |
|---------|-----------|-------------|--------|-------------------|--------------|
| **AUTH-T-001** | Teacher | Google OAuth | Sign in with Google (teacher account) | Teacher dashboard shown, not student dashboard | Role = teacher in JWT |
| **AUTH-T-002** | Teacher | Local account | Create teacher account, select role "Teacher" | Account created with role=teacher | Database: users.role = 'teacher' |
| **AUTH-T-003** | Teacher | Login | Accesses offline score upload feature | "Upload Offline Scores" menu visible | UI element present for teachers only |
| **AUTH-T-004** | Parent | Local account | Create account, role "Parent" | Parent dashboard shown | Database: role = 'parent' |
| **AUTH-T-005** | Parent | Login | Links child accounts (by code or email invite) | Parent sees linked students, can view their results | Database: parent_child_link table |
| **AUTH-T-006** | Parent | Dashboard | Attempts to upload offline scores | Upload feature allowed | Parent can submit scores for linked children |
| **AUTH-T-007** | Admin | Login | Super-admin role assigned | Access to user management, reports | Role = 'admin' in JWT |
| **AUTH-T-008** | Teacher | Role escalation attempt | Tampers JWT, changes role to 'admin' | Backend rejects, returns 403 Forbidden | Server validates JWT signature, role mismatch detected |
| **AUTH-T-009** | Teacher | Session timeout (30 min idle) | Auto-logout, redirect to login | Session cookie expired, user prompted to re-auth |
| **AUTH-T-010** | Teacher | Cross-site login attempt | Opens Learnfyra in iframe on malicious site | X-Frame-Options denies, or SameSite cookie blocks | No session established in iframe context |

### 1.4 Authorization — Online/Offline Mode Access Control

| Test ID | User Type | Worksheet Mode | Action | Expected Behavior | Verification |
|---------|-----------|----------------|--------|-------------------|--------------|
| **AUTHZ-001** | Anonymous student | Online worksheet | Clicks solve link | Blocked, prompted to login | Error: "Login required for online worksheets" |
| **AUTHZ-002** | Logged-in student | Online worksheet | Clicks solve link | Allowed, solve page loads | Solve flow starts, timer/questions visible |
| **AUTHZ-003** | Anonymous student | Offline worksheet PDF | Downloads PDF, solves on paper | No login required, download succeeds | PDF served, no auth check |
| **AUTHZ-004** | Anonymous student | Offline worksheet | Teacher uploads scores later | Scores recorded without student login | Database: scores can have studentId=null or identifier |
| **AUTHZ-005** | Logged-in student | Offline worksheet | Solves on paper, teacher uploads score | Score linked to student account by name/ID | Database: score record matches studentId |
| **AUTHZ-006** | Logged-in student | Online worksheet | Submits answers | Results saved to user account instantly | Database: result stored with studentId, timestamp |
| **AUTHZ-007** | Teacher | Online worksheet generation | Creates worksheet, sets mode = "online" | Worksheet flagged as online-only | Database: worksheets.mode = 'online' |
| **AUTHZ-008** | Teacher | Offline worksheet generation | Creates worksheet, mode = "offline" | PDF/DOCX download, no online solve button | UI: "Solve Online" button hidden |
| **AUTHZ-009** | Teacher | Mixed worksheet | Generates with mode = "both" | Both online solve and PDF download available | UI: both buttons shown |
| **AUTHZ-010** | Student | Worksheet link expired | Attempts to solve expired online worksheet | Error: "This worksheet has expired" | Database: worksheet.expiresAt < now() |
| **AUTHZ-011** | Student | Class-restricted worksheet | Attempts to solve worksheet meant for different class | Blocked, error message | Error: "This worksheet is for [Class Name] only" |
| **AUTHZ-012** | Student | Teacher-assigned worksheet | Solves worksheet assigned specifically to them | Allowed, result records assignment link | Database: worksheet_assignment.studentId matches |

### 1.5 Data Capture — Guest vs. Logged-In Online Solve

| Test ID | User Type | Solve Type | Data Captured | Storage Location | Retention |
|---------|-----------|------------|---------------|------------------|-----------|
| **DATA-001** | Guest student | Guest online solve (if allowed) | answers[], timeTaken, timed flag | Session storage only, no DB | Cleared on tab close |
| **DATA-002** | Guest student | Guest solve, submits | Results calculated, shown in UI | Ephemeral — no database record | None |
| **DATA-003** | Logged-in student | Online solve | worksheetId, studentId, answers[], score, timestamp | Database: results table | Indefinite (or retention policy) |
| **DATA-004** | Logged-in student | Online solve | weakness data (incorrect topics) | Database: weaknesses table | Indefinite |
| **DATA-005** | Logged-in student | Online solve, timed mode | timeTaken, timed=true | Database: results.timeTaken, results.timed | Stored |
| **DATA-006** | Logged-in student | Online solve, untimed | timed=false, timeTaken still captured | Database: results.timed=false | Stored |
| **DATA-007** | Logged-in student | Partial solve (abandoned) | No record created | No database write | None (or draft saved if feature exists) |
| **DATA-008** | Logged-in student | Re-solves same worksheet | New result record created | Database: multiple results same worksheetId+studentId | All attempts stored |
| **DATA-009** | Logged-in student | Solves 10 worksheets | 10 result records | Database: 10 rows, correct studentId | All stored |
| **DATA-010** | Logged-in student | Solve with special chars in answers | answers escaped/sanitized | Database: safe storage, no SQL injection | Data integrity preserved |

### 1.6 Data Capture — Offline Score Upload by Teacher/Parent

| Test ID | User Type | Upload Method | Data Format | Expected Behavior | Verification |
|---------|-----------|---------------|-------------|-------------------|--------------|
| **DATA-OFF-001** | Teacher | CSV upload | studentName, worksheetId, score, questionResults | Bulk insert, scores linked to students | Database: scores table populated |
| **DATA-OFF-002** | Teacher | CSV upload | Invalid studentName | Error report: "Student [name] not found in class" | Upload partially succeeds, errors listed |
| **DATA-OFF-003** | Teacher | Manual form entry | Single student score, per-question breakdown | Form submits, score recorded | Database: 1 result record |
| **DATA-OFF-004** | Teacher | CSV upload | Missing required column (e.g., score) | Upload rejected, error message | "CSV must include: studentName, worksheetId, score" |
| **DATA-OFF-005** | Parent | Manual form for linked child | Child selector, worksheet selector, score | Score recorded for child | Database: parentId linked to result record |
| **DATA-OFF-006** | Parent | Attempts to upload score for non-linked child | Blocked, authorization error | Error: "You can only submit scores for linked children" |
| **DATA-OFF-007** | Teacher | CSV with 100 rows | Bulk upload | All 100 processed, transaction atomic | All succeed or all fail (rollback on error) |
| **DATA-OFF-008** | Teacher | CSV with duplicate entries | Same student+worksheet uploaded twice | Second upload updates or creates new attempt | Configurable: update or append |
| **DATA-OFF-009** | Teacher | CSV with score > totalPoints | Validation error | Error: "Score cannot exceed total points" |
| **DATA-OFF-010** | Teacher | CSV with per-question breakdown | questionResults JSON array | Detailed results stored | Database: results.questionResults[] populated |
| **DATA-OFF-011** | Teacher | CSV with empty score | Interpreted as 0 or null | Configurable: treat as 0 or skip | Error or default behavior |
| **DATA-OFF-012** | Teacher | Upload references nonexistent worksheetId | Error: "Worksheet [id] not found" | Upload fails for those rows |
| **DATA-OFF-013** | Teacher | Upload for class not assigned to teacher | Blocked, authorization check | Error: "You do not have access to this class" |

### 1.7 Reporting — Weakness Analysis Correctness

| Test ID | Report Type | Aggregation Level | Input Data | Expected Output | Verification |
|---------|-------------|-------------------|------------|-----------------|--------------|
| **REPORT-001** | Weakness report | Single student | 5 worksheets, 3 math topics | Chart shows % incorrect per topic | UI: bar chart, correct percentages |
| **REPORT-002** | Weakness report | Class-level | 20 students, Math subject | Aggregated topics needing improvement | Report: "Multiplication: 40% class avg, Fractions: 60%" |
| **REPORT-003** | Weakness report | Subject breakdown | All subjects for class | Separate reports for Math, ELA, Science | UI: tabs or dropdowns per subject |
| **REPORT-004** | Weakness report | Class, no data | Class with 0 results | "No data available" message | UI: graceful empty state |
| **REPORT-005** | Weakness report | Student, all correct answers | 10 worksheets, 100% scores | Weakness report shows "No weaknesses identified" | UI: positive message |
| **REPORT-006** | Weakness report | Student, all incorrect | 10 worksheets, 0% scores | All topics flagged as needing improvement | UI: all topics in red/yellow |
| **REPORT-007** | Weakness report | Class with mixed performance | 50% students < 70%, 50% > 90% | Report shows distribution, highlights struggling topics | Chart: histogram or box plot |
| **REPORT-008** | Weakness report | Topic-level drill-down | Click topic "Fractions" | Shows per-student performance on Fractions | Drill-down table: student names, scores |
| **REPORT-009** | Weakness report | Date range filter | Last 30 days only | Report recalculates based on date filter | Data filtered correctly |
| **REPORT-010** | Weakness report | Cross-subject comparison | Math vs ELA weakness | Side-by-side charts | UI: compare view |
| **REPORT-011** | Weakness report | Export to CSV | Click "Export Report" | CSV downloaded with correct data | File: studentName, topic, score, date |
| **REPORT-012** | Weakness report | Real-time update | New score added during report view | Report refreshes or shows stale data | Configurable: auto-refresh or manual |
| **REPORT-013** | Weakness report | Teacher views another teacher's class | Authorization check | Blocked, 403 Forbidden | Error: "Access denied" |
| **REPORT-014** | Weakness report | Parent views linked child | Own child's weakness report | Allowed, shows child-specific data | Report filtered to child's results |
| **REPORT-015** | Weakness report | Parent attempts to view class report | Teacher-only feature | Blocked or limited view | Error or read-only aggregate |

### 1.8 Reporting — Class & Subject Aggregation

| Test ID | Aggregation | Filters | Expected Calculation | Verification |
|---------|-------------|---------|----------------------|--------------|
| **REPORT-AGG-001** | Class average | All students, all worksheets | SUM(scores) / COUNT(results) | Math check: manual calculation matches |
| **REPORT-AGG-002** | Subject average | Math only, all students | Filter by subject, then average | Correct filtering, accurate average |
| **REPORT-AGG-003** | Topic average | "Multiplication", class-wide | Filter by topic, average score | Cross-check with source data |
| **REPORT-AGG-004** | Date range average | Last 7 days | Only results within date range | Timestamp filtering correct |
| **REPORT-AGG-005** | Per-student aggregation | Student A, all subjects | Separate averages per subject | Student-level breakdown accurate |
| **REPORT-AGG-006** | Percentile calculation | Class, 90th percentile score | Correct percentile ranking | Statistical validation |
| **REPORT-AGG-007** | Grade-level comparison | Grade 3 Math vs Grade 4 Math | Separate aggregations | No cross-grade contamination |
| **REPORT-AGG-008** | Mixed online + offline results | 10 online, 10 offline scores | Both included in aggregation | No mode bias in calculations |
| **REPORT-AGG-009** | Weighted average (if applicable) | Different point totals per worksheet | Weighted by totalPoints | Weighting formula correct |
| **REPORT-AGG-010** | Exclude incomplete results | Some students have 0 attempts | Only count completed results | Incomplete students not skewing average |

---

## 2. Security & Privacy Test Cases

### 2.1 Authentication Security

| Test ID | Attack Vector | Action | Expected Defense | Verification |
|---------|---------------|--------|------------------|--------------|
| **SEC-AUTH-001** | Brute force login | 100 login attempts, wrong password | Rate limiting after 5 attempts | Lockout for 15 min or CAPTCHA |
| **SEC-AUTH-002** | SQL injection in email field | Email: `' OR '1'='1` | Input sanitized, login fails | No database error, no unauthorized access |
| **SEC-AUTH-003** | XSS in username | Username: `<script>alert(1)</script>` | Stored escaped, not executed | UI renders escaped text, no alert |
| **SEC-AUTH-004** | Session fixation | Pre-set session ID, then login | New session ID generated on login | Session ID changes post-auth |
| **SEC-AUTH-005** | Session hijacking | Steal JWT, replay from different IP | JWT includes IP or device fingerprint, rejected | 403 Forbidden, "Session invalid" |
| **SEC-AUTH-006** | CSRF on password change | Malicious site submits password change form | CSRF token required, request blocked | 403 Forbidden, no password change |
| **SEC-AUTH-007** | OAuth token leaked | Attacker obtains OAuth token | Token expires after 1 hour, refresh required | Short token lifespan limits damage |
| **SEC-AUTH-008** | Weak password | Password: "12345" | Rejected, password policy enforced | Error: "Password must be 8+ chars, include uppercase, number" |
| **SEC-AUTH-009** | Password reuse | User resets password to old password | Blocked, history check | Error: "Cannot reuse last 3 passwords" |
| **SEC-AUTH-010** | Enumeration attack | Login attempts to guess valid emails | Generic error: "Invalid credentials" (no hint) | Same error for wrong email or wrong password |

### 2.2 Authorization & Access Control

| Test ID | Scenario | Attacker Action | Expected Defense | Verification |
|---------|----------|-----------------|------------------|--------------|
| **SEC-AUTHZ-001** | Direct URL access | Student guesses teacher report URL | 403 Forbidden, role check | Error: "Unauthorized" |
| **SEC-AUTHZ-002** | API endpoint bypass | POST /api/reports without auth header | 401 Unauthorized | No data returned |
| **SEC-AUTHZ-003** | Role escalation | Student tampers JWT, changes role to teacher | Backend validates JWT signature, rejects | 403 Forbidden, JWT invalid |
| **SEC-AUTHZ-004** | Worksheet ID enumeration | Iterate worksheetIds, access others' results | Only own results returned | Authorization filter on query |
| **SEC-AUTHZ-005** | Parent access to non-linked child | Parent changes studentId in API request | Blocked, authorization fails | Error: "Access denied" |
| **SEC-AUTHZ-006** | Teacher accesses another school's class | Teacher changes classId in request | Blocked, school/district isolation | 403 Forbidden |
| **SEC-AUTHZ-007** | Admin impersonation | User sets role=admin in localStorage | Backend ignores client-side claims, uses JWT | No elevated privileges |
| **SEC-AUTHZ-008** | IDOR on results endpoint | GET /api/results?userId=other_user_id | Blocked, userId must match JWT subject | Error or empty results |
| **SEC-AUTHZ-009** | Bulk data extraction | Scrape /api/reports in loop | Rate limiting, IP blocking | 429 Too Many Requests |
| **SEC-AUTHZ-010** | Cross-class data leak | Teacher queries students not in their class | Empty result set or error | Database filter: classId IN teacher.classes |

### 2.3 Data Privacy & PII Protection

| Test ID | Data Type | Scenario | Expected Behavior | Verification |
|---------|-----------|----------|-------------------|--------------|
| **SEC-PRIV-001** | Student names | Report displays student names | Only visible to authorized teacher/parent | Role-based masking |
| **SEC-PRIV-002** | Email addresses | Student email in API response | Not exposed in public endpoints | JSON: email field absent or redacted |
| **SEC-PRIV-003** | Password storage | User creates account | Password hashed with bcrypt/argon2 | Database: password_hash, algorithm identifier |
| **SEC-PRIV-004** | Answer content | Student answers to open-ended questions | Stored securely, not logged | Logs: no PII, only IDs |
| **SEC-PRIV-005** | OAuth tokens | Google OAuth token | Stored encrypted or in secure key vault | Database: encrypted field or external vault |
| **SEC-PRIV-006** | Session cookies | Auth cookie set | HTTPOnly, Secure, SameSite=Strict | Browser DevTools: flags set |
| **SEC-PRIV-007** | GDPR export | Student requests data export | All results, scores, PII exported | JSON file with complete data |
| **SEC-PRIV-008** | GDPR deletion | Student requests account deletion | All PII deleted, scores anonymized | Database: user record deleted, results studentId=null |
| **SEC-PRIV-009** | Data minimization | Guest solve | No PII collected without consent | No tracking cookies, no account creation |
| **SEC-PRIV-010** | Third-party analytics | Google Analytics or similar | No PII sent to analytics | Analytics payload: no names, emails |

### 2.4 Network & Transport Security

| Test ID | Attack Vector | Action | Expected Defense | Verification |
|---------|---------------|--------|------------------|--------------|
| **SEC-NET-001** | HTTP access | Navigate to http://learnfyra.com | Redirect to HTTPS | Browser redirected |
| **SEC-NET-002** | Certificate validation | Invalid SSL certificate | Browser warning | Connection not trusted |
| **SEC-NET-003** | Man-in-the-middle | Intercept API request | TLS encryption prevents reading | Wireshark: payload encrypted |
| **SEC-NET-004** | Mixed content | HTTPS page loads HTTP script | Browser blocks, CSP error | Console error, script not executed |
| **SEC-NET-005** | API key exposure | ANTHROPIC_API_KEY in client JS | Never exposed, backend only | View-source: no API key |
| **SEC-NET-006** | CORS bypass | Malicious site calls API | CORS headers block request | Preflight fails, no data leak |
| **SEC-NET-007** | Clickjacking | Learnfyra in iframe on phishing site | X-Frame-Options: DENY | Iframe blocked |
| **SEC-NET-008** | DDoS simulation | 10,000 requests in 1 second | Rate limiting, IP block, CloudFlare | 503 Service Unavailable or throttled |
| **SEC-NET-009** | Token interception | Steal JWT from network | Short TTL, refresh token in HTTPOnly cookie | Attacker limited to 1-hour window |
| **SEC-NET-010** | DNS spoofing | Attacker redirects DNS to fake site | DNSSEC, HTTPS enforced | Browser shows cert mismatch |

---

## 3. Data Integrity & Reconciliation Tests

### 3.1 Offline Score Upload → Online Sync

| Test ID | Scenario | Offline Upload | Expected Reconciliation | Verification |
|---------|----------|----------------|-------------------------|--------------|
| **RECON-001** | New offline score | Teacher uploads score for student who never solved online | New result record created, source=offline | Database: results.source = 'offline' |
| **RECON-002** | Duplicate student+worksheet | Student solved online, teacher also uploads offline score | Two separate records OR overwrite based on policy | Configurable: keep both or latest |
| **RECON-003** | Conflicting scores | Online: 80%, Offline upload: 90% for same attempt | Both stored, highest score shown in report (configurable) | UI: flag icon indicating conflict |
| **RECON-004** | Offline upload before online solve | Teacher uploads score, student solves online later | Two attempts, both valid | Database: 2 results, timestamps differ |
| **RECON-005** | Batch upload 50 scores, 5 students already have online scores | 45 new records, 5 conflicts | Conflict resolution policy applied | Report: "45 added, 5 updated/conflicted" |
| **RECON-006** | Offline score with detailed questionResults | Teacher uploads per-question data | Online + offline results aggregated in weakness report | Report: both data sources included |
| **RECON-007** | Student name mismatch | Offline CSV: "John Doe", Database: "Doe, John" | Fuzzy matching or manual resolution | UI: "Match student: John Doe → Doe, John?" |
| **RECON-008** | Missing student in database | Offline upload for student not in system | Error or create placeholder student | Configurable: auto-create or reject |
| **RECON-009** | Worksheet not in database | Offline upload references worksheetId not generated yet | Error: "Worksheet not found" | Upload fails for those rows |
| **RECON-010** | Timestamp conflicts | Offline upload has date = "2026-03-01", online solve = "2026-03-15" | Both timestamps preserved, no overwrite | Database: separate createdAt fields |

### 3.2 Data Consistency Across Sessions

| Test ID | Scenario | Action | Expected Consistency | Verification |
|---------|----------|--------|----------------------|--------------|
| **CONSIST-001** | Student solves, closes browser, re-opens | Logout/login cycle | Results still visible in history | Database query: results persist |
| **CONSIST-002** | Teacher uploads scores, refreshes page | Page reload | All uploaded scores still shown | UI: score list unchanged |
| **CONSIST-003** | Parent links child, logs out, logs in | Session reset | Child still linked | Database: parent_child_link unchanged |
| **CONSIST-004** | Network interruption during solve | Submit fails mid-request | Error shown, retry option | UI: "Submission failed, retry?" |
| **CONSIST-005** | Network interruption during offline upload | Upload fails | Rollback, no partial data | Database: transaction rolled back |
| **CONSIST-006** | Concurrent edits | Two teachers upload scores for same student simultaneously | Last-write-wins or lock mechanism | Database: one commit succeeds, other conflicts |
| **CONSIST-007** | Database backup/restore | Backup at time T, restore later | Data consistent with backup snapshot | No orphaned records |
| **CONSIST-008** | Cache invalidation | Result stored, cache layer stale | Cache expires or refreshed on new data | User sees updated data after TTL |
| **CONSIST-009** | Multi-tab workflow | Student solves in tab A, views results in tab B | Tab B reflects new result | Real-time sync or manual refresh |
| **CONSIST-010** | Time zone differences | Teacher in PST uploads score, student in EST views | Timestamps consistent (UTC storage) | Database: UTC timestamps, UI converts to local |

### 3.3 Data Migration & Schema Changes

| Test ID | Migration Type | Scenario | Expected Behavior | Verification |
|---------|----------------|----------|-------------------|--------------|
| **MIGRATE-001** | Add new column | results.timeTaken added | Existing records have NULL or default | No data loss, backwards compatible |
| **MIGRATE-002** | Rename column | results.score → results.totalScore | Migration script updates all records | All rows migrated, no orphans |
| **MIGRATE-003** | Add foreign key constraint | results.studentId must exist in users.id | Orphaned records identified and cleaned | Database: FK constraint passes |
| **MIGRATE-004** | Change data type | results.score from integer to decimal | All scores converted without precision loss | Verify calculations still correct |
| **MIGRATE-005** | Backfill missing data | Old results lack questionResults | Script generates default structure | All records have consistent schema |
| **MIGRATE-006** | Delete deprecated column | results.legacyField removed | Field dropped, no app breakage | Application code updated, tests pass |
| **MIGRATE-007** | Split user roles table | users.role → separate role_assignments table | Data normalized, relationships preserved | Join queries work, no data loss |
| **MIGRATE-008** | Merge duplicate students | Two accounts for same student | Merge records, results consolidated | Database: single student, all results linked |
| **MIGRATE-009** | Archive old data | Results > 2 years old moved to archive table | Archive query fast, main table optimized | Performance improved, data retrievable |
| **MIGRATE-010** | Rollback migration | Migration fails, rollback triggered | Database restored to pre-migration state | All data intact, no corruption |

---

## 4. Edge Cases & Failure Modes

### 4.1 Authentication Edge Cases

| Test ID | Scenario | Expected Behavior | Fallback |
|---------|----------|-------------------|----------|
| **EDGE-AUTH-001** | OAuth provider down | "Sign in with Google" fails | "Try local account" or retry message |
| **EDGE-AUTH-002** | Email verification link clicked twice | First click verifies, second shows "Already verified" | No error, redirect to login |
| **EDGE-AUTH-003** | User creates account, deletes email, tries to reset password | No email sent, user must contact support | "Email not found" or support link |
| **EDGE-AUTH-004** | User changes email, verification pending | Old email still active until verified | Two emails in transition state |
| **EDGE-AUTH-005** | JWT expires mid-request | 401 Unauthorized, refresh token used | Silent re-auth or login prompt |
| **EDGE-AUTH-006** | User deletes account, then tries to login | Error: "Account not found" | No PII leaked |
| **EDGE-AUTH-007** | Multiple devices logged in, logout on one | Other sessions remain active (unless logout all) | Configurable behavior |
| **EDGE-AUTH-008** | OAuth returns invalid user info | Account creation fails, error shown | "Unable to create account, try again" |
| **EDGE-AUTH-009** | User has no role assigned | Default role = student applied | No access errors |
| **EDGE-AUTH-010** | Admin account locked | Master admin can unlock or time-based unlock | Security escalation procedure |

### 4.2 Data Capture Edge Cases

| Test ID | Scenario | Expected Behavior | Fallback |
|---------|----------|-------------------|----------|
| **EDGE-DATA-001** | Student submits empty answers array | Score = 0, result recorded | No crash, valid result |
| **EDGE-DATA-002** | Student submits malformed JSON | 400 Bad Request, validation error | "Invalid submission format" |
| **EDGE-DATA-003** | Student submits 1000-character answer | Truncated to field limit or error | Graceful handling, no crash |
| **EDGE-DATA-004** | Duplicate submission (double-click) | Idempotency key prevents duplicate | Only one result created |
| **EDGE-DATA-005** | Worksheet deleted mid-solve | Submission fails, error shown | "Worksheet no longer exists" |
| **EDGE-DATA-006** | Database write fails | Error returned, retry prompt | "Unable to save, please retry" |
| **EDGE-DATA-007** | Network timeout during submission | 504 Gateway Timeout, retry | Client retries or user re-submits |
| **EDGE-DATA-008** | Student closes tab mid-solve (timed mode) | Timer stops, no result recorded | Data not saved |
| **EDGE-DATA-009** | Student solves worksheet 100 times | All 100 attempts stored | No limit (or configurable cap) |
| **EDGE-DATA-010** | CSV upload with 10,000 rows | Batch processing, progress indicator | Upload succeeds, may take time |

### 4.3 Reporting Edge Cases

| Test ID | Scenario | Expected Behavior | Fallback |
|---------|----------|-------------------|----------|
| **EDGE-REPORT-001** | Class with 1 student | Report generated, no division errors | Valid report, single-student data |
| **EDGE-REPORT-002** | Class with 0 results | "No data available" message | No crash, empty state |
| **EDGE-REPORT-003** | Subject with 1000 topics | Paginated or scrollable list | UI handles large dataset |
| **EDGE-REPORT-004** | Date range with no results | Empty report, date range shown | "No results in selected range" |
| **EDGE-REPORT-005** | Student with 1 result (100% score) | Weakness report shows no weaknesses | Positive message |
| **EDGE-REPORT-006** | Topic name with special characters | Rendered correctly, no XSS | Escaped and safe |
| **EDGE-REPORT-007** | Export report with 10,000 rows | CSV generated, may be large | Download link, file size warning |
| **EDGE-REPORT-008** | Report calculation during upload | Stale data shown until refresh | "Refresh" button or auto-refresh |
| **EDGE-REPORT-009** | Teacher views report, student adds result | Report out of date | Manual refresh or polling |
| **EDGE-REPORT-010** | Cross-school report request | Authorization blocks | 403 Forbidden |

### 4.4 Offline Workflow Edge Cases

| Test ID | Scenario | Expected Behavior | Fallback |
|---------|----------|-------------------|----------|
| **EDGE-OFFLINE-001** | Teacher uploads CSV with UTF-8 BOM | Parsed correctly, BOM stripped | No encoding errors |
| **EDGE-OFFLINE-002** | CSV with extra columns | Extra columns ignored | No error, expected columns processed |
| **EDGE-OFFLINE-003** | CSV with missing rows | Partial upload, errors reported | "Rows 5, 7 failed: missing data" |
| **EDGE-OFFLINE-004** | Teacher uploads scores for future date | Accepted or warning shown | Configurable: allow or warn |
| **EDGE-OFFLINE-005** | Parent uploads score for linked child, child unlinked during upload | Upload fails or succeeds based on transaction | Authorization re-checked |
| **EDGE-OFFLINE-006** | CSV with circular references (matching question) | Data integrity check, error | "Invalid matching data" |
| **EDGE-OFFLINE-007** | Offline upload transaction interrupted | Rollback ensures atomicity | Partial data not committed |
| **EDGE-OFFLINE-008** | Teacher uploads scores, then deletes class | Scores orphaned or cascade delete | Configurable retention policy |
| **EDGE-OFFLINE-009** | Simultaneous uploads by two teachers | Both succeed, no collision | Database locks or idempotency |
| **EDGE-OFFLINE-010** | Upload includes HTML in student name | Sanitized, stored safely | No XSS on display |

---

## 5. User Acceptance Testing (UAT) Scripts

### 5.1 UAT — Student Journey (Guest Mode)

**Persona:** Alex, 5th grade student, first-time user, no account  
**Goal:** Solve a worksheet assigned by teacher without creating account  
**Context:** Teacher shared a link on Google Classroom

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Click worksheet link from Google Classroom | Lands on solve page with worksheet preview | ✅ Page loads in < 3 seconds |
| 2 | Sees "Solve as Guest" button | Understand this is anonymous, no login required | ✅ Button clearly labeled |
| 3 | Clicks "Solve as Guest" | Enters solve page, sees questions and timer option | ✅ Questions render correctly |
| 4 | Chooses "Timed Mode" (20 minutes) | Timer starts countdown, questions accessible | ✅ Timer visible, ticking down |
| 5 | Answers all 10 questions | Input fields work, can navigate between questions | ✅ All input types functional |
| 6 | Clicks "Submit" with 2 minutes remaining | Results page loads instantly | ✅ Score calculated, < 2 seconds |
| 7 | Views results: 8/10 correct (80%) | Sees which answers were correct/incorrect | ✅ Color-coded feedback clear |
| 8 | Sees "Create Account to Save Results" prompt | CTA visible, explains benefit | ✅ Non-intrusive, clear value prop |
| 9 | Clicks browser back button | Returns to results page (no re-solve) | ✅ Browser history works |
| 10 | Closes browser tab | No data persisted, cannot retrieve results | ✅ Ephemeral behavior confirmed |

**Success Metrics:**
- Task completion: < 5 minutes from link click to submit
- Zero errors or confusion about guest mode
- Student understands results are temporary

---

### 5.2 UAT — Student Journey (Logged-In Mode)

**Persona:** Jamie, 7th grade student, has Learnfyra account (Google OAuth)  
**Goal:** Solve multiple worksheets, track progress over time  
**Context:** Part of ongoing class assignments

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Clicks worksheet link from email | Redirected to login page | ✅ Login prompt shown |
| 2 | Clicks "Sign in with Google" | OAuth popup, approves consent | ✅ OAuth flow smooth, < 5 sec |
| 3 | Authenticated, redirected to worksheet | Sees "Welcome back, Jamie" + worksheet details | ✅ Personalized greeting |
| 4 | Chooses "Untimed Mode" | No timer shown, can take as long as needed | ✅ No time pressure |
| 5 | Answers 10 questions over 15 minutes | Can save draft (if feature exists) and return | ✅ Progress saved (optional feature) |
| 6 | Submits worksheet | Results saved to account automatically | ✅ "Results saved" confirmation |
| 7 | Views results: 9/10 (90%) | Detailed feedback per question | ✅ Explanations helpful |
| 8 | Navigates to "My Results" dashboard | Sees all past worksheet attempts | ✅ History visible, sortable |
| 9 | Clicks on worksheet from 2 weeks ago | Past results still accessible | ✅ Data persistence confirmed |
| 10 | Views "My Weaknesses" report | Chart shows topics needing improvement | ✅ Visual chart clear, actionable |

**Success Metrics:**
- Login → Solve → Results: < 10 minutes
- Student can easily find and review past results
- Weakness report provides clear guidance

---

### 5.3 UAT — Teacher Journey (Offline Score Upload)

**Persona:** Ms. Rodriguez, 4th grade teacher, 25 students  
**Goal:** Upload scores from paper worksheets solved in class  
**Context:** Students took printed worksheets home, returned graded

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Logs in to Learnfyra teacher portal | Dashboard with "Upload Offline Scores" button | ✅ Feature clearly visible |
| 2 | Clicks "Upload Offline Scores" | Upload form shown, CSV template download link | ✅ Template available |
| 3 | Downloads CSV template | Excel-compatible, clear column headers | ✅ Opens in Excel/Google Sheets |
| 4 | Fills 25 rows: studentName, worksheetId, score, questionResults | Completes in spreadsheet app | ✅ Template intuitive |
| 5 | Saves CSV, uploads via form | Upload progress bar shown | ✅ Visual feedback |
| 6 | Receives upload summary | "22 scores uploaded, 3 warnings" | ✅ Clear success/error report |
| 7 | Reviews warnings: 3 students not found in class roster | Option to manually match or skip | ✅ Conflict resolution UI |
| 8 | Manually matches 2 students, skips 1 | Matches saved, skipped row logged | ✅ Flexible resolution |
| 9 | Navigates to "Class Reports" | Sees updated scores in weakness report | ✅ Data reflected immediately |
| 10 | Exports class report to PDF | PDF downloaded with charts and tables | ✅ Professional report format |

**Success Metrics:**
- CSV upload: < 2 minutes for 25 students
- Error handling clear, no data loss
- Teacher feels confident data is accurate

---

### 5.4 UAT — Parent Journey (View Child's Progress)

**Persona:** Mr. Chen, parent of 2 children (Emma, grade 3; Liam, grade 6)  
**Goal:** Monitor children's worksheet performance and identify weak areas  
**Context:** Teacher recommended Learnfyra for home practice

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Receives email invite from teacher | Email contains link + access code | ✅ Instructions clear |
| 2 | Clicks link, creates parent account | Fills: name, email, password | ✅ Account creation simple |
| 3 | Enters access codes for Emma and Liam | Both children linked to account | ✅ Multi-child support |
| 4 | Lands on parent dashboard | Sees overview: Emma 5 worksheets, Liam 8 worksheets | ✅ Aggregated view |
| 5 | Selects Emma from dropdown | Dashboard filters to Emma's results | ✅ Child-specific filter works |
| 6 | Views Emma's weakness report | Chart shows "Fractions: 55%, Multiplication: 85%" | ✅ Visual and numerical data |
| 7 | Clicks "Fractions" to drill down | Sees per-worksheet breakdown | ✅ Detailed view available |
| 8 | Switches to Liam's results | Dashboard updates to Liam's data | ✅ Smooth switching |
| 9 | Sees Liam has 1 incomplete worksheet | Status: "In Progress, 6/10 answered" | ✅ Progress tracking |
| 10 | Uploads offline score for Emma (teacher authorized) | Form allows parent upload, score saved | ✅ Parent upload feature works |

**Success Metrics:**
- Parent can link children in < 5 minutes
- Dashboard provides clear progress overview
- Weakness reports actionable for home practice

---

### 5.5 UAT — Teacher Journey (Review Class Weakness Report)

**Persona:** Mr. Thompson, 9th grade Science teacher, 3 classes (90 students total)  
**Goal:** Identify topics needing re-teaching across all classes  
**Context:** End-of-unit assessment, needs data for curriculum planning

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Logs in, navigates to "Reports" | Sees class selector dropdown | ✅ Multi-class support |
| 2 | Selects "All Classes" option | Combined report for all 90 students | ✅ Aggregation works |
| 3 | Filters by Subject: "Science", Date: "Last 30 Days" | Report regenerates with filter | ✅ Filters apply correctly |
| 4 | Views weakness heatmap | Topics color-coded: green (strong), red (weak) | ✅ Visual clarity |
| 5 | Sees "Cell Division" is 40% class average (red) | Identifies priority topic | ✅ Data accurate |
| 6 | Clicks "Cell Division" row | Drill-down shows per-class breakdown | ✅ Granular detail available |
| 7 | Sees Period 1: 50%, Period 2: 35%, Period 3: 45% | Period 2 needs most support | ✅ Actionable insight |
| 8 | Exports report as PDF with charts | PDF includes all data and visualizations | ✅ Shareable format |
| 9 | Schedules re-teaching session for Period 2 | Uses report to inform lesson planning | ✅ Report drives action |
| 10 | Returns to dashboard, sees "New results: 5" badge | Real-time updates when students submit | ✅ Live data feed |

**Success Metrics:**
- Teacher identifies weak topics in < 5 minutes
- Report drives curriculum adjustments
- No confusion about data aggregation

---

### 5.6 UAT — Admin Journey (System Health Check)

**Persona:** System Administrator, Learnfyra IT team  
**Goal:** Verify auth, data integrity, and reporting after feature deployment  
**Context:** Post-deployment verification in staging environment

| Step | Action | Expected Experience | Acceptance Criteria |
|------|--------|---------------------|---------------------|
| 1 | Attempts to login as student with invalid credentials | Error: "Invalid credentials", rate limit after 5 attempts | ✅ Security controls active |
| 2 | Logs in as admin using OAuth | Authenticates, sees admin dashboard | ✅ Admin role recognized |
| 3 | Navigates to "User Management" | Lists all users, roles, statuses | ✅ Admin-only access |
| 4 | Searches for test student account | Finds user, views linked results | ✅ Search functional |
| 5 | Manually links test parent to test student | Relationship created | ✅ Manual override works |
| 6 | Runs data integrity check script | Script reports 0 orphaned records | ✅ Database clean |
| 7 | Tests offline CSV upload with invalid data | Upload fails gracefully, errors logged | ✅ Validation robust |
| 8 | Generates system-wide weakness report | Report spans all schools, classes | ✅ Global aggregation |
| 9 | Checks CloudWatch logs for errors | No 500 errors in last 24 hours | ✅ System stable |
| 10 | Triggers manual data backup | Backup completes, download link shown | ✅ Backup functional |

**Success Metrics:**
- All admin features accessible and functional
- No data integrity issues detected
- Security controls prevent unauthorized access

---

## 6. Test Execution Plan

### 6.1 Testing Phases

| Phase | Focus Area | Duration | Entry Criteria | Exit Criteria |
|-------|-----------|----------|----------------|---------------|
| **Phase 1: Unit Testing** | Authentication logic, scoring algorithms | 2 weeks | Code complete | 80%+ coverage |
| **Phase 2: Integration Testing** | API endpoints, DB transactions | 1 week | Unit tests pass | All endpoints return correct data |
| **Phase 3: Security Testing** | Auth bypass, SQL injection, XSS | 1 week | Integration tests pass | No critical vulnerabilities |
| **Phase 4: Performance Testing** | Load testing reports, CSV uploads | 3 days | Security cleared | < 2s p95 response time |
| **Phase 5: UAT** | Teacher/parent/student workflows | 1 week | All tests pass | UAT scripts complete |
| **Phase 6: Regression Testing** | Verify no existing features broken | 2 days | UAT approved | All smoke tests pass |

### 6.2 Test Environment Configuration

```yaml
# Test Environments — DO NOT include in code, for QA planning only

dev:
  database: PostgreSQL (test data)
  auth: Mock OAuth, local accounts
  s3: LocalStack S3 emulator
  users: 10 students, 3 teachers, 1 parent, 1 admin

staging:
  database: PostgreSQL (production-like data, anonymized)
  auth: Real OAuth (test Google Workspace account), local accounts
  s3: AWS S3 staging bucket
  users: 100 students, 10 teachers, 5 parents, 1 admin

production:
  database: PostgreSQL (real data)
  auth: Real OAuth (production), local accounts
  s3: AWS S3 production bucket
  users: Real users (no test data)
```

### 6.3 Test Data Management

**Student Test Accounts:**
- guest-student (no account)
- student-logged-in (OAuth)
- student-local (local account)
- student-multiple-classes (enrolled in 3 classes)

**Teacher Test Accounts:**
- teacher-single-class (1 class, 20 students)
- teacher-multi-class (3 classes, 60 students)
- teacher-no-students (new account, empty class)

**Parent Test Accounts:**
- parent-single-child (1 linked child)
- parent-multi-child (3 linked children)
- parent-no-children (account, no links)

**Worksheet Test Data:**
- worksheet-online-only (mode=online, requires login)
- worksheet-offline-only (PDF/DOCX, no online solve)
- worksheet-both-modes (supports both)
- worksheet-expired (expiresAt in past)
- worksheet-future (createdAt in future, for edge case testing)

---

## 7. Defect Classification & Prioritization

### 7.1 Severity Levels

| Severity | Definition | Example | Response Time |
|----------|------------|---------|---------------|
| **P0 — Critical** | System down, data loss, security breach | Auth bypass, data deletion bug | Immediate (< 1 hour) |
| **P1 — High** | Major feature broken, blocks workflow | Reports show wrong data, CSV upload fails | Same day (< 4 hours) |
| **P2 — Medium** | Feature degraded, workaround exists | Slow report generation, UI glitch | 2-3 days |
| **P3 — Low** | Cosmetic, minor inconvenience | Button misaligned, typo | Next sprint |

### 7.2 Sample Defect Report Template

```markdown
**Defect ID:** DEF-AUTH-001  
**Severity:** P1 — High  
**Component:** Authentication — OAuth  
**Environment:** Staging  

**Summary:**  
OAuth callback fails when user email contains `+` character

**Steps to Reproduce:**  
1. Create Google account: test+user@example.com
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Observe: error "Invalid email format"

**Expected:**  
User logged in successfully, account created

**Actual:**  
400 Bad Request, "Invalid email format" error

**Root Cause (if known):**  
Email validation regex does not allow `+` character

**Workaround:**  
Use email without `+` character

**Fix Priority:**  
High — blocks subset of users from registering
```

---

## 8. Test Automation Strategy (Future Scope)

### 8.1 Automation Candidates

**High Priority (automate first):**
- Auth login/logout flows (guest + OAuth + local)
- API endpoint tests (all /api/generate, /api/submit, /api/reports)
- Scoring engine (all question types)
- CSV upload validation
- Regression suite (smoke tests)

**Medium Priority:**
- UI tests (Playwright/Cypress): form validation, navigation
- Performance tests: load testing reports with 1000 students
- Security scans: OWASP ZAP, static analysis

**Low Priority (manual acceptable):**
- UAT scripts (need human judgment)
- Visual regression (UI changes frequently)

### 8.2 Suggested Test Framework

```yaml
# Framework choices — recommendations, not code

Unit Tests:
  framework: Jest
  coverage: 80% minimum
  run: Pre-commit hook + CI

Integration Tests:
  framework: Jest + Supertest (API testing)
  database: Test DB with fixtures
  run: CI pipeline (on PR)

E2E Tests:
  framework: Playwright
  browsers: Chrome, Firefox, Safari
  run: Nightly + pre-deploy

Security Tests:
  tools: OWASP ZAP, npm audit, Snyk
  run: Weekly + pre-deploy

Performance Tests:
  tools: k6, Lighthouse
  run: Pre-release (staging)
```

---

## 9. Success Criteria Summary

### 9.1 Functional Acceptance

- ✅ All test cases in Section 1 (Test Matrix) pass
- ✅ All security tests in Section 2 pass with 0 P0/P1 defects
- ✅ Data integrity tests in Section 3 confirm no data loss
- ✅ All UAT scripts in Section 5 complete successfully
- ✅ Regression tests confirm no existing features broken

### 9.2 Performance Acceptance

- ✅ Report generation: < 2 seconds for class of 30 students
- ✅ CSV upload: < 5 seconds for 100 rows
- ✅ Auth login: < 3 seconds (OAuth) or < 1 second (local)
- ✅ Worksheet solve page load: < 2 seconds

### 9.3 Security Acceptance

- ✅ No critical vulnerabilities (authenticated access bypass, SQL injection, XSS)
- ✅ All PII protected: passwords hashed, emails not exposed
- ✅ HTTPS enforced, CORS configured, CSRF protection active

### 9.4 Usability Acceptance

- ✅ Teachers complete offline score upload in < 5 minutes
- ✅ Parents can link children and view reports without support
- ✅ Students complete guest solve with no account friction
- ✅ All error messages clear and actionable

---

## 10. Sign-Off & Approval

### 10.1 QA Sign-Off Checklist

| Checkpoint | Status | Notes |
|------------|--------|-------|
| All test cases executed | ⬜ Pending | |
| No open P0/P1 defects | ⬜ Pending | |
| UAT scripts completed by stakeholders | ⬜ Pending | |
| Security review approved | ⬜ Pending | |
| Performance benchmarks met | ⬜ Pending | |
| Regression tests pass | ⬜ Pending | |
| Documentation updated | ⬜ Pending | |

### 10.2 Approval Signatures

**BA Agent (Requirements Owner):**  
Signature: ________________  Date: __________  
Confirmation: Feature meets acceptance criteria defined in original spec

**QA Agent (Test Lead):**  
Signature: ________________  Date: __________  
Confirmation: All test cases pass, no blocking defects

**DevOps Agent (Deployment Owner):**  
Signature: ________________  Date: __________  
Confirmation: Staging environment stable, ready for production deployment

**Product Owner:**  
Signature: ________________  Date: __________  
Confirmation: Feature approved for release

---

## Appendix A: Test Data SQL (Sample)

```sql
-- DO NOT EXECUTE — Sample test data for reference only

INSERT INTO users (id, email, role, auth_provider) VALUES
  ('student-1', 'alex@example.com', 'student', 'google'),
  ('student-2', 'jamie@example.com', 'student', 'local'),
  ('teacher-1', 'ms.rodriguez@school.edu', 'teacher', 'local'),
  ('parent-1', 'mr.chen@example.com', 'parent', 'local');

INSERT INTO classes (id, name, teacher_id) VALUES
  ('class-1', 'Grade 4 Math', 'teacher-1');

INSERT INTO worksheets (id, grade, subject, topic, mode) VALUES
  ('ws-online', 4, 'Math', 'Fractions', 'online'),
  ('ws-offline', 4, 'Math', 'Multiplication', 'offline');

INSERT INTO results (id, worksheet_id, student_id, score, total_points, source) VALUES
  ('result-1', 'ws-online', 'student-1', 8, 10, 'online'),
  ('result-2', 'ws-offline', 'student-2', 9, 10, 'offline');
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Guest Mode** | Anonymous worksheet solving without account creation; results not saved |
| **OAuth** | Open Authorization standard; Google/Microsoft SSO integration |
| **Local Account** | Username/password authentication managed by Learnfyra |
| **Offline Workflow** | Students solve on paper; teacher/parent uploads scores manually |
| **Online Workflow** | Students solve in browser; results auto-saved to account |
| **Weakness Report** | Analytics showing topics with low performance, aggregated by class/subject |
| **Idempotency** | Duplicate requests produce same result (no double-submission) |
| **IDOR** | Insecure Direct Object Reference; unauthorized access via ID manipulation |
| **PII** | Personally Identifiable Information (names, emails, etc.) |
| **JWT** | JSON Web Token; used for stateless authentication |

---

**Document Status:** Ready for BA Review  
**Next Steps:**  
1. BA Agent reviews for alignment with feature spec  
2. DEV Agent uses as reference during implementation  
3. QA Agent executes test cases during testing phase  

**Questions/Feedback:**  
Contact QA Agent via project Slack channel or GitHub issue

---

*End of QA Specification — No code implementation included per requirements*

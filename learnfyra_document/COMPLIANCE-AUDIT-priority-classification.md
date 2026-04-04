# Learnfyra — Compliance Audit: Requirement Priority Classification

**Document ID:** LFR-AUDIT-001
**Version:** 1.0
**Date:** April 3, 2026
**Source BRD:** LFR-BRD-COMPLIANCE-001 v1.1
**Auditor Role:** Compliance Auditor
**Context:** US-based K-12 EdTech platform serving children under 13
**Validated Against:** Codebase commit `45050ef`

---

## Classification Criteria

| Category | Definition | Launch Gate? |
|---|---|---|
| **MUST HAVE** | Legally mandated. Failure to implement exposes Learnfyra to enforcement action, fines, or injunctions. Cannot launch without these. | YES — blocks public release |
| **SHOULD HAVE** | Strongly recommended by regulation or industry standard. Not immediately enforceable at current scale, but creates significant legal exposure if deferred more than 90 days post-launch. | NO — but implement within 90 days |
| **NICE TO HAVE** | Best practice or future-proofing. No current legal obligation, but positions Learnfyra for growth (school districts, international expansion, SOC 2). | NO — implement in Phase 2+ |

---

## TOP 10 CRITICAL REQUIREMENTS — Must Be Implemented Before Any Public Release

These are the absolute non-negotiable items. Launching without ANY of these creates immediate, enforceable legal liability.

| Rank | Requirement ID | Requirement | Why It Is #1-10 | Current Status | FTC Fine Exposure |
|---|---|---|---|---|---|
| **1** | **FR-02** | **Age Gate at Registration** | Without age determination, Learnfyra cannot distinguish children from adults. Every subsequent COPPA control depends on this. The FTC's 2023 enforcement against Edmodo specifically cited failure to verify ages. This is the single point of failure for the entire compliance program. | NOT BUILT | $50,120/violation |
| **2** | **FR-01** | **Parental Consent Workflow (VPC)** | COPPA Section 312.5 is unambiguous: no data collection from children under 13 without VPC. Learnfyra is "directed to children" — this isn't optional. The FTC treats missing VPC as a strict liability violation. | NOT BUILT | $50,120/violation |
| **3** | **COPPA-02 / Privacy Policy** | **Children's Privacy Notice + Privacy Policy Page** | COPPA Section 312.4 requires a "clear and prominent" privacy notice before collecting any data. The Privacy Policy page does not exist yet (footer links to `/privacy` route but page is blank). No privacy policy = no legal basis for any data collection. | NOT BUILT — route exists, page empty | $50,120/violation + injunction |
| **4** | **FR-07** | **Account Deletion Backend** | COPPA Section 312.6(a)(2) and CCPA Section 1798.105 both grant deletion rights. The UI button exists but the backend endpoint does not. A parent requesting deletion with no mechanism to fulfill it is a violation waiting to happen. | PARTIAL — UI exists, no backend | $50,120 (COPPA) + $7,500 (CCPA) per violation |
| **5** | **FR-03** | **Privacy Dashboard for Parents** | COPPA Section 312.6(a)(1): parents must be able to review all data collected about their child. No dashboard = no way for parents to exercise their rights = violation. | NOT BUILT | $50,120/violation |
| **6** | **COPPA-09 / FR-08** | **Consent Record Storage + Audit Log Retention (3 years)** | COPPA Section 312.10 requires operators to retain consent records for 3 years. Current log retention is 1 month. If the FTC audits, there will be no records to produce. | NOT BUILT — logs exist but 1-month retention | $50,120/violation + adverse inference in FTC investigation |
| **7** | **NFR-03 (validated)** | **Data Minimization Enforcement** | Already mostly compliant (code collects only email, displayName, role, authType). However, `validator.js` accepts optional `studentName`, `teacherName`, `className` fields that are passed to exporters. For children under 13, these fields should be blocked or require parental consent. No DOB field exists to enforce this. | PARTIAL — core is minimal, optional PII fields need gating | $50,120/violation |
| **8** | **AI-01** | **AI Transparency Disclosure** | California AB 2013 (effective January 2026) requires disclosure when content is AI-generated. Learnfyra serves California users. No disclosure label on worksheets currently. This is a state law with active enforcement. | NOT BUILT | California AG enforcement (variable fines) |
| **9** | **NFR-02 (validated)** | **Encryption in Transit (TLS)** | Already implemented and compliant. CloudFront enforces HTTPS, API uses HTTPS_ONLY. Included in Top 10 because if this were to regress (e.g., someone adds an HTTP endpoint), it would be a FERPA violation and breach notification trigger. Must remain enforced. | COMPLIANT | Breach notification liability |
| **10** | **CCPA-03** | **"Do Not Sell" Link** | CCPA Section 1798.135 requires this link on every page, regardless of whether you actually sell data. Simple to implement (footer link), but legally required for California users from day one. Enforcement doesn't require a threshold — it's triggered by serving California consumers. | NOT BUILT | $2,500/violation, $7,500/intentional |

---

## Complete Requirement Classification Table

### FUNCTIONAL REQUIREMENTS

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Age Gate at Registration | FR-02 | **MUST HAVE** | NOT BUILT | COPPA requires age determination before data collection from a platform "directed to children." Without this, every user interaction is a potential COPPA violation. FTC's 2023 Edmodo consent order specifically required age verification. | FTC enforcement action. $50,120 per violation (per child, per instance). Platform could be ordered to delete ALL user data collected without age verification. |
| Parental Consent Workflow (VPC) | FR-01 | **MUST HAVE** | NOT BUILT | COPPA Section 312.5 — strict liability. No VPC = illegal data collection from every child user. There is no safe harbor, no grace period, no materiality threshold. One child without consent = one violation. | FTC fines ($50,120/violation). Consent decree requiring 20 years of FTC oversight (standard COPPA penalty). Mandatory biennial privacy audits at company expense. |
| Privacy Dashboard for Parents | FR-03 | **MUST HAVE** | NOT BUILT | COPPA Section 312.6 — parents must be able to review and delete their child's data. This is a statutory right, not a feature request. The `assertParentLink` middleware exists but there is no UI or endpoint for parents to actually exercise these rights. | FTC enforcement. Loss of parent trust. Schools will refuse to adopt a platform where parents cannot review data. |
| DSAR Form / Endpoint | FR-04 | **SHOULD HAVE** | NOT BUILT | CCPA requires a mechanism for data access requests. For US launch, an email address (privacy@learnfyra.com) satisfies the minimum. A full in-app form is preferred but not strictly required at launch. The email-based fallback is acceptable if documented in the Privacy Policy. | CCPA fines ($2,500-$7,500/violation) if a California user requests data and Learnfyra has no mechanism to respond within 45 days. Low risk at small scale, high risk at scale. |
| AI Content Safety Guardrails | FR-05 | **SHOULD HAVE** | PARTIAL (refusal detection only) | No federal law mandates content filtering, but FTC guidance on AI and children (2023) signals enforcement. Current implementation detects Claude refusals but does not filter for offensive, biased, or age-inappropriate content. A single incident of inappropriate content reaching a child would be devastating reputationally and could trigger FTC investigation. | Reputational destruction. FTC investigation under Section 5 (unfair/deceptive practices). Media coverage. School district blacklisting. |
| Cookie Consent Banner | FR-06 (banner) | **SHOULD HAVE** | NOT BUILT | Learnfyra currently has zero analytics/tracking SDKs, which means no non-essential cookies are set. The legal requirement is triggered by the act of setting non-essential cookies, not by having a website. However, the "Do Not Sell" link (CCPA-03) is required regardless. Once any analytics tool is added, this becomes MUST HAVE. | Low immediate risk (no analytics exist). Risk escalates the moment any tracking is added. The "Do Not Sell" link is separately classified as MUST HAVE. |
| Account Deletion Backend | FR-07 | **MUST HAVE** | PARTIAL (UI button, no backend) | COPPA and CCPA both require functional deletion. A button that does nothing is worse than no button — it's arguably deceptive. The UI promises deletion; the backend must deliver. | FTC action for deceptive practice (promising deletion but not delivering). CCPA fine for failure to honor deletion request ($7,500/intentional violation). |
| Audit Logging (3-year retention) | FR-08 | **MUST HAVE** | PARTIAL (1-month retention) | API Gateway logs exist but are retained for only 1 month. COPPA Section 312.10 requires 3-year record-keeping. If the FTC requests compliance records and Learnfyra can only produce 30 days of logs, the FTC will draw adverse inferences. | Inability to demonstrate compliance during FTC audit. Adverse inference = assumed non-compliant. Higher fines and stricter consent decree terms. |

---

### COMPLIANCE REQUIREMENTS — COPPA

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Verifiable Parental Consent | COPPA-01 | **MUST HAVE** | NOT BUILT | Core COPPA obligation. See FR-01 above. | See FR-01. $50,120/violation. |
| Children's Privacy Notice | COPPA-02 | **MUST HAVE** | NOT BUILT | Must exist before any data collection. The Privacy Policy page is not built. This is the legal document that informs parents what data is collected. Without it, consent is not "informed" and therefore invalid. | Every parental consent obtained without a proper notice is void. Retroactive violation for all users. |
| Parental Review/Deletion Rights | COPPA-03 | **MUST HAVE** | NOT BUILT | See FR-03. Statutory right. | See FR-03. |
| Data Minimization | COPPA-04 | **MUST HAVE** | MOSTLY COMPLIANT | Core data collection (email, displayName, role) is minimal. Risk area: optional `studentName`, `teacherName`, `className` fields in `validator.js` are passed to worksheet exporters. For children, these should not be collected without parental consent. The prompt builder correctly excludes PII from AI calls. | If FTC determines optional PII fields violate minimization, each instance is a violation. Mitigated by the fact that fields are optional and not sent to AI. |
| Reasonable Security | COPPA-05 | **MUST HAVE** | COMPLIANT | Encryption at rest (S3_MANAGED, DynamoDB default AES-256), encryption in transit (HTTPS enforced), bcrypt password hashing, Secrets Manager for keys, rate limiting, WAF on prod. This meets the "reasonable" standard. | Already satisfied. Maintain vigilance. |
| Data Retention Limits | COPPA-06 | **MUST HAVE** | PARTIAL | Worksheet S3 data expires in 7 days (compliant). Guest sessions expire in 30 days (compliant). User account data has no expiration or deletion mechanism (non-compliant). | FTC can argue indefinite retention of children's data violates COPPA. Must implement deletion. |
| Service Provider COPPA Obligations | COPPA-07 | **MUST HAVE** | MOSTLY COMPLIANT | AWS has a COPPA-compliant DPA. Anthropic API receives no PII (validated in code). No third-party analytics SDKs exist. Risk: if any SDK is added without COPPA review, this breaks. | If a non-COPPA-compliant SDK is added, every data transmission to that SDK is a violation. Implement a pre-approval process for new dependencies. |
| COPPA Safe Harbor | COPPA-08 | **NICE TO HAVE** | NOT PURSUED | Optional FTC program. Provides some enforcement protection but is not required. Costs money and requires ongoing audit. Evaluate after revenue justifies the cost. | No legal risk. Missed opportunity for marketing ("kidSAFE Certified") and enforcement protection. |
| Record-Keeping (3 years) | COPPA-09 | **MUST HAVE** | NOT BUILT | See FR-08. Consent records do not exist. Log retention is 1 month vs. required 3 years. | FTC audit failure. Adverse inference. |

---

### COMPLIANCE REQUIREMENTS — FERPA

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| School Official Designation | FERPA-01 | **NICE TO HAVE** | NOT BUILT | Phase 1 is direct-to-consumer. FERPA is triggered only when schools share student records. No school contracts exist yet. Prepare the DPA template, but this is not a launch blocker. | Cannot sign school district contracts without a DPA. Blocks B2B revenue but no legal risk in Phase 1. |
| No Re-disclosure | FERPA-02 | **SHOULD HAVE** | COMPLIANT (by design) | Anthropic API never receives student PII (validated). No third-party analytics. This is compliant by architecture, not by explicit control. Should add a CI check to prevent regression. | If regression occurs and student PII leaks to a third party, the school loses FERPA protections. Learnfyra would be in breach of any future DPA. |
| Parent/Student Rights | FERPA-03 | **NICE TO HAVE** | NOT BUILT (covered by COPPA controls) | In Phase 1, FR-03 (Privacy Dashboard) satisfies this. FERPA-specific requirements (e.g., right to amend records) only apply when school data is involved. | No risk in Phase 1. Build FERPA-specific amendment flow before school district contracts. |
| Access Logging | FERPA-04 | **SHOULD HAVE** | PARTIAL | API Gateway logs capture who accessed what endpoint. Missing: application-level logging of which user viewed which student's data. The API logs don't distinguish "parent viewed child's worksheet" from "parent viewed own profile." | If a school asks "who accessed my students' data?", Learnfyra cannot answer from API logs alone. Blocks FERPA compliance for school contracts. |
| Directory Information Controls | FERPA-05 | **NICE TO HAVE** | COMPLIANT (by absence) | No leaderboards or public-facing student data exists. Compliant by not having the feature. When leaderboards are added (Phase 2+), this becomes MUST HAVE. | No risk. Monitor when student-visible features are added. |

---

### COMPLIANCE REQUIREMENTS — CCPA/CPRA

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Right to Know | CCPA-01 | **SHOULD HAVE** | NOT BUILT | CCPA requires a mechanism to respond to "right to know" requests. At minimum, a Privacy Policy listing categories of data collected (not yet built) and a contact email (privacy@learnfyra.com) is sufficient for launch. In-app DSAR form is preferred but not required. | If a California user submits a request and Learnfyra fails to respond within 45 days, each failure is a $2,500-$7,500 violation. Risk scales with California user count. |
| Right to Delete | CCPA-02 | **MUST HAVE** | PARTIAL (UI only) | See FR-07. Overlaps with COPPA deletion requirement. The CCPA 45-day response window is more generous than COPPA, but the underlying obligation is the same: deletion must be functional. | $7,500/intentional violation. Class action private right of action if data breach occurs and deletion was requested but not honored. |
| "Do Not Sell" Link | CCPA-03 | **MUST HAVE** | NOT BUILT | CCPA Section 1798.135 requires this link on every page. It's a simple footer link. Learnfyra does not sell data, so the link can lead to a page stating "Learnfyra does not sell your personal information." But the link itself must exist. No revenue threshold for this requirement. | $2,500/violation (negligent), $7,500/intentional. California AG has enforced this against companies that don't sell data but failed to include the link. Trivial to implement, inexcusable to skip. |
| Non-Discrimination | CCPA-04 | **SHOULD HAVE** | COMPLIANT (by design) | Learnfyra does not gate features based on privacy choices. No paid tiers exist. Compliant by default. Must remain vigilant when monetization is added. | No current risk. Risk emerges if premium features are introduced and privacy-exercising users are excluded. |
| Privacy Policy Updates (annual) | CCPA-05 | **MUST HAVE** | NOT BUILT | The Privacy Policy itself does not exist yet. This requirement is subsumed by COPPA-02 (build the Privacy Policy). Once built, establish an annual review cadence. | See COPPA-02. |
| Minor-Specific Protections | CCPA-06 | **MUST HAVE** | COMPLIANT (by policy) | Learnfyra does not sell data. COPPA consent (FR-01) covers under-13. For 13-15 year olds, the no-sale policy satisfies CCPA. If data sharing/sale is ever introduced, explicit opt-in is required. | No current risk because Learnfyra does not sell data. Risk emerges if business model changes. |

---

### COMPLIANCE REQUIREMENTS — GDPR

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Lawful Basis for Processing | GDPR-01 | **NICE TO HAVE** | NOT BUILT | US-only launch. GDPR does not apply. Building a ROPA (Record of Processing Activities) is good practice but not legally required. | No legal risk for US launch. Required before EU expansion. |
| Data Protection Impact Assessment | GDPR-02 | **NICE TO HAVE** | NOT BUILT | Only required under GDPR for high-risk processing (AI + children). Not applicable for US-only. Recommended as internal practice before launching adaptive learning features. | No legal risk for US launch. |
| Right to Data Portability | GDPR-03 | **NICE TO HAVE** | NOT BUILT | GDPR-specific right. CCPA "right to know" is the US equivalent and is covered by FR-04. JSON export is good practice but not US-legally required beyond CCPA. | No legal risk for US launch. |
| Data Protection by Design | GDPR-04 | **SHOULD HAVE** | MOSTLY COMPLIANT | The architecture already follows privacy-by-design principles: encryption, minimization, PII isolation from AI. Not a formal GDPR requirement for US, but the engineering practices are sound. | No legal risk. The existing architecture is well-positioned for GDPR if needed. |
| Appoint a DPO | GDPR-05 | **NICE TO HAVE** | NOT DONE | GDPR requirement only. For US Phase 1, designate a "privacy lead" informally. Formal DPO appointment needed before EU launch. | No legal risk for US. |
| 72-Hour Breach Notification | GDPR-06 | **NICE TO HAVE** | NOT BUILT | GDPR-specific timeline. US breach notification timelines vary by state (e.g., NY SHIELD Act: "expedient," not 72 hours). The incident response plan (NFR-06) should be built regardless but is classified SHOULD HAVE below. | No GDPR risk for US. State breach notification risks are covered under NFR-06. |

---

### COMPLIANCE REQUIREMENTS — AI-Specific

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| AI Transparency Disclosure | AI-01 | **MUST HAVE** | NOT BUILT | California AB 2013 (effective January 2026) requires disclosure of AI-generated content. Learnfyra serves California users. A simple label on each worksheet ("Generated with AI assistance") satisfies this. Trivial to implement. | California AG enforcement. Emerging federal AI transparency legislation. Reputational risk if discovered without disclosure. |
| No Student PII in AI Prompts | AI-02 | **MUST HAVE** | COMPLIANT | Validated in code: `promptBuilder.js` sends only grade, subject, topic, difficulty, questionCount. No student PII. This is the single most important AI compliance control. | Already satisfied. A regression here would be a COPPA violation (sharing child data with third-party without consent) AND a FERPA violation (unauthorized disclosure). |
| Content Safety Filtering | AI-03 | **SHOULD HAVE** | PARTIAL | Generator detects Claude refusals but does not filter for offensive, biased, or harmful content. No federal law mandates this, but FTC has stated that deploying AI to children without safeguards may constitute an "unfair practice" under Section 5. | Reputational catastrophe if inappropriate content reaches a child. FTC Section 5 investigation. School districts will blacklist the platform. |
| Factual Accuracy Validation | AI-04 | **SHOULD HAVE** | PARTIAL | Questions are structurally validated (correct JSON schema, valid question types) but not fact-checked against curriculum standards. A factually wrong math answer in a Grade 3 worksheet is embarrassing; a factually wrong science claim could be harmful. | Educational credibility damage. Parents and teachers lose trust. Not a legal violation but a product-quality issue that compounds into compliance risk (FTC "deceptive" if marketed as "curriculum-aligned"). |
| AI Model Documentation | AI-05 | **NICE TO HAVE** | NOT BUILT | No current US law requires an AI Model Card. Emerging regulation (EU AI Act, proposed US bills) may require it. Good practice for transparency and vendor risk management. | No legal risk today. Future-proofs against coming regulation. |
| No Autonomous Decision-Making | AI-06 | **NICE TO HAVE** | COMPLIANT (by design) | Learnfyra scores are for practice, not official grades. No student placement or consequential decisions are made by AI. Compliant by architecture. | No risk. Monitor if adaptive learning features change this. |
| Bias Monitoring | AI-07 | **NICE TO HAVE** | NOT BUILT | No US law requires bias monitoring for educational content generation. EU AI Act does for "high-risk" AI systems. Good practice to build trust and avoid embarrassing bias incidents. | Reputational risk if biased content is discovered. No legal enforcement mechanism currently. |
| AI Vendor Due Diligence | AI-08 | **SHOULD HAVE** | PARTIAL | Anthropic API does not train on API inputs by default. This should be documented in a vendor risk assessment. No formal agreement exists between Learnfyra and Anthropic beyond the standard API terms. | If Anthropic changes policy, worksheet content could be used for training. Low probability but high impact if it includes any identifiable data (even grade-level patterns). |

---

### COMPLIANCE REQUIREMENTS — Authentication & Security

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Secure Password Storage | SEC-01 | **MUST HAVE** | COMPLIANT | bcryptjs with cost factor 10. Industry standard. Already built. | Already satisfied. Plaintext passwords would be a catastrophic breach liability. |
| JWT Secret Management | SEC-02 | **MUST HAVE** | COMPLIANT | JWT_SECRET in Secrets Manager. Already built. | Already satisfied. Hardcoded secrets = immediate breach if code is leaked. |
| Session Timeout | SEC-03 | **SHOULD HAVE** | COMPLIANT (prod) | Cognito path: 1h access, 30d refresh. Mock path: 7d access (dev only). Production is compliant. Dev mode is acceptable for local testing. | Already satisfied for production. |
| Rate Limiting | SEC-04 | **MUST HAVE** | COMPLIANT | API Gateway throttle on auth endpoints. Already built. | Already satisfied. Without rate limiting, credential stuffing attacks succeed trivially. |
| CORS Restrictions | SEC-05 | **MUST HAVE** | COMPLIANT (prod) | CDK enforces non-wildcard ALLOWED_ORIGIN in staging/prod. Default `*` only in local dev. | Already satisfied. Wildcard CORS in prod would allow cross-origin attacks on auth endpoints. |
| Input Validation | SEC-06 | **MUST HAVE** | COMPLIANT | `validator.js` validates all fields. Already built. Must ensure new endpoints (solve, submit) also use it. | Already satisfied. Missing validation = XSS/injection vulnerability = breach liability. |
| Dependency Vulnerability Scanning | SEC-07 | **SHOULD HAVE** | COMPLIANT | `npm audit` in CI pipeline via `security-audit.yml`. Gitleaks for secret scanning. | Already satisfied. Known-vulnerable dependencies are the #1 cause of breaches in Node.js apps. |
| MFA for Admin/Teacher Roles | SEC-08 | **NICE TO HAVE** | NOT BUILT | No admin console exists yet. MFA is important for elevated roles but not legally required. FERPA expects it for school data access but Phase 1 has no school contracts. | No legal risk in Phase 1. Becomes SHOULD HAVE when school districts are onboarded. |

---

### COMPLIANCE REQUIREMENTS — Accessibility

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| WCAG 2.1 AA Compliance | A11Y-01 | **SHOULD HAVE** | UNKNOWN | No accessibility testing visible in codebase or CI. Section 508 is legally required for school district sales. ADA Title III lawsuits against web platforms have increased 300%+ since 2020. Not a launch blocker for direct-to-consumer, but becomes MUST HAVE for school sales. | ADA lawsuit ($50K-$150K settlement typical). School districts will not procure non-508-compliant software. Loss of federal funding for partner schools. |
| Keyboard Navigation | A11Y-02 | **SHOULD HAVE** | UNKNOWN | Subset of WCAG 2.1 AA. React components should be keyboard-accessible. Not tested. | See A11Y-01. |
| Screen Reader Compatibility | A11Y-03 | **SHOULD HAVE** | UNKNOWN | Subset of WCAG 2.1 AA. No ARIA audit visible. | See A11Y-01. |
| Color Contrast | A11Y-04 | **SHOULD HAVE** | RISK IDENTIFIED | Theme yellow (#F5C534) on white backgrounds fails WCAG contrast ratio (2.3:1 vs. required 4.5:1). Blue (#3D9AE8) on white passes (3.2:1 for normal text — borderline, passes for large text only). Green (#6DB84B) on white fails (3.5:1). | Immediate accessibility failure on key UI elements. Fix before school district demos. |
| Alternative Text | A11Y-05 | **NICE TO HAVE** | UNKNOWN | Important but lower priority than contrast and keyboard. | Minor accessibility gap. |
| Accessible Worksheets | A11Y-06 | **NICE TO HAVE** | NOT BUILT | AI-generated worksheets in HTML format need semantic markup. Current exporters do not include `<fieldset>`, `<legend>`, or MathML. Important for screen reader users but a small percentage of initial audience. | Blocks adoption by schools with visually impaired students. Build before school district expansion. |

---

### NON-FUNCTIONAL REQUIREMENTS

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Encryption at Rest | NFR-01 | **MUST HAVE** | COMPLIANT | S3_MANAGED (AES-256), DynamoDB default encryption. Already built. Provides breach notification safe harbor in many states (encrypted data is exempt from notification). | Already satisfied. Without encryption, every data exposure triggers mandatory breach notifications to all affected users + state AGs. |
| Encryption in Transit | NFR-02 | **MUST HAVE** | COMPLIANT | HTTPS enforced everywhere. Already built. | Already satisfied. HTTP traffic = all data interceptable. |
| Data Minimization | NFR-03 | **MUST HAVE** | MOSTLY COMPLIANT | Core collection is minimal. Optional PII fields (studentName, teacherName, className) need review for child users. AI prompts correctly exclude PII. | Low risk currently. Address optional PII fields when age gate is built — gate them behind parental consent for under-13. |
| Data Retention Policy | NFR-04 | **MUST HAVE** | PARTIAL | S3 lifecycle (7 days) and guest TTL (30 days) are correct. User account data has no deletion mechanism. Log retention is 1 month vs. required 3 years. | COPPA violation (indefinite retention of children's data). FTC audit failure (missing consent records). |
| Access Control / Least Privilege | NFR-05 | **MUST HAVE** | MOSTLY COMPLIANT | `assertParentLink` enforces parent-child access. Lambda IAM roles are scoped. Students access own data only. No admin escalation vectors visible. | Already mostly satisfied. Maintain vigilance as new features are added. |
| Incident Response Plan | NFR-06 | **SHOULD HAVE** | NOT BUILT | No documented incident response plan. US state breach notification laws require "without unreasonable delay" (typically interpreted as 30-60 days). A plan ensures the team can respond within legal timelines. Not a launch blocker because breaches are unlikely at launch, but must exist before significant user scale. | If a breach occurs with no plan, response will be chaotic, slow, and legally non-compliant. Fines + lawsuits + reputational damage. |

---

### REMAINING ITEMS

| Requirement | ID | Category | Implemented? | Reason for Classification | Risk if Ignored |
|---|---|---|---|---|---|
| Terms of Service Page | (implicit) | **MUST HAVE** | NOT BUILT | Required to establish the legal relationship with users. Must disclaim AI limitations, define acceptable use, limit liability. Without ToS, no enforceable agreement exists. | No legal protection for Learnfyra. Users can claim any expectation. Liability is unlimited without ToS. |
| "Do Not Sell" Link | CCPA-03 | **MUST HAVE** | NOT BUILT | See CCPA section above. Simple footer link. | $2,500-$7,500/violation (California). |
| Security Response Headers | (implicit) | **SHOULD HAVE** | NOT BUILT | CSP, HSTS, X-Frame-Options, X-Content-Type-Options. OWASP Top 10 best practice. Not legally required but prevents XSS and clickjacking attacks that could lead to data breaches. | Increased attack surface. If a breach occurs via XSS/clickjacking, the absence of basic headers will be cited as failure to implement "reasonable security" (COPPA-05). |
| COPPA Safe Harbor | COPPA-08 | **NICE TO HAVE** | NOT PURSUED | Optional certification. Costs $5K-$25K/year. Worth it when revenue justifies. | No legal risk. Missed marketing advantage. |
| SDPC/FERPA DPA Template | FERPA-01 | **NICE TO HAVE** | NOT BUILT | No school contracts in Phase 1. Prepare the template, but no urgency. | Blocks school district sales. No risk in Phase 1. |
| GDPR (all items) | GDPR-01-06 | **NICE TO HAVE** | NOT BUILT | US-only launch. No EU users. | No risk until EU expansion. |
| State-Specific Laws | 7.8 | **SHOULD HAVE** | COMPLIANT (via COPPA+CCPA baseline) | COPPA + CCPA compliance satisfies the core requirements of all 18+ state privacy laws. Monitor quarterly for new legislation. | Low risk. The COPPA+CCPA baseline is the strongest compliance posture available. |
| Compliance-Specific Tests | (implicit) | **NICE TO HAVE** | NOT BUILT | Automated tests for consent flows, age gates, deletion cascades. Good engineering practice but not legally required. | Higher risk of regression when compliance features are modified. |

---

## Summary Dashboard

### By Category

| Category | Count | Built | Partially Built | Not Built |
|---|---|---|---|---|
| **MUST HAVE** | 22 | 11 | 5 | 6 |
| **SHOULD HAVE** | 14 | 4 | 3 | 7 |
| **NICE TO HAVE** | 14 | 2 | 0 | 12 |
| **TOTAL** | **50** | **17** | **8** | **25** |

### MUST HAVE Items Not Yet Built (Launch Blockers)

| # | Item | Effort Estimate | Dependency |
|---|---|---|---|
| 1 | Age Gate (FR-02) | 2-3 days | None — build first |
| 2 | Parental Consent Workflow (FR-01) | 3-5 days | FR-02 (age gate) |
| 3 | Privacy Policy Page (COPPA-02) | 1-2 days (engineering) + legal review | Legal counsel |
| 4 | Terms of Service Page | 1-2 days (engineering) + legal review | Legal counsel |
| 5 | Account Deletion Backend (FR-07) | 2-3 days | None |
| 6 | "Do Not Sell" Link (CCPA-03) | 0.5 days | None — trivial footer link |
| 7 | AI Transparency Label (AI-01) | 0.5 days | None — label on worksheets |
| 8 | Consent Record Storage (COPPA-09) | 1-2 days | FR-01 (consent flow) |
| 9 | Log Retention Extension to 3 Years (FR-08) | 0.5 days (CDK config change) | None |
| 10 | Privacy Dashboard for Parents (FR-03) | 3-5 days | FR-01, FR-02 |

**Estimated total effort for launch-blocking compliance work: 15-24 engineering days + legal review.**

### Recommended Implementation Order

```
Week 1:  FR-02 (Age Gate) → FR-01 (Parental Consent) → COPPA-09 (Consent Records)
Week 2:  FR-07 (Account Deletion Backend) → FR-03 (Privacy Dashboard)
Week 3:  CCPA-03 ("Do Not Sell" Link) → AI-01 (AI Label) → FR-08 (3-Year Log Retention)
Week 4:  Privacy Policy + Terms of Service (requires legal review in parallel)
```

Legal review of Privacy Policy and Terms of Service should begin in Week 1 and run in parallel with engineering work.

---

*Classification performed on April 3, 2026. Must be re-evaluated if scope changes (e.g., school district contracts, EU expansion, payment processing, or new analytics tools are added).*

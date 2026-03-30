# Frontend Prerequisite Intake Template

Version: 1.0
Date: 2026-03-26
Purpose: Single source document to collect all prerequisites before detailed frontend requirement breakdown.
Owner: Product + Frontend + Architecture
Status: In Progress

## How To Use
1. Fill each section in order.
2. For files/assets, provide workspace-relative paths.
3. Mark each section status as `Complete` only when all required fields are filled.
4. Attach referenced assets/folders in the workspace and update paths here.
5. Keep this document updated; detailed requirement docs will use this as input baseline.

---

## 0. Intake Control Sheet

### 0.1 Intake Metadata
- Request Name:
- Requested By:
- Date Started:
- Target Frontend Technology: Angular
- Target Angular Version:
- Target Release Window:

### 0.2 Section Status Tracker
| Section | Title | Owner | Status (`Not Started` / `In Progress` / `Complete`) | Notes |
|---|---|---|---|---|
| 1 | Brand and Visual Identity |  | Not Started |  |
| 2 | Theme and Design System Inputs |  | Not Started |  |
| 3 | Product Scope and Role Definitions |  | Not Started |  |
| 4 | Authentication and Identity Providers |  | Not Started |  |
| 5 | Analytics and Tracking Setup |  | Not Started |  |
| 6 | Compliance, Legal, and Security Constraints |  | Not Started |  |
| 7 | API, Environment, and Integration Contracts |  | Not Started |  |
| 8 | Content and Curriculum Inputs |  | Not Started |  |
| 9 | UX Behavior and Interaction Decisions |  | Not Started |  |
| 10 | Device, Browser, and Performance Targets |  | Not Started |  |
| 11 | QA, UAT, and Release Governance |  | Not Started |  |
| 12 | Asset Handoff and Delivery Logistics |  | Not Started |  |

---

## 1. Brand and Visual Identity
Status:

### Required Inputs
- Primary logo (SVG):
- Secondary logo (SVG/PNG):
- Favicon:
- Brand colors (hex palette):
- Typography family:
- Illustration style reference:
- Icon style preference:

### File Attachments
| Item | File Path | Provided (`Yes/No`) | Notes |
|---|---|---|---|
| Primary logo |  | No |  |
| Secondary logo |  | No |  |
| Favicon |  | No |  |
| Brand guideline doc |  | No |  |

### Decisions
- Brand tone for students:
- Brand tone for teachers:
- Do/Don't design rules:

---

## 2. Theme and Design System Inputs
Status:

### Required Inputs
- Theme mode(s):
- Grade-band visual style split (`G1-3`, `G4-7`, `G8-10`):
- Motion preference (`Low`, `Medium`, `High`):
- Dark mode requirement (`Yes/No`):
- Accessibility high-contrast mode (`Yes/No`):

### Token Starter Values
- Primary color:
- Secondary color:
- Success color:
- Warning color:
- Error color:
- Base spacing unit:
- Border radius scale:
- Shadow style:

### Attachments
- Theme tokens file path:
- Font files path:
- Illustration pack path:

---

## 3. Product Scope and Role Definitions
Status:

### Role Model
- Roles in Phase 1 MVP (check all):
  - [ ] Student
  - [ ] Teacher
  - [ ] Parent
  - [ ] Admin
- Default landing audience:
- Role-based entry points:

### MVP Scope Lock
- In scope modules:
- Explicitly out-of-scope modules:
- Must-have user journeys:
- Success criteria (business):

### Constraints
- Deadline constraints:
- Budget constraints:
- Team constraints:

---

## 4. Authentication and Identity Providers
Status:

### Authentication Strategy
- Auth required for MVP (`Yes/No`):
- Anonymous student solve allowed (`Yes/No`):
- Session model (`JWT/Cookie/Other`):
- Session timeout policy:

### Provider Credentials (fill placeholders only; secrets should remain in secure vault)
#### Google OAuth
- Client ID:
- Redirect URI(s):
- Environment mapping (`dev/staging/prod`):

#### Microsoft OAuth
- Tenant ID:
- Client ID:
- Redirect URI(s):
- Environment mapping (`dev/staging/prod`):

#### Other SSO (if any)
- Provider name:
- Setup details:

### Role Mapping
- Claim-to-role mapping rules:
- First-login behavior:

---

## 5. Analytics and Tracking Setup
Status:

### Analytics Stack
- GA4 required (`Yes/No`):
- GA4 Measurement ID:
- GTM required (`Yes/No`):
- GTM Container ID:
- Additional analytics tools:

### Event Tracking Requirements
- Mandatory events list:
- Funnel definition:
- Conversion goals:
- Dashboard/report consumers:

### Privacy Constraints
- PII allowed in events (`Yes/No`):
- Consent banner required (`Yes/No`):
- Retention period:

---

## 6. Compliance, Legal, and Security Constraints
Status:

### Compliance Scope
- COPPA applicable (`Yes/No`):
- FERPA applicable (`Yes/No`):
- GDPR applicable (`Yes/No`):
- Other local policy constraints:

### Security Requirements
- CSP policy constraints:
- Allowed domains list:
- Data masking requirements:
- Frontend secrets policy:
- File upload constraints (if applicable):

### Accessibility Requirement
- Target standard (`WCAG 2.1 AA` / `WCAG 2.2 AA` / other):
- Mandatory assistive-tech validation:

---

## 7. API, Environment, and Integration Contracts
Status:

### Environment Configuration
- Frontend app URLs (`local/dev/staging/prod`):
- API base URLs (`local/dev/staging/prod`):
- Feature flag service details:
- Config loading strategy (`build-time/runtime`):

### API Contract Inputs
- Endpoints used in MVP:
- Request/response schema references:
- Error format standard:
- Rate limit expectations:
- Retry behavior expectations:

### CORS and Origin Rules
- Allowed origins:
- Cookie/auth header expectations:

---

## 8. Content and Curriculum Inputs
Status:

### Domain Inputs
- Subjects in MVP:
- Grade range in MVP:
- Topic taxonomy source:
- Difficulty model:
- Question type matrix:

### Copy and Messaging
- Student encouragement style:
- Teacher instruction style:
- Empty state copy guidelines:
- Error copy guidelines:

---

## 9. UX Behavior and Interaction Decisions
Status:

### Solve Experience Rules
- Timed mode in MVP (`Yes/No`):
- Timer warning thresholds:
- Auto-submit on timeout (`Yes/No`):
- Retry behavior:
- Result reveal policy:

### Gamification Rules
- Badges in MVP (`Yes/No`):
- Streaks in MVP (`Yes/No`):
- Confetti/celebration level:
- Competitive elements allowed (`Yes/No`):

### Motion and Interaction Safety
- Motion reduction support required (`Yes/No`):
- Sensory-safe mode required (`Yes/No`):

---

## 10. Device, Browser, and Performance Targets
Status:

### Device Targets
- Priority devices:
- Lowest supported screen width:
- Touch target baseline:

### Browser Targets
- Chrome minimum:
- Edge minimum:
- Safari minimum:
- Firefox minimum:

### Performance Targets
- Initial load target:
- Interactive readiness target:
- Bundle size budget:
- Network assumptions (`low-bandwidth/offline expectations`):

---

## 11. QA, UAT, and Release Governance
Status:

### QA Requirements
- Test levels required (`unit/integration/e2e/accessibility/performance`):
- Coverage target:
- Required test environments:

### UAT Governance
- UAT stakeholders:
- Sign-off criteria:
- Go/No-Go gate owner:

### Release Plan Inputs
- Pilot rollout needed (`Yes/No`):
- Pilot audience:
- Rollback expectations:

---

## 12. Asset Handoff and Delivery Logistics
Status:

### Asset Packaging
- Logo folder path:
- Theme folder path:
- Font folder path:
- Media/illustration folder path:

### Naming and Versioning
- File naming convention:
- Versioning convention:
- Change log requirement (`Yes/No`):

### Coordination
- Single point of contact:
- Approval SLA:
- Escalation path:

---

## Appendix A: Quick Attachment Checklist
- [ ] Logo package attached
- [ ] Theme tokens attached
- [ ] Font files attached
- [ ] OAuth setup details provided
- [ ] Analytics IDs provided
- [ ] Compliance constraints confirmed
- [ ] Environment URLs provided
- [ ] API contract references attached
- [ ] UX behavior decisions finalized
- [ ] Device/browser targets confirmed

## Appendix B: Final Readiness Gate
Mark `Ready for Detailed Requirement Writing` only when all conditions are met.

- [ ] Sections 1-12 marked `Complete`
- [ ] All required file paths are valid and accessible in workspace
- [ ] Open decisions are resolved
- [ ] Product, Architect, and BA owners approved baseline

Readiness Status: Not Ready
Approved By:
Approval Date:

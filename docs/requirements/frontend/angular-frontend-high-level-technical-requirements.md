# Angular Frontend High-Level Technical Requirements

Version: 1.0
Date: 2026-03-26
Prepared via: architect-agent + ba-agent + PO agent synthesis
Status: Baseline approved for design-first phase

## 1. Objective
Build a new Angular frontend for Learnfyra that is:
- Fun and engaging for school students (Grades 1-10)
- Clear and efficient for teachers
- Scalable for module-by-module expansion
- Fully compatible with the existing backend and AWS architecture

This phase defines only high-level frontend requirements. Detailed module specifications will be created in later phases.

## 2. Product Direction
- Frontend technology: Angular 17+ (standalone components, strict TypeScript)
- Delivery approach: Design-first, then module-by-module implementation
- UX direction: "Fun-loving, learning-first" (delight without distraction)
- Theme/logo source: Will be provided by team in a separate folder

## 3. Personas and Primary Needs
- Student (primary): Easy-to-use solving UI, instant feedback, encouraging interactions
- Teacher (primary): Fast worksheet generation and assignment workflow
- School admin (secondary): Safe, reliable, and adoption-ready platform behavior

## 4. High-Level Scope
In scope for high-level design baseline:
- Angular app shell and route model
- Student solve journey and result experience requirements
- Teacher worksheet workflow requirements (frontend side)
- Shared design system and theming strategy
- API integration boundaries with existing endpoints
- Non-functional requirements (performance, accessibility, security)
- Delivery roadmap with decision gates

Out of scope for this phase:
- Detailed wireframes and pixel-level UI specs
- Per-module low-level component contracts
- New backend contract changes
- Advanced gamification economy and social features

## 5. High-Level Frontend Architecture Requirements
### 5.1 App Structure
- Use domain-based feature organization:
  - core: app-wide services/interceptors/config
  - shared: reusable UI primitives and utilities
  - features/student
  - features/teacher
  - features/public
- Use lazy loading for feature routes.
- Keep role-based navigation separation between student and teacher experiences.

### 5.2 Routing Requirements
- Public routes: landing, login, help
- Teacher routes: dashboard, generate, library, classes (future-ready)
- Student routes: dashboard, solve, results, rewards (phase-based)
- Required guards:
  - auth guard
  - role guard
  - unsaved changes guard for critical forms
  - timer/leave guard during timed solve

### 5.3 State Management Requirements
- Preferred baseline: Angular Signals + RxJS
- Global state limited to:
  - auth/session
  - active worksheet context
  - solve session context
- Keep local UI state within feature components/services.
- Avoid unnecessary global store complexity in the first implementation phase.

## 6. Design System and UI Requirements
### 6.1 Design Goals
- Student UI: playful, optimistic, readable, age-appropriate
- Teacher UI: efficient, structured, low-friction
- Both flows must remain visually consistent with one unified design token system

### 6.2 Theming Requirements
- Theme tokens must be externalized and centrally managed (colors, type scale, spacing, radii, shadows)
- Theme and logo assets must be loaded from an agreed assets directory
- Frontend must support runtime theme configuration without code changes

### 6.3 Required Asset Contract (for your separate folder)
- Suggested path contract:
  - frontend/assets/brand/logo.svg
  - frontend/assets/theme/theme.tokens.json
  - frontend/assets/theme/fonts/*
- If a different path is used, it must be mapped through a single theme configuration service

### 6.4 UX Behavior Requirements
- Use meaningful motion (load reveals, progress transitions, positive feedback moments)
- Avoid noisy or distracting animation patterns
- Provide clear empty/loading/error states with child-friendly and teacher-friendly copy variants

## 7. API Integration Boundaries (No Contract Breaks)
Frontend will consume existing APIs and remain contract-compatible:
- POST /api/generate
- GET /api/solve/:worksheetId
- POST /api/submit
- Existing download/admin endpoints as required

Requirements:
- Central API service wrapper
- Standardized error mapping
- Interceptors for auth (if enabled), retry policy, loading state
- No secrets in frontend bundles

## 8. Non-Functional Requirements
### 8.1 Accessibility
- Minimum WCAG 2.1 AA
- Full keyboard navigation support
- Screen-reader-friendly labels and announcements
- Error feedback must not rely on color only

### 8.2 Performance
- First load target: <= 3s on constrained school networks
- Lazy-load non-critical routes
- Keep initial bundle size controlled and measurable in CI
- Optimize images and fonts for low bandwidth school environments

### 8.3 Security
- Sanitize all untrusted content rendered in UI
- Enforce secure API usage patterns and CORS consistency
- Prevent double submit and invalid input abuse at UI layer

### 8.4 Reliability
- Robust error recovery states
- Autosave where applicable in solve/generation forms
- Optional offline capability can be added as phase extension (PWA)

## 9. Testing Requirements
- Unit tests for services, validators, utility logic
- Integration tests for major feature flows
- End-to-end tests for key journeys:
  - Teacher generate flow
  - Student solve and submit flow
  - Result view flow
- Accessibility checks included in automated QA gates

## 10. Phase Plan (Design-First, Then Modules)
### Phase 1: High-Level Design Baseline (current)
- Finalize frontend principles, architecture boundaries, NFRs, and rollout gates

### Phase 2: Design + Architecture Deepening
- Finalize visual system with provided theme/logo assets
- Finalize Angular architecture decisions and folder standards

### Phase 3: Module-by-Module Specs (BA + Architect)
- Module 1: Foundation shell and shared UI primitives
- Module 2: Student discovery and solve experience
- Module 3: Submit/results and feedback experiences
- Module 4: Teacher workflow expansion
- Module 5: Hardening (performance/accessibility/reliability)

### Phase 4: Implementation and QA
- Feature build in iterations with QA gate per module

### Phase 5: Pilot and rollout
- Controlled rollout, feedback loop, and production hardening

## 11. Acceptance Criteria for This Document
This high-level requirement phase is complete when:
- Angular is confirmed as frontend standard
- Design-first approach is confirmed before module implementation
- Theme/logo handoff contract is documented
- High-level architecture and NFR boundaries are approved
- Module-by-module execution path is agreed

## 12. Open Decisions to Lock Before Module Specs
- Final theme/logo folder path and naming conventions
- Final state strategy confirmation (Signals baseline approved)
- Offline/PWA inclusion timing (core or later phase)
- Authentication mode for early student flow (anonymous vs managed)

## 13. Collaboration Model
- BA: owns requirement clarity and acceptance criteria
- Architect: owns technical boundaries and scalability decisions
- PO: owns prioritization, milestone gates, and scope control
- Frontend implementation starts only after all open decisions in Section 12 are resolved

## 14. Next Step
Start the module-by-module design workshop with Module 1 (Foundation shell + design token wiring + route skeleton), then proceed in sequence with validation gates after each module.

## 15. Prerequisite Intake Source
Before starting detailed module requirements, complete the prerequisite intake template:
- docs/requirements/frontend-prerequisite-intake-template.md

All detailed requirement documents should reference the finalized values from that template as the single source of truth.
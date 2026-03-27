# Learnfyra UI and Flow Master Specification
# File: docs/specs/frontend/ui-flow-master-spec.md
# Version: 1.0
# Date: 2026-03-24
# Branch: feature/ui-redesign
# Status: Approved for design phase, no application code changes in this document

---

## Purpose

This document is the canonical UI and flow specification for the Learnfyra redesign. It consolidates product, UX, architecture, and QA input into one agreed baseline so implementation can proceed later without re-litigating scope.

This is a design document only. It does not authorize JavaScript, backend, or infrastructure changes by itself.

---

## Negotiation Inputs

This master specification was negotiated using the following sources:

- Product requirements from [docs/specs/ui-redesign-spec.md](c:/arbab-github/edusheet-ai/docs/specs/ui-redesign-spec.md)
- Existing online solve behavior from [docs/specs/online-solve-spec.md](c:/arbab-github/edusheet-ai/docs/specs/online-solve-spec.md)
- Visual direction from [docs/design/learnfyra-ui-spec-v3.md](c:/arbab-github/edusheet-ai/docs/design/learnfyra-ui-spec-v3.md)
- Verification and regression guidance from [docs/qa/ui-redesign-qa-spec.md](c:/arbab-github/edusheet-ai/docs/qa/ui-redesign-qa-spec.md)
- Source-of-truth selector contracts from [frontend/js/app.js](c:/arbab-github/edusheet-ai/frontend/js/app.js) and [frontend/js/solve.js](c:/arbab-github/edusheet-ai/frontend/js/solve.js)

Where the agent outputs disagree, this file resolves the conflict.

---

## Final Decisions

### Design Scope

The redesign covers both primary user experiences:

1. Generator page for teachers and tutors in [frontend/index.html](c:/arbab-github/edusheet-ai/frontend/index.html)
2. Solve page for students in [frontend/solve.html](c:/arbab-github/edusheet-ai/frontend/solve.html)

### Delivery Scope

Baseline redesign includes:

- New visual system
- Updated page hierarchy and section layout
- Improved content flow and action emphasis
- Responsive behavior for mobile, tablet, and desktop
- Accessibility requirements
- Selector-safe HTML structure updates
- CSS-only motion and decoration

Baseline redesign does not include:

- Changes to app logic in frontend JavaScript
- New API behavior
- New persistence features
- Teacher accounts, dashboards, or analytics
- Queue generation
- Practice mistakes generation
- Clipboard, preview accordion, or browser-leave guards unless separately approved as behavior work

### Contract Rule

The source JavaScript files are the only valid contract for preserved IDs, classes, and DOM hooks.

If any written design note conflicts with [frontend/js/app.js](c:/arbab-github/edusheet-ai/frontend/js/app.js) or [frontend/js/solve.js](c:/arbab-github/edusheet-ai/frontend/js/solve.js), the JavaScript wins.

---

## Design Goals

The redesign must make Learnfyra feel:

- Trustworthy for teachers
- Clear for first-time users
- Energizing for students
- Structured rather than playful chaos
- Fast and low-friction
- Distinct from generic SaaS worksheet tools

The product position is:

Trusted by teachers, loved by students.

---

## Visual System

### Brand Direction

Learnfyra will use a bold school-supplies visual language rather than a generic productivity SaaS style.

### Color Tokens

Primary tokens:

- Sky Blue: `#3B82F6`
- Sun Yellow: `#FBBF24`
- Leaf Green: `#10B981`
- Coral: `#F97316`
- Berry Purple: `#8B5CF6`
- Chalk: `#F8FAFC`
- Ink Navy: `#1E293B`
- Cloud: `#E2E8F0`

Color roles:

- Blue for trust and core actions
- Orange for the hottest calls to action, especially solve-related actions
- Green for success and correct-answer states
- Purple for answer-key and premium-supporting actions
- Yellow for highlights and timed-state warning transitions

### Typography

- Headings: Nunito, weights 700 to 900
- Body: Inter, weights 400 to 600
- Monospace utility use: JetBrains Mono for timer and technical micro-labels if needed

### Shape Language

- Card radius: 20px
- Button radius: 12px to 14px
- Input radius: 10px
- Pill badges: fully rounded

### Motion

Motion should feel intentional and upbeat, not decorative for its own sake.

- Card hover lift
- Button press compression
- Success-state pop-in
- Section reveal transitions
- Reduced-motion support is mandatory

### Decoration

Decoration remains CSS-only.

Allowed approaches:

- Notebook-rule backgrounds
- Pencil-stripe accents
- Multi-color header strip
- Subtle layered gradients and soft shadow depth

Disallowed approaches:

- Raster illustrations as a dependency for core layout
- Heavy looping animation
- Visual noise that competes with the worksheet form or student questions

---

## Generator Experience Specification

### Primary User

Teachers and tutors creating worksheets quickly.

### Core Outcome

The page should help a user move from zero state to generated worksheet with minimal hesitation and clear trust signals.

### Required Structure

The generator page keeps this overall flow:

1. Header with brand and positioning
2. Hero with value proposition
3. Main generation card
4. Loading state card
5. Results state card
6. Error state card
7. Footer

### Information Hierarchy

The page must visually separate:

1. Required worksheet setup
2. Optional classroom details
3. Submission action
4. Result actions after generation

### Generator UX Rules

- The hero should be concise and above the fold
- Required inputs must dominate the first screen
- Optional fields should feel secondary but still easy to find
- The generate button must be the strongest action before submission
- The results section must elevate Solve Online above download parity without hiding file downloads

### Results-State Priorities

After generation, the page should emphasize these actions in order:

1. Solve Online
2. Primary requested download format
3. Remaining file downloads
4. Generate Another Worksheet

### Generator State Model

Supported states:

- Form visible
- Loading visible
- Results visible
- Error visible

Only one of those primary states should dominate at a time.

### Required Preserved Contracts

The following IDs from [frontend/js/app.js](c:/arbab-github/edusheet-ai/frontend/js/app.js) must remain present and functional:

- `grade`
- `subject`
- `topic`
- `difficulty`
- `questionCount`
- `format`
- `includeAnswerKey`
- `studentName`
- `worksheetDate`
- `teacherName`
- `period`
- `className`
- `generateBtn`
- `worksheetForm`
- `formSection`
- `loadingSection`
- `resultsSection`
- `errorSection`
- `downloadButtons`
- `resultsDescription`
- `errorMessage`
- `generateAnotherBtn`
- `dismissErrorBtn`
- `gradeError`
- `subjectError`
- `topicError`
- `difficultyError`
- `questionCountError`
- `formatError`

The following classes must remain compatible with current behavior:

- `btn`
- `btn--primary`
- `btn--secondary`
- `btn--solve`
- `form-select`
- `form-input`
- `checkbox-input`
- `reveal`

---

## Solve Experience Specification

### Primary User

Students solving worksheets without login or setup friction.

### Core Outcome

The solve page should move the student cleanly through loading, mode selection, solving, and review with high readability and low confusion.

### Required Structure

The solve page keeps this overall flow:

1. Header with worksheet metadata
2. Loading state
3. Error state
4. Mode selection state
5. Solve state
6. Results state
7. Footer

### Solve UX Rules

- The first meaningful decision is timed or untimed mode
- The mode choice should be visually simple and easy to understand
- Question content must be easier to scan than the surrounding decoration
- The timer must feel informative, not punishing
- The submit action must remain obvious at all times
- Results must prioritize learning feedback over raw scoring alone

### Timed Mode Rules

- Timer remains visible while solving
- Timer color can shift from blue to yellow to orange/red as time runs down
- The visual change must be calm, not alarming
- Auto-submit remains part of the flow because it is already defined by the feature spec

### Untimed Mode Rules

- No timer is shown
- The interface should remove any unnecessary urgency cues
- Progress and completion clarity replace time pressure as the guidance mechanism

### Results Rules

Results should communicate:

1. Score summary
2. Percentage
3. Time taken when timed mode applies
4. Per-question correct or incorrect status
5. Correct answer for incorrect items
6. Explanation when available
7. Clear next actions

### Solve State Model

Supported states:

- Loading visible
- Error visible
- Mode selection visible
- Solve form visible
- Results visible

Only one primary state should dominate at a time.

### Required Preserved Contracts

The following IDs from [frontend/js/solve.js](c:/arbab-github/edusheet-ai/frontend/js/solve.js) must remain present and functional:

- `loadingSection`
- `errorSection`
- `errorMessage`
- `modeSection`
- `modeTitleText`
- `modeSubtitleText`
- `timedDesc`
- `timedModeBtn`
- `untimedModeBtn`
- `solveSection`
- `timerBar`
- `timerDisplay`
- `questionsContainer`
- `solveForm`
- `submitBtn`
- `resultsSection`
- `scoreHeader`
- `resultsBreakdown`
- `tryAgainBtn`
- `worksheetMeta`

The following runtime-generated class hooks must remain supported by CSS and HTML structure:

- `question-card`
- `question-header`
- `question-badge`
- `question-text`
- `question-points`
- `question-input-area`
- `question-options`
- `option-label`
- `option-radio`
- `option-custom`
- `option-text`
- `fill-input`
- `short-answer-input`
- `matching-wrap`
- `matching-row`
- `matching-left`
- `matching-right-input`
- `work-area`
- `final-answer-input`
- `final-answer-label`
- `timer-display--urgent`
- `result-item`
- `result-item--correct`
- `result-item--incorrect`
- `result-item-header`
- `result-icon`

---

## Component Hierarchy

### Generator Page Components

- Site header
- Hero block
- Generator card
- Worksheet setup group
- Optional details group
- Primary generate action row
- Loading card
- Results card
- Download action grid
- Error card
- Footer

### Solve Page Components

- Site header with worksheet meta
- Loading card
- Error card
- Mode selection card
- Timer bar
- Question list container
- Question card
- Submit action row
- Results score header
- Results breakdown list
- Post-result action row
- Footer

---

## Responsive Specification

### 375px Mobile

- Single-column layout
- Full-width buttons
- Strong spacing between stacked controls
- Mode cards stack vertically
- Download actions stack or form a single-column grid
- Question cards stay single column with large touch targets

### 768px Tablet

- Two-column form where appropriate
- Mode cards can sit side by side
- Download actions can use a two-column arrangement
- Solve layout remains single question column for readability

### 1280px Desktop

- Centered content with controlled max width
- Generator card uses balanced multi-column grouping
- Results actions can expand into a denser grid
- Header and hero spacing can breathe without widening form inputs excessively

---

## Accessibility Specification

The redesign must meet WCAG 2.1 AA expectations for the main experience.

Required accessibility behaviors:

- Logical heading order
- Clear landmark structure
- Visible keyboard focus
- Sufficient color contrast
- Labels connected to all form fields
- Error feedback announced appropriately
- Decorative elements marked hidden from assistive tech
- Reduced-motion support
- Minimum 44px touch target sizing for primary controls

---

## Baseline Acceptance Criteria

### Generator Page

1. Given a teacher lands on the homepage, when the page loads, then the primary form is immediately understandable and the generate action is visually dominant.
2. Given the teacher is completing required fields, when they interact with grade, subject, topic, difficulty, count, and format, then the interface preserves current validation and dependency behavior.
3. Given generation is in progress, when the request starts, then the loading state becomes the dominant visible state.
4. Given generation succeeds, when results appear, then Solve Online is visually emphasized without hiding download options.
5. Given generation fails, when an error is shown, then the error state is readable and the retry path remains obvious.

### Solve Page

1. Given a student opens a valid solve link, when the worksheet loads, then the first clear choice is timed or untimed mode.
2. Given timed mode is chosen, when solving begins, then the timer remains visible and the submit action remains easy to find.
3. Given untimed mode is chosen, when solving begins, then no timer is shown and the interface does not create artificial urgency.
4. Given questions are rendered, when the student reads and answers them, then every supported question type remains readable, touch-friendly, and visually consistent.
5. Given answers are submitted, when results render, then score, per-question correctness, correct answers, and explanations are presented in a clear review flow.

### Cross-Cutting

1. Given the redesign is implemented, when tested at mobile, tablet, and desktop widths, then layout remains stable and readable.
2. Given the redesign is implemented, when run against the current JavaScript, then no JS selector contract is broken.
3. Given reduced-motion preference is enabled, when the user interacts with the page, then transitions are reduced appropriately.

---

## Deferred Enhancements

These concepts are acceptable future ideas, but they are not part of the baseline redesign unless separately approved:

- Saved previous selections
- Generate similar shortcut
- Queue multiple worksheets
- Preview questions accordion
- Copy link feedback behavior
- Practice mistakes workflow
- Stakeholder confetti or high-celebration result effects
- Client-side completion progress bar if it requires JavaScript changes

---

## Verification Plan

Verification should follow the QA detail spec in [docs/qa/ui-redesign-qa-spec.md](c:/arbab-github/edusheet-ai/docs/qa/ui-redesign-qa-spec.md), with one correction:

`errorSection` is present in [frontend/index.html](c:/arbab-github/edusheet-ai/frontend/index.html), so it is not a current markup bug.

Minimum verification gates for future implementation:

1. Selector contract check against source JavaScript
2. Manual generator flow smoke test
3. Manual solve flow smoke test for timed and untimed modes
4. Responsive validation at 375px, 768px, and 1280px
5. Accessibility spot check for keyboard, focus, and contrast

---

## Recommended Next Design Documents

If the team continues design work before implementation, the next documents should be:

1. Annotated wireframe spec for [frontend/index.html](c:/arbab-github/edusheet-ai/frontend/index.html)
2. Annotated wireframe spec for [frontend/solve.html](c:/arbab-github/edusheet-ai/frontend/solve.html)
3. CSS token inventory and component mapping plan for [frontend/css/styles.css](c:/arbab-github/edusheet-ai/frontend/css/styles.css) and [frontend/css/solve.css](c:/arbab-github/edusheet-ai/frontend/css/solve.css)
4. Implementation checklist with selector-safe HTML edit map

---

## Approval Note

This document defines the agreed baseline for the redesign branch. It is intentionally stricter than the aspirational product ideas in the BA document and intentionally narrower than stretch concepts that would require JavaScript or backend work.

Use this file as the implementation gatekeeper.

---

## Implementation Readiness References

1. Local and AWS parity strategy: [docs/technical/platform/LOCAL_DEV_STRATEGY.md](docs/technical/platform/LOCAL_DEV_STRATEGY.md)
2. Implementation checklist: [docs/IMPLEMENTATION_READINESS_CHECKLIST.md](docs/IMPLEMENTATION_READINESS_CHECKLIST.md)
# Learnfyra UI Redesign — Product Specification
# File: docs/specs/ui-redesign-spec.md
# Version: 1.0
# Author: BA Agent
# Date: 2026-03-24
# Status: Proposed — No Code Changes Yet

---

## Feature: Complete UI/UX Overhaul for Generator and Solve Experiences

### Executive Summary
This specification defines a major visual and interaction redesign for Learnfyra's two primary user flows: the teacher-facing worksheet generator and the student-facing online solve experience. The redesign focuses on progressive disclosure, visual hierarchy, accessibility, and delight — transforming a functional tool into an engaging educational platform.

**Design Philosophy:**
- Progressive disclosure: show complexity only when needed
- Immediate visual feedback on all user actions
- Mobile-first responsive design (works on tablets and phones)
- WCAG 2.1 AA accessibility compliance
- Zero-friction onboarding (no accounts, no sign-up, instant use)

---

## User Stories

### Teacher Flow (Generator Page)

**US-1: Quick Start for First-Time Teachers**
As a **first-time teacher** visiting Learnfyra,
I want to see a minimal, focused form with clear value proposition,
So that I can generate my first worksheet in under 60 seconds without reading documentation.

**US-2: Efficient Repeat Generation**
As a **returning teacher**,
I want my previous selections remembered and a "Generate Similar" quick-action,
So that I can create variant worksheets for different class periods without re-entering data.

**US-3: Bulk Generation for the Week**
As a **teacher preparing weekly lesson plans**,
I want to queue multiple worksheet requests (e.g., Mon/Wed/Fri different topics),
So that I can batch-generate a week's materials in one session.

**US-4: Preview Before Download**
As a **teacher**,
I want to preview the generated worksheet questions in the browser,
So that I can verify quality and relevance before committing to a download or share.

**US-5: Flexible Sharing Options**
As a **teacher**,
I want to copy a "Solve Online" link, download files, or print directly,
So that I can distribute worksheets via Google Classroom, email, or paper based on my students' needs.

---

### Student Flow (Solve Page)

**US-6: Zero-Friction Student Access**
As a **student**,
I want to click a teacher-shared link and immediately see the worksheet without login,
So that I can start solving without technical barriers.

**US-7: Clear Mode Selection**
As a **student choosing how to practice**,
I want to see a clean choice between Timed (test prep) and Untimed (learning) modes with clear benefits,
So that I understand which mode matches my current learning goal.

**US-8: Confidence-Building Progress**
As a **student working through questions**,
I want to see a visual progress indicator (e.g., "3 of 10 answered"),
So that I stay motivated and know how much work remains.

**US-9: Stress-Free Timer (Timed Mode)**
As a **student in timed mode**,
I want the timer displayed persistently but not aggressively (no flashing/red countdown),
So that I stay aware of time without anxiety-inducing pressure.

**US-10: Instant Learning Feedback**
As a **student reviewing results**,
I want to see at-a-glance which answers were correct (✅) vs. incorrect (❌) with expandable explanations,
So that I can quickly identify knowledge gaps and learn from mistakes.

**US-11: Mistake-Driven Re-Practice**
As a **student who missed several questions**,
I want a "Practice Mistakes" button that generates a new worksheet on only the topics I got wrong,
So that I can focus my study time efficiently.

---

## Acceptance Criteria

### Generator Page Redesign

#### AC-1: Streamlined Initial State
```
Given a teacher lands on the homepage for the first time
When the page loads
Then the hero section displays a single-sentence value proposition above the fold
And the form shows only 4 required fields: Grade, Subject, Topic, Difficulty (in a single row on desktop)
And all optional fields (student name, class details) are collapsed behind an "Add Details (Optional)" toggle link
And the page includes 1-2 sample worksheets as visual previews below the form
And the "Generate Worksheet" button is prominently styled with high contrast (teal/orange theme)
```

#### AC-2: Smart Field Dependencies
```
Given a teacher selects a Grade
When the Subject dropdown activates
Then it only shows curriculum-appropriate subjects for that grade (e.g., no "Algebra II" for Grade 3)
And when a Subject is selected
Then the Topic dropdown populates with relevant topics and auto-focuses for keyboard users
And the entire form flow is keyboard-navigable with visible focus indicators
```

#### AC-3: Optional Fields Progressive Disclosure
```
Given the optional "Student & Class Details" section is collapsed (default)
When the teacher clicks "Add Details (Optional)"
Then the section expands with a smooth animation (300ms ease-out)
And the 5 optional fields appear: Student Name, Date, Teacher, Period, Class
And the Date field defaults to today's date
And all fields have helper text explaining how they appear on the worksheet
And the toggle link text changes to "Hide Details"
```

#### AC-4: Formation Validation with Inline Feedback
```
Given a teacher interacts with any required field
When they leave the field blank or select invalid data
Then an inline error message appears immediately below the field (no page scroll)
And the error message is descriptive: "Please select a grade level" (not generic "Required field")
And the "Generate Worksheet" button remains disabled until all 4 required fields are valid
And field-level validation uses aria-live regions for screen reader announcement
```

#### AC-5: Loading State with Estimated Time
```
Given the teacher submits a valid form
When the Generate button is clicked
Then the form section collapses up with a fade animation
And a centered loading card appears showing a spinner, estimated time ("~15 seconds"), and progress message
And the loading message updates every 5 seconds: "Generating..." → "Aligning to standards..." → "Almost ready..."
And the entire page is aria-busy="true" to prevent interaction during generation
And the user cannot navigate away without a browser confirmation dialog ("Worksheet generation in progress. Leave page?")
```

#### AC-6: Results State with Preview & Actions
```
Given a worksheet has successfully generated
When the results section renders
Then it displays:
  - Success badge (✓ icon) with "Your Worksheet is Ready!" headline
  - Metadata subtitle: "Grade 3 Math — Multiplication Facts (1-10) — 10 questions"
  - Expandable "Preview Questions" accordion showing the first 3 questions (without answers)
  - Download button group in a card: [PDF] [Word] [HTML] [Answer Key PDF] (icons + labels)
  - "Solve Online" button prominently styled as primary action (teal, larger)
  - "Copy Link" button next to "Solve Online" (copies solve URL to clipboard, shows "✓ Copied!" feedback)
  - "Generate Another" secondary button below the actions
And each download button shows file size estimate (e.g., "PDF — ~180 KB")
And clicking a download button triggers instant browser download (no new tab)
And clicking "Solve Online" opens solve.html in a new tab with the worksheetId pre-loaded
```

#### AC-7: Bulk Queue Feature (Stretch)
```
Given a teacher wants to generate multiple worksheets
When they click "Add to Queue" instead of "Generate Worksheet"
Then the current form data is saved to a queue panel on the right side of the screen
And the form resets to allow configuring the next worksheet
And the queue panel shows thumbnails of queued items with [Edit] [Remove] actions
And a "Generate All (3)" button processes the queue sequentially
And each queued worksheet result appears in an expanded results grid below the form
```

---

### Solve Page Redesign

#### AC-8: Clean Mode Selection Screen
```
Given a student navigates to solve.html?worksheetId={uuid}
When the page loads
Then a loading spinner appears while solve-data.json is fetched
And once loaded, the worksheet metadata displays in the header: "Grade 3 Math — Multiplication Facts"
And the mode selection screen shows two large, visual cards side-by-side (stacked on mobile)
  Card 1 (Timed):
    - Timer icon (🕐)
    - "Timed Mode" headline
    - "Race against the clock — {estimatedTime}" subtext
    - "Best for test prep and quick practice" hint
  Card 2 (Untimed):
    - Book icon (📖)
    - "Untimed Mode" headline
    - "Take your time, no pressure" subtext
    - "Best for learning and review" hint
And both cards have hover/focus states (scale + shadow) and are keyboard accessible
And the page includes a "Back to Generator" link in the top-left corner (breadcrumb)
```

#### AC-9: Progress Indicator in Solve UI
```
Given a student has selected a mode and the question form is visible
When the page renders the questions
Then a sticky progress bar appears at the top of the form (below the header):
  - "Question 1 of 10" text on the left
  - Horizontal progress fill (30% width if 3 of 10 answered)
  - Color: teal for progress, light gray for remaining
And the progress bar updates in real-time as the student fills in answers
And the progress is based on non-empty answers (not validation — any input counts as "answered")
And on mobile, the progress bar is full-width and slightly taller for touch visibility
```

#### AC-10: Timed Mode Experience
```
Given a student selects Timed Mode
When the solve form renders
Then a timer bar appears directly below the header (above the progress indicator):
  - "Time Remaining" label on the left
  - MM:SS countdown timer on the right (e.g., "19:42")
  - Background color gradually transitions from teal → yellow → orange as time runs low
  - No flashing or red — gentle color shift only
And the timer updates every second
And when 2 minutes remain, a subtle toast notification appears: "2 minutes left" (dismissible)
And when the timer reaches 00:00:
  - The form auto-submits with current answers
  - A modal overlay appears: "Time's up! Submitting your answers..."
  - The student cannot edit answers after auto-submit
And the timer is always visible on scroll (sticky position)
```

#### AC-11: Untimed Mode Experience
```
Given a student selects Untimed Mode
When the solve form renders
Then NO timer is displayed anywhere on the page
And the progress indicator is the only persistent UI element (no time pressure cues)
And the "Submit Answers" button is enabled at all times (even with zero answers filled)
And clicking "Submit" shows a confirmation modal:
  - "You've answered 7 of 10 questions. Submit now?"
  - [Go Back] [Submit Anyway] buttons
And the confirmation modal only appears if fewer than 80% of questions are answered
```

#### AC-12: Question Rendering with Type-Specific UI
```
Given the solve form renders questions
When each question type is displayed
Then it uses the appropriate input component:

  Multiple Choice:
    - Radio buttons with labels showing full option text ("A. 42", "B. 56")
    - Options stacked vertically with ample spacing (minimum 44px touch target height)
    - Selected option has a teal border and light teal background

  True/False:
    - Two large radio buttons side-by-side ("True" | "False")
    - Icon-enhanced: ✓ True | ✗ False

  Fill-in-the-Blank:
    - Single-line text input with placeholder "Type your answer"
    - Auto-focus on the input when question card is scrolled into view
    - Monospace font for numeric answers

  Short Answer:
    - Textarea (3 rows minimum, auto-expands)
    - Character count below ("0 / 500 characters")

  Matching:
    - Left column shows terms, right column shows dropdown selects
    - Each dropdown contains all possible matches
    - Visual connector lines appear when matches are selected (optional polish)

  Show Your Work / Word Problem:
    - Textarea for work shown (labeled "Show Your Work")
    - Separate text input below for final answer (labeled "Final Answer")
    - Final answer field is required, work shown is optional

And each question is wrapped in a card with:
  - Question number badge (top-left circle: "1")
  - Point value badge (top-right: "1 pt")
  - Question text in readable 18px font (minimum)
  - Adequate whitespace between questions (24px margin)
```

#### AC-13: Submit Confirmation & Processing
```
Given a student clicks "Submit Answers"
When the submission is processing
Then a full-screen loading overlay appears:
  - Semi-transparent background
  - Centered spinner with "Scoring your answers..." text
  - Progress message updates: "Scoring..." → "Calculating results..." (every 2 seconds)
And the form is disabled (no editing during submission)
And if the request fails (network error, 500 response):
  - The overlay is replaced with an error modal
  - Error message: "Couldn't submit your answers. Check your connection and try again."
  - [Try Again] button re-attempts submission
  - [Save Draft] button (future) — out of scope for v1
```

---

### Results Review Redesign

#### AC-14: Results Summary Header
```
Given a student's submission has been scored
When the results page renders
Then the top of the page shows a large score card:
  - Centered score display: "8 / 10" in 48px bold font
  - Percentage below: "80%" in 32px font
  - Performance badge:
    - 90-100%: "Excellent! 🎉" (green background)
    - 70-89%: "Good work! 👍" (teal background)
    - 50-69%: "Keep practicing 📚" (orange background)
    - 0-49%: "Let's review 🔍" (neutral gray background)
  - Time taken: "Completed in 14:05" (if timed) or "Completed in untimed mode"
  - Summary breakdown: "8 correct, 2 incorrect"
And the score card has a subtle bounce-in animation (400ms ease-out)
```

#### AC-15: Per-Question Results Breakdown
```
Given the results are displayed
When the student scrolls below the score card
Then a vertically stacked list of question result cards appears:
  - Each card shows:
    - Question number + correct/incorrect icon (✅ or ❌)
    - The original question text (read-only)
    - Student's answer with label "Your answer:" (highlighted in red if incorrect, green if correct)
    - Correct answer with label "Correct answer:" (only shown if student was incorrect)
    - Collapsible "Explanation" section (collapsed by default):
      - [▶ Show Explanation] button
      - When expanded, shows the explanation text from Claude with a light background
      - Button changes to [▼ Hide Explanation]
    - Points earned: "1 / 1 pt" or "0 / 1 pt"
And incorrect answers are sorted to the top of the list (if viewing "Mistakes First" toggle is on)
And each card has a distinct border: green (correct) or red (incorrect) with 3px thickness
```

#### AC-16: Results Action Panel
```
Given the results are displayed
When the student reaches the bottom of the results list
Then an action panel appears with three buttons:
  - "Try Again" (secondary button):
    - Reloads solve.html with the same worksheetId
    - Clears previous answers (fresh attempt)
    - Returns to mode selection screen
  - "Practice Mistakes" (primary button, only if score < 100%):
    - Generates a new worksheet focused on topics the student missed
    - Uses generate API with filters based on incorrect question topics
    - Opens in a new tab
  - "Generate New Worksheet" (secondary button):
    - Returns to the homepage (index.html)
    - Pre-fills the form with the same grade/subject/difficulty
And the panel is sticky on mobile (fixed to bottom of viewport)
```

#### AC-17: Mobile-Responsive Results
```
Given a student views results on a mobile device (< 768px width)
When the results page renders
Then the layout adapts:
  - Score card stacks vertically (score above percentage above time)
  - Question result cards span full width with increased padding
  - "Show Explanation" buttons are full-width for easy tapping
  - Action panel buttons stack vertically (full-width, 48px height minimum)
  - Fonts scale down slightly (score: 36px instead of 48px)
And all interactive elements meet 44px minimum touch target size
```

---

### Cross-Cutting UI/UX Criteria

#### AC-18: Accessibility Compliance
```
Given any page in the Learnfyra application
When evaluated with axe DevTools or WAVE
Then it passes WCAG 2.1 Level AA compliance with zero critical violations
And all interactive elements are keyboard-navigable (Tab, Enter, Space)
And all form fields have associated <label> elements (no placeholder-only labels)
And all images/icons have descriptive alt text or aria-label
And color contrast ratios meet 4.5:1 for normal text, 3:1 for large text
And focus indicators are clearly visible (2px teal outline, no browser default blue)
And error messages are announced to screen readers via aria-live="polite"
```

#### AC-19: Mobile-First Responsive Design
```
Given any page loads on devices from 320px to 2560px width
When the viewport is resized
Then the layout adapts using these breakpoints:
  - Mobile: 320px - 767px (single column, stacked buttons)
  - Tablet: 768px - 1023px (two-column form, side-by-side mode cards)
  - Desktop: 1024px+ (three-column layouts where applicable, max 1200px container)
And all touch targets are minimum 44px × 44px on mobile
And font sizes scale: base 16px mobile, 18px desktop
And the header logo/tagline is consistently positioned across breakpoints
And no horizontal scrolling occurs on any breakpoint
```

#### AC-20: Performance & Loading States
```
Given any user action that requires a network request (generate, solve, submit)
When the request is in-flight
Then a loading indicator appears within 100ms of the action
And the UI is disabled to prevent duplicate submissions (buttons show "Loading..." state)
And if the request takes longer than 30 seconds:
  - A timeout message appears: "This is taking longer than usual. Please wait..."
And if the request fails:
  - A contextual error message appears (not a generic alert)
  - The user can retry without losing form data
And all images are lazy-loaded with blur-up placeholders
```

#### AC-21: Visual Design System Consistency
```
Given the entire application
When designed and implemented
Then it uses a consistent design system:
  - Typography: Nunito font family (400, 600, 700 weights)
  - Colors:
    - Primary: #2D9CCA (teal)
    - Secondary: #F97316 (orange)
    - Success: #10B981 (green)
    - Error: #EF4444 (red)
    - Neutral: #6B7280 (gray-500)
    - Background: #FFFFFF (light mode only — dark mode out of scope)
  - Spacing: 8px base unit (margins/padding in multiples of 8px)
  - Border radius: 8px for cards, 4px for buttons, 20px for badges
  - Shadows: 0 2px 8px rgba(0,0,0,0.1) for cards, 0 4px 16px rgba(0,0,0,0.15) for modals
And all components derive from this system (no one-off colors or font sizes)
```

---

## AWS Services Involved
This specification is UI/UX-focused and does not introduce new AWS services beyond those already planned in the online-solve-spec.md. The UI redesign is implemented entirely in frontend HTML/CSS/JavaScript with no changes to backend Lambda handlers or S3 bucket structure.

For reference:
- Frontend hosting: S3 static site behind CloudFront (existing)
- API calls: API Gateway → Lambda (existing)
- Asset optimization: CloudFront caching for CSS/JS/images (existing)

---

## Out of Scope

### Explicitly NOT included in this redesign:
1. **Dark Mode** — Single light theme only. Dark mode deferred to v2.0.
2. **User Accounts / Login** — Remains anonymous/link-based. No authentication.
3. **Teacher Dashboard** — No analytics, no historical worksheet tracking, no student roster management.
4. **Student Result Persistence** — Results are display-only, not saved to database or emailed.
5. **Bulk Export to LMS** — No Google Classroom, Canvas, or Schoology integrations.
6. **Multi-Language Support** — English-only UI (curricula are USA-based).
7. **PDF Customization UI** — No in-browser PDF editing (margins, fonts, logos).
8. **AI Tutor Chat** — No conversational follow-up on missed questions (future feature).
9. **Practice Mistakes Generator** — AC-16 mentions this button, but the generate API integration for topic filtering is deferred to a separate spec.
10. **Offline Mode / PWA** — No service worker, no offline functionality.
11. **Animation Library** — All animations are CSS-only (no GSAP, Framer Motion).
12. **Real-Time Collaboration** — No multi-student simultaneous solve with shared results.
13. **Gamification** — No badges, leaderboards, or XP systems.
14. **Printable Results Certificate** — "80% — Great Job!" printable cert deferred.
15. **Time Zone Handling** — All times displayed in the user's local browser time zone (no server-side TZ conversion).

---

## Dependencies

### Required Before UI Development Begins:
1. **Design Mockups** — UI agent must create or reference Figma/Sketch files showing:
   - Generator page: initial state, loading state, results state
   - Solve page: mode selection, question types (all 7), results layout
   - Mobile breakpoints for all states
2. **Icon Library** — Decision needed: inline SVG vs. icon font vs. image sprites (recommend inline SVG for flexibility)
3. **Sample Worksheet Data** — Fixtures for all 7 question types with realistic Claude-generated content (QA agent to provide)
4. **Accessibility Audit Tool** — axe DevTools or WAVE installed in dev browser
5. **Browser Support Matrix** — Define minimum supported versions (recommend: last 2 major versions of Chrome, Firefox, Safari, Edge)

### Downstream Dependencies (What Depends on This Spec):
1. **UI Agent** — Implements the HTML/CSS/JS changes per this spec
2. **QA Agent** — Writes visual regression tests (Percy/Chromatic) and accessibility tests
3. **DBA Agent** — Confirms no schema changes needed (this is purely frontend)
4. **DevOps Agent** — Ensures S3/CloudFront invalidation strategy handles new CSS/JS asset paths

---

## Open Questions & Decision Points

### OQ-1: Question Preview in Results State
**Context:** AC-6 specifies an expandable "Preview Questions" accordion showing the first 3 questions. This increases page load time (client-side rendering) and may clutter the results screen.

**Options:**
- **A:** Keep preview (helps teachers verify quality before sharing)
- **B:** Replace with "View Sample" modal (on-demand, doesn't inflate DOM)
- **C:** Remove entirely (download or solve online are sufficient verification)

**Recommendation:** Option B — Modal preview keeps the results screen clean while providing on-demand verification.

**Decision Required By:** UI agent before implementing results section.

---

### OQ-2: Timer Bar Color Transition Thresholds
**Context:** AC-10 specifies timer bar color shifts from teal → yellow → orange. What are the exact time thresholds?

**Options:**
- **A:** Linear gradient (color shifts continuously based on percentage remaining)
- **B:** Fixed breakpoints (teal until 50% time left, yellow until 20%, orange final 20%)
- **C:** Teacher-configurable (out of scope — adds form complexity)

**Recommendation:** Option B — Clear breakpoints at 50% and 20% time remaining. Easier to test and implement.

**Decision Required By:** UI agent before implementing timer component.

---

### OQ-3: "Practice Mistakes" Button Generate Logic
**Context:** AC-16 includes "Practice Mistakes" button but the generate API does not currently support topic filtering by missed questions.

**Options:**
- **A:** Build the UI button now (disabled with tooltip "Coming soon"), implement backend later
- **B:** Omit the button entirely from v1, add in v2 when backend supports it
- **C:** Implement a simplified version: generate a new worksheet with the same grade/subject/difficulty (ignore topic filtering)

**Recommendation:** Option A — Show the button (builds user expectation) but disable it with clear messaging. Prevents users from building workarounds.

**Decision Required By:** BA agent (this spec) and confirmed by DEV agent before UI work begins.

---

### OQ-4: Mobile Solve Experience — One Question Per Screen?
**Context:** AC-12 renders all questions in a vertical list. On mobile with 10+ questions, this creates a very long scroll.

**Options:**
- **A:** Keep vertical list (current spec) — user scrolls through all questions
- **B:** Paginated (one question per screen, "Next" / "Previous" buttons)
- **C:** Hybrid (first 3 questions visible, "Load More" for the rest)

**Recommendation:** Option A for v1 (simpler, fewer edge cases with progress tracking). Revisit in v2 based on user feedback.

**Decision Required By:** UI agent. If user testing shows high mobile dropout, re-evaluate in sprint retrospective.

---

### OQ-5: Score Card Animation — Celebration for High Scores?
**Context:** AC-14 includes a bounce-in animation for the score card. Should high scores (90%+) trigger additional celebration (confetti, sound effect)?

**Options:**
- **A:** Visual only — confetti animation (CSS or canvas-based, ~2 seconds)
- **B:** Audio + visual — short chime sound + confetti (requires audio file, accessibility concern)
- **C:** No special celebration — consistent presentation for all scores

**Recommendation:** Option A — Subtle CSS confetti (falling emoji or shapes) for 100% scores only. No audio (avoids accessibility/user preference issues).

**Decision Required By:** UI agent. Should prototype and user-test with students before finalizing.

---

### OQ-6: Browser Support for CSS Grid & Flexbox
**Context:** The existing site uses Flexbox. This redesign assumes CSS Grid for complex layouts (generator form grid, results card grid).

**Concern:** Does the minimum supported browser version matrix (defined in Dependencies) guarantee CSS Grid support?

**Required Action:** DevOps agent to confirm browser support matrix. If IE11 or older Safari versions are required, Grid must be feature-detected with Flexbox fallback.

**Decision Required By:** Before UI agent implements layout system.

---

### OQ-7: "Copy Link" Button Clipboard API Fallback
**Context:** AC-6 includes a "Copy Link" button using the Clipboard API (navigator.clipboard.writeText). This requires HTTPS and is unsupported in older browsers.

**Options:**
- **A:** Clipboard API only — show error toast if unsupported ("Copy failed. Please copy the link manually.")
- **B:** Clipboard API with fallback — use deprecated document.execCommand('copy') if API unavailable
- **C:** Always show link in a selectable input field — no automatic copy

**Recommendation:** Option B — Clipboard API with execCommand fallback. Notify user on success ("✓ Copied!") or failure.

**Decision Required By:** UI agent during results section implementation.

---

### OQ-8: Progress Bar — Should It Track Validation State?
**Context:** AC-9 specifies progress based on "non-empty answers (any input counts)". Should the progress bar reflect validation state (e.g., multiple-choice answered but blank fill-in-the-blank doesn't count)?

**Implication:** Tracking validation complicates the logic and may frustrate students if they fill in text but it's not counted as progress (e.g., typo in fill-in-the-blank).

**Recommendation:** No validation tracking in v1. Progress = (number of questions with any non-null student input) / (total questions). Simple and predictable.

**Decision Required By:** UI agent before implementing progress indicator logic.

---

## Success Metrics (Post-Launch)

While analytics are out of scope for this redesign, the following metrics should be tracked via CloudFront logs or future analytics integration to validate the redesign's impact:

1. **Generator Completion Rate:** % of teachers who fill the form and click "Generate" (baseline vs. post-redesign)
2. **Solve Completion Rate:** % of students who start solving and submit answers (not just load the page)
3. **Download vs. Solve Online Ratio:** Measure adoption of the online solve feature
4. **Mobile Bounce Rate:** % of mobile users who leave within 10 seconds (should decrease with responsive redesign)
5. **Average Time to First Worksheet:** Seconds from landing on homepage to clicking "Generate" (should decrease with simplified form)
6. **Results Page Engagement:** % of students who expand explanations (indicates learning behavior)

---

## Implementation Phases (Recommendation)

While this spec is design-only, the recommended build sequence for the UI agent is:

**Phase 1 — Generator Page Redesign** (5-7 days)
- Implement AC-1 through AC-7
- Focus on form UX and results state
- QA: Visual regression tests + accessibility audit

**Phase 2 — Solve Page Mode Selection** (2-3 days)
- Implement AC-8
- Focus on clean mode selection UI
- QA: Keyboard navigation + mobile responsiveness

**Phase 3 — Solve Form & Timer** (5-7 days)
- Implement AC-9 through AC-12
- Focus on question rendering and timer logic
- QA: Functional tests for all question types + timer behavior

**Phase 4 — Results Review** (4-5 days)
- Implement AC-14 through AC-17
- Focus on score presentation and action panel
- QA: Results rendering for all score ranges (0%, 50%, 80%, 100%)

**Phase 5 — Polish & Accessibility** (3-4 days)
- Implement AC-18 through AC-21
- Cross-browser testing, accessibility audit, performance optimization
- QA: Full regression suite + Lighthouse audit (target: 90+ performance, 100 accessibility)

**Total Estimated Effort:** 19-26 UI agent working days + 8-10 QA agent days (parallel)

---

## Appendix: Visual Design Reference

### Color Palette
```css
:root {
  /* Primary Colors */
  --color-primary: #2D9CCA;        /* Teal — buttons, links, progress */
  --color-primary-light: #E0F2F7;  /* Teal background for highlights */
  --color-secondary: #F97316;      /* Orange — accents, badges */
  
  /* Semantic Colors */
  --color-success: #10B981;        /* Green — correct answers, success badges */
  --color-error: #EF4444;          /* Red — incorrect answers, error messages */
  --color-warning: #F59E0B;        /* Amber — timer warning state */
  
  /* Neutrals */
  --color-gray-50: #F9FAFB;        /* Background for alternating rows */
  --color-gray-200: #E5E7EB;       /* Borders */
  --color-gray-500: #6B7280;       /* Secondary text */
  --color-gray-900: #111827;       /* Primary text */
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.15);
  
  /* Border Radius */
  --radius-sm: 4px;   /* Buttons, inputs */
  --radius-md: 8px;   /* Cards */
  --radius-lg: 12px;  /* Modals */
  --radius-full: 9999px; /* Badges, pills */
}
```

### Typography Scale
```css
/* Headings */
h1 { font-size: 2.5rem; font-weight: 800; line-height: 1.2; }  /* 40px */
h2 { font-size: 2rem;   font-weight: 700; line-height: 1.3; }  /* 32px */
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.4; }  /* 24px */

/* Body Text */
body { font-size: 1.125rem; font-weight: 400; line-height: 1.6; } /* 18px */
small { font-size: 0.875rem; }  /* 14px */

/* Responsive Scaling */
@media (max-width: 767px) {
  h1 { font-size: 2rem; }    /* 32px on mobile */
  h2 { font-size: 1.5rem; }  /* 24px on mobile */
  body { font-size: 1rem; }  /* 16px on mobile */
}
```

### Spacing System
All margins and padding use multiples of 8px:
```css
--space-1: 0.5rem;  /* 8px */
--space-2: 1rem;    /* 16px */
--space-3: 1.5rem;  /* 24px */
--space-4: 2rem;    /* 32px */
--space-6: 3rem;    /* 48px */
--space-8: 4rem;    /* 64px */
```

---

## Conclusion

This specification defines a complete visual and interaction redesign for Learnfyra's generator and solve experiences. The redesign prioritizes teacher efficiency and student engagement while maintaining the product's core value: zero-friction, curriculum-aligned worksheet generation and practice.

**Next Steps:**
1. BA agent (this spec) awaits approval from product owner / project lead
2. Upon approval, UI agent receives this spec + design mockups (Figma/Sketch handoff)
3. UI agent implements in 5 phases (19-26 days estimated)
4. QA agent validates against all 21 acceptance criteria with automated accessibility + visual regression tests
5. DevOps agent deploys to dev → staging → prod with CloudFront cache invalidation

**Open questions (OQ-1 through OQ-8) must be resolved before Phase 1 implementation begins.**

---

**Specification Author:** BA Agent  
**Review Required From:** Product Owner, UI Agent (feasibility), QA Agent (testability)  
**Status:** AWAITING APPROVAL — No code changes until approved

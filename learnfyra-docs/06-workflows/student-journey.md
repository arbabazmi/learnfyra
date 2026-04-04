# Student Journey

## User Personas

### Student (Primary User)
- **Age:** 6–16 (Grades 1–10)
- **Under 13 (COPPA):** Requires parental consent before account creation. No direct signup. Parent-managed sessions only (Phase 1).
- **13+ :** Standard self-registration via Google OAuth or email/password.
- **Goal:** Practice skills, receive instant feedback, build study habits
- **Frustrations:** Waiting for teacher grading, not knowing which answers were wrong
- **Motivations:** Improving grades, understanding mistakes, preparing for tests

### Teacher
- **Age:** 22–60
- **Goal:** Generate and assign standards-aligned worksheets, track class performance
- **Frustrations:** Time spent creating materials, identifying struggling students
- **Motivations:** Student outcomes, efficient lesson planning

### Parent
- **Age:** 30–55
- **Goal:** Monitor child progress, reinforce weak areas
- **Frustrations:** Not knowing what child is learning, opaque school feedback
- **Motivations:** Child's academic success, staying involved

---

## Screen Inventory (25 Screens)

### Authentication Screens (8 — updated for COPPA)
1. **Landing Page** — value proposition, "Try Free" + "Sign In" CTAs
2. **Login Page** — email/password + "Sign in with Google"
3. **Register Page** — age gate FIRST, then role selection (student/teacher/parent), email/password
4. **Age Gate** — "Are you under 13?" (COPPA) — shown before any form fields
5. **Parent Email Entry** — under-13 flow: parent email + optional nickname (COPPA)
6. **Consent Page** — parent reviews data practices, gives consent (COPPA)
7. **Parent Dashboard** — manage child accounts, start sessions, view/delete data (COPPA)
8. **Link Child** — parent account setup, enter child's email

### Worksheet Generation Screens (3)
5. **Generate Page (main)** — grade, subject, topic, difficulty, count, format selectors
6. **Generating... (loading)** — progress indicator while Claude generates
7. **Result Page** — download links (PDF/DOCX/HTML), "Solve Online" button, share link

### Solve Screens (5)
8. **Solve Mode Select** — timed vs untimed choice
9. **Solve Page** — interactive question form, timer (if timed)
10. **Submitting... (loading)** — brief scoring indicator
11. **Results Page** — score, per-question breakdown, explanations
12. **Certificate Page** — downloadable certificate (if score >= 80%)

### Student Dashboard Screens (4)
13. **Student Home** — recent attempts, weak areas, assignments from classes
14. **Progress Overview** — all-time stats, subject breakdown, streak
15. **Attempt History** — paginated list of past worksheets with scores
16. **Attempt Detail** — full result breakdown for a past attempt

### Teacher Dashboard Screens (5)
17. **Teacher Home** — list of classes, quick generate button
18. **Class View** — roster, class average, assignment completion
19. **Student Detail** — individual student progress, intervention flag
20. **Generate for Class** — same as Generate Page but with classId attached
21. **Assign Worksheet** — search existing worksheets, set due date

### Parent Dashboard Screens (5 — updated for COPPA)
22. **Parent Home** — child's progress summary, weak areas, streak
23. **Child Attempt History** — child's past worksheets
24. **Parent COPPA Dashboard** — manage linked children (view, start session, download data, delete)
25. **Consent Confirmation** — confirmation after giving parental consent
26. **Child Data Export** — downloadable JSON of all child data

### Admin Screens (2 — Phase 2 Angular redesign)
24. **Admin Dashboard** — platform health, recent errors, model status
25. **Admin User List** — searchable user table with actions

---

## Student Journey Map (End-to-End)

### Scenario A: Guest Student (no login)
```
Landing Page
  ↓ clicks "Try Free"
Generate Page (grade, subject, topic selections)
  ↓ clicks "Generate Worksheet"
Loading...
  ↓ worksheet ready
Result Page (download links + "Solve Online" button)
  ↓ clicks "Solve Online"
Solve Mode Select (timed or untimed)
  ↓ chooses untimed
Solve Page (interactive questions)
  ↓ fills answers, clicks Submit
Results Page (score + explanations)
  ↓ sees "Log in to save your progress" prompt
  [optionally proceeds to Register Page]
```

### Scenario B: Returning Student (logged in)
```
Login Page → Student Home
  ↓ sees pending assignment from teacher
Student Home → clicks assignment
Solve Mode Select
  ↓ chooses timed (class assignment)
Solve Page (countdown timer running)
  ↓ submits before time expires
Results Page (score + explanations)
  ↓ score >= 80% → certificate offered
Certificate Page → downloads certificate
  ↓
Student Home updated:
  - Attempt saved to history
  - Progress aggregates updated
  - Streak incremented
```

### Scenario D: Under-13 Student Registration (COPPA Parent-Gated)
```
Landing Page
  ↓ clicks "Try Free" or "Sign Up"
Register Page → Age Gate: "Are you under 13?"
  ↓ clicks "Yes, I am under 13"
Parent Email Entry (only parent email + optional nickname shown)
  ↓ enters parent's email, clicks Submit
  ↓ POST /api/auth/child-request → PendingConsent record created
  ↓ consent email sent to parent
Confirmation Screen: "Ask your parent to check their email!"
  ❌ NO account created
  ❌ NO Cognito identity
  ❌ NO JWT token

  [Meanwhile: Parent receives email with consent link]

Parent clicks consent link → Consent Page
  ↓ sees: what data is collected, COPPA rights, Privacy Policy link
  ↓ creates account (or logs in if existing parent)
  ↓ clicks "I Consent"
  ↓ POST /api/auth/consent/:token
  ↓ ConsentLog written, child account created under parent
  ↓ redirected to Parent Dashboard
Parent Dashboard
  ↓ clicks "Start [Child]'s Session"
  ↓ scoped child JWT issued
  ↓ child can now use platform
Student Home (child session — restricted permissions)
```

### Scenario E: Parent Managing Child Account (COPPA)
```
Login Page → Parent Home
  ↓ clicks "Manage Children"
Parent COPPA Dashboard
  ↓ sees list of linked children
  │
  ├── clicks "Start Session" → child JWT issued → index.html
  ├── clicks "View Data" → child progress summary displayed
  ├── clicks "Download Data" → JSON export downloaded
  └── clicks "Delete Account" → confirmation dialog
       ↓ confirms deletion
       ↓ child account + all data deleted
       ↓ ConsentLog updated (revokedAt)
       ↓ child removed from parent's list
```

### Scenario C: Teacher Workflow
```
Login Page → Teacher Home
  ↓ clicks "New Worksheet"
Generate Page (selects Grade 5 Science — Ecosystems)
  ↓ generates worksheet
Result Page
  ↓ clicks "Assign to Class"
Assign Worksheet → selects class, sets due date
  ↓
Class View (shows new assignment in roster)
  ↓ 3 days later
Class View refreshed:
  - Completion rate visible (18/25 students completed)
  - 4 students flagged as needing intervention (< 60%)
  ↓ clicks on flagged student
Student Detail (sees weak areas: Food Chains, Energy Transfer)
```

---

## UI Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | #00BFA5 | Teal — primary brand, buttons, headers |
| `--primary-dark` | #00897B | Hover states |
| `--accent` | #FF7043 | Orange — CTAs, "Generate" button, highlights |
| `--accent-dark` | #E64A19 | CTA hover states |
| `--success` | #4CAF50 | Correct answers, success messages |
| `--error` | #F44336 | Incorrect answers, error states |
| `--warning` | #FFC107 | Caution, approaching time limit |
| `--neutral-900` | #212121 | Body text |
| `--neutral-700` | #616161 | Secondary text |
| `--neutral-300` | #E0E0E0 | Borders, dividers |
| `--neutral-100` | #F5F5F5 | Page backgrounds |

### Typography

- **Headings:** Nunito, weights 700 (bold) and 800 (extrabold)
- **Body:** Inter, weights 400 (regular) and 500 (medium)
- **Code/Answers:** Fira Code, weight 400

Base font size: 16px. Line height: 1.5 for body, 1.2 for headings.

### Responsive Breakpoints

| Breakpoint | Min Width | Layout |
|---|---|---|
| Mobile | 320px | Single column |
| Tablet | 768px | Two column where applicable |
| Desktop | 1024px | Full layout |
| Wide | 1280px | Max-width container (1200px) centered |

### Component Design Philosophy

**Joyful meets trustworthy:**
- Rounded corners (border-radius: 8–16px) on cards and buttons
- Consistent shadow system: sm (hover states), md (cards), lg (modals)
- Multi-color accent usage (teal primary, orange secondary, green success, red error)
- Generous whitespace (minimum 16px between components)

**Accessibility:**
- All interactive elements have focus styles
- Color is not the only indicator of correct/incorrect (also icon + label)
- Minimum touch target: 44px × 44px on mobile
- WCAG AA contrast ratios on all text

---

## Solve Page UX Details

### Question Rendering by Type

**multiple-choice:**
```html
<fieldset>
  <legend>Question 1: What is 6 × 7?</legend>
  <label><input type="radio" name="q1" value="A"> A. 36</label>
  <label><input type="radio" name="q1" value="B"> B. 42</label>
  <label><input type="radio" name="q1" value="C"> C. 48</label>
  <label><input type="radio" name="q1" value="D"> D. 54</label>
</fieldset>
```

**fill-in-the-blank:**
```html
<label>8 × 9 = <input type="text" name="q2" placeholder="Your answer"></label>
```

**true-false:**
```html
<fieldset>
  <legend>The Sun is a planet. True or False?</legend>
  <label><input type="radio" name="q3" value="True"> True</label>
  <label><input type="radio" name="q3" value="False"> False</label>
</fieldset>
```

**short-answer:**
```html
<textarea name="q4" rows="3" placeholder="Write your answer here..."></textarea>
```

**show-your-work:**
```html
<textarea name="q5-work" rows="4" placeholder="Show your work..."></textarea>
<input type="text" name="q5-final" placeholder="Final answer">
```

### Timer UX

Timed mode timer behavior:
- Displays as `MM:SS` countdown
- Turns yellow (--warning) when < 25% time remains
- Turns red (--error) when < 10% time remains
- Auto-submits when reaches 00:00 (captures all filled answers)
- Timer continues even if student navigates away (JS timestamp comparison on return)

### Results Page Design

After submission:
```
┌─────────────────────────────────────────────────────────────┐
│  Your Score: 8/10                           80%             │
│  Time Taken: 14 minutes 5 seconds                           │
│  Mode: Timed                                                │
└─────────────────────────────────────────────────────────────┘

Question 1                                           ✓ 1/1 pt
What is 6 × 7?
Your answer: B. 42                                   CORRECT
Explanation: 6 × 7 = 42

Question 2                                           ✗ 0/1 pt
8 × 9 = ___
Your answer: 63        Correct answer: 72
Explanation: 8 × 9 = 72

[Try Again]  [Generate New Worksheet]  [Download Certificate]
```

The "Download Certificate" button only appears when score >= 80%.

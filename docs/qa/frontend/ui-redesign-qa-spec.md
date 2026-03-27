# UI Redesign — QA & Verification Specification
**Document Version:** 1.0  
**Created:** 2026-03-24  
**Project:** Learnfyra  
**Scope:** UI redesign verification with NO code changes baseline  
**Author:** QA Agent  
**Branch:** feature/ui-redesign  

---

## 1. Test Matrix

### 1.1 Generator Page (index.html) — State Transitions

| Test ID | Initial State | User Action | Expected State | Critical Selectors |
|---------|--------------|-------------|----------------|-------------------|
| **G-001** | Page load | None | Form visible, all required fields empty, Generate button disabled | `#formSection` visible, `#generateBtn[disabled]` |
| **G-002** | All fields empty | Select Grade 3 | Subject dropdown enabled, Topic disabled | `#subject:not([disabled])`, `#topic[disabled]` |
| **G-003** | Grade selected | Select Subject "Math" | Topic dropdown populated with Math topics | `#topic option[value="Multiplication Facts (1–10)"]` exists |
| **G-004** | Grade, Subject, Topic selected | Select Difficulty, Count, Format | Generate button enabled | `#generateBtn:not([disabled])` |
| **G-005** | All required fields filled | Click Generate | Loading section shown, form hidden | `#loadingSection:not([hidden])`, `#formSection[hidden]` |
| **G-006** | Loading state | API returns 200 | Results section shown with download buttons | `#resultsSection:not([hidden])`, `.download-btn` exists |
| **G-007** | Results shown | Click "Generate Another" | Form reappears, fields cleared | `#formSection:not([hidden])`, `#grade` value === "" |
| **G-008** | Loading state | API returns error | Error section shown with message | `#errorSection:not([hidden])`, `#errorMessage` not empty |
| **G-009** | Results shown | Worksheet includes worksheetId | "Solve Online" button visible | `.btn--solve` exists with text "Solve Online" |
| **G-010** | Results shown | Optional fields filled before generation | resultsDescription includes metadata | `#resultsDescription` contains grade/subject/topic |

### 1.2 Generator Page — Form Validation

| Test ID | Scenario | Trigger | Expected Validation | Critical Selectors |
|---------|----------|---------|---------------------|-------------------|
| **V-001** | All fields empty | Click Generate | Each required field shows error span | `.field-error` text not empty for grade/subject/topic/difficulty/questionCount/format |
| **V-002** | Only Grade filled | Click Generate | Subject/Topic/Difficulty/Count/Format show errors | `#subjectError`, `#topicError`, etc. contain text |
| **V-003** | Grade out of range (DOM tampering) | Grade = 11, submit | Grade error shown, form invalid | `#gradeError` contains "must be between 1 and 10" |
| **V-004** | Valid required fields | Submit | No error spans, API call made | All `.field-error` empty |
| **V-005** | Optional fields left blank | Submit | No validation errors, empty strings passed to API | No error, payload includes empty strings |
| **V-006** | Invalid date format (manual input) | worksheetDate = "invalid" | Browser native validation or accepted | Depends on browser, no JS validation expected |

### 1.3 Solve Page (solve.html) — Loading & Mode Selection

| Test ID | Initial State | User Action | Expected State | Critical Selectors |
|---------|--------------|-------------|----------------|-------------------|
| **S-001** | Page load with ?id=valid-uuid | None (automatic) | Loading spinner, then mode selection | `#loadingSection` visible then hidden, `#modeSection:not([hidden])` |
| **S-002** | Mode selection shown | None | Timer description shows formatted time | `#timedDesc` contains "20:00 countdown" format MM:SS |
| **S-003** | Mode selection shown | Worksheet metadata loaded | Header shows Grade·Subject·Topic·Difficulty | `#worksheetMeta` contains "·" separators |
| **S-004** | Mode selection shown | Click "Timed Mode" | Solve section shown, timer bar visible, countdown starts | `#solveSection:not([hidden])`, `#timerBar:not([hidden])`, `#timerDisplay` updating |
| **S-005** | Mode selection shown | Click "Untimed Mode" | Solve section shown, no timer bar | `#solveSection:not([hidden])`, `#timerBar[hidden]` |
| **S-006** | ?id parameter missing | Page load | Error section shown | `#errorSection:not([hidden])`, `#errorMessage` contains "No worksheet ID" |
| **S-007** | ?id=nonexistent-uuid | Page load, API returns 404 | Error section with "not found" message | `#errorSection:not([hidden])`, `#errorMessage` contains "not found" |
| **S-008** | API network failure | Page load, fetch throws | Error section with network error | `#errorMessage` contains "Network error" |

### 1.4 Solve Page — Question Rendering

| Test ID | Question Type | Expected Render | Critical Selectors | Points Display |
|---------|---------------|-----------------|-------------------|----------------|
| **Q-001** | multiple-choice | 4 radio buttons with labels A-D | `.question-card[data-type="multiple-choice"]`, `.option-radio`, `.option-text` | `.question-points` shows "1 pt" |
| **Q-002** | true-false | 2 radio buttons: True, False | `.question-card[data-type="true-false"]`, `input[value="True"]`, `input[value="False"]` | Points badge visible |
| **Q-003** | fill-in-the-blank | Single text input | `.question-card[data-type="fill-in-the-blank"]`, `.fill-input` | Points badge visible |
| **Q-004** | short-answer | Textarea, 3 rows | `.question-card[data-type="short-answer"]`, `.short-answer-input[rows="3"]` | Points badge visible |
| **Q-005** | matching | Multiple rows, left labels + right inputs | `.question-card[data-type="matching"]`, `.matching-wrap`, `.matching-row`, `.matching-left`, `.matching-right-input` | Points badge visible |
| **Q-006** | show-your-work | Textarea (work area) + text input (final answer) | `.question-card[data-type="show-your-work"]`, `.work-area`, `.final-answer-input` | Points badge visible |
| **Q-007** | word-problem | Same as show-your-work | `.question-card[data-type="word-problem"]`, `.work-area`, `.final-answer-input` | Points badge visible |
| **Q-008** | Question with 0 points | Points badge should show "0 pts" or be hidden | `.question-points` either absent or shows "0 pts" | Per code decision |
| **Q-009** | Question with 2+ points | Points badge shows "2 pts" (plural) | `.question-points` contains "pts" not "pt" | Plural check |
| **Q-010** | 10 questions rendered | 10 `.question-card` elements in order | `#questionsContainer .question-card` count === 10 | Order by question number |

### 1.5 Solve Page — Timed Mode

| Test ID | Scenario | User Action | Expected Behavior | Critical Selectors |
|---------|----------|-------------|-------------------|-------------------|
| **T-001** | Timed mode started | None (automatic tick every 1s) | `#timerDisplay` decrements from timerSeconds | `#timerDisplay` text changes every 1000ms |
| **T-002** | Timer at 20:00 | 60 seconds pass | Display shows 19:00 | `#timerDisplay` === "19:00" |
| **T-003** | Timer reaches 01:00 | 1 more second | Display turns red (urgent) | `.timer-display--urgent` class added, `#timerDisplay` === "00:59" |
| **T-004** | Timer reaches 00:00 | Countdown completes | Form auto-submits | `#submitBtn.disabled`, POST /api/submit called |
| **T-005** | Student submits before timer expires | Click Submit | Timer stops, no double submission | `timerInterval` cleared, single POST |
| **T-006** | Timer at 00:05 | Visual check | Display red, seconds count down | `.timer-display--urgent` applied |
| **T-007** | Timed mode | Page refresh mid-solve | Timer resets (no persistence) | Expected: timer starts from full time again (no localStorage) |

### 1.6 Solve Page — Untimed Mode

| Test ID | Scenario | User Action | Expected Behavior | Critical Selectors |
|---------|----------|-------------|-------------------|-------------------|
| **U-001** | Untimed mode started | None | No timer bar visible | `#timerBar[hidden]` |
| **U-002** | Untimed mode | Fill answers, submit | POST /api/submit with timed:false | Request body includes `"timed": false` |
| **U-003** | Untimed mode, 5 minutes elapsed | Submit | timeTaken reflects actual elapsed seconds | Request body `timeTaken` ~300 seconds |
| **U-004** | Untimed mode | Leave page idle for 1 hour, submit | No timeout, submission succeeds | No artificial timeout enforced |

### 1.7 Solve Page — Answer Collection

| Test ID | Question Type | Student Input | Expected Collected Answer | Validation |
|---------|---------------|---------------|---------------------------|------------|
| **A-001** | multiple-choice | Radio button B selected | `{ number: 1, answer: "B" }` | `answer` is letter only |
| **A-002** | multiple-choice | No selection | `{ number: 1, answer: "" }` | Empty string |
| **A-003** | true-false | "False" selected | `{ number: 2, answer: "False" }` | Exact case match expected |
| **A-004** | fill-in-the-blank | Input: "  42  " | `{ number: 3, answer: "42" }` | Trimmed |
| **A-005** | short-answer | Textarea: "The answer is X\n\n" | `{ number: 4, answer: "The answer is X" }` | Trimmed, newlines preserved or collapsed |
| **A-006** | matching | 3 pairs filled | `{ number: 5, answer: [{left:"A",right:"1"},{left:"B",right:"2"},{left:"C",right:"3"}] }` | Array of objects |
| **A-007** | matching | 1 pair blank | Right input empty -> that pair has `right: ""` | Partial fill allowed |
| **A-008** | show-your-work | Final answer: "24" | `{ number: 6, answer: "24" }` | Only final answer, work area ignored |
| **A-009** | word-problem | Final answer: "7 apples" | `{ number: 7, answer: "7 apples" }` | Only final answer |
| **A-010** | Any type | Field left blank | `answer` is `""` or `[]` for matching | Never `null` or `undefined` |

### 1.8 Submit & Results

| Test ID | Scenario | API Response | Expected Render | Critical Selectors |
|---------|----------|--------------|-----------------|-------------------|
| **R-001** | Submit with 8/10 correct | 200, 80% | Green score circle, "Great Job!" title | `.score-circle--great`, `.score-title` contains positive message |
| **R-002** | Submit with 6/10 correct | 200, 60% | Yellow score circle, "Good Try" title | `.score-circle--ok` |
| **R-003** | Submit with 3/10 correct | 200, 30% | Red score circle, "Keep Practicing" title | `.score-circle--poor` |
| **R-004** | All correct answers | 200, 100% | 10 green checkmarks, no red X | All `.result-item--correct`, no `.result-item--incorrect` |
| **R-005** | All incorrect answers | 200, 0% | 10 red X marks, correct answers shown | All `.result-item--incorrect`, `.result-correct-answer` visible |
| **R-006** | Mixed results | 200 | Each result-item has icon ✅ or ❌ | `.result-icon` contains checkmark or X |
| **R-007** | Correct answer | 200 | No "Correct answer:" line shown (redundant) | `.result-correct-answer` absent on correct items |
| **R-008** | Incorrect answer | 200 | "Correct answer:" line shown with actual answer | `.result-correct-value` contains the correct answer text |
| **R-009** | Question with explanation | 200 | Explanation paragraph visible | `.result-explanation` contains explanation text |
| **R-010** | Question with no explanation | 200 | No explanation paragraph | `.result-explanation` absent |
| **R-011** | Timed mode result | 200 | "Time taken: 14:05" shown in score summary | `.score-detail` contains "Time taken:" |
| **R-012** | Untimed mode result | 200 | No time display in summary (or time without emphasis) | No "Time taken:" or not emphasized |
| **R-013** | Click "Try Again" | None | Reload solve.html with same ?id | Page reloads, mode selection shown again |
| **R-014** | Click "Generate New Worksheet" | None | Navigate to / (index.html) | Location changes to root |
| **R-015** | Submit fails (network error) | 500 or network fail | Alert shown, submit button re-enabled | Alert dialog, `#submitBtn:not([disabled])` |

### 1.9 Error States

| Test ID | Error Condition | Expected Display | Critical Selectors |
|---------|----------------|------------------|-------------------|
| **E-001** | Generator API returns 400 | Error section shown, message from API | `#errorSection:not([hidden])`, `#errorMessage` contains API error |
| **E-002** | Generator API returns 500 | Error section shown, generic message | `#errorMessage` contains "server error" or "try again" |
| **E-003** | Solve API returns 404 | Error section with "not found" | `#errorMessage` contains "not found" |
| **E-004** | Submit API returns 400 | Alert dialog (non-blocking) | Browser `alert()` called |
| **E-005** | Submit API returns 500 | Alert dialog with error message | Alert shows "Submission failed" |
| **E-006** | Network timeout on generate | Error section after timeout | Error message indicates network issue |

### 1.10 Responsive Behavior

| Test ID | Viewport Size | Page | Expected Layout | Visual Check |
|---------|--------------|------|-----------------|--------------|
| **RWD-001** | 320px width (mobile) | index.html | Single column form, full width inputs | `.form-grid` stacks vertically |
| **RWD-002** | 768px width (tablet) | index.html | Two-column grid for form fields | `.form-grid` uses grid layout |
| **RWD-003** | 1024px+ (desktop) | index.html | Two-column grid, centered container | `.container` max-width applied |
| **RWD-004** | 320px width | solve.html | Question cards full width, single column | `.question-card` stacks |
| **RWD-005** | 768px width | solve.html | Question cards still single column | No side-by-side questions |
| **RWD-006** | Timer on mobile | solve.html timed mode | Timer bar spans full width, readable | `#timerBar` at top, no overflow |
| **RWD-007** | Results on mobile | solve.html results | Score circle and breakdown stack vertically | `.results-score-header` vertical layout |
| **RWD-008** | Download buttons on mobile | index.html results | Buttons stack vertically | `.download-grid` becomes column |
| **RWD-009** | Long topic names | Dropdowns on mobile | Text wraps or ellipsis, no overflow | `#topic option` text fits select |
| **RWD-010** | Header on mobile | Both pages | Logo and tagline readable, responsive | `.site-header` layout adjusts |

---

## 2. Selector-Contract Validation Checklist

### Purpose
Verify that all DOM element IDs, classes, and data attributes used by JavaScript functionality are present in the HTML and that their contracts (e.g., required attributes, structure) are met. This prevents silent breakage when CSS or HTML structure changes during redesign.

### 2.1 Generator Page (index.html) — Required IDs

| Element ID | JavaScript Reference | Contract | Risk if Missing/Changed |
|-----------|---------------------|----------|-------------------------|
| `grade` | `document.getElementById('grade')` | `<select>` element, `required` | Dropdown population fails, validation fails, form breaks |
| `subject` | `document.getElementById('subject')` | `<select>` element, initial `disabled`, `required` | Subject selection broken |
| `topic` | `document.getElementById('topic')` | `<select>` element, initial `disabled`, `required` | Topic selection broken |
| `difficulty` | `document.getElementById('difficulty')` | `<select>` element, `required` | Validation fails |
| `questionCount` | `document.getElementById('questionCount')` | `<select>` element, `required` | Validation fails |
| `format` | `document.getElementById('format')` | `<select>` element, `required` | Validation fails |
| `includeAnswerKey` | `document.getElementById('includeAnswerKey')` | `<input type="checkbox">`, `.checked` property | Answer key toggle broken |
| `studentName` | `document.getElementById('studentName')` | `<input type="text">`, `.value.trim()` | Optional field, but must exist |
| `worksheetDate` | `document.getElementById('worksheetDate')` | `<input type="date">`, `.value` | Optional field, must exist |
| `teacherName` | `document.getElementById('teacherName')` | `<input type="text">`, `.value.trim()` | Optional field, must exist |
| `period` | `document.getElementById('period')` | `<input type="text">`, `.value.trim()` | Optional field, must exist |
| `className` | `document.getElementById('className')` | `<input type="text">`, `.value.trim()` | Optional field, must exist |
| `generateBtn` | `document.getElementById('generateBtn')` | `<button>`, `.disabled` property | Generate action broken |
| `worksheetForm` | `document.getElementById('worksheetForm')` | `<form>`, submit event listener | Form submission broken |
| `formSection` | `document.getElementById('formSection')` | Section container, `.hidden` property | Show/hide transitions broken |
| `loadingSection` | `document.getElementById('loadingSection')` | Section container, `.hidden` property | Loading state broken |
| `resultsSection` | `document.getElementById('resultsSection')` | Section container, `.hidden` property | Results display broken |
| `errorSection` | `document.getElementById('errorSection')` | Section container, `.hidden` property | Error display broken (but not currently in HTML per my reading — **RISK**) |
| `downloadButtons` | `document.getElementById('downloadButtons')` | Container for injected buttons, `.innerHTML` | Download buttons not injected |
| `resultsDescription` | `document.getElementById('resultsDescription')` | Text container, `.textContent` | Metadata display broken |
| `errorMessage` | `document.getElementById('errorMessage')` | Text container, `.textContent` | Error message not shown (if errorSection exists) |
| `generateAnotherBtn` | `document.getElementById('generateAnotherBtn')` | `<button>`, click event listener | "Generate Another" action broken |
| `gradeError` | `document.getElementById('gradeError')` | `.field-error` span, `.textContent` | Validation error not displayed |
| `subjectError` | `document.getElementById('subjectError')` | `.field-error` span, `.textContent` | Validation error not displayed |
| `topicError` | `document.getElementById('topicError')` | `.field-error` span, `.textContent` | Validation error not displayed |
| `difficultyError` | `document.getElementById('difficultyError')` | `.field-error` span, `.textContent` | Validation error not displayed |
| `questionCountError` | `document.getElementById('questionCountError')` | `.field-error` span, `.textContent` | Validation error not displayed |
| `formatError` | `document.getElementById('formatError')` | `.field-error` span, `.textContent` | Validation error not displayed |

**CRITICAL DISCOVERY:** The current `index.html` does NOT include `<section id="errorSection">`. The JavaScript in `app.js` references this element but it is missing from the HTML. This is a **HIGH RISK** bug that will cause a runtime error when `showError()` is called.

**ACTION REQUIRED:** Verify that `errorSection` exists or document as a known bug to fix before redesign.

### 2.2 Generator Page — Required Classes

| Class Name | JavaScript Reference | Contract | Risk if Missing/Changed |
|-----------|---------------------|----------|-------------------------|
| `.form-select` | Styling only (no JS reference found) | Applied to all `<select>` elements | Styling only, no functional break |
| `.form-input` | Styling only | Applied to text/date inputs | Styling only |
| `.is-invalid` | `el.classList.add('is-invalid')` in validation | Applied to invalid required fields | Validation visual feedback broken |
| `.field-error` | Indirect reference via IDs (`#gradeError` etc.) | Error message spans | See ID table above |
| `.download-btn` | Created programmatically: `btn.className = 'btn btn--pdf download-btn'` | Applied to injected download buttons | Styling of download buttons broken |
| `.btn--primary`, `.btn--secondary` | Applied to generate and "Generate Another" buttons | Action buttons | Styling broken |
| `.btn--pdf`, `.btn--docx`, `.btn--html`, `.btn--key`, `.btn--solve` | Dynamic button modifiers | Download button variants | Styling variants broken |

### 2.3 Solve Page (solve.html) — Required IDs

| Element ID | JavaScript Reference | Contract | Risk if Missing/Changed |
|-----------|---------------------|----------|-------------------------|
| `loadingSection` | `document.getElementById('loadingSection')` | Section, `.hidden` property | Loading state broken |
| `errorSection` | `document.getElementById('errorSection')` | Section, `.hidden` property | Error display broken |
| `errorMessage` | `document.getElementById('errorMessage')` | Text container, `.textContent` | Error text not shown |
| `modeSection` | `document.getElementById('modeSection')` | Section, `.hidden` property | Mode selection not shown |
| `modeTitleText` | `document.getElementById('modeTitleText')` | Text container, `.textContent` | Title not updated |
| `modeSubtitleText` | `document.getElementById('modeSubtitleText')` | Text container, `.textContent` | Subtitle not updated |
| `timedDesc` | `document.getElementById('timedDesc')` | Text container, `.textContent` | Timer duration not shown |
| `timedModeBtn` | `document.getElementById('timedModeBtn')` | `<button>`, click event listener | Timed mode selection broken |
| `untimedModeBtn` | `document.getElementById('untimedModeBtn')` | `<button>`, click event listener | Untimed mode selection broken |
| `solveSection` | `document.getElementById('solveSection')` | Section, `.hidden` property | Questions not displayed |
| `timerBar` | `document.getElementById('timerBar')` | Container, `.hidden` property | Timer not shown/hidden correctly |
| `timerDisplay` | `document.getElementById('timerDisplay')` | Text container, `.textContent`, class `.timer-display--urgent` | Timer countdown not displayed |
| `questionsContainer` | `document.getElementById('questionsContainer')` | Container, `.innerHTML` cleared/appended | Questions not rendered |
| `solveForm` | `document.getElementById('solveForm')` | `<form>`, submit event listener | Form submission broken |
| `submitBtn` | `document.getElementById('submitBtn')` | `<button>`, `.disabled`, `.textContent` | Submit broken |
| `resultsSection` | `document.getElementById('resultsSection')` | Section, `.hidden` property | Results not shown |
| `scoreHeader` | `document.getElementById('scoreHeader')` | Container, `.innerHTML` replaced | Score summary not shown |
| `resultsBreakdown` | `document.getElementById('resultsBreakdown')` | Container, `.innerHTML` replaced | Per-question results broken |
| `tryAgainBtn` | `document.getElementById('tryAgainBtn')` | `<button>`, click event listener (code not shown, assumed) | Try again broken |
| `worksheetMeta` | `document.getElementById('worksheetMeta')` | Text container, `.textContent` | Worksheet metadata not shown |

### 2.4 Solve Page — Required Classes

| Class Name | JavaScript Reference | Contract | Risk if Missing/Changed |
|-----------|---------------------|----------|-------------------------|
| `.question-card` | Created: `card.className = 'question-card'` | Wrapper for each question | Styling and query selector broken |
| `.question-header` | Created: `header.className = 'question-header'` | Question number + text wrapper | Styling broken |
| `.question-badge` | Created: `<span class="question-badge">` | Question number display | Styling broken |
| `.question-text` | Created: `<p class="question-text">` | Question text display | Styling broken |
| `.question-points` | Created: `pts.className = 'question-points'` | Points display badge | Styling broken |
| `.question-input-area` | Created: `wrap.className = 'question-input-area'` | Input field wrapper | Styling broken |
| `.question-options` | Created: `fieldset.className = 'question-options'` | Radio button fieldset | Styling and layout broken |
| `.option-label` | Created: `label.className = 'option-label'` | Radio button label wrapper | Styling broken |
| `.option-radio` | Created: `<input class="option-radio">` | Radio button input | Styling and query selector broken |
| `.option-custom` | Created: `<span class="option-custom">` | Custom radio button display | Styling broken |
| `.option-text` | Created: `<span class="option-text">` | Radio button label text | Styling broken |
| `.form-input` | Applied to text inputs and textareas | Generic input styling | Styling broken |
| `.fill-input` | Applied to fill-in-the-blank inputs | Specific input type styling | Query selector `.fill-input` broken |
| `.short-answer-input` | Applied to short-answer textarea | Query selector broken |
| `.matching-wrap` | Created for matching questions | Wrapper with `data-qnum` | Query selector broken |
| `.matching-row` | Created for each matching pair | Matching pair row | Styling and query selector broken |
| `.matching-left` | Created for left side of match | Left label | Query selector broken |
| `.matching-right-input` | Created for right input | Right input field with `data-left` and `data-index` | Query selector broken |
| `.work-area` | Created for show-your-work/word-problem | Textarea for work | Styling only (not queried) |
| `.final-answer-input` | Created for final answer input | Text input with `data-qnum` | Query selector `.final-answer-input` broken |
| `.final-answer-label` | Created: `<label class="final-answer-label">` | Label for final answer | Styling broken |
| `.timer-display--urgent` | Applied when `secondsLeft <= 60` | Red timer display | Urgent styling broken |
| `.result-item` | Created: `item.className = 'result-item ...'` | Results item wrapper | Styling and layout broken |
| `.result-item--correct` | Applied to correct answers | Green checkmark styling | Styling broken |
| `.result-item--incorrect` | Applied to incorrect answers | Red X styling | Styling broken |
| `.result-item-header` | Created for result header | Result item header wrapper | Styling broken |
| `.result-icon` | Created: `<span class="result-icon">` | Checkmark or X icon | Styling broken |
| `.result-qnum` | Created: `<span class="result-qnum">` | "Question #" label | Styling broken |
| `.result-points` | Created: `<span class="result-points">` | Points earned display | Styling broken |
| `.result-points--earned` | Applied when correct | Earned points styling | Styling broken |
| `.result-student-answer` | Created: `<div class="result-student-answer">` | Student answer wrapper | Styling broken |
| `.result-student-label` | Created: `<span class="result-student-label">` | "Your answer:" label | Styling broken |
| `.result-student-value` | Created: `<span class="result-student-value">` | Student answer value | Styling broken |
| `.result-correct-answer` | Created when incorrect: `<div class="result-correct-answer">` | Correct answer wrapper | Styling and conditional display broken |
| `.result-correct-label` | Created: `<span class="result-correct-label">` | "Correct answer:" label | Styling broken |
| `.result-correct-value` | Created: `<span class="result-correct-value">` | Correct answer value | Styling broken |
| `.result-explanation` | Created: `<p class="result-explanation">` | Explanation paragraph | Styling broken |
| `.score-circle` | Created: `<div class="score-circle score-circle--{grade}">` | Score percentage circle | Styling broken |
| `.score-circle--great`, `--ok`, `--poor` | Dynamic modifier based on percentage | Color coding (green/yellow/red) | Styling broken |
| `.score-pct` | Created: `<span class="score-pct">` | Percentage text inside circle | Styling broken |
| `.score-summary` | Created: `<div class="score-summary">` | Score text summary | Styling broken |
| `.score-title` | Created: `<h2 class="score-title">` | Score header text | Styling broken |
| `.score-detail` | Created: `<p class="score-detail">` | Points and time display | Styling broken |
| `.results-score-header` | Created: `scoreHeader.className = 'results-score-header results-score-header--{grade}'` | Results header wrapper | Styling broken |
| `.results-score-header--great`, `--ok`, `--poor` | Dynamic modifier | Color-coded header | Styling broken |

### 2.5 Data Attributes — Solve Page

| Attribute | Element Type | JavaScript Usage | Contract | Risk if Missing |
|-----------|--------------|------------------|----------|-----------------|
| `data-number` | `.question-card` | `card.dataset.number = q.number` | Integer question number | Answer collection fails to identify question |
| `data-type` | `.question-card` | `card.dataset.type = q.type` | Question type string (multiple-choice, fill-in-the-blank, etc.) | Answer collection logic fails to select correct input |
| `data-qnum` | `.fill-input`, `.short-answer-input`, `.final-answer-input`, `.matching-wrap` | Input elements: `input.dataset.qnum = q.number` | Integer question number | Fallback: parent `.question-card` `data-number` must be used |
| `data-left` | `.matching-right-input` | `rightInput.dataset.left = leftItem` | String, left-side item text | Matching pair association broken |
| `data-index` | `.matching-right-input` | `rightInput.dataset.index = i` | Integer index | Not used in current code, likely for debugging |

### 2.6 Named Inputs (Solve Page)

| Input Name | Element Type | JavaScript Selector | Contract | Risk if Missing |
|-----------|--------------|---------------------|----------|-----------------|
| `q{number}` | Radio button group (multiple-choice, true-false) | `card.querySelector('input[name="q${qNum}"]:checked')` | Multiple radio inputs share same name per question | Answer collection fails |

**IMPORTANT:** The `name` attribute on radio buttons is dynamically generated as `name="q${q.number}"` where `q.number` is the question number from the API. The HTML does not statically define these; they are created by `solve.js`.

### 2.7 ARIA and Accessibility Contracts

| Element | Required ARIA Attributes | Contract | Risk if Changed |
|---------|-------------------------|----------|-----------------|
| All `<select>` required fields (generator) | `aria-required="true"` | Screen reader announcement | Accessibility fail, WCAG violation |
| All `.field-error` spans | `role="alert"`, `aria-live="polite"` | Error announcements | Screen reader does not announce errors |
| `#loadingSection` (both pages) | `aria-label="Loading..."`, `aria-live="polite"` | Loading state announcements | Screen reader user unaware of loading |
| `#errorSection` (solve.html) | `role="alert"`, `aria-live="assertive"` | Error announcements (urgent) | Critical errors not announced |
| `.question-options` fieldset | `<legend class="sr-only">` | Screen reader instructions | User does not know what to do |
| Each input in solve.html | `aria-label="Answer for question {number}"` | Screen reader identifies field | Ambiguous field purpose |
| `.spinner` elements | `aria-hidden="true"` | Decorative, not announced | Screen reader clutter (minor) |
| `.bg-orb` elements | `aria-hidden="true"` | Decorative background | Screen reader clutter (minor) |

---

## 3. Accessibility & Regression Checks

### 3.1 Keyboard Navigation

| Test ID | Page | Action | Expected Behavior | WCAG Criteria |
|---------|------|--------|-------------------|---------------|
| **A11Y-001** | index.html | Tab through form | Focus visible on each field in order: Grade → Subject → Topic → Difficulty → Count → Format → Checkbox → Optional fields → Generate button | 2.1.1 (Keyboard), 2.4.7 (Focus Visible) |
| **A11Y-002** | index.html | Tab to Generate when disabled | Focus reaches button, but activation does nothing | 2.1.1 |
| **A11Y-003** | index.html results | Tab through download buttons | Each button receives focus, Enter activates | 2.1.1 |
| **A11Y-004** | solve.html mode selection | Tab to mode buttons | Both buttons focusable, Enter/Space activates | 2.1.1 |
| **A11Y-005** | solve.html | Tab through questions | Each input receives focus in order (Q1 option A → B → C → D → Q2...) | 2.1.1, 2.4.3 (Focus Order) |
| **A11Y-006** | solve.html multiple-choice | Arrow keys in radio group | Up/Down arrows change selection (browser native) | 2.1.1 |
| **A11Y-007** | solve.html | Tab to Submit button | Focus visible, Enter submits form | 2.1.1 |
| **A11Y-008** | solve.html results | Tab through results | "Try Again" and "Generate New" buttons focusable | 2.1.1 |
| **A11Y-009** | Both pages | Tab trap test | No focus traps, Tab reaches all interactive elements | 2.1.2 (No Keyboard Trap) |

### 3.2 Screen Reader Testing

| Test ID | Page | Element | Expected Announcement | Tool |
|---------|------|---------|----------------------|------|
| **SR-001** | index.html | Grade select (required) | "Grade, required, combobox" | NVDA / JAWS |
| **SR-002** | index.html | Subject select (disabled) | "Subject, required, combobox, unavailable" | NVDA / JAWS |
| **SR-003** | index.html | Validation error | "Grade is required" announced as alert | NVDA / JAWS |
| **SR-004** | index.html | Loading section | "Generating worksheet" announced | NVDA / JAWS |
| **SR-005** | solve.html | Question 1 multiple-choice | "Question 1, What is 6 x 7? Radio group, 4 items" | NVDA / JAWS |
| **SR-006** | solve.html | Radio button A | "A. 42, radio button, 1 of 4, not checked" | NVDA / JAWS |
| **SR-007** | solve.html | Timer display | "Time remaining, 19:30" (aria-live update) | NVDA / JAWS |
| **SR-008** | solve.html | Error section | "Could not load worksheet. Alert" | NVDA / JAWS |
| **SR-009** | solve.html results | Score summary | "Great Job! You scored 8 out of 10 points" | NVDA / JAWS |
| **SR-010** | solve.html results | Correct answer item | "Check mark, Question 1, 1 out of 1 point" | NVDA / JAWS |

**Tool Note:** NVDA (Windows) or VoiceOver (Mac) required. JAWS if available for enterprise testing.

### 3.3 Color Contrast (WCAG AA 4.5:1 minimum for text)

| Test ID | Element | Foreground | Background | Expected Ratio | Tool |
|---------|---------|-----------|------------|----------------|------|
| **CC-001** | Body text | CSS variable or computed | Background | ≥ 4.5:1 | Chrome DevTools Contrast Checker |
| **CC-002** | `.btn--primary` | Button text | Button background | ≥ 4.5:1 | Axe DevTools |
| **CC-003** | `.form-label` required text | Red asterisk | White/light background | ≥ 4.5:1 | Manual check |
| **CC-004** | `.field-error` text | Error red | White background | ≥ 4.5:1 | Axe DevTools |
| **CC-005** | `.timer-display--urgent` | Red text | Timer bar background | ≥ 4.5:1 | Manual check |
| **CC-006** | `.score-circle--great` | White "80%" | Green background | ≥ 4.5:1 | Manual check |
| **CC-007** | `.score-circle--poor` | White "30%" | Red background | ≥ 4.5:1 | Manual check |
| **CC-008** | `.result-item--correct` | Green checkmark / text | White background | ≥ 3:1 (large text) | Manual check |
| **CC-009** | `.result-item--incorrect` | Red X / text | White background | ≥ 3:1 (large text) | Manual check |
| **CC-010** | Link text (footer) | Link color | Footer background | ≥ 4.5:1 | Axe DevTools |

**Action:** Run automated Axe DevTools scan on both pages, then manually verify any flagged issues.

### 3.4 Semantic HTML & Landmarks

| Test ID | Requirement | Expected | Verification |
|---------|------------|----------|--------------|
| **SEM-001** | `<main>` landmark present | Both pages have one `<main>` element | Manual inspection |
| **SEM-002** | `<header>` landmark | Both pages have `<header class="site-header">` | Manual inspection |
| **SEM-003** | Form fields have `<label>` | Every form input has an associated `<label>` with `for` attribute or wrapping | Manual inspection |
| **SEM-004** | Buttons use `<button>` not `<div>` | All interactive actions use semantic `<button>` | Manual inspection |
| **SEM-005** | Link uses `<a href>` | "Generate New Worksheet" and logo links use `<a>` | Manual inspection (solve.html logo is `<a>`, bottom link is `<a>`) |
| **SEM-006** | Headings hierarchy | H1 → H2 → H3 in proper nesting | Axe DevTools scan |
| **SEM-007** | Lists for download buttons | `<div role="list">` and `<button role="listitem">` (current pattern) | Verify ARIA list roles present |
| **SEM-008** | Fieldset for radio groups | Multiple-choice and true-false use `<fieldset>` with `<legend>` | Manual inspection of rendered HTML |
| **SEM-009** | No skipped heading levels | No jump from H2 → H4 | Axe DevTools |
| **SEM-010** | Form validation semantically announced | `aria-required`, `aria-invalid`, `role="alert"` present | Manual inspection |

### 3.5 Regression Checks (Baseline Functionality)

| Test ID | Functionality | Pre-Redesign Expected Behavior | Verification Method |
|---------|--------------|-------------------------------|---------------------|
| **REG-001** | Grade dropdown population | Grades 1-10 appear on page load | Manual test |
| **REG-002** | Subject cascading | Select Grade 3 → Math/ELA/Science/Social Studies/Health options appear | Manual test |
| **REG-003** | Topic cascading | Select Grade 3 + Math → 10 Math topics appear | Manual test |
| **REG-004** | Generate button enable/disable | Disabled until all 6 required fields filled | Manual test |
| **REG-005** | Optional fields passthrough | Leave studentName blank → API receives empty string | Browser DevTools Network inspect |
| **REG-006** | Generate API call | POST /api/generate with correct payload | Network panel |
| **REG-007** | Download button click | Calls GET /api/download, opens new tab | Network panel + visual confirm |
| **REG-008** | Solve Online button | Opens /solve.html?id={uuid} in new tab | Visual confirm |
| **REG-009** | Solve page load | ?id={uuid} → GET /api/solve/:id called | Network panel |
| **REG-010** | Timed mode countdown | Timer decrements every second from timerSeconds | Visual confirm |
| **REG-011** | Timer auto-submit | Timer reaches 0:00, form submits automatically | Manual test with short timer (modify fixture) |
| **REG-012** | Answer collection | Submit form, inspect POST /api/submit payload | Network panel |
| **REG-013** | Results rendering | 200 response renders score circle + breakdown | Visual confirm |
| **REG-014** | Try Again button | Reloads solve.html with same ?id | Location.href check |
| **REG-015** | Form validation prevents submit | Empty form, click Generate, no API call made | Network panel shows no POST |

---

## 4. Risks Most Likely to Break During Redesign

### 4.1 HIGH RISK — Critical Functional Breakage

| Risk ID | Risk Description | Likelihood | Impact | Affected Files | Detection Method |
|---------|------------------|-----------|--------|----------------|------------------|
| **RISK-001** | Changing or removing an element ID that JS depends on (e.g., `#grade`, `#submitBtn`) | **HIGH** | **CRITICAL** | index.html, solve.html | Runtime error in console, functionality broken. Use automated ID contract test (see 5.2). |
| **RISK-002** | Changing radio button `name` attribute structure for questions | **MEDIUM** | **CRITICAL** | solve.js rendering logic (dynamic) | Answer collection returns wrong data. Use test A-001 through A-003. |
| **RISK-003** | Removing `data-number` or `data-type` from `.question-card` | **MEDIUM** | **CRITICAL** | solve.js | Answer collection fails to identify question type. Use test Q-001 through Q-010. |
| **RISK-004** | Breaking `.hidden` property contract (e.g., using `display:none` via class instead of property) | **MEDIUM** | **HIGH** | Both pages | State transitions fail (sections stay visible/hidden incorrectly). Use test G-001, S-001. |
| **RISK-005** | Missing `errorSection` element in index.html (current bug) | **CONFIRMED** | **HIGH** | index.html | `showError()` call throws TypeError. **FIX BEFORE REDESIGN**. |
| **RISK-006** | Nested fieldset changes for radio groups | **MEDIUM** | **MEDIUM** | solve.js multiple-choice/true-false | Query selector `card.querySelector('input[name="q${qNum}"]:checked')` may fail. Use test A-001. |
| **RISK-007** | Changing `.form-input` class on dynamically created inputs | **MEDIUM** | **MEDIUM** | solve.js | Styling breaks, but query selectors like `.fill-input` still work if not removed. |
| **RISK-008** | Removing `role="listitem"` from download buttons | **LOW** | **LOW** | app.js | Accessibility regression, not functional breakage. Use test SEM-007. |
| **RISK-009** | Changing score circle class name pattern | **MEDIUM** | **LOW** | solve.js results rendering | Styling breaks (green/yellow/red), not functional. Use test R-001 through R-003. |
| **RISK-010** | Timer display not updating due to CSS `display:none` on parent | **MEDIUM** | **MEDIUM** | solve.css + solve.js | Timer ticks but not visible. Use test T-001. |

### 4.2 MEDIUM RISK — Visual/UX Breakage

| Risk ID | Risk Description | Likelihood | Impact | Mitigation |
|---------|------------------|-----------|--------|------------|
| **RISK-011** | Form grid layout breaks on mobile (< 768px) | **MEDIUM** | **MEDIUM** | Test RWD-001 through RWD-010 on real devices. |
| **RISK-012** | Download buttons layout breaks (stacking incorrectly) | **MEDIUM** | **MEDIUM** | Test RWD-008, verify `.download-grid` responsive behavior. |
| **RISK-013** | Timer bar overlaps content or is not sticky | **LOW** | **MEDIUM** | Visual test at viewport 320px, 768px. |
| **RISK-014** | Score circle percentage not centered or readable | **LOW** | **MEDIUM** | Visual test R-001 through R-003. |
| **RISK-015** | Long question text overflows card boundaries | **MEDIUM** | **LOW** | Test with manually created long text fixture. |
| **RISK-016** | Background orbs cause performance issues on mobile | **LOW** | **LOW** | Manual performance test on low-end device. |
| **RISK-017** | Color contrast fails on new color scheme | **HIGH** (if colors change) | **MEDIUM** | Automated Axe scan + manual contrast checks CC-001 through CC-010. |
| **RISK-018** | Validation error messages not visible (CSS `display:none` on parent) | **MEDIUM** | **MEDIUM** | Test V-001 through V-006. |

### 4.3 LOW RISK — Edge Cases

| Risk ID | Risk Description | Likelihood | Impact | Mitigation |
|---------|------------------|-----------|--------|------------|
| **RISK-019** | Matching question extraction regex fails on new question format | **LOW** | **LOW** | Matching questions are rare; fallback to 4 blank rows. |
| **RISK-020** | `extractMatchingItems()` returns unexpected array length | **LOW** | **LOW** | Defensive coding in `solve.js` handles variable length. |
| **RISK-021** | Browser date input format (worksheetDate) inconsistent | **MEDIUM** | **LOW** | No client-side validation; relies on browser native. Document known limitation. |
| **RISK-022** | Slow network causes double-submit if user clicks Generate twice | **LOW** | **LOW** | Button disabled on submit, re-clicking does nothing. Verify in test G-005. |
| **RISK-023** | Timer interval continues after navigation away | **LOW** | **LOW** | No cleanup on unload; browser GC handles it. Not a user-facing issue. |

### 4.4 Risk Mitigation Strategy

1. **Before Redesign:**
   - Add missing `errorSection` to `index.html` or remove `showError()` calls.
   - Run automated ID contract validator (see Section 5.2).
   - Run Axe DevTools scan to establish accessibility baseline.

2. **During Redesign:**
   - Never change element IDs without updating JavaScript references.
   - Never change data attribute names without updating JavaScript.
   - Test every state transition manually after CSS/HTML changes.
   - Use browser DevTools Elements panel to verify `.hidden` property (not just `display:none` CSS).

3. **After Redesign:**
   - Run full test matrix (Section 1).
   - Run selector contract validation (Section 2).
   - Run accessibility regression suite (Section 3).
   - Deploy to staging and run smoke tests (Section 5.5).

---

## 5. Recommended Manual Acceptance Script for Stakeholders

### 5.1 Purpose
This script is designed for non-technical stakeholders (teachers, product managers) to verify critical user flows after UI redesign. It assumes no developer tools or test automation.

### 5.2 Prerequisites
- Browser: Chrome or Firefox (latest version)
- Screen size: Desktop (1920x1080) and Mobile (iPhone or Android phone)
- Test environment: staging or local dev server
- Sample inputs prepared (see table below)

### Sample Test Data

| Field | Value |
|-------|-------|
| Grade | 3 |
| Subject | Math |
| Topic | Multiplication Facts (1–10) |
| Difficulty | Medium |
| # Questions | 10 |
| Format | PDF |
| Include Answer Key | Checked |
| Student Name | (leave blank) |
| Date | (leave default) |

---

### 5.3 Acceptance Test Script — Generator Flow

**Test 1: Open Generator Page**  
1. Navigate to `http://localhost:3000` (or staging URL).
2. **PASS if:** Page loads with logo "Learnfyra", hero text "Create polished classroom worksheets", and empty form visible.
3. **FAIL if:** Blank page, error message, or missing content.

---

**Test 2: Fill Out Form (Valid Input)**  
1. Select **Grade:** 3
2. Wait for Subject dropdown to enable.
3. Select **Subject:** Math
4. Wait for Topic dropdown to enable.
5. Select **Topic:** Multiplication Facts (1–10)
6. Select **Difficulty:** Medium
7. Select **Number of Questions:** 10
8. Select **Output Format:** PDF
9. Leave "Include Answer Key" **checked** (default).
10. Leave all optional fields blank.
11. **PASS if:** The "Generate Worksheet" button is **enabled** (not grayed out).
12. **FAIL if:** Button remains disabled.

---

**Test 3: Submit Form and View Loading State**  
1. Click **"Generate Worksheet"** button.
2. **PASS if:** 
   - Form disappears.
   - A spinner/loading animation appears.
   - Text says "Generating your worksheet…"
3. **FAIL if:** Form stays visible, no loading state, or immediate error.

---

**Test 4: View Results with Download Buttons**  
1. Wait for generation to complete (10-20 seconds).
2. **PASS if:**
   - Loading state disappears.
   - Results section appears with green checkmark icon.
   - Heading: "Your Worksheet is Ready!"
   - Description line shows "Grade 3 · Math · Multiplication Facts (1–10)"
   - **Three buttons visible:** "Download PDF", "Download Answer Key", "Solve Online"
   - Fourth button: "Generate Another Worksheet"
3. **FAIL if:** Buttons missing, error message shown, or results section does not appear.

---

**Test 5: Download Worksheet**  
1. Click **"Download PDF"**.
2. **PASS if:** A new browser tab opens with a PDF file (or download starts).
3. **FAIL if:** Nothing happens, error alert, or broken link.

---

**Test 6: Generate Another Worksheet**  
1. Click **"Generate Another Worksheet"**.
2. **PASS if:** Form reappears, all fields are cleared back to placeholder state.
3. **FAIL if:** Results section stays visible, or form fields still populated.

---

**Test 7: Form Validation (Empty Submit)**  
1. With form cleared, immediately click **"Generate Worksheet"** without filling anything.
2. **PASS if:**
   - Form does NOT submit.
   - Red error messages appear under Grade, Subject, Topic, Difficulty, # Questions, and Format fields.
   - Each error says "{Field Name} is required."
3. **FAIL if:** No error messages appear, or form submits anyway.

---

### 5.4 Acceptance Test Script — Solve Flow

**Test 8: Open Solve Page**  
1. Generate a worksheet (repeat Tests 2-4 if needed).
2. Click **"Solve Online"** button.
3. **PASS if:** A new browser tab opens showing the solve page with title "Solve Worksheet — Learnfyra".
4. **FAIL if:** 404 error, blank page, or error message.

---

**Test 9: Mode Selection**  
1. Verify loading spinner appears briefly, then disappears.
2. **PASS if:**
   - Mode selection screen appears.
   - Heading: "Ready to solve?"
   - Subtitle: "10 questions · 20 minutes" (or similar).
   - Two buttons: "Timed Mode" and "Untimed Mode".
3. **FAIL if:** Mode selection does not appear, or buttons missing.

---

**Test 10: Timed Mode — Start Solving**  
1. Click **"Timed Mode"**.
2. **PASS if:**
   - Questions appear (10 question cards).
   - Timer bar at top shows "Time remaining: 20:00" (or configured time).
   - Timer counts down every second (e.g., 19:59, 19:58...).
3. **FAIL if:** No timer visible, or timer does not update.

---

**Test 11: Answer Questions**  
1. Scroll through questions.
2. **PASS if:**
   - Each question shows a number badge (1, 2, 3...).
   - Each question has appropriate input type:
     - Multiple-choice: 4 radio buttons (A, B, C, D).
     - Fill-in-the-blank: Text input box.
     - Short-answer: Larger text area.
   - Points label visible (e.g., "1 pt").
3. Fill in answers to **at least 5 questions** (select random options).
4. **FAIL if:** Questions missing, inputs broken, or layout garbled.

---

**Test 12: Submit Answers**  
1. Click **"Submit Answers"** button at bottom.
2. **PASS if:**
   - Questions disappear.
   - Results section appears with large score circle showing percentage (e.g., "50%").
   - Heading shows "Great Job!", "Good Try", or "Keep Practicing" (depending on score).
   - Score detail text: "You scored X / 10 points. Time taken: MM:SS."
3. **FAIL if:** No results shown, or error message appears.

---

**Test 13: Review Per-Question Results**  
1. Scroll down to see per-question breakdown.
2. **PASS if:**
   - Each question shows:
     - Green checkmark ✅ if correct, red X ❌ if incorrect.
     - "Question #" label.
     - "Your answer:" line.
     - "Correct answer:" line (only if incorrect).
     - Explanation text (if available).
     - Points earned (e.g., "1/1 pt" or "0/1 pt").
3. **FAIL if:** Results missing, icons broken, or explanations not shown.

---

**Test 14: Try Again**  
1. Click **"Try Again"** button.
2. **PASS if:** Page reloads, mode selection screen reappears (same worksheet).
3. **FAIL if:** Error or nothing happens.

---

**Test 15: Untimed Mode (Optional Quick Check)**  
1. Return to mode selection (via Try Again or generate new worksheet).
2. Click **"Untimed Mode"**.
3. **PASS if:**
   - Questions appear as before.
   - **NO timer bar** visible.
   - Can submit at any time.
4. Submit immediately (even with blank answers).
5. **PASS if:** Results appear normally, score is 0/10 or partial if some questions filled.
6. **FAIL if:** Timer bar still visible, or error on submit.

---

### 5.5 Mobile Acceptance Test (Abbreviated)

**Test 16: Generator on Mobile (320px width)**  
1. Open `http://localhost:3000` on a mobile phone or use Chrome DevTools Device Toolbar (iPhone SE).
2. **PASS if:**
   - Form fields stack vertically (one per row).
   - All text readable, no horizontal scroll.
   - Generate button full width at bottom.
3. **FAIL if:** Layout broken, fields overlap, or horizontal scroll required.

---

**Test 17: Solve Page on Mobile**  
1. Generate worksheet, open Solve page on mobile.
2. Select Timed Mode.
3. **PASS if:**
   - Questions stack vertically.
   - Timer bar spans full width at top.
   - Radio buttons and text inputs are tappable (no overlapping).
   - Submit button full width at bottom.
4. **FAIL if:** Questions not readable, timer overlaps content, or buttons too small to tap.

---

**Test 18: Results on Mobile**  
1. Submit answers on mobile.
2. **PASS if:**
   - Score circle centered and readable.
   - Per-question results stack vertically.
   - "Try Again" and "Generate New" buttons full width.
3. **FAIL if:** Layout broken, text overflows, or buttons off-screen.

---

### 5.6 Acceptance Criteria Summary

✅ **PASS Criteria:**
- All 18 tests pass on desktop (Chrome/Firefox).
- Tests 16-18 pass on mobile (iPhone or Android, or DevTools emulation).
- No console errors visible in browser DevTools (press F12 → Console tab).
- All text readable, no visual glitches, no horizontal scroll on mobile.

❌ **FAIL Criteria:**
- Any test marked FAIL.
- JavaScript errors in console (red error messages).
- Broken layout on any viewport size.
- Missing functionality (buttons don't work, data not submitted, etc.).

---

## 6. Automated Test Support (Optional — For QA Agent)

### 6.1 Automated Selector Contract Validator (Puppeteer Script)

This script validates that all required element IDs exist on page load.

**File:** `tests/e2e/selector-contract.test.js`

```javascript
/**
 * @file tests/e2e/selector-contract.test.js
 * @description Validates DOM element contracts for UI redesign.
 * Run: node tests/e2e/selector-contract.test.js
 * Requires: puppeteer installed (npm install --save-dev puppeteer)
 */

const puppeteer = require('puppeteer');

const REQUIRED_IDS_INDEX = [
  'grade', 'subject', 'topic', 'difficulty', 'questionCount', 'format',
  'includeAnswerKey', 'studentName', 'worksheetDate', 'teacherName', 'period', 'className',
  'generateBtn', 'worksheetForm', 'formSection', 'loadingSection', 'resultsSection',
  'downloadButtons', 'resultsDescription', 'generateAnotherBtn',
  'gradeError', 'subjectError', 'topicError', 'difficultyError', 'questionCountError', 'formatError'
];

const REQUIRED_IDS_SOLVE = [
  'loadingSection', 'errorSection', 'errorMessage', 'modeSection', 'modeTitleText',
  'modeSubtitleText', 'timedDesc', 'timedModeBtn', 'untimedModeBtn', 'solveSection',
  'timerBar', 'timerDisplay', 'questionsContainer', 'solveForm', 'submitBtn',
  'resultsSection', 'scoreHeader', 'resultsBreakdown', 'tryAgainBtn', 'worksheetMeta'
];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log('🔍 Validating index.html selector contracts...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  let allPass = true;

  for (const id of REQUIRED_IDS_INDEX) {
    const el = await page.$(`#${id}`);
    if (!el) {
      console.error(`❌ MISSING ID: #${id}`);
      allPass = false;
    } else {
      console.log(`✅ Found: #${id}`);
    }
  }

  console.log('\n🔍 Validating solve.html selector contracts...');
  // Note: solve.html requires ?id= parameter, so use a fixture or skip URL load
  // For contract validation, we can load the HTML directly if no API call is needed
  await page.goto('http://localhost:3000/solve.html?id=test-fixture', { waitUntil: 'domcontentloaded' });

  for (const id of REQUIRED_IDS_SOLVE) {
    const el = await page.$(`#${id}`);
    if (!el) {
      console.error(`❌ MISSING ID: #${id}`);
      allPass = false;
    } else {
      console.log(`✅ Found: #${id}`);
    }
  }

  await browser.close();

  if (allPass) {
    console.log('\n🎉 All selector contracts validated successfully!');
    process.exit(0);
  } else {
    console.error('\n💥 Selector contract validation FAILED. Fix missing IDs before redesign.');
    process.exit(1);
  }
})();
```

**Usage:**
```bash
npm install --save-dev puppeteer
node tests/e2e/selector-contract.test.js
```

Run this before and after redesign to ensure no IDs were accidentally removed.

---

### 6.2 Accessibility Baseline Snapshot (Axe-Core CLI)

**File:** `tests/e2e/a11y-baseline.sh`

```bash
#!/bin/bash
# Generates accessibility baseline report for index.html and solve.html
# Requires: @axe-core/cli (npm install -g @axe-core/cli)

echo "Running Axe accessibility scan on index.html..."
axe http://localhost:3000 --save a11y-reports/index-baseline.json --tags wcag2a,wcag2aa

echo "Running Axe accessibility scan on solve.html..."
axe http://localhost:3000/solve.html?id=test-fixture --save a11y-reports/solve-baseline.json --tags wcag2a,wcag2aa

echo "Baseline reports saved to a11y-reports/"
echo "Review violations in JSON files or run: axe http://localhost:3000 (for CLI output)"
```

**Usage:**
```bash
npm install -g @axe-core/cli
mkdir -p a11y-reports
./tests/e2e/a11y-baseline.sh
```

Compare baseline reports before and after redesign to detect new violations.

---

## 7. Test Execution Checklist

### 7.1 Pre-Redesign Baseline

- [ ] Run manual acceptance script (Section 5.3-5.5) on current UI → **All 18 tests PASS**
- [ ] Run automated selector contract validator → **All IDs found**
- [ ] Run Axe accessibility scan → **Baseline violations documented**
- [ ] Run full test matrix (Section 1) → **All tests PASS or known failures documented**
- [ ] Verify all CSS class selectors exist in stylesheets → **No missing classes**
- [ ] Confirm `errorSection` bug (RISK-005) → **Document as known issue**

### 7.2 During Redesign

- [ ] CSS changes only: No HTML structure changes
- [ ] If HTML changes required:
  - [ ] Update selector contract checklist (Section 2) with new IDs/classes
  - [ ] Update JavaScript if necessary (coordinate with DEV agent)
- [ ] Test each commit incrementally on localhost
- [ ] Run visual regression tests at 320px, 768px, 1920px viewports

### 7.3 Post-Redesign Verification

- [ ] Run manual acceptance script (Section 5.3-5.5) → **All 18 tests PASS**
- [ ] Run automated selector contract validator → **All IDs found, no regressions**
- [ ] Run Axe accessibility scan → **No new violations vs baseline**
- [ ] Run full test matrix (Section 1) → **All tests PASS**
- [ ] Run contrast checker (Section 3.3) → **All ratios meet WCAG AA**
- [ ] Run keyboard navigation tests (Section 3.1) → **All pass**
- [ ] Run screen reader spot checks (Section 3.2) → **Critical announcements work**
- [ ] Deploy to staging → **Smoke test with real API**
- [ ] Stakeholder walkthrough → **Product manager approval**

---

## 8. Known Issues and Edge Cases (Document as Bugs)

### 8.1 CONFIRMED BUG: Missing `errorSection` in index.html
**Severity:** HIGH  
**Description:** `app.js` references `document.getElementById('errorSection')` but this element does not exist in the current `index.html`. Calling `showError()` will throw `TypeError: Cannot set property 'textContent' of null`.  
**Impact:** Any API error on the generator page will cause a JavaScript crash instead of showing an error message.  
**Recommended Fix:** Add the following HTML after `#resultsSection` in `index.html`:
```html
<section id="errorSection" class="card reveal" hidden role="alert" aria-live="assertive">
  <div class="card-header">
    <h2 class="card-title">Error</h2>
  </div>
  <p id="errorMessage" class="error-message"></p>
  <div class="form-actions">
    <button type="button" id="dismissErrorBtn" class="btn btn--secondary">
      Try Again
    </button>
  </div>
</section>
```
And add an event listener in `app.js`:
```javascript
dismissErrorBtn.addEventListener('click', showForm);
```

**QA Verification After Fix:** Run test E-001, E-002 from Section 1.9.

---

### 8.2 EDGE CASE: Timer Precision on Slow Devices
**Severity:** LOW  
**Description:** `setInterval(tickTimer, 1000)` may drift on slow devices or when browser tab is backgrounded. JavaScript timers are not guaranteed to fire exactly every 1000ms.  
**Impact:** Timer display may show 00:01 when it should show 00:00, or auto-submit may fire 1-2 seconds late.  
**Recommended Mitigation:** None (acceptable UX trade-off). Document as known limitation.

---

### 8.3 EDGE CASE: Matching Question Regex Fragility
**Severity:** LOW  
**Description:** `extractMatchingItems()` in `solve.js` uses a regex to parse question text for left-side items. If Claude returns matching questions in an unexpected format, the regex may fail and fall back to 4 generic rows ("Item 1", "Item 2"...).  
**Impact:** Matching questions may not render correctly if question format changes.  
**Recommended Mitigation:** Add integration test with real Claude responses. If regex fails frequently, replace with structured question.options field for matching type.

---

### 8.4 KNOWN LIMITATION: No Student Answer Persistence
**Severity:** LOW (by design)  
**Description:** If the student refreshes the page mid-solve, all answers are lost and the timer resets.  
**Impact:** Accidental refresh or browser crash loses all work.  
**Recommended Future Enhancement:** Add localStorage persistence for answers and timer state.

---

## 9. Sign-Off Criteria

### For QA Agent (This Document Creator)
- [ ] All sections of this spec are complete and reviewed.
- [ ] Selector contract checklist verified against actual source code.
- [ ] Test matrix covers all user flows from the online-solve-spec.md.
- [ ] Automated test scripts provided and tested locally.
- [ ] Known bugs documented with severity and recommended fixes.

### For UI Designer (Before Redesign Starts)
- [ ] Read Section 2 (Selector-Contract Validation) — understand ID/class constraints.
- [ ] Read Section 4 (Risks) — understand critical functional dependencies.
- [ ] Read Section 5 (Acceptance Script) — understand expected UX.
- [ ] Confirm: No element IDs will be changed without DEV agent coordination.

### For BA Agent (Feature Owner)
- [ ] Review acceptance criteria in Section 5 vs original online-solve-spec.md.
- [ ] Confirm test matrix covers all acceptance criteria from feature spec.
- [ ] Approve manual acceptance script as stakeholder demo script.

### For DEV Agent (If Code Changes Required)
- [ ] Review Section 2.1-2.6 (Selector Contracts) before any JavaScript changes.
- [ ] Fix RISK-005 (missing errorSection) before or during redesign.
- [ ] Coordinate with UI designer if any ID/class changes are unavoidable.

---

## Document Maintenance

**Last Updated:** 2026-03-24  
**Next Review:** After UI redesign implementation, before merge to `develop` branch  
**Owner:** QA Agent  
**Approvers:** BA Agent, UI Agent (when created), DEV Agent (for code changes)

---

**END OF SPECIFICATION**

# UI QA Spec

## Generator Page Tests

| ID | Scenario | Expected |
|---|---|---|
| G-001 | Page loads | Generate form visible, grade/subject/topic/difficulty/count selectors present |
| G-002 | Select Grade 1 | Subject options update to show Grade 1 subjects only |
| G-003 | Select Grade 10 | Subject options show all 5 subjects |
| G-004 | Select subject before grade | Error or disabled state shown |
| G-005 | Topic dropdown populated after grade+subject | Topics from curriculum map for Grade/Subject |
| G-006 | Generate button disabled until all required fields filled | Generate button has disabled attribute |
| G-007 | Click Generate with valid form | Loading state shown, button disabled |
| G-008 | Successful generation | Result section appears with download buttons and Solve Online button |
| G-009 | Failed generation | Error message shown, form re-enabled |
| G-010 | Format checkboxes | At least 1 format must be selected; Generate button disabled if all deselected |

## Form Validation Tests

| ID | Scenario | Expected |
|---|---|---|
| V-001 | Grade field empty | Submit blocked, error shown |
| V-002 | Question count below 5 | Submit blocked, "Minimum 5 questions" shown |
| V-003 | Question count above 30 | Submit blocked, "Maximum 30 questions" shown |
| V-004 | Question count = 5 | Valid, form submits |
| V-005 | Question count = 30 | Valid, form submits |
| V-006 | Topic not in curriculum for selected grade/subject | Submit blocked or topic not available in dropdown |

## Solve Page Loading Tests

| ID | Scenario | Expected |
|---|---|---|
| S-001 | Load solve page with valid worksheetId | Questions rendered, no answers visible |
| S-002 | Mode selection screen shown first | Timed/Untimed choice presented before questions |
| S-003 | Select Timed mode | Timer visible, counting down from estimatedTime |
| S-004 | Select Untimed mode | No timer shown, Submit button always enabled |
| S-005 | Load with invalid worksheetId | Error page shown: "Worksheet not found" |
| S-006 | Load with expired worksheetId | Error page shown: "Worksheet has expired" |
| S-007 | Navigate away and back (timed mode) | Timer continues from correct remaining time |
| S-008 | Timer reaches 00:00 | Form auto-submits, loading state shown |

## Question Rendering Tests

| ID | Type | Expected UI |
|---|---|---|
| Q-001 | multiple-choice | 4 radio buttons labeled A-D, legend shows question text |
| Q-002 | true-false | 2 radio buttons: True / False |
| Q-003 | fill-in-the-blank | Text input field inline with question |
| Q-004 | short-answer | Textarea with 3+ rows |
| Q-005 | matching | Dropdown select for each left-side term |
| Q-006 | show-your-work | Textarea for work + separate final answer input |
| Q-007 | word-problem | Problem text prominent, textarea + final answer input |
| Q-008 | Points shown per question | "(1 pt)" or "(2 pts)" label visible |
| Q-009 | Question numbers sequential | Questions numbered 1, 2, 3... |
| Q-010 | No answers visible | No answer or explanation text in DOM |

## Timed Mode Tests

| ID | Scenario | Expected |
|---|---|---|
| T-001 | Timer starts at estimatedTime | Initial value matches worksheet estimatedTime |
| T-002 | Timer counts down every second | Value decreases by 1 each second |
| T-003 | Timer turns yellow at < 25% time | CSS class change or color change visible |
| T-004 | Timer turns red at < 10% time | CSS class change or color change visible |
| T-005 | Auto-submit captures all filled answers | All answered questions in submit payload |
| T-006 | Auto-submit captures blank answers as missing | Empty questions not in answers array |
| T-007 | After auto-submit, timer disappears | Timer element hidden or removed from DOM |

## Results Page Tests

| ID | Scenario | Expected |
|---|---|---|
| R-001 | Score shown prominently | totalScore/totalPoints and percentage visible |
| R-002 | Time taken shown | timeTaken displayed as MM:SS |
| R-003 | Correct question styling | Green left border, checkmark, "CORRECT" badge |
| R-004 | Incorrect question styling | Red left border, X icon, "INCORRECT" badge |
| R-005 | Correct answer shown for wrong questions | correctAnswer displayed under "Correct answer:" |
| R-006 | Explanation shown for all questions | Explanation text visible under each question |
| R-007 | "Try Again" button present | Reloads solve page with same worksheetId |
| R-008 | "Generate New" button present | Returns to generate page |
| R-009 | Certificate button when score >= 80% | "Download Certificate" button visible |
| R-010 | No certificate button when score < 80% | Certificate button not in DOM |

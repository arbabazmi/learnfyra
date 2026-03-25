/**
 * @file frontend/js/solve.js
 * @description Learnfyra — Online Solve page logic.
 *
 * Responsibilities:
 *  - Reads worksheetId from URL query string (?id=...)
 *  - Fetches worksheet questions from GET /api/solve/:id
 *  - Shows mode selection (timed / untimed)
 *  - Renders questions per type into interactive inputs
 *  - Manages countdown timer in timed mode
 *  - Collects answers and POSTs to /api/submit
 *  - Renders per-question score breakdown
 */

'use strict';

/* =============================================================
   Rewards — lazy import so rewards.js is only loaded when needed
   ============================================================= */
let _renderRewardSummary;
async function getRenderRewardSummary() {
  if (!_renderRewardSummary) {
    const mod = await import('./rewards.js');
    _renderRewardSummary = mod.renderRewardSummary;
  }
  return _renderRewardSummary;
}

/* =============================================================
   State
   ============================================================= */
let worksheetData = null;   // full response from /api/solve/:id
let timerInterval  = null;  // setInterval handle for countdown
let secondsLeft    = 0;     // remaining seconds in timed mode
let startTime      = null;  // Date.now() when solving began
let isTimed        = false; // whether timed mode is active
let isGuestSolve   = false; // true when student bypassed the auth gate

/* =============================================================
   DOM References
   ============================================================= */
const loadingSection    = document.getElementById('loadingSection');
const errorSection      = document.getElementById('errorSection');
const errorMessage      = document.getElementById('errorMessage');
const authGateSection   = document.getElementById('authGateSection');
const modeSection       = document.getElementById('modeSection');
const modeTitleText     = document.getElementById('modeTitleText');
const modeSubtitleText  = document.getElementById('modeSubtitleText');
const timedDesc         = document.getElementById('timedDesc');
const timedModeBtn      = document.getElementById('timedModeBtn');
const untimedModeBtn    = document.getElementById('untimedModeBtn');
const solveSection      = document.getElementById('solveSection');
const timerBar          = document.getElementById('timerBar');
const timerDisplay      = document.getElementById('timerDisplay');
const questionsContainer= document.getElementById('questionsContainer');
const solveForm         = document.getElementById('solveForm');
const submitBtn         = document.getElementById('submitBtn');
const resultsSection    = document.getElementById('resultsSection');
const scoreHeader       = document.getElementById('scoreHeader');
const resultsBreakdown  = document.getElementById('resultsBreakdown');
const tryAgainBtn       = document.getElementById('tryAgainBtn');
const worksheetMeta     = document.getElementById('worksheetMeta');

/* =============================================================
   Utility Helpers
   ============================================================= */

/**
 * Formats a seconds count as MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Shows the error section with a message. */
function showError(msg) {
  loadingSection.hidden  = true;
  modeSection.hidden     = true;
  solveSection.hidden    = true;
  resultsSection.hidden  = true;
  errorMessage.textContent = msg;
  errorSection.hidden    = false;
}

/* =============================================================
   Fetch Worksheet
   ============================================================= */

/**
 * Reads the worksheetId from the URL query string and fetches
 * the worksheet data from GET /api/solve/:id.
 */
async function loadWorksheet() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showError('No worksheet ID provided. Please return to the generator and click "Solve Online".');
    return;
  }

  try {
    const res = await fetch(`/api/solve/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || `Could not load worksheet (HTTP ${res.status}).`);
      return;
    }

    worksheetData = data;

    // Update page header with worksheet metadata
    const parts = [
      data.grade ? `Grade ${data.grade}` : '',
      data.subject || '',
      data.topic   || '',
      data.difficulty || '',
    ].filter(Boolean);
    worksheetMeta.textContent = parts.join(' \u00b7 ');
    document.title = `${data.subject || 'Worksheet'} \u2014 Learnfyra`;

    // Update mode selection copy
    modeTitleText.textContent = `Ready to solve?`;
    modeSubtitleText.textContent =
      `${data.questions.length} question${data.questions.length !== 1 ? 's' : ''} \u00b7 ${data.estimatedTime || ''}`;

    if (data.timerSeconds) {
      timedDesc.textContent = `${formatTime(data.timerSeconds)} countdown`;
    }

    // Auth gate: require a stored token before showing mode selection
    const token = localStorage.getItem('auth_token');
    if (!token) {
      loadingSection.hidden   = true;
      authGateSection.hidden  = false;
      return;
    }

    loadingSection.hidden = true;
    modeSection.hidden    = false;

  } catch (err) {
    showError(`Network error: ${err.message}`);
  }
}

/* =============================================================
   Mode Selection
   ============================================================= */

timedModeBtn.addEventListener('click', () => startSolving(true));
untimedModeBtn.addEventListener('click', () => startSolving(false));

// Auth gate — guest bypass
const continueAsGuestBtn = document.getElementById('continueAsGuestBtn');
if (continueAsGuestBtn) {
  continueAsGuestBtn.addEventListener('click', () => {
    authGateSection.hidden = true;
    modeSection.hidden     = false;
    isGuestSolve           = true;
  });
}

/**
 * Transitions from mode selection into the solve view.
 * @param {boolean} timed
 */
function startSolving(timed) {
  isTimed   = timed;
  startTime = Date.now();

  modeSection.hidden  = true;
  solveSection.hidden = false;

  renderQuestions(worksheetData.questions);

  if (timed && worksheetData.timerSeconds) {
    secondsLeft = worksheetData.timerSeconds;
    timerBar.hidden = false;
    timerDisplay.textContent = formatTime(secondsLeft);
    timerInterval = setInterval(tickTimer, 1000);
  }
}

/* =============================================================
   Timer
   ============================================================= */

function tickTimer() {
  secondsLeft -= 1;
  timerDisplay.textContent = formatTime(secondsLeft);

  // Turn display red in the last 60 seconds
  if (secondsLeft <= 60) {
    timerDisplay.classList.add('timer-display--urgent');
  }

  if (secondsLeft <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    submitAnswers(true); // auto-submit
  }
}

/* =============================================================
   Question Rendering
   ============================================================= */

/**
 * Renders all questions into #questionsContainer.
 * @param {Array} questions
 */
function renderQuestions(questions) {
  questionsContainer.innerHTML = '';
  questions.forEach((q, idx) => {
    const card = buildQuestionCard(q, idx + 1);
    questionsContainer.appendChild(card);
  });
}

/**
 * Creates a question card element for the given question.
 * @param {Object} q - Question object (no answer/explanation)
 * @param {number} displayNum - Display number (1-indexed)
 * @returns {HTMLElement}
 */
function buildQuestionCard(q, displayNum) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.dataset.number = q.number;
  card.dataset.type   = q.type;

  // Question number badge + text
  const header = document.createElement('div');
  header.className = 'question-header';
  header.innerHTML = `
    <span class="question-badge" aria-hidden="true">${displayNum}</span>
    <p class="question-text">${escapeHtml(q.question)}</p>
  `;
  card.appendChild(header);

  // Points label
  if (typeof q.points === 'number' && q.points > 0) {
    const pts = document.createElement('span');
    pts.className = 'question-points';
    pts.textContent = `${q.points} pt${q.points !== 1 ? 's' : ''}`;
    header.appendChild(pts);
  }

  // Input area
  const inputArea = buildInputArea(q);
  card.appendChild(inputArea);

  return card;
}

/**
 * Builds the appropriate input element(s) for a question type.
 * @param {Object} q
 * @returns {HTMLElement}
 */
function buildInputArea(q) {
  const wrap = document.createElement('div');
  wrap.className = 'question-input-area';

  switch (q.type) {
    case 'multiple-choice': {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'question-options';
      fieldset.setAttribute('aria-label', `Answer options for question ${q.number}`);
      const legend = document.createElement('legend');
      legend.className = 'sr-only';
      legend.textContent = 'Select one answer';
      fieldset.appendChild(legend);

      (q.options || []).forEach((opt) => {
        const letter = opt.trim().charAt(0).toUpperCase();
        const label = document.createElement('label');
        label.className = 'option-label';
        label.innerHTML = `
          <input type="radio" name="q${q.number}" value="${escapeAttr(letter)}" class="option-radio" />
          <span class="option-custom" aria-hidden="true"></span>
          <span class="option-text">${escapeHtml(opt)}</span>
        `;
        fieldset.appendChild(label);
      });

      wrap.appendChild(fieldset);
      break;
    }

    case 'true-false': {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'question-options';
      fieldset.setAttribute('aria-label', `True or false for question ${q.number}`);
      const legend = document.createElement('legend');
      legend.className = 'sr-only';
      legend.textContent = 'Select True or False';
      fieldset.appendChild(legend);

      ['True', 'False'].forEach((val) => {
        const label = document.createElement('label');
        label.className = 'option-label';
        label.innerHTML = `
          <input type="radio" name="q${q.number}" value="${val}" class="option-radio" />
          <span class="option-custom" aria-hidden="true"></span>
          <span class="option-text">${val}</span>
        `;
        fieldset.appendChild(label);
      });

      wrap.appendChild(fieldset);
      break;
    }

    case 'fill-in-the-blank': {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input fill-input';
      input.placeholder = 'Type your answer here\u2026';
      input.dataset.qnum = q.number;
      input.setAttribute('aria-label', `Answer for question ${q.number}`);
      wrap.appendChild(input);
      break;
    }

    case 'short-answer': {
      const textarea = document.createElement('textarea');
      textarea.className = 'form-input short-answer-input';
      textarea.rows = 3;
      textarea.placeholder = 'Write your answer here\u2026';
      textarea.dataset.qnum = q.number;
      textarea.setAttribute('aria-label', `Answer for question ${q.number}`);
      wrap.appendChild(textarea);
      break;
    }

    case 'matching': {
      // question.answer is an array of {left, right} — not sent to client
      // We need to render each left item with a text input for the right item
      // Since answer is stripped, we build matching from question text convention:
      // The question text describes the pairs; we use a generic N-pair renderer
      // by counting implied pairs from the question. For robustness we render
      // a configurable number of rows (default 4) with a left label and right input.
      const matchWrap = document.createElement('div');
      matchWrap.className = 'matching-wrap';
      matchWrap.dataset.qnum = q.number;

      // Parse "Match A with B" style questions — extract left-side items if encoded
      // in the question as a list. Fallback: render 4 blank rows.
      const rows = extractMatchingItems(q.question);
      rows.forEach((leftItem, i) => {
        const row = document.createElement('div');
        row.className = 'matching-row';
        const leftLabel = document.createElement('span');
        leftLabel.className = 'matching-left';
        leftLabel.textContent = leftItem;
        const rightInput = document.createElement('input');
        rightInput.type = 'text';
        rightInput.className = 'form-input matching-right-input';
        rightInput.placeholder = 'Match\u2026';
        rightInput.dataset.left  = leftItem;
        rightInput.dataset.index = i;
        rightInput.setAttribute('aria-label', `Match for: ${leftItem}`);
        row.appendChild(leftLabel);
        row.appendChild(rightInput);
        matchWrap.appendChild(row);
      });

      wrap.appendChild(matchWrap);
      break;
    }

    case 'show-your-work':
    case 'word-problem': {
      const workLabel = document.createElement('label');
      workLabel.className = 'form-label';
      workLabel.textContent = q.type === 'show-your-work' ? 'Show your work:' : 'Your work / solution steps:';

      const workArea = document.createElement('textarea');
      workArea.className = 'form-input work-area';
      workArea.rows = 4;
      workArea.placeholder = 'Show your work here\u2026';
      workArea.setAttribute('aria-label', `Work area for question ${q.number}`);

      const finalLabel = document.createElement('label');
      finalLabel.className = 'form-label final-answer-label';
      finalLabel.textContent = 'Final Answer:';

      const finalInput = document.createElement('input');
      finalInput.type = 'text';
      finalInput.className = 'form-input final-answer-input';
      finalInput.placeholder = 'Final answer\u2026';
      finalInput.dataset.qnum = q.number;
      finalInput.setAttribute('aria-label', `Final answer for question ${q.number}`);

      wrap.appendChild(workLabel);
      wrap.appendChild(workArea);
      wrap.appendChild(finalLabel);
      wrap.appendChild(finalInput);
      break;
    }

    default: {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input fill-input';
      input.placeholder = 'Type your answer here\u2026';
      input.dataset.qnum = q.number;
      wrap.appendChild(input);
    }
  }

  return wrap;
}

/**
 * Attempts to extract left-side items for a matching question from the question text.
 * Falls back to 4 blank placeholders if parsing fails.
 * @param {string} questionText
 * @returns {string[]}
 */
function extractMatchingItems(questionText) {
  // Look for numbered or lettered list items: "1. item", "A. item", "- item"
  const listPattern = /(?:^|\n)\s*(?:\d+[.)]\s*|[A-Za-z][.)]\s*|-\s+)(.+)/g;
  const items = [];
  let match;
  while ((match = listPattern.exec(questionText)) !== null) {
    items.push(match[1].trim());
  }
  if (items.length >= 2) return items;
  // Fallback: four blank rows
  return ['Item 1', 'Item 2', 'Item 3', 'Item 4'];
}

/* =============================================================
   Answer Collection
   ============================================================= */

/**
 * Reads each question card and builds the answers array for submission.
 * @returns {Array<{number: number, answer: string|Array}>}
 */
function collectAnswers() {
  const cards = questionsContainer.querySelectorAll('.question-card');
  const answers = [];

  cards.forEach((card) => {
    const qNum  = Number(card.dataset.number);
    const qType = card.dataset.type;
    let answer  = '';

    switch (qType) {
      case 'multiple-choice':
      case 'true-false': {
        const selected = card.querySelector(`input[name="q${qNum}"]:checked`);
        answer = selected ? selected.value : '';
        break;
      }

      case 'fill-in-the-blank': {
        const input = card.querySelector('.fill-input');
        answer = input ? input.value.trim() : '';
        break;
      }

      case 'short-answer': {
        const ta = card.querySelector('.short-answer-input');
        answer = ta ? ta.value.trim() : '';
        break;
      }

      case 'matching': {
        const rows = card.querySelectorAll('.matching-row');
        const pairs = [];
        rows.forEach((row) => {
          const leftEl  = row.querySelector('.matching-left');
          const rightEl = row.querySelector('.matching-right-input');
          if (leftEl && rightEl) {
            pairs.push({ left: leftEl.textContent.trim(), right: rightEl.value.trim() });
          }
        });
        answer = pairs;
        break;
      }

      case 'show-your-work':
      case 'word-problem': {
        const finalInput = card.querySelector('.final-answer-input');
        answer = finalInput ? finalInput.value.trim() : '';
        break;
      }

      default: {
        const anyInput = card.querySelector('input[type="text"], textarea');
        answer = anyInput ? anyInput.value.trim() : '';
      }
    }

    answers.push({ number: qNum, answer });
  });

  return answers;
}

/* =============================================================
   Submission
   ============================================================= */

solveForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitAnswers(false);
});

/**
 * Collects answers and POSTs to /api/submit.
 * @param {boolean} autoSubmit - True when triggered by timer expiry
 */
async function submitAnswers(autoSubmit) {
  // Stop the timer if still running
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  const answers   = collectAnswers();

  submitBtn.disabled   = true;
  submitBtn.textContent = 'Submitting\u2026';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worksheetId: worksheetData.worksheetId,
        answers,
        timeTaken,
        timed: isTimed,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || `Server error (${res.status})`);
    }

    showResults(result);

  } catch (err) {
    submitBtn.disabled   = false;
    submitBtn.textContent = 'Submit Answers';
    alert(`Submission failed: ${err.message}`);
  }
}

/* =============================================================
   Results Rendering
   ============================================================= */

/**
 * Renders the score summary and per-question breakdown.
 * @param {Object} result - Response from /api/submit
 */
function showResults(result) {
  solveSection.hidden  = true;
  timerBar.hidden      = true;

  // Score header
  const pct   = result.percentage;
  const grade = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'poor';
  scoreHeader.className = `results-score-header results-score-header--${grade}`;
  scoreHeader.innerHTML = `
    <div class="score-circle score-circle--${grade}" aria-label="Score: ${pct}%">
      <span class="score-pct">${pct}%</span>
    </div>
    <div class="score-summary">
      <h2 class="score-title">${scoreTitle(pct)}</h2>
      <p class="score-detail">
        You scored <strong>${result.totalScore} / ${result.totalPoints}</strong> points.
        ${result.timed ? `Time taken: <strong>${formatTime(result.timeTaken)}</strong>.` : ''}
      </p>
    </div>
  `;

  // Per-question breakdown
  resultsBreakdown.innerHTML = '';
  (result.results || []).forEach((r) => {
    const item = document.createElement('div');
    item.className = `result-item ${r.correct ? 'result-item--correct' : 'result-item--incorrect'}`;

    const icon   = r.correct ? '\u2705' : '\u274C';
    const points = `${r.pointsEarned}/${r.pointsPossible} pt${r.pointsPossible !== 1 ? 's' : ''}`;

    let wrongAnswerHtml = '';
    if (!r.correct) {
      wrongAnswerHtml = `
        <div class="result-correct-answer">
          <span class="result-correct-label">Correct answer:</span>
          <span class="result-correct-value">${escapeHtml(String(r.correctAnswer))}</span>
        </div>
      `;
    }

    const explanationHtml = r.explanation
      ? `<p class="result-explanation">${escapeHtml(r.explanation)}</p>`
      : '';

    item.innerHTML = `
      <div class="result-item-header">
        <span class="result-icon" aria-hidden="true">${icon}</span>
        <span class="result-qnum">Question ${r.number}</span>
        <span class="result-points ${r.correct ? 'result-points--earned' : ''}">${points}</span>
      </div>
      <div class="result-student-answer">
        <span class="result-student-label">Your answer:</span>
        <span class="result-student-value">${escapeHtml(String(r.studentAnswer) || '(no answer)')}</span>
      </div>
      ${wrongAnswerHtml}
      ${explanationHtml}
    `;

    resultsBreakdown.appendChild(item);
  });

  resultsSection.hidden = false;

  // Show reward summary if the server returned reward data
  if (result.rewards) {
    const rewardContainer = document.getElementById('rewardSummary');
    if (rewardContainer) {
      getRenderRewardSummary().then(function(renderFn) {
        renderFn(result.rewards, rewardContainer);
      });
    }
  }

  // Guest banner — results visible but not persisted
  if (isGuestSolve) {
    const banner = document.createElement('p');
    banner.style.cssText = 'text-align:center;padding:0.75rem;background:var(--color-sun-soft);border-radius:var(--radius);margin-bottom:1rem;font-size:0.875rem;';
    banner.innerHTML = '📝 <strong>Your results were not saved.</strong> <a href="/login.html" style="color:var(--primary)">Sign in</a> to track your progress.';
    resultsSection.prepend(banner);
  }

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Returns a congratulatory message based on percentage score.
 * @param {number} pct
 * @returns {string}
 */
function scoreTitle(pct) {
  if (pct >= 90) return 'Excellent work!';
  if (pct >= 80) return 'Great job!';
  if (pct >= 60) return 'Good effort!';
  if (pct >= 40) return 'Keep practising!';
  return 'Don\'t give up!';
}

/* =============================================================
   Try Again
   ============================================================= */

tryAgainBtn.addEventListener('click', () => {
  // Reset state
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isTimed    = false;
  startTime  = null;
  secondsLeft = 0;
  timerDisplay.classList.remove('timer-display--urgent');
  timerBar.hidden = true;

  resultsSection.hidden = true;
  modeSection.hidden    = false;

  const rewardSummary = document.getElementById('rewardSummary');
  if (rewardSummary) { rewardSummary.hidden = true; rewardSummary.innerHTML = ''; }
});

/* =============================================================
   Security: HTML Escaping
   ============================================================= */

/**
 * Escapes a string for safe insertion as HTML text content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes a string for safe use inside an HTML attribute value.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =============================================================
   Boot
   ============================================================= */

loadWorksheet();

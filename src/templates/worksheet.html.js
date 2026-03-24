/**
 * @file src/templates/worksheet.html.js
 * @description HTML template builder for worksheets and answer keys.
 *   Uses CSS class names from styles.css.js — no inline styles except
 *   minor one-off layout tweaks that don't warrant a dedicated class.
 * @agent DEV
 */

import { getStyles } from './styles.css.js';

// ─── XSS helpers ──────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters to prevent XSS in templates.
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
 * Formats an ISO date (YYYY-MM-DD) as MM/DD/YYYY.
 * @param {string} value
 * @returns {string}
 */
function formatHeaderDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}

// ─── School logo placeholder ──────────────────────────────────────────────────

/**
 * Renders the school logo placeholder column with an inline SVG school icon.
 * Replace the SVG with an <img> tag once a real logo asset is available.
 * @returns {string}
 */
function renderSchoolLogo() {
  return `
    <div class="school-logo-wrap">
      <div class="school-logo-box" title="School logo — replace with your logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="#1a3a6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <path d="M3 21h18"/>
          <path d="M5 21V7l7-4 7 4v14"/>
          <path d="M9 21v-4h6v4"/>
          <rect x="10" y="9" width="4" height="4"/>
        </svg>
        <span class="school-logo-label">School<br>Logo</span>
      </div>
    </div>`;
}

// ─── Student fields ───────────────────────────────────────────────────────────

/**
 * Renders the student-fields grid with optional prefilled values.
 * @param {Object} worksheet - Parsed worksheet JSON (used for totalPoints)
 * @param {Object} options - Optional display metadata
 * @returns {string}
 */
function renderStudentFields(worksheet, options = {}) {
  const studentName = escapeHtml(options.studentName || '');
  const teacherName = escapeHtml(options.teacherName || '');
  const period = escapeHtml(options.period || '');
  const className = escapeHtml(options.className || '');
  const dateValue = escapeHtml(formatHeaderDate(options.worksheetDate));

  return `
    <div class="student-fields">
      <div class="sf-row">
        <span class="sf-label">Name</span>
        <div class="sf-line">${studentName}</div>
      </div>
      <div class="sf-row">
        <span class="sf-label">Date</span>
        <div class="sf-line">${dateValue}</div>
      </div>
      <div class="sf-row">
        <span class="sf-label">Teacher</span>
        <div class="sf-line">${teacherName}</div>
      </div>
      <div class="sf-row">
        <span class="sf-label">Period</span>
        <div class="sf-line">${period}</div>
      </div>
      <div class="sf-row">
        <span class="sf-label">Class</span>
        <div class="sf-line">${className}</div>
      </div>
      <div class="sf-row score">
        <span class="sf-label">Score</span>
        <div style="display:flex;align-items:flex-end;gap:6px;">
          <div class="sf-score-val"></div>
          <span style="font-size:9pt;color:#888;padding-bottom:2px;">/ ${worksheet.totalPoints} pts</span>
        </div>
      </div>
    </div>`;
}

// ─── Info strip ───────────────────────────────────────────────────────────────

/**
 * Renders the info strip showing estimated time, difficulty, question count,
 * and aligned standards.
 * @param {Object} worksheet
 * @returns {string}
 */
function renderInfoStrip(worksheet) {
  const standards = (worksheet.standards || []).join(' &middot; ') || '&mdash;';
  return `
    <div class="info-strip">
      <div class="info-strip-item">
        <strong>Time:</strong> ${escapeHtml(worksheet.estimatedTime || 'N/A')}
      </div>
      <div class="info-strip-item">
        <strong>Difficulty:</strong> ${escapeHtml(worksheet.difficulty)}
      </div>
      <div class="info-strip-item">
        <strong>Questions:</strong> ${worksheet.questions.length}
      </div>
      <div class="info-strip-item">
        <strong>Standards:</strong> ${standards}
      </div>
    </div>`;
}

// ─── Question rendering ───────────────────────────────────────────────────────

/**
 * Renders the answer / response area for a single question by type.
 * @param {Object} q - Question object from worksheet JSON
 * @returns {string}
 */
function renderAnswerArea(q) {
  switch (q.type) {

    case 'multiple-choice':
      return `
        <div class="mc-options">
          ${(q.options || []).map((opt) => `
          <div class="mc-option">
            <span class="mc-bubble"></span>
            <span>${escapeHtml(opt)}</span>
          </div>`).join('')}
        </div>`;

    case 'true-false':
      return `
        <div class="tf-choices">
          <div class="tf-option">
            <span class="tf-bubble"></span>
            <span>True</span>
          </div>
          <div class="tf-option">
            <span class="tf-bubble"></span>
            <span>False</span>
          </div>
        </div>`;

    case 'fill-in-the-blank':
      return `
        <div class="answer-lines">
          <div class="answer-line short"></div>
        </div>`;

    case 'short-answer':
      return `
        <div class="answer-lines">
          <div class="answer-line"></div>
          <div class="answer-line"></div>
        </div>`;

    case 'matching':
      return `
        <div class="matching-wrap">
          <div class="matching-grid">
            <span class="match-letter">Answer:</span>
            <div class="match-blank"></div>
          </div>
        </div>`;

    case 'show-your-work':
      return `<div class="work-box"></div>`;

    case 'word-problem':
      return `
        <div class="work-label">Show Your Work</div>
        <div class="work-box"></div>`;

    default:
      return `
        <div class="answer-lines">
          <div class="answer-line"></div>
        </div>`;
  }
}

/**
 * Renders a complete question block: stem + answer area.
 * Word-problem questions receive a shaded stem box in place of inline text.
 * @param {Object} q - Question object
 * @returns {string}
 */
function renderQuestion(q) {
  const pts = q.points === 1 ? '1 pt' : `${q.points} pts`;

  if (q.type === 'word-problem') {
    return `
  <div class="question">
    <div class="question-stem" style="margin-bottom:5px;">
      <span class="q-num">${q.number}.</span>
      <span class="q-text" style="font-style:italic;font-size:9.5pt;color:#888;">Word Problem</span>
      <span class="q-pts">${pts}</span>
    </div>
    <div class="word-problem-stem">${escapeHtml(q.question)}</div>
    ${renderAnswerArea(q)}
  </div>`;
  }

  return `
  <div class="question">
    <div class="question-stem">
      <span class="q-num">${q.number}.</span>
      <span class="q-text">${escapeHtml(q.question)}</span>
      <span class="q-pts">${pts}</span>
    </div>
    ${renderAnswerArea(q)}
  </div>`;
}

// ─── Public exports ───────────────────────────────────────────────────────────

/**
 * Builds the full worksheet HTML document (student copy).
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} [options={}] - Reserved for future per-export metadata
 * @returns {string} Complete self-contained HTML document string
 */
export function buildWorksheetHTML(worksheet, options = {}) {
  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worksheet.title)}</title>
  <style>${getStyles()}</style>
</head>
<body>

  <!-- ── Page header: logo | title | student fields ── -->
  <header class="page-header">
    ${renderSchoolLogo()}
    <div class="header-title-block">
      <h1>${escapeHtml(worksheet.title)}</h1>
      <div class="header-meta">
        Grade ${worksheet.grade} &nbsp;&middot;&nbsp; ${escapeHtml(worksheet.subject)}
        &nbsp;&middot;&nbsp; ${escapeHtml(worksheet.topic)}
      </div>
    </div>
    ${renderStudentFields(worksheet, options)}
  </header>

  <!-- ── Info strip ── -->
  ${renderInfoStrip(worksheet)}

  <!-- ── Instructions ── -->
  <div class="instructions-box">
    <strong>Instructions:</strong> ${escapeHtml(worksheet.instructions)}
  </div>

  <!-- ── Questions ── -->
  <div class="section-heading">Questions</div>

  ${worksheet.questions.map(renderQuestion).join('\n')}

  <!-- ── Screen / print footer ── -->
  <footer class="page-footer">
    <span>EduSheet AI &mdash; ${dateStr}</span>
    <span class="footer-center">
      Grade ${worksheet.grade} &bull; ${escapeHtml(worksheet.subject)} &bull; ${escapeHtml(worksheet.difficulty)}
    </span>
    <span>&copy; ${year} &mdash; For Educational Use Only</span>
  </footer>

</body>
</html>`;
}

/**
 * Builds the answer key HTML document (teacher copy).
 * Contains a full table with type badges, correct answers, explanations, and points.
 * @param {Object} worksheet - Parsed worksheet JSON
 * @returns {string} Complete self-contained HTML document string
 */
export function buildAnswerKeyHTML(worksheet) {
  const year = new Date().getFullYear();
  const standards = (worksheet.standards || []).join(' &middot; ') || '&mdash;';

  const tableRows = worksheet.questions.map((q) => {
    const pts = q.points === 1 ? '1 pt' : `${q.points} pts`;
    return `
      <tr>
        <td class="ak-num">${q.number}.</td>
        <td><span class="ak-type-badge">${escapeHtml(q.type)}</span></td>
        <td class="ak-answer">${escapeHtml(String(q.answer))}</td>
        <td class="ak-explanation">${escapeHtml(q.explanation || '')}</td>
        <td class="ak-pts">${pts}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Answer Key &mdash; ${escapeHtml(worksheet.title)}</title>
  <style>${getStyles()}</style>
</head>
<body>

  <!-- ── Answer key banner ── -->
  <div class="ak-banner">
    <h1>Answer Key</h1>
    <span class="ak-subtitle">Teacher Copy &mdash; Do Not Distribute to Students</span>
  </div>

  <!-- ── Answer key metadata ── -->
  <div class="ak-meta">
    <span><strong>Worksheet:</strong> ${escapeHtml(worksheet.title)}</span>
    <span><strong>Grade:</strong> ${worksheet.grade}</span>
    <span><strong>Subject:</strong> ${escapeHtml(worksheet.subject)}</span>
    <span><strong>Difficulty:</strong> ${escapeHtml(worksheet.difficulty)}</span>
    <span><strong>Total Points:</strong> ${worksheet.totalPoints}</span>
    <span><strong>Standards:</strong> ${standards}</span>
  </div>

  <!-- ── Answer table ── -->
  <table class="ak-table">
    <thead>
      <tr>
        <th style="width:32px;">#</th>
        <th style="width:130px;">Type</th>
        <th style="width:120px;">Answer</th>
        <th>Explanation</th>
        <th style="width:50px;">Pts</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="ak-total-row">
        <td colspan="4" style="text-align:right;padding-right:14px;">Total</td>
        <td class="ak-pts">${worksheet.totalPoints}&nbsp;pts</td>
      </tr>
    </tbody>
  </table>

  <!-- ── Footer ── -->
  <footer class="page-footer">
    <span>EduSheet AI &mdash; Answer Key</span>
    <span class="footer-center">${escapeHtml(worksheet.title)}</span>
    <span>&copy; ${year} &mdash; Teacher Use Only</span>
  </footer>

</body>
</html>`;
}

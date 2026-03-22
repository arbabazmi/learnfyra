/**
 * @file src/templates/worksheet.html.js
 * @description HTML template builder for worksheets and answer keys
 * @agent DEV
 */

import { getStyles } from './styles.css.js';

/**
 * Renders a single question as HTML based on its type
 * @param {Object} q - Question object from worksheet JSON
 * @returns {string} HTML string for the question
 */
function renderQuestion(q) {
  const typeBlock = (() => {
    switch (q.type) {
      case 'multiple-choice':
        return `<div class="options">${(q.options || [])
          .map((opt) => `<div class="option">${opt}</div>`)
          .join('')}</div>`;

      case 'true-false':
        return `<div class="true-false">
          <span>○ True</span>
          <span>○ False</span>
        </div>`;

      case 'show-your-work':
        return `<div class="work-area"></div>`;

      case 'short-answer':
        return `<div class="answer-line"></div><div class="answer-line" style="margin-top:6px"></div>`;

      case 'matching':
        return `<div class="answer-line" style="width:60px;display:inline-block;"></div>`;

      default: // fill-in-the-blank, word-problem
        return `<div class="answer-line"></div>`;
    }
  })();

  return `
    <div class="question">
      <div class="question-header">
        <span class="question-number">${q.number}.</span>
        <span class="question-text">${escapeHtml(q.question)}</span>
        <span class="question-points">(${q.points} pt${q.points !== 1 ? 's' : ''})</span>
      </div>
      ${typeBlock}
    </div>`;
}

/**
 * Builds the full worksheet HTML document
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Generation options (studentName, etc.)
 * @returns {string} Complete HTML document string
 */
export function buildWorksheetHTML(worksheet, options = {}) {
  const standards = (worksheet.standards || []).join(', ') || '—';
  const studentName = options.studentName || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worksheet.title)}</title>
  <style>${getStyles()}</style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(worksheet.title)}</h1>
      <div class="meta">
        Grade ${worksheet.grade} · ${worksheet.subject} · ${worksheet.topic} · ${worksheet.difficulty}
      </div>
    </div>
    <div class="header-right">
      <div class="field">Name: ${escapeHtml(studentName)}_____________________</div>
      <div class="field">Date: _____________________</div>
      <div class="field">Score: _______ / ${worksheet.totalPoints}</div>
    </div>
  </div>

  <div class="info-bar">
    <span>⏱ ${worksheet.estimatedTime || 'N/A'}</span>
    <span>📋 ${worksheet.questions.length} Questions</span>
    <span>📐 Standards: ${escapeHtml(standards)}</span>
  </div>

  <div class="instructions">${escapeHtml(worksheet.instructions)}</div>

  <div class="questions-section">
    <h2>Questions</h2>
    ${worksheet.questions.map(renderQuestion).join('')}
  </div>

  <div class="footer">
    <span>EduSheet AI — Generated ${new Date().toLocaleDateString('en-US')}</span>
    <span>Page 1</span>
    <span>© ${new Date().getFullYear()} — For Educational Use</span>
  </div>

</body>
</html>`;
}

/**
 * Builds the answer key HTML document
 * @param {Object} worksheet - Parsed worksheet JSON
 * @returns {string} Complete HTML document string
 */
export function buildAnswerKeyHTML(worksheet) {
  const answerItems = worksheet.questions
    .map(
      (q) => `
    <div class="answer-item">
      <span class="num">${q.number}.</span>
      <span class="ans">${escapeHtml(String(q.answer))}</span>
      <span class="exp">${escapeHtml(q.explanation || '')}</span>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Answer Key — ${escapeHtml(worksheet.title)}</title>
  <style>${getStyles()}</style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>ANSWER KEY</h1>
      <div class="meta">${escapeHtml(worksheet.title)}</div>
      <div class="meta">Grade ${worksheet.grade} · ${worksheet.subject} · ${worksheet.difficulty}</div>
    </div>
    <div class="header-right">
      <div>Total Points: ${worksheet.totalPoints}</div>
    </div>
  </div>

  <div class="answer-key-header">Answer Key — Teacher Copy</div>

  ${answerItems}

  <div class="footer">
    <span>EduSheet AI — Answer Key</span>
    <span>© ${new Date().getFullYear()} — Teacher Use Only</span>
  </div>

</body>
</html>`;
}

/**
 * Escapes HTML special characters to prevent XSS in templates
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

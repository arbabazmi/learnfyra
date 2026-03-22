/**
 * @file src/templates/styles.css.js
 * @description Print-ready CSS styles for worksheets (US Letter, clean layout)
 * @agent DEV
 */

/**
 * Returns the full CSS string for worksheet HTML templates
 * @returns {string} CSS styles
 */
export function getStyles() {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      color: #111;
      background: #fff;
      padding: 0.75in;
      max-width: 8.5in;
      margin: 0 auto;
    }

    /* ── Header ─────────────────────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .header-left h1 {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .header-left .meta {
      font-size: 10pt;
      color: #444;
    }
    .header-right {
      text-align: right;
      font-size: 10pt;
    }
    .header-right .field {
      margin-bottom: 4px;
      border-bottom: 1px solid #888;
      min-width: 140px;
      padding-bottom: 2px;
    }

    /* ── Standards & Info Bar ───────────────────── */
    .info-bar {
      display: flex;
      gap: 24px;
      font-size: 9pt;
      color: #555;
      margin-bottom: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #ddd;
    }

    /* ── Instructions ───────────────────────────── */
    .instructions {
      background: #f5f5f5;
      border-left: 4px solid #333;
      padding: 8px 12px;
      font-size: 11pt;
      margin-bottom: 20px;
      font-style: italic;
    }

    /* ── Questions ──────────────────────────────── */
    .questions-section h2 {
      font-size: 13pt;
      border-bottom: 1px solid #333;
      padding-bottom: 4px;
      margin-bottom: 14px;
    }

    .question {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      gap: 8px;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .question-number {
      font-weight: bold;
      min-width: 24px;
    }
    .question-points {
      font-size: 9pt;
      color: #666;
      margin-left: auto;
    }
    .question-text {
      font-size: 12pt;
      line-height: 1.4;
    }

    /* Multiple choice options */
    .options {
      margin-top: 8px;
      margin-left: 32px;
    }
    .option {
      margin-bottom: 5px;
      font-size: 11pt;
    }

    /* Fill-in / short-answer work area */
    .answer-line {
      border-bottom: 1px solid #888;
      margin-top: 10px;
      height: 20px;
      width: 100%;
    }
    .work-area {
      border: 1px solid #ccc;
      margin-top: 8px;
      height: 80px;
      width: 100%;
    }

    /* True/False */
    .true-false {
      display: flex;
      gap: 32px;
      margin-top: 8px;
      margin-left: 32px;
    }

    /* ── Footer ─────────────────────────────────── */
    .footer {
      margin-top: 32px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #888;
    }

    /* ── Answer Key ─────────────────────────────── */
    .answer-key-header {
      background: #1a1a1a;
      color: #fff;
      padding: 10px 16px;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 16px;
    }
    .answer-item {
      display: grid;
      grid-template-columns: 40px 1fr 2fr;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
      font-size: 11pt;
    }
    .answer-item .num { font-weight: bold; }
    .answer-item .ans { color: #006600; font-weight: bold; }
    .answer-item .exp { color: #444; font-size: 10pt; }

    /* ── Print Styles ───────────────────────────── */
    @media print {
      body { padding: 0.5in; }
      .question { page-break-inside: avoid; }
      .answer-item { page-break-inside: avoid; }
      @page { size: letter; margin: 0.75in; }
    }
  `;
}

/**
 * @file src/templates/styles.css.js
 * @description Complete print-ready CSS for Learnfyra worksheets and answer keys.
 *
 *   Layout target: US Letter (8.5" × 11"), portrait.
 *   Print engine:  Puppeteer (Chrome) for PDF; any modern browser for HTML.
 *
 *   Section index:
 *     1. CSS custom properties
 *     2. Reset & base
 *     3. School logo placeholder
 *     4. Page header (logo | title | student fields)
 *     5. Student fields grid
 *     6. Info strip (standards · difficulty · time · count)
 *     7. Instructions box
 *     8. Questions section
 *     9. Question type blocks
 *        a. Multiple-choice
 *        b. True / False
 *        c. Fill-in-the-blank  (answer lines)
 *        d. Short answer       (answer lines)
 *        e. Matching           (two-column grid)
 *        f. Show-your-work     (ruled work box)
 *        g. Word problem       (shaded stem + work box)
 *    10. Answer key
 *    11. Screen footer
 *    12. @media print  (overrides + @page)
 * @agent DEV
 */

/**
 * Returns the full inline CSS string used by all worksheet HTML documents.
 * @returns {string}
 */
export function getStyles() {
  return `
/* ─── 1. CSS custom properties ─────────────────────────────────────────────── */
:root {
  --color-ink:         #111111;
  --color-ink-light:   #444444;
  --color-ink-faint:   #888888;
  --color-border:      #cccccc;
  --color-border-dark: #333333;
  --color-accent:      #1a3a6b;   /* dark navy — school branding colour */
  --color-bg-light:    #f5f6f8;
  --color-bg-logo:     #e8ecf2;
  --color-correct:     #005500;
  --color-ak-banner:   #1a3a6b;

  --font-main:  Arial, Helvetica, sans-serif;
  --font-size:  11.5pt;
  --line-height: 1.45;

  --page-width:   8.5in;
  --page-padding: 0.75in;
}

/* ─── 2. Reset & base ───────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-main);
  font-size: var(--font-size);
  line-height: var(--line-height);
  color: var(--color-ink);
  background: #ffffff;
  /* Screen: centre the page with generous padding */
  max-width: var(--page-width);
  margin: 0 auto;
  padding: var(--page-padding);
}

/* ─── 3. School logo placeholder ─────────────────────────────────────────────── */
.school-logo-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
}

.school-logo-box {
  width:  72px;
  height: 72px;
  border: 2px dashed var(--color-accent);
  border-radius: 6px;
  background: var(--color-bg-logo);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
}
.school-logo-box svg {
  width: 36px;
  height: 36px;
  opacity: 0.5;
}
.school-logo-label {
  font-size: 6pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-accent);
  text-align: center;
  line-height: 1.2;
}

.school-name-text {
  font-size: 9pt;
  font-weight: bold;
  color: var(--color-accent);
  max-width: 120px;
  line-height: 1.3;
}

/* ─── 4. Page header ─────────────────────────────────────────────────────────── */
.page-header {
  display: grid;
  /* logo | title-block | student-fields */
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: start;
  border-bottom: 2.5pt solid var(--color-accent);
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.header-title-block {
  padding-top: 4px;
}
.header-title-block h1 {
  font-size: 15pt;
  font-weight: bold;
  color: var(--color-accent);
  line-height: 1.2;
  margin-bottom: 5px;
}
.header-meta {
  font-size: 9.5pt;
  color: var(--color-ink-light);
  line-height: 1.6;
}

/* ─── 5. Student fields grid ────────────────────────────────────────────────── */
.student-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  font-size: 9.5pt;
  min-width: 220px;
}

.sf-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sf-label {
  font-size: 9pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ink-light);
}
.sf-line {
  border-bottom: 1pt solid var(--color-ink);
  height: 18px;
  width: 100%;
  line-height: 16px;       /* ensures text fits within the 18px box */
  overflow: visible;       /* pre-filled text must not be clipped by PDF renderer */
  color: var(--color-ink); /* explicit colour — not left to inheritance in print mode */
}
/* Score field spans both columns */
.sf-row.score {
  grid-column: 1 / -1;
}
.sf-score-val {
  font-size: 10pt;
  border-bottom: 1pt solid var(--color-ink);
  height: 18px;
  width: 80px;
}

/* ─── 6. Info strip ──────────────────────────────────────────────────────────── */
.info-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  font-size: 8.5pt;
  color: var(--color-ink-light);
  background: var(--color-bg-light);
  border: 1pt solid var(--color-border);
  border-radius: 3px;
  margin-bottom: 12px;
  overflow: hidden;
}
.info-strip-item {
  padding: 5px 12px;
  border-right: 1pt solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.info-strip-item:last-child {
  border-right: none;
  flex: 1;
  white-space: normal;
}
.info-strip-item strong {
  color: var(--color-ink);
}
.info-icon {
  font-size: 9pt;
  line-height: 1;
}

/* ─── 7. Instructions box ────────────────────────────────────────────────────── */
.instructions-box {
  border-left: 4pt solid var(--color-accent);
  background: var(--color-bg-light);
  padding: 8px 12px;
  font-size: 10.5pt;
  font-style: italic;
  color: var(--color-ink-light);
  margin-bottom: 18px;
  border-radius: 0 3px 3px 0;
}
.instructions-box strong {
  font-style: normal;
  color: var(--color-ink);
  margin-right: 6px;
}

/* ─── 8. Questions section ───────────────────────────────────────────────────── */
.section-heading {
  font-size: 11pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink);
  border-bottom: 1.5pt solid var(--color-border-dark);
  padding-bottom: 4px;
  margin-bottom: 16px;
}

.question {
  margin-bottom: 22px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.question-stem {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 7px;
}
.q-num {
  font-weight: bold;
  font-size: 11pt;
  min-width: 22px;
  flex-shrink: 0;
  color: var(--color-accent);
}
.q-text {
  font-size: 11pt;
  line-height: 1.45;
  flex: 1;
}
.q-pts {
  font-size: 8pt;
  color: var(--color-ink-faint);
  white-space: nowrap;
  align-self: flex-start;
  padding-top: 2px;
}

/* ─── 9a. Multiple-choice ────────────────────────────────────────────────────── */
.mc-options {
  margin-left: 30px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.mc-option {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 10.5pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.mc-bubble {
  width: 12px;
  height: 12px;
  border: 1.5pt solid var(--color-ink);
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
  margin-top: 2px;
}

/* ─── 9b. True / False ───────────────────────────────────────────────────────── */
.tf-choices {
  margin-left: 30px;
  margin-top: 8px;
  display: flex;
  gap: 28px;
  font-size: 10.5pt;
}
.tf-option {
  display: flex;
  align-items: center;
  gap: 7px;
}
.tf-bubble {
  width: 14px;
  height: 14px;
  border: 1.5pt solid var(--color-ink);
  border-radius: 50%;
  flex-shrink: 0;
}

/* ─── 9c–d. Answer lines (fill-in-blank, short-answer) ──────────────────────── */
.answer-lines {
  margin-left: 30px;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.answer-line {
  border-bottom: 1pt solid var(--color-ink);
  height: 22px;
  width: 100%;
}
.answer-line.short {
  width: 60%;
}

/* ─── 9e. Matching ───────────────────────────────────────────────────────────── */
.matching-wrap {
  margin-left: 30px;
  margin-top: 8px;
}
.matching-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  align-items: end;
  font-size: 10.5pt;
}
.match-letter {
  font-weight: bold;
  text-align: right;
  padding-bottom: 3px;
}
.match-blank {
  border-bottom: 1pt solid var(--color-ink);
  height: 22px;
}

/* ─── 9f. Show-your-work ─────────────────────────────────────────────────────── */
.work-box {
  margin-left: 30px;
  margin-top: 8px;
  border: 1pt solid var(--color-border);
  border-radius: 3px;
  background: #fafafa;
  /* Ruled lines via repeating-linear-gradient */
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 23px,
    var(--color-border) 23px,
    var(--color-border) 24px
  );
  height: 96px;
  width: 100%;
}

/* ─── 9g. Word problem ───────────────────────────────────────────────────────── */
.word-problem-stem {
  background: var(--color-bg-light);
  border: 1pt solid var(--color-border);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 10.5pt;
  line-height: 1.5;
  margin-bottom: 8px;
}
.work-label {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-faint);
  margin-left: 30px;
  margin-bottom: 4px;
}

/* ─── 10. Answer key ──────────────────────────────────────────────────────────── */
.ak-banner {
  background: var(--color-ak-banner);
  color: #ffffff;
  padding: 12px 16px;
  margin: -0.75in -0.75in 0 -0.75in; /* bleed to page edges */
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.ak-banner h1 {
  font-size: 15pt;
  font-weight: bold;
  letter-spacing: 0.05em;
}
.ak-banner .ak-subtitle {
  font-size: 9pt;
  opacity: 0.8;
}

.ak-meta {
  font-size: 9.5pt;
  color: var(--color-ink-light);
  padding: 10px 0 12px;
  border-bottom: 1pt solid var(--color-border);
  margin-bottom: 16px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.ak-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5pt;
}
.ak-table th {
  background: var(--color-bg-light);
  border-bottom: 1.5pt solid var(--color-border-dark);
  text-align: left;
  padding: 6px 10px;
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ink-light);
}
.ak-table td {
  padding: 7px 10px;
  border-bottom: 1pt solid var(--color-border);
  vertical-align: top;
}
.ak-table tr:last-child td {
  border-bottom: none;
}
.ak-table tr:nth-child(even) td {
  background: #fafbfc;
}
.ak-num {
  font-weight: bold;
  color: var(--color-accent);
  width: 32px;
}
.ak-type-badge {
  display: inline-block;
  font-size: 7.5pt;
  background: var(--color-bg-light);
  border: 1pt solid var(--color-border);
  border-radius: 10px;
  padding: 1px 7px;
  color: var(--color-ink-light);
  white-space: nowrap;
}
.ak-answer {
  font-weight: bold;
  color: var(--color-correct);
}
.ak-explanation {
  color: var(--color-ink-light);
  font-size: 10pt;
}
.ak-pts {
  text-align: right;
  color: var(--color-ink-faint);
  white-space: nowrap;
  width: 50px;
}
.ak-total-row td {
  font-weight: bold;
  background: var(--color-bg-light) !important;
  border-top: 1.5pt solid var(--color-border-dark);
  color: var(--color-ink);
}

/* ─── 11. Screen footer ──────────────────────────────────────────────────────── */
.page-footer {
  margin-top: 32px;
  padding-top: 8px;
  border-top: 1pt solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8pt;
  color: var(--color-ink-faint);
}
.footer-center {
  text-align: center;
}

/* ─── 12. @media print ───────────────────────────────────────────────────────── */
@media print {
  /* Page setup — US Letter, 0.75in margins on all sides */
  @page {
    size: letter portrait;
    margin: 0.75in;
  }

  /* Remove screen chrome */
  body {
    padding: 0;
    max-width: none;
    background: white;
  }

  /* Logo placeholder prints with grey fill; hide dashed border */
  .school-logo-box {
    border-style: solid;
    border-color: #aaaaaa;
    background: #eeeeee;
  }

  /* Keep the navy accent colour when printing */
  .page-header {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  .ak-banner,
  .info-strip,
  .instructions-box,
  .word-problem-stem,
  .ak-table th,
  .ak-table tr:nth-child(even) td,
  .ak-total-row td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  /* Prevent question content from splitting across pages */
  .question {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .mc-option {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .ak-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Answer key always starts on a fresh page */
  .ak-page-start {
    page-break-before: always;
    break-before: page;
  }

  /* Fixed footer appears on every printed page */
  .page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0;
    padding: 6px 0 2px;
    background: white;
    border-top: 1pt solid var(--color-border);
  }

  /* Reserve space so content doesn't flow under the fixed footer */
  body::after {
    content: '';
    display: block;
    height: 28px;
  }
}
`;
}

/**
 * @file src/templates/certificate.html.js
 * @description HTML template for student completion certificates in local mode.
 */

/**
 * Escapes HTML entities for safe string interpolation.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Builds printable certificate HTML.
 * @param {Object} data
 * @returns {string}
 */
export function buildCertificateHtml(data) {
  const {
    displayName,
    subject,
    topic,
    grade,
    percentage,
    issuedAt,
  } = data;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Completion Certificate</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: #f6f1e8;
      }
      .wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 900px;
        background: #fff;
        border: 10px solid #1f6f5f;
        padding: 48px 40px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
      }
      h1 {
        margin: 0;
        text-align: center;
        letter-spacing: 1px;
        color: #1f6f5f;
      }
      h2 {
        margin: 28px 0 8px;
        text-align: center;
        font-size: 34px;
      }
      p {
        margin: 6px 0;
        text-align: center;
        font-size: 18px;
        color: #2b2b2b;
      }
      .score {
        margin-top: 20px;
        text-align: center;
        font-size: 26px;
        font-weight: bold;
        color: #c85f2f;
      }
      .footer {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
        gap: 24px;
      }
      .line {
        flex: 1;
        border-top: 1px solid #777;
        padding-top: 8px;
        text-align: center;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="card">
        <h1>Certificate of Completion</h1>
        <h2>${escapeHtml(displayName)}</h2>
        <p>has successfully completed a Learnfyra worksheet.</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)} | <strong>Topic:</strong> ${escapeHtml(topic)}</p>
        <p><strong>Grade:</strong> ${escapeHtml(grade)}</p>
        <div class="score">Score: ${escapeHtml(percentage)}%</div>
        <p><strong>Issued:</strong> ${escapeHtml(new Date(issuedAt).toLocaleDateString())}</p>
        <div class="footer">
          <div class="line">Teacher Signature</div>
          <div class="line">Learnfyra</div>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

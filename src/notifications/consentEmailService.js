/**
 * @file src/notifications/consentEmailService.js
 * @description Consent email service — console.log in dev, SES in prod/AWS.
 *
 * In development mode all emails are printed to stdout so the consent URL is
 * immediately visible without needing an actual mail server.
 *
 * In production (NODE_ENV=production) or AWS runtime (APP_RUNTIME=aws) the
 * email is sent via Amazon SES using lazy-loaded SDK clients.
 */

// Lazy SES client — initialized once, reused across Lambda invocations
let _sesClient;
const getSesClient = async () => {
  if (!_sesClient) {
    const { SESClient } = await import('@aws-sdk/client-ses');
    _sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return _sesClient;
};

/**
 * Builds the HTML body for the parental consent request email.
 *
 * @param {string} childDisplayName
 * @param {string} consentUrl
 * @returns {string} HTML string
 */
function buildConsentEmailHtml(childDisplayName, consentUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Parental Consent Required — Learnfyra</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background: #f4f7f9; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #0d9488; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 26px; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; color: #ccfbf1; font-size: 14px; }
    .body { padding: 36px 40px; }
    .body h2 { margin: 0 0 12px; font-size: 20px; color: #0f172a; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #374151; }
    .cta { text-align: center; margin: 32px 0; }
    .cta a { display: inline-block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; letter-spacing: 0.3px; }
    .info-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 4px; margin: 24px 0; }
    .info-box p { margin: 0 0 8px; font-size: 14px; color: #166534; }
    .info-box p:last-child { margin: 0; }
    .rights-list { margin: 0 0 16px; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; font-size: 12px; color: #6b7280; line-height: 1.6; }
    .expiry-notice { margin: 20px 0 0; font-size: 13px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Learnfyra</h1>
      <p>AI-Powered Worksheets for Grades 1–10</p>
    </div>
    <div class="body">
      <h2>Parental Consent Required for ${childDisplayName}</h2>
      <p>
        A Learnfyra account has been created for <strong>${childDisplayName}</strong>.
        Because ${childDisplayName} is under 13, we need your consent before they can
        access the platform. This is required under the Children's Online Privacy
        Protection Act (COPPA).
      </p>

      <div class="info-box">
        <p><strong>What we collect</strong></p>
        <p>Nickname / display name chosen by your child</p>
        <p>Worksheet answers and scores (used only for learning progress)</p>
        <p>Grade level (so we show the right difficulty)</p>
      </div>

      <div class="info-box">
        <p><strong>What we do NOT do</strong></p>
        <p>We never show ads to children or sell any data</p>
        <p>We never share personal information with third parties</p>
        <p>We never collect real names, addresses, or contact details</p>
      </div>

      <p><strong>Your rights as a parent or guardian:</strong></p>
      <ul class="rights-list">
        <li>View all data collected about your child at any time</li>
        <li>Download a full export of your child's data</li>
        <li>Request deletion of your child's account and all associated data</li>
        <li>Revoke consent at any time — this immediately suspends the account</li>
      </ul>

      <p>
        To approve your child's account, click the button below. If you did not
        initiate this request, you can safely ignore this email — no account will
        be activated without your consent.
      </p>

      <div class="cta">
        <a href="${consentUrl}">Approve Consent for ${childDisplayName}</a>
      </div>

      <p class="expiry-notice">This link expires in 48 hours.</p>
    </div>
    <div class="footer">
      <p>
        Learnfyra &mdash; noreply@learnfyra.com<br />
        To contact us about privacy or data requests, reply to this email or visit learnfyra.com/privacy.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends (or simulates sending) a parental consent request email.
 * In production or AWS runtime, sends via Amazon SES.
 * In all other environments, writes the message to stdout.
 *
 * @param {Object} params
 * @param {string} params.parentEmail       - Recipient email address
 * @param {string} params.childDisplayName  - Child's first name (COPPA-safe)
 * @param {string} params.consentUrl        - Full consent approval URL
 * @returns {Promise<{ sent: boolean, method: string }>}
 */
export async function sendConsentEmail({ parentEmail, childDisplayName, consentUrl }) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_RUNTIME === 'aws';

  if (isProduction) {
    const { SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = await getSesClient();

    const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@learnfyra.com';

    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [parentEmail] },
      Message: {
        Subject: {
          Data: `Learnfyra: Parental Consent Required for ${childDisplayName}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: buildConsentEmailHtml(childDisplayName, consentUrl),
            Charset: 'UTF-8',
          },
          Text: {
            Data: [
              `Parental Consent Required for ${childDisplayName}`,
              '',
              `A Learnfyra account has been created for ${childDisplayName}. To approve, visit:`,
              consentUrl,
              '',
              'This link expires in 48 hours.',
              '',
              'What we collect: nickname, worksheet answers, grade level.',
              'We never sell data or show ads to children.',
              'You may view, download, or delete your child\'s data at any time.',
            ].join('\n'),
            Charset: 'UTF-8',
          },
        },
      },
    });

    await ses.send(command);
    return { sent: true, method: 'ses' };
  }

  // Local dev — print to stdout
  console.log('━'.repeat(60));
  console.log('[CONSENT EMAIL] Parental consent request');
  console.log(`  To: ${parentEmail}`);
  console.log(`  Child: ${childDisplayName}`);
  console.log(`  Consent URL: ${consentUrl}`);
  console.log('━'.repeat(60));

  return { sent: true, method: 'console' };
}

/**
 * @file src/notifications/consentEmailService.js
 * @description Consent email service — console.log in dev, SES in prod (future).
 *
 * In development mode all emails are printed to stdout so the consent URL is
 * immediately visible without needing an actual mail server.
 *
 * Production SES integration is deferred — a TODO comment marks the hook point.
 */

/**
 * Sends (or simulates sending) a parental consent request email.
 * In any environment other than production the message is written to stdout.
 *
 * @param {Object} params
 * @param {string} params.parentEmail       - Recipient email address
 * @param {string} params.childDisplayName  - Child's first name (COPPA-safe)
 * @param {string} params.consentUrl        - Full consent approval URL
 * @returns {Promise<{ sent: boolean, method: string }>}
 */
export async function sendConsentEmail({ parentEmail, childDisplayName, consentUrl }) {
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement SES email sending
    console.log('[CONSENT EMAIL] Production email sending not yet implemented');
  }

  console.log('━'.repeat(60));
  console.log('[CONSENT EMAIL] Parental consent request');
  console.log(`  To: ${parentEmail}`);
  console.log(`  Child: ${childDisplayName}`);
  console.log(`  Consent URL: ${consentUrl}`);
  console.log('━'.repeat(60));

  return { sent: true, method: 'console' };
}

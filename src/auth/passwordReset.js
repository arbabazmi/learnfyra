/**
 * @file src/auth/passwordReset.js
 * @description Password reset service. Environment-aware:
 *   - local:         Generates token, stores in DB, sends email via Mailhog (SMTP)
 *   - dev/qa/prod:   Delegates to Cognito ForgotPassword API
 *
 * Used by authHandler.js for:
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 */

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDbAdapter } from '../db/index.js';
import { getAuthAdapter } from './index.js';

const RESET_TABLE = 'passwordresets';
const USERS_TABLE = 'users';
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);

/**
 * Lazily loads nodemailer to avoid requiring it in production (Cognito sends emails).
 * @returns {Promise<import('nodemailer')>}
 */
let _nodemailer;
async function getNodemailer() {
  if (!_nodemailer) {
    _nodemailer = await import('nodemailer');
  }
  return _nodemailer.default || _nodemailer;
}

/**
 * Sends a password reset email via SMTP (Mailhog in local dev).
 * @param {string} email
 * @param {string} resetUrl
 * @param {string} displayName
 */
async function sendResetEmail(email, resetUrl, displayName) {
  const nodemailer = await getNodemailer();
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
  });

  await transport.sendMail({
    from: '"Learnfyra" <noreply@learnfyra.com>',
    to: email,
    subject: 'Reset your Learnfyra password',
    html: `
      <div style="font-family:'Nunito',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="color:#0a0f1e;font-size:22px;font-weight:800;margin:0 0 8px;">
          Reset your password
        </h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi ${displayName || 'there'},<br/>
          We received a request to reset your Learnfyra password.
          Click the button below to choose a new one. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#3D9AE8;color:#fff;font-size:15px;font-weight:700;
                  padding:12px 28px;border-radius:10px;text-decoration:none;">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Reset your Learnfyra password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Handles the forgot-password request for local (non-Cognito) environments.
 *
 * 1. Look up user by email
 * 2. If found: generate token, store in DB, send email via SMTP
 * 3. Always return success (don't reveal whether email exists)
 *
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDbAdapter();

  const matches = await db.queryByField(USERS_TABLE, 'email', normalizedEmail);
  const user = matches.length > 0 ? matches[0] : null;

  if (!user) {
    // Don't reveal that the email doesn't exist
    return;
  }

  // Generate a unique token ID
  const tokenId = randomUUID();
  const now = Date.now();
  const expiresAt = Math.floor((now + TOKEN_EXPIRY_MS) / 1000); // Unix seconds for TTL

  await db.putItem(RESET_TABLE, {
    tokenId,
    email: normalizedEmail,
    userId: user.userId,
    expiresAt,
    used: false,
    createdAt: new Date(now).toISOString(),
  });

  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${tokenId}`;
  await sendResetEmail(normalizedEmail, resetUrl, user.displayName);
}

/**
 * Validates a password reset token and updates the user's password.
 *
 * @param {string} tokenId - The reset token ID from the URL
 * @param {string} newPassword - The new plain-text password
 * @throws {{ message: string, statusCode: number }} On invalid/expired/used token
 */
export async function resetPassword(tokenId, newPassword) {
  const db = getDbAdapter();

  const record = await db.getItem(RESET_TABLE, tokenId);
  if (!record) {
    const err = new Error('Invalid or expired reset link.');
    err.statusCode = 400;
    throw err;
  }

  if (record.used) {
    const err = new Error('This reset link has already been used.');
    err.statusCode = 400;
    throw err;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (record.expiresAt && nowSeconds > record.expiresAt) {
    const err = new Error('This reset link has expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }

  // Hash the new password and update the user record
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.updateItem(USERS_TABLE, record.userId, { passwordHash });

  // Mark the token as used
  await db.updateItem(RESET_TABLE, record.tokenId, { used: true });
}

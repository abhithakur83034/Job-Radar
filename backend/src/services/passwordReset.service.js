import crypto from 'crypto';
import { hash } from '@node-rs/argon2';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { identifierQuery } from '../utils/identity.js';
import { sendMail } from './mail.service.js';

const TOKEN_TTL_MS = 30 * 60 * 1000;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function resetUrl(token) {
  return `${env.FRONTEND_ORIGIN.split(',')[0].trim()}/reset-password?token=${token}`;
}

/** Create a single-use token for a user, invalidating any earlier unused ones. */
export async function createResetToken(userId, createdBy = 'self') {
  await PasswordResetToken.deleteMany({ userId, usedAt: null });
  const token = crypto.randomBytes(32).toString('base64url');
  await PasswordResetToken.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    createdBy,
  });
  return { token, url: resetUrl(token), expiresInMinutes: TOKEN_TTL_MS / 60000 };
}

/**
 * "Forgot password": if the identifier matches an active account, email it a reset
 * link. Callers must respond identically either way (no account enumeration).
 */
export async function requestPasswordReset(identifier) {
  const user = await User.findOne(identifierQuery(identifier)).select('email name status').lean();
  if (!user || user.status === 'suspended' || !user.email) return;

  const { url, expiresInMinutes } = await createResetToken(user._id);
  await sendMail({
    to: user.email,
    subject: 'Reset your JobRadar password',
    text: `Hi ${user.name},\n\nUse this link to set a new JobRadar password. It works once and expires in ${expiresInMinutes} minutes:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email; your password won't change.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Use this link to set a new JobRadar password. It works once and expires in ${expiresInMinutes} minutes:</p><p><a href="${url}">Reset my password</a></p><p>If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
  });
}

/**
 * Consume a reset token and set the new password. Signs out every existing session
 * (passwordChangedAt) and invalidates any other outstanding reset tokens.
 * @returns {Promise<boolean>} false if the token is invalid, used or expired
 */
export async function resetPassword(token, newPassword) {
  const record = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: hashToken(String(token)), usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!record) return false;

  await User.updateOne(
    { _id: record.userId },
    { passwordHash: await hash(newPassword), passwordChangedAt: new Date() }
  );
  await PasswordResetToken.deleteMany({ userId: record.userId, _id: { $ne: record._id } });
  return true;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

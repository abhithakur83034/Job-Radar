import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { identifierQuery } from '../utils/identity.js';
import { Notification } from '../models/Notification.js';
import { requestPasswordReset, resetPassword as consumeResetToken } from '../services/passwordReset.service.js';
import { isMailConfigured } from '../services/mail.service.js';

// Request bodies are validated by Joi schemas in validators/auth.validators.js (see auth.routes.js)
const INVALID_LOGIN = 'Invalid username/mobile number or password';

function parseDurationMs(durationStr) {
  if (typeof durationStr === 'number') return durationStr;
  const match = /^(\d+)([smhd])$/.exec(durationStr);
  if (!match) return 15 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

export function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'job-radar-api',
    audience: 'job-radar-web',
  });

  const maxAge = parseDurationMs(env.JWT_EXPIRES_IN);
  const isSecure = env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE || (isSecure ? 'none' : 'lax');

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/',
    maxAge,
  });

  return token;
}

export function clearSessionCookie(res) {
  const isSecure = env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAME_SITE || (isSecure ? 'none' : 'lax');

  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecure,
    sameSite,
    path: '/',
  });
}

export function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username || null,
    mobile: user.mobile || null,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    createdAt: user.createdAt,
    hiddenCompanies: user.hiddenCompanies ?? [],
    notificationPrefs: {
      minScore: user.notificationPrefs?.minScore ?? 80,
      push: user.notificationPrefs?.push ?? true,
    },
  };
}

/** Returns the name of the first identifier already used by another account, if any. */
async function findTakenIdentifier({ email, username, mobile }, excludeUserId) {
  const checks = [
    ['email', email],
    ['username', username],
    ['mobile number', mobile],
  ].filter(([, value]) => value);
  for (const [label, value] of checks) {
    const field = label === 'mobile number' ? 'mobile' : label;
    const filter = { [field]: value };
    if (excludeUserId) filter._id = { $ne: excludeUserId };
    if (await User.exists(filter)) return label;
  }
  return null;
}

export async function register(req, res) {
  const { name, username, mobile, email, password } = req.body;

  const taken = await findTakenIdentifier({ email, username, mobile });
  if (taken) {
    return res.status(409).json({ error: `An account with that ${taken} already exists` });
  }

  const user = await User.create({
    name,
    username,
    mobile,
    email,
    passwordHash: await hash(password),
  });

  setSessionCookie(res, user._id);

  return res.status(201).json({
    user: safeUser(user),
  });
}

export async function login(req, res) {
  const { identifier, email, password } = req.body;

  const user = await User.findOne(identifierQuery(identifier ?? email)).select('+passwordHash');
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: INVALID_LOGIN });
  }

  const isValid = await verify(user.passwordHash, password);
  if (!isValid) {
    return res.status(401).json({ error: INVALID_LOGIN });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
  }

  setSessionCookie(res, user._id);

  return res.status(200).json({
    user: safeUser(user),
  });
}

export async function logout(_req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

/** POST /auth/forgot-password — same response whether or not the account exists. */
export async function forgotPassword(req, res) {
  await requestPasswordReset(req.body.identifier);
  return res.json({
    message: "If that account exists, we've sent a password reset link to its email address.",
    emailEnabled: isMailConfigured(),
  });
}

/** POST /auth/reset-password */
export async function resetPassword(req, res) {
  const ok = await consumeResetToken(req.body.token, req.body.password);
  if (!ok) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.', code: 'INVALID_RESET_TOKEN' });
  }
  clearSessionCookie(res);
  return res.json({ message: 'Password updated. Please sign in with your new password.' });
}

export async function getCurrentUser(req, res) {
  // Unread count rides along with the session check so the bell needs no extra request
  const unreadNotifications = await Notification.countDocuments({ userId: req.user._id, readAt: null });
  return res.status(200).json({
    user: { ...safeUser(req.user), unreadNotifications },
  });
}


export async function updateCurrentUser(req, res) {
  const updates = { ...req.body };
  if (updates.avatarUrl === '') updates.avatarUrl = null;

  const taken = await findTakenIdentifier(
    { username: updates.username, mobile: updates.mobile },
    req.user._id
  );
  if (taken) {
    return res.status(409).json({ error: `That ${taken} is already in use` });
  }

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after' });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: safeUser(user) });
}

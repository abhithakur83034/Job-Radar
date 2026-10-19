import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

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

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  return token;
}

export function clearSessionCookie(res) {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
  });
}

export function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function register(req, res) {
  const parsed = registerSchema.parse(req.body);
  const normalizedEmail = parsed.email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await hash(parsed.password);

  const user = await User.create({
    name: parsed.name,
    email: normalizedEmail,
    passwordHash,
  });

  setSessionCookie(res, user._id);

  return res.status(201).json({
    user: safeUser(user),
  });
}

export async function login(req, res) {
  const parsed = loginSchema.parse(req.body);
  const normalizedEmail = parsed.email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValid = await verify(user.passwordHash, parsed.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
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

export async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: safeUser(req.user),
  });
}


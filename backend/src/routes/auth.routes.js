import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateMeSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validators.js';
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

/**
 * Rate limits for unauthenticated endpoints only. Session checks (/me) are never
 * limited here: every page load makes one, and on the live site they all arrive from
 * the frontend server's IP, so an IP-only limit would be shared by every user.
 * Sign-in and reset limits are keyed by IP + the account being targeted, so one
 * account's attacker can't lock everyone else out.
 */
const limiter = ({ windowMs, limit, key }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' },
    keyGenerator: key ? (req) => `${ipKeyGenerator(req.ip)}:${key(req)}` : undefined,
    skip: () => env.NODE_ENV === 'test',
  });

const accountKey = (req) => String(req.body?.identifier ?? req.body?.email ?? '').trim().toLowerCase().slice(0, 254);

const loginLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 10, key: accountKey });
const registerLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 50 });
// Reset emails cost sender reputation and invite abuse
const forgotLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 5, key: accountKey });
const resetLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 20, key: (req) => String(req.body?.token ?? '').slice(0, 12) });

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/forgot-password', forgotLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));
router.get('/me', requireAuth, asyncHandler(getCurrentUser));
router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(updateCurrentUser));

export default router;


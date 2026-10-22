import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

// Fields loaded for req.user (everything safeUser() returns, plus status checks)
const SESSION_USER_FIELDS = '_id name email username mobile role status avatarUrl createdAt lastActiveAt hiddenCompanies notificationPrefs passwordChangedAt';
const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Authenticates the request from the session cookie (or an Authorization: Bearer
 * header for API clients). There is deliberately no development fallback user and
 * no token-in-URL support: every request must carry a real session.
 */
export async function requireAuth(req, res, next) {
  let token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'job-radar-api', audience: 'job-radar-web' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session', code: 'UNAUTHENTICATED' });
  }

  try {
    const user = await User.findById(payload.sub).select(SESSION_USER_FIELDS);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session', code: 'UNAUTHENTICATED' });
    }
    // A password reset signs out every session issued before it
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ error: 'Your password was changed. Please sign in again.', code: 'UNAUTHENTICATED' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
    }
    // Record activity at most every few minutes rather than writing on every request
    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
      User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

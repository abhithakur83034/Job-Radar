import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.[env.SESSION_COOKIE_NAME];

    // Also support Authorization header for flexibility in API clients / tests
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'job-radar-api',
      audience: 'job-radar-web',
    });

    const user = await User.findById(payload.sub).select('_id name email role createdAt');
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}


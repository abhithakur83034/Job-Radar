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

    // Also support query param token for iframe / direct link embedding
    if (!token && req.query?.token) {
      token = req.query.token;
    }

    if (!token) {
      // In local development, fall back to the active user to prevent broken dev sessions or cross-port iframe drops
      if (env.NODE_ENV === 'development') {
        let devUser = await User.findOne({ email: /abhishek/i }).select('_id name email role avatarUrl createdAt');
        if (!devUser) {
          devUser = await User.findOne().sort({ createdAt: -1 }).select('_id name email role avatarUrl createdAt');
        }
        if (devUser) {
          req.user = devUser;
          return next();
        }
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'job-radar-api',
      audience: 'job-radar-web',
    });

    const user = await User.findById(payload.sub).select('_id name email role avatarUrl createdAt');
    if (!user) {
      if (env.NODE_ENV === 'development') {
        let devUser = await User.findOne({ email: /abhishek/i }).select('_id name email role avatarUrl createdAt');
        if (!devUser) devUser = await User.findOne().sort({ createdAt: -1 }).select('_id name email role avatarUrl createdAt');
        if (devUser) {
          req.user = devUser;
          return next();
        }
      }
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    next();
  } catch (_err) {
    if (env.NODE_ENV === 'development') {
      let devUser = await User.findOne({ email: /abhishek/i }).select('_id name email role avatarUrl createdAt');
      if (!devUser) devUser = await User.findOne().sort({ createdAt: -1 }).select('_id name email role avatarUrl createdAt');
      if (devUser) {
        req.user = devUser;
        return next();
      }
    }
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}


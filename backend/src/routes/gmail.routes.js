import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../config/env.js';
import {
  getGmailStatus,
  connectGmail,
  gmailCallback,
  syncGmail,
  disconnectGmail,
} from '../controllers/gmail.controller.js';

const router = Router();

const gmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

router.use(requireAuth);

router.get('/status', asyncHandler(getGmailStatus));
router.get('/connect', gmailLimiter, asyncHandler(connectGmail));
router.get('/callback', gmailLimiter, asyncHandler(gmailCallback));
router.post('/sync', gmailLimiter, asyncHandler(syncGmail));
router.delete('/', asyncHandler(disconnectGmail));

export default router;

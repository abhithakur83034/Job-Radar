import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { env } from '../config/env.js';
import {
  listJobSources,
  adminJobSourceStatus,
  adminRefreshJobSources,
} from '../controllers/jobSources.controller.js';

export const jobSourcesRouter = Router();
jobSourcesRouter.get('/', requireAuth, asyncHandler(listJobSources));

const manualRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

export const adminJobSourcesRouter = Router();
adminJobSourcesRouter.use(requireAuth, requireAdmin);
adminJobSourcesRouter.get('/status', asyncHandler(adminJobSourceStatus));
adminJobSourcesRouter.post('/refresh', manualRefreshLimiter, asyncHandler(adminRefreshJobSources));

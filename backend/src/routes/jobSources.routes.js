import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { listJobSources, listPublicSources } from '../controllers/jobSources.controller.js';

export const jobSourcesRouter = Router();
jobSourcesRouter.get('/', requireAuth, asyncHandler(listJobSources));
jobSourcesRouter.get('/public', listPublicSources);

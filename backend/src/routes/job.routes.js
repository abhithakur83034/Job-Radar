import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { syncListings, listJobs } from '../controllers/job.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/sync', asyncHandler(syncListings));
router.get('/', asyncHandler(listJobs));

export default router;


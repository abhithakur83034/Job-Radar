import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listApplications,
  createApplication,
  updateApplicationStatus,
  addFollowUp,
} from '../controllers/application.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listApplications));
router.post('/', asyncHandler(createApplication));
router.patch('/:id/status', asyncHandler(updateApplicationStatus));
router.post('/:id/followup', asyncHandler(addFollowUp));

export default router;


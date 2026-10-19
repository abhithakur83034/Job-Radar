import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getLatestResume,
  listResumes,
  uploadResume,
} from '../controllers/resume.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/latest', asyncHandler(getLatestResume));
router.get('/', asyncHandler(listResumes));
router.post('/', asyncHandler(uploadResume));

export default router;

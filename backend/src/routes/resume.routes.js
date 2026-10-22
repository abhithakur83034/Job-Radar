import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleResumeUpload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createResumeSchema } from '../validators/resume.validators.js';
import {
  getLatestResume,
  listResumes,
  uploadResume,
  uploadResumeFile,
  viewResumeFile,
  downloadResumeFile,
  parseResume,
} from '../controllers/resume.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/latest', asyncHandler(getLatestResume));
router.get('/view/latest', asyncHandler(viewResumeFile));
router.get('/view/:id', asyncHandler(viewResumeFile));
router.get('/download/latest', asyncHandler(downloadResumeFile));
router.get('/download/:id', asyncHandler(downloadResumeFile));
router.get('/', asyncHandler(listResumes));
router.post('/upload', handleResumeUpload, asyncHandler(uploadResumeFile));
router.post('/parse', handleResumeUpload, asyncHandler(parseResume));
router.post('/', validate(createResumeSchema), asyncHandler(uploadResume));

export default router;

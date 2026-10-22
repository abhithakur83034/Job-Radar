import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { createProfileSchema, updateProfileSchema } from '../validators/profile.validators.js';
import {
  listProfiles,
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/profile.controller.js';

const router = Router();

// All profile endpoints require authentication
router.use(requireAuth);

router.get('/', asyncHandler(listProfiles));
router.post('/', validate(createProfileSchema), asyncHandler(createProfile));
router.get('/:id', asyncHandler(getProfile));
router.patch('/:id', validate(updateProfileSchema), asyncHandler(updateProfile));
router.delete('/:id', asyncHandler(deleteProfile));

export default router;


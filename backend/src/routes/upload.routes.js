import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleImageUpload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadAvatar, uploadImage } from '../controllers/upload.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/avatar', handleImageUpload, asyncHandler(uploadAvatar));
router.post('/image', handleImageUpload, asyncHandler(uploadImage));

export default router;


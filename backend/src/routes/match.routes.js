import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { listMatches, getMatch, toggleSaveMatch } from '../controllers/match.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listMatches));
router.get('/:id', asyncHandler(getMatch));
router.patch('/:id/save', asyncHandler(toggleSaveMatch));

export default router;


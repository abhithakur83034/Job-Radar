import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getDraftByMatch, generateDraft, updateDraft } from '../controllers/draft.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/match/:matchId', asyncHandler(getDraftByMatch));
router.post('/generate', asyncHandler(generateDraft));
router.patch('/:id', asyncHandler(updateDraft));

export default router;


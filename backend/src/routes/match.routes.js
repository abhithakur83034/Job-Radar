import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { dismissSchema } from '../validators/me.validators.js';
import { listMatches, getMatch, toggleSaveMatch, dismissMatch } from '../controllers/match.controller.js';
import { hideCompanyOfMatch } from '../controllers/me.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listMatches));
router.get('/:id', asyncHandler(getMatch));
router.patch('/:id/save', asyncHandler(toggleSaveMatch));
router.patch('/:id/dismiss', validate(dismissSchema), asyncHandler(dismissMatch));
router.post('/:id/hide-company', asyncHandler(hideCompanyOfMatch));

export default router;


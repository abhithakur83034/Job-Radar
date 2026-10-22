import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, updateMeSchema } from '../validators/auth.validators.js';
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateCurrentUser,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(getCurrentUser));
router.patch('/me', requireAuth, validate(updateMeSchema), asyncHandler(updateCurrentUser));

export default router;


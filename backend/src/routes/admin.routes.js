import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { settingsSchema } from '../config/runtimeSettings.js';
import {
  objectIdParam,
  listUsersQuery,
  updateUserStatusBody,
  updateUserRoleBody,
  listJobsQuery,
  updateJobStatusBody,
  listRunsQuery,
  listAuditQuery,
  manualRefreshBody,
  resetLinkBody,
} from '../validators/admin.validators.js';
import * as admin from '../controllers/admin.controller.js';

/**
 * Admin API (/api/v1/admin). Every route — including read-only ones — requires a
 * signed-in user with role "admin", enforced here on the server.
 */
const router = Router();
router.use(requireAuth, requireAdmin);

const limiter = (limit) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => env.NODE_ENV === 'test' });
const writeLimiter = limiter(60);
const refreshLimiter = limiter(5);

router.get('/overview', asyncHandler(admin.getOverview));

router.get('/users', validate(listUsersQuery, 'query'), asyncHandler(admin.listUsers));
router.get('/users/:id', validate(objectIdParam, 'params'), asyncHandler(admin.getUser));
router.patch('/users/:id/status', writeLimiter, validate(objectIdParam, 'params'), validate(updateUserStatusBody), asyncHandler(admin.updateUserStatus));
router.post('/users/:id/password-reset-link', writeLimiter, validate(objectIdParam, 'params'), validate(resetLinkBody), asyncHandler(admin.createUserResetLink));
router.patch('/users/:id/role', writeLimiter, validate(objectIdParam, 'params'), validate(updateUserRoleBody), asyncHandler(admin.updateUserRole));

router.get('/jobs', validate(listJobsQuery, 'query'), asyncHandler(admin.listJobs));
router.get('/jobs/:id', validate(objectIdParam, 'params'), asyncHandler(admin.getJob));
router.patch('/jobs/:id/status', writeLimiter, validate(objectIdParam, 'params'), validate(updateJobStatusBody), asyncHandler(admin.updateJobStatus));

router.get('/job-sources', asyncHandler(admin.listSources));
router.get('/job-sources/status', asyncHandler(admin.listSources)); // kept for existing clients
router.get('/job-sources/runs', validate(listRunsQuery, 'query'), asyncHandler(admin.listRuns));
router.post('/job-sources/refresh', refreshLimiter, validate(manualRefreshBody), asyncHandler(admin.triggerRefresh));

router.get('/audit-logs', validate(listAuditQuery, 'query'), asyncHandler(admin.listAuditLogs));

router.get('/settings', asyncHandler(admin.getSettings));
router.patch('/settings', writeLimiter, validate(settingsSchema), asyncHandler(admin.patchSettings));
router.post('/settings/reset', writeLimiter, asyncHandler(admin.resetSettingsToDefaults));

export default router;

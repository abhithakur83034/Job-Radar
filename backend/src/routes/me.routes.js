import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  companySchema,
  notificationPrefsSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  paginationSchema,
} from '../validators/me.validators.js';
import {
  hideCompany,
  unhideCompany,
  listNotifications,
  markAllNotificationsRead,
  updateNotificationPrefs,
  getPushConfig,
  subscribePush,
  unsubscribePush,
} from '../controllers/me.controller.js';

/** The signed-in user's own preferences: hidden companies, notifications, push. */
const router = Router();
router.use(requireAuth);

router.post('/hidden-companies', validate(companySchema), asyncHandler(hideCompany));
router.delete('/hidden-companies/:company', asyncHandler(unhideCompany));

router.get('/notifications', validate(paginationSchema, 'query'), asyncHandler(listNotifications));
router.post('/notifications/read-all', asyncHandler(markAllNotificationsRead));
router.patch('/notification-prefs', validate(notificationPrefsSchema), asyncHandler(updateNotificationPrefs));

router.get('/push', asyncHandler(getPushConfig));
router.post('/push/subscriptions', validate(pushSubscriptionSchema), asyncHandler(subscribePush));
router.delete('/push/subscriptions', validate(pushUnsubscribeSchema), asyncHandler(unsubscribePush));

export default router;

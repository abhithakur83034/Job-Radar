import Joi from 'joi';

const page = Joi.number().integer().min(1).max(10000).default(1);
const limit = Joi.number().integer().min(1).max(100).default(20);
const search = Joi.string().trim().max(100).allow('').default('');
const reason = Joi.string().trim().min(3).max(500).required().label('Reason');

export const objectIdParam = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const listUsersQuery = Joi.object({
  page,
  limit,
  search,
  role: Joi.string().valid('user', 'admin', ''),
  status: Joi.string().valid('active', 'suspended', ''),
  registeredFrom: Joi.date().iso(),
  registeredTo: Joi.date().iso(),
});

export const updateUserStatusBody = Joi.object({
  status: Joi.string().valid('active', 'suspended').required(),
  reason,
});

export const updateUserRoleBody = Joi.object({
  role: Joi.string().valid('user', 'admin').required(),
  reason,
});

export const resetLinkBody = Joi.object({ reason });

export const listJobsQuery = Joi.object({
  page,
  limit,
  search,
  source: Joi.string().trim().lowercase().max(40).allow(''),
  company: Joi.string().trim().lowercase().max(100).allow(''),
  status: Joi.string().valid('open', 'closed', 'hidden', ''),
  foundFrom: Joi.date().iso(),
  foundTo: Joi.date().iso(),
});

export const updateJobStatusBody = Joi.object({
  // hidden: admin-hidden from all feeds; visible: un-hide (and reopen)
  status: Joi.string().valid('hidden', 'visible').required(),
  reason,
});

export const listRunsQuery = Joi.object({ page, limit });

export const listAuditQuery = Joi.object({
  page,
  limit,
  action: Joi.string().trim().max(60).allow(''),
  targetType: Joi.string().valid('user', 'job', 'settings', 'job-refresh', ''),
});

export const manualRefreshBody = Joi.object({
  reason: Joi.string().trim().max(500).allow(''),
});

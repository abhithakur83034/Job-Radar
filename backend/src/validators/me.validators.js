import Joi from 'joi';

export const companySchema = Joi.object({
  company: Joi.string().trim().lowercase().min(1).max(100).required().label('Company'),
});

export const notificationPrefsSchema = Joi.object({
  minScore: Joi.number().integer().min(50).max(100),
  push: Joi.boolean(),
}).min(1);

// A browser PushSubscription (subscription.toJSON()); endpoint must be an https push service URL
export const pushSubscriptionSchema = Joi.object({
  endpoint: Joi.string().uri({ scheme: ['https'] }).max(1000).required(),
  expirationTime: Joi.any().strip(),
  keys: Joi.object({
    p256dh: Joi.string().max(200).required(),
    auth: Joi.string().max(100).required(),
  }).required(),
});

export const pushUnsubscribeSchema = Joi.object({
  endpoint: Joi.string().uri({ scheme: ['https'] }).max(1000).required(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const dismissSchema = Joi.object({
  dismissed: Joi.boolean().default(true),
});

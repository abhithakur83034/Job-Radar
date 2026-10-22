import Joi from 'joi';
import { USERNAME_PATTERN, normalizeMobile } from '../utils/identity.js';

const username = Joi.string()
  .trim()
  .lowercase()
  .pattern(USERNAME_PATTERN)
  .messages({
    'string.pattern.base':
      'Username must be 3–30 characters, start with a letter, and use only letters, numbers, dots or underscores',
  });

const mobile = Joi.string()
  .trim()
  .custom((value, helpers) => normalizeMobile(value) ?? helpers.error('mobile.invalid'))
  .messages({
    'mobile.invalid': 'Enter a valid mobile number (10-digit Indian number, or include the + country code)',
  });

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().label('Name'),
  username: username.required().label('Username'),
  mobile: mobile.required().label('Mobile number'),
  email: Joi.string().trim().lowercase().email().max(254).required().label('Email'),
  password: Joi.string().min(8).max(128).required().label('Password'),
});

export const loginSchema = Joi.object({
  // Username, mobile number, or (for older accounts) email
  identifier: Joi.string().trim().min(1).max(254).label('Username or mobile number'),
  // Back-compat for clients that still send { email }
  email: Joi.string().trim().max(254),
  password: Joi.string().min(1).max(128).required().label('Password'),
})
  .or('identifier', 'email')
  .messages({ 'object.missing': 'Username or mobile number is required' });

export const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).label('Name'),
  username: username.label('Username'),
  mobile: mobile.label('Mobile number'),
  // Only images uploaded through /api/v1/upload, never arbitrary URLs
  avatarUrl: Joi.string()
    .trim()
    .pattern(/^\/uploads\/images\/[\w.-]+$/)
    .allow(null, '')
    .messages({ 'string.pattern.base': 'Avatar must be an uploaded image' }),
})
  .min(1)
  .messages({ 'object.min': 'Nothing to update' });

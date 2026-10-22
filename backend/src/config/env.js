import 'dotenv/config';
import Joi from 'joi';

// `.empty('')` treats blank values (e.g. `GMAIL_TOKEN_KEY=`) as unset
const optionalString = () => Joi.string().empty('');
const bool = (fallback) => Joi.boolean().truthy('true', '1').falsy('false', '0').empty('').default(fallback);
const int = (fallback, min, max) => Joi.number().integer().min(min).max(max).empty('').default(fallback);

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').empty('').default('development'),
  PORT: Joi.number().integer().positive().empty('').default(4000),
  MONGODB_URI: Joi.string().required().messages({ 'any.required': 'MONGODB_URI is required' }),
  FRONTEND_ORIGIN: optionalString().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: optionalString().default('jr_session'),
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: optionalString().default('7d'),
  COOKIE_SECURE: Joi.string().valid('true', 'false').empty('').default('false'),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'none', 'strict').empty(''),

  // Gmail job-alert import (optional; feature is disabled unless all four are set)
  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().empty(''),
  GMAIL_TOKEN_KEY: optionalString().custom((value, helpers) =>
    Buffer.from(value, 'base64').length === 32 ? value : helpers.message('GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded')
  ),

  // Job-source providers that need credentials (each is disabled until configured)
  ADZUNA_APP_ID: optionalString(),
  ADZUNA_APP_KEY: optionalString(),
  ADZUNA_COUNTRY: optionalString().lowercase().pattern(/^[a-z]{2}$/).default('in'),
  JOOBLE_API_KEY: optionalString(),
  JOOBLE_HOST: optionalString().hostname().default('in.jooble.org'),
  THE_MUSE_API_KEY: optionalString(), // optional: raises The Muse limit from 500 to 3600 req/hour

  // Background job refresh
  JOB_REFRESH_ENABLED: bool(false),
  JOB_REFRESH_INTERVAL_MINUTES: int(360, 60, 24 * 60),
  JOB_FETCH_TIMEOUT_MS: int(12000, 1000, 60000),
  JOB_FETCH_CONCURRENCY: int(3, 1, 10),
  JOB_FETCH_MAX_RETRIES: int(2, 0, 5),
  // Board jobs missing from a successful refresh for this long are marked inactive
  JOB_STALE_GRACE_DAYS: int(3, 1, 60),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false, convert: true });
if (error) {
  throw new Error(`Invalid environment configuration: ${error.details.map((d) => d.message).join('; ')}`);
}

export const env = value;

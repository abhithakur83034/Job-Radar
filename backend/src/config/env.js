import 'dotenv/config';
import { z } from 'zod';

// Treat empty env values (e.g. `GMAIL_TOKEN_KEY=`) as unset
const optional = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().default('jr_session'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'none', 'strict']).optional(),
  // Gmail job-alert import (optional; feature is disabled unless all four are set)
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
  GOOGLE_REDIRECT_URI: optional(z.string().url()),
  GMAIL_TOKEN_KEY: optional(
    z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded')
  ),
});

export const env = schema.parse(process.env);

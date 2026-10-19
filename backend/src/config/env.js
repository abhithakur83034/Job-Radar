import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  SESSION_COOKIE_NAME: z.string().default('jr_session'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false')
});

export const env = schema.parse(process.env);


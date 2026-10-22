import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/env.js';
import path from 'path';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import jobRoutes from './routes/job.routes.js';
import matchRoutes from './routes/match.routes.js';
import draftRoutes from './routes/draft.routes.js';
import applicationRoutes from './routes/application.routes.js';
import gmailRoutes from './routes/gmail.routes.js';
import meRoutes from './routes/me.routes.js';
import { jobSourcesRouter } from './routes/jobSources.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { serveStoredFile } from './utils/storage.js';

export const app = express();

app.disable('x-powered-by');
// Behind one reverse proxy in production (Render/Railway); needed for correct client IPs in rate limiting
app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalhost = env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || isLocalhost) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve uploaded files: legacy local disk first, then GridFS
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.get('/uploads/:folder/:filename', serveStoredFile);

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/drafts', draftRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/gmail', gmailRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/job-sources', jobSourcesRouter);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

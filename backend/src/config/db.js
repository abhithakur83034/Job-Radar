import mongoose from 'mongoose';
import { env } from './env.js';

function maskUri(uri) {
  try {
    return uri.replace(/:([^:@]+)@/, ':****@');
  } catch {
    return '***';
  }
}

export async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log(`[Database] MongoDB connected successfully to ${maskUri(env.MONGODB_URI)}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected.');
  });

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production',
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  // autoIndex is off in production, so build indexes explicitly (idempotent; no-op when they exist)
  if (env.NODE_ENV === 'production') {
    await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
    console.log('[Database] Indexes ensured.');
  }
}

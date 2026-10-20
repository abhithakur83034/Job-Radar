import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';

await connectDatabase();

const server = app.listen(env.PORT, () => {
  console.log(`Job Radar API listening on port ${env.PORT}`);
});

async function gracefulShutdown(signal) {
  console.log(`${signal} received: closing HTTP server and database connections`);
  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


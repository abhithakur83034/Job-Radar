import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';

await connectDatabase();

const server = app.listen(env.PORT, () => {
  console.log(`Job Radar API listening on port ${env.PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});


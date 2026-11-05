import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './auth.js';
import { createDatabase } from './db/client.js';
import { loadEnv } from './env.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = loadEnv();

const { db, close } = createDatabase(env.DATABASE_URL);
const app = createApp({
  db,
  verifyToken: createSupabaseVerifier(env.SUPABASE_URL),
  corsOrigins: env.CORS_ORIGINS,
  log: true,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close(() => {
    void close().then(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { existsSync } from 'node:fs';
// Vercel solo acepta como entrada un archivo que importe `hono` directamente.
import { Hono } from 'hono';
import { createSupabaseVerifier } from './auth.js';
import { createApp } from './create-app.js';
import { createDatabase } from './db/client.js';
import { loadEnv } from './env.js';

// Punto de entrada de la API. Vercel lo detecta y sirve su `export default`;
// en local lo arranca src/serve.ts.

if (existsSync('.env')) process.loadEnvFile('.env');
const env = loadEnv();

const { db } = createDatabase(env.DATABASE_URL);

const app = createApp({
  db,
  verifyToken: createSupabaseVerifier(env.SUPABASE_URL),
  corsOrigins: env.CORS_ORIGINS,
  log: true,
});

export default app satisfies Hono<any, any, any>;

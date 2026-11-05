import { serve } from '@hono/node-server';
import app from './index.js';
import { loadEnv } from './env.js';

// Servidor Node para desarrollo local (`pnpm api`). En Vercel no se usa.
const { PORT } = loadEnv();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

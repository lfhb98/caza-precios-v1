import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv, VerifyToken } from './auth.js';
import type { Database } from './db/client.js';
import { handleError } from './errors.js';
import { meRoutes } from './routes/me.js';
import { pricesRoutes } from './routes/prices.js';
import { productsRoutes } from './routes/products.js';
import { storesRoutes } from './routes/stores.js';

export interface AppOptions {
  db: Database;
  verifyToken: VerifyToken;
  corsOrigins?: string[];
  log?: boolean;
}

export function createApp({ db, verifyToken, corsOrigins = [], log = false }: AppOptions) {
  const app = new Hono<AppEnv>();

  app.onError(handleError);
  app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));
  if (log) app.use(logger());
  if (corsOrigins.length > 0) app.use(cors({ origin: corsOrigins }));

  return app
    .get('/health', (c) => c.json({ ok: true, message: 'API is running' }))
    .route('/stores', storesRoutes(db, verifyToken))
    .route('/products', productsRoutes(db, verifyToken))
    .route('/prices', pricesRoutes(db, verifyToken))
    .route('/me', meRoutes(db, verifyToken));
}

// Tipo de la API para el cliente RPC de Hono (`hc<AppType>`) en móvil y web.
export type AppType = ReturnType<typeof createApp>;

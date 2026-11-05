import { createStoreSchema } from '@caza-precios/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { asc, desc, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth, type AppEnv, type VerifyToken } from '../auth.js';
import type { Database } from '../db/client.js';
import { stores } from '../db/schema.js';
import { validationHook } from '../errors.js';

const storeColumns = { id: stores.id, name: stores.name, isDefault: stores.isDefault };

export function storesRoutes(db: Database, verifyToken: VerifyToken) {
  return new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db
        .select(storeColumns)
        .from(stores)
        .orderBy(desc(stores.isDefault), asc(sql`lower(${stores.name})`));
      return c.json(rows);
    })
    .post(
      '/',
      requireAuth(verifyToken),
      zValidator('json', createStoreSchema, validationHook),
      async (c) => {
        const { name } = c.req.valid('json');

        const [existing] = await db
          .select(storeColumns)
          .from(stores)
          .where(sql`lower(trim(${stores.name})) = lower(${name})`)
          .limit(1);
        if (existing) {
          return c.json({ error: 'Ya existe una tienda con ese nombre', store: existing }, 409);
        }

        const [store] = await db
          .insert(stores)
          .values({ name, createdBy: c.get('user').id })
          .returning(storeColumns);
        return c.json(store, 201);
      }
    );
}

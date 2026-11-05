import { createProductSchema } from '@caza-precios/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireAuth, type AppEnv, type VerifyToken } from '../auth.js';
import type { Database } from '../db/client.js';
import { currentPrices, type CurrentPrice } from '../db/queries.js';
import { prices, products, stores } from '../db/schema.js';
import { validationHook } from '../errors.js';
import { idParamSchema } from './params.js';

const productColumns = { id: products.id, name: products.name };

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const historyQuerySchema = z.object({
  storeId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// Escapa los comodines de LIKE para buscar el texto tal cual.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

function cheapestByProduct(rows: CurrentPrice[]) {
  const cheapest = new Map<string, CurrentPrice>();
  for (const row of rows) {
    const best = cheapest.get(row.productId);
    if (!best || row.price < best.price) cheapest.set(row.productId, row);
  }
  return cheapest;
}

async function findProduct(db: Database, id: string) {
  const [product] = await db.select(productColumns).from(products).where(eq(products.id, id));
  if (!product) throw new HTTPException(404, { message: 'Producto no encontrado' });
  return product;
}

export function productsRoutes(db: Database, verifyToken: VerifyToken) {
  return new Hono<AppEnv>()
    .get('/', zValidator('query', listQuerySchema, validationHook), async (c) => {
      const { search, limit, offset } = c.req.valid('query');

      const rows = await db
        .select(productColumns)
        .from(products)
        .where(search ? ilike(products.name, `%${escapeLike(search)}%`) : undefined)
        .orderBy(asc(sql`lower(${products.name})`))
        .limit(limit)
        .offset(offset);

      const cheapest = cheapestByProduct(await currentPrices(db, rows.map((row) => row.id)));

      return c.json(
        rows.map((product) => {
          const best = cheapest.get(product.id);
          return {
            ...product,
            cheapest: best
              ? { price: best.price, storeId: best.storeId, storeName: best.storeName, observedAt: best.observedAt }
              : null,
          };
        })
      );
    })
    .post(
      '/',
      requireAuth(verifyToken),
      zValidator('json', createProductSchema, validationHook),
      async (c) => {
        const { name } = c.req.valid('json');

        const [existing] = await db
          .select(productColumns)
          .from(products)
          .where(sql`lower(trim(${products.name})) = lower(${name})`)
          .limit(1);
        if (existing) {
          return c.json({ error: 'Ya existe un producto con ese nombre', product: existing }, 409);
        }

        const [product] = await db
          .insert(products)
          .values({ name, createdBy: c.get('user').id })
          .returning(productColumns);
        return c.json(product, 201);
      }
    )
    .get('/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
      const product = await findProduct(db, c.req.valid('param').id);
      const current = await currentPrices(db, [product.id]);
      current.sort((a, b) => a.price - b.price);

      return c.json({
        ...product,
        prices: current.map(({ productId: _productId, ...price }) => price),
      });
    })
    .get(
      '/:id/history',
      zValidator('param', idParamSchema, validationHook),
      zValidator('query', historyQuerySchema, validationHook),
      async (c) => {
        const product = await findProduct(db, c.req.valid('param').id);
        const { storeId, limit } = c.req.valid('query');

        const history = await db
          .select({
            id: prices.id,
            storeId: prices.storeId,
            storeName: stores.name,
            price: prices.price,
            observedAt: prices.observedAt,
            imagePath: prices.imagePath,
            userId: prices.userId,
          })
          .from(prices)
          .innerJoin(stores, eq(stores.id, prices.storeId))
          .where(
            and(eq(prices.productId, product.id), storeId ? eq(prices.storeId, storeId) : undefined)
          )
          .orderBy(desc(prices.observedAt), desc(prices.createdAt))
          .limit(limit);

        return c.json({ ...product, history });
      }
    );
}

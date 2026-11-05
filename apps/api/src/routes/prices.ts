import { createPriceSchema, updatePriceSchema } from '@caza-precios/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAuth, type AppEnv, type VerifyToken } from '../auth.js';
import type { Database } from '../db/client.js';
import { prices } from '../db/schema.js';
import { validationHook } from '../errors.js';
import { idParamSchema } from './params.js';

const priceColumns = {
  id: prices.id,
  productId: prices.productId,
  storeId: prices.storeId,
  userId: prices.userId,
  price: prices.price,
  imagePath: prices.imagePath,
  observedAt: prices.observedAt,
  createdAt: prices.createdAt,
};

// Solo quien registró un precio puede editarlo o borrarlo.
async function findOwnPrice(db: Database, id: string, userId: string) {
  const [price] = await db.select({ userId: prices.userId }).from(prices).where(eq(prices.id, id));
  if (!price) throw new HTTPException(404, { message: 'Precio no encontrado' });
  if (price.userId !== userId) {
    throw new HTTPException(403, { message: 'Solo puedes modificar los precios que registraste' });
  }
}

export function pricesRoutes(db: Database, verifyToken: VerifyToken) {
  return new Hono<AppEnv>()
    .use(requireAuth(verifyToken))
    .post('/', zValidator('json', createPriceSchema, validationHook), async (c) => {
      const { observedAt, ...input } = c.req.valid('json');

      const [price] = await db
        .insert(prices)
        .values({
          ...input,
          observedAt: observedAt ? new Date(observedAt) : undefined,
          userId: c.get('user').id,
        })
        .returning(priceColumns);
      return c.json(price, 201);
    })
    .patch(
      '/:id',
      zValidator('param', idParamSchema, validationHook),
      zValidator('json', updatePriceSchema, validationHook),
      async (c) => {
        const { id } = c.req.valid('param');
        const { observedAt, ...changes } = c.req.valid('json');
        await findOwnPrice(db, id, c.get('user').id);

        const [price] = await db
          .update(prices)
          .set({ ...changes, ...(observedAt && { observedAt: new Date(observedAt) }) })
          .where(eq(prices.id, id))
          .returning(priceColumns);
        return c.json(price);
      }
    )
    .delete('/:id', zValidator('param', idParamSchema, validationHook), async (c) => {
      const { id } = c.req.valid('param');
      await findOwnPrice(db, id, c.get('user').id);

      await db.delete(prices).where(eq(prices.id, id));
      return c.body(null, 204);
    });
}

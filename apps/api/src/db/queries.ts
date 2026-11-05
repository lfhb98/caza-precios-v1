import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from './client.js';
import { prices, stores } from './schema.js';

// Precio actual de cada producto en cada tienda: la observación más reciente
// por pareja (producto, tienda). Las anteriores quedan como historial.
export async function currentPrices(db: Database, productIds: string[]) {
  if (productIds.length === 0) return [];

  return db
    .selectDistinctOn([prices.productId, prices.storeId], {
      id: prices.id,
      productId: prices.productId,
      storeId: prices.storeId,
      storeName: stores.name,
      price: prices.price,
      observedAt: prices.observedAt,
      imagePath: prices.imagePath,
      userId: prices.userId,
    })
    .from(prices)
    .innerJoin(stores, eq(stores.id, prices.storeId))
    .where(inArray(prices.productId, productIds))
    .orderBy(prices.productId, prices.storeId, desc(prices.observedAt), desc(prices.createdAt));
}

export type CurrentPrice = Awaited<ReturnType<typeof currentPrices>>[number];

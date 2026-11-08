import type { AppType } from '@caza-precios/api';
import type { UpdatePriceInput } from '@caza-precios/shared/schemas';
import { hc, type InferResponseType } from 'hono/client';
import { getSession } from './supabase';

// Cliente tipado de la API (rutas, parámetros y respuestas salen de apps/api),
// como en apps/mobile/src/lib/api.ts. Las peticiones van a /api del mismo
// dominio y Next las reenvía a la API (rewrites en next.config.ts).
// El token solo se pide para las rutas que lo necesitan (las que escriben).
const publicApi = hc<AppType>('/api');
const authedApi = hc<AppType>('/api', {
  headers: async () => ({ Authorization: `Bearer ${(await getSession()).access_token}` }),
});

export type Store = InferResponseType<typeof publicApi.stores.$get, 200>[number];
export type ProductSummary = InferResponseType<typeof publicApi.products.$get, 200>[number];
export type ProductDetail = InferResponseType<(typeof publicApi.products)[':id']['$get'], 200>;
export type StorePrice = ProductDetail['prices'][number];
export type PriceHistory = InferResponseType<
  (typeof publicApi.products)[':id']['history']['$get'],
  200
>['history'];

export class ApiError extends Error {}

async function toError(response: { status: number; json(): Promise<unknown> }) {
  try {
    const body = (await response.json()) as { error?: string };
    return new ApiError(body.error ?? `Error ${response.status}`);
  } catch {
    return new ApiError(`Error ${response.status}`);
  }
}

// Mensaje para mostrar al usuario a partir de cualquier error.
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.startsWith('No se pudo iniciar sesión')) {
    return error.message;
  }
  return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
}

export { existingUserId } from './supabase';

// --- Tiendas ---

export async function fetchStores(): Promise<Store[]> {
  const response = await publicApi.stores.$get();
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

// Crea la tienda; si ya existe (409), devuelve la existente con `existed: true`.
export async function createStore(name: string) {
  const response = await authedApi.stores.$post({ json: { name } });
  if (response.status === 201) return { store: await response.json(), existed: false };
  if (response.status === 409) return { store: (await response.json()).store, existed: true };
  throw await toError(response);
}

// --- Productos ---

export async function searchProducts(search: string): Promise<ProductSummary[]> {
  const response = await publicApi.products.$get({
    query: search.trim() ? { search: search.trim(), limit: '100' } : { limit: '100' },
  });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function fetchProduct(id: string): Promise<ProductDetail> {
  const response = await publicApi.products[':id'].$get({ param: { id } });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function fetchHistory(id: string): Promise<PriceHistory> {
  const response = await publicApi.products[':id'].history.$get({ param: { id }, query: {} });
  if (response.status !== 200) throw await toError(response);
  return (await response.json()).history;
}

// Crea el producto; si ya existe (409), devuelve el existente con `existed: true`.
export async function createProduct(name: string) {
  const response = await authedApi.products.$post({ json: { name } });
  if (response.status === 201) return { product: await response.json(), existed: false };
  if (response.status === 409) return { product: (await response.json()).product, existed: true };
  throw await toError(response);
}

// --- Precios ---

export async function createPrice(input: { productId: string; storeId: string; price: number }) {
  const response = await authedApi.prices.$post({ json: input });
  if (response.status !== 201) throw await toError(response);
  return response.json();
}

export async function updatePrice(id: string, changes: UpdatePriceInput) {
  const response = await authedApi.prices[':id'].$patch({ param: { id }, json: changes });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function deletePrice(id: string) {
  const response = await authedApi.prices[':id'].$delete({ param: { id } });
  if (response.status !== 204) throw await toError(response);
}

import type { AppType } from '@caza-precios/api';
import type { UpdatePriceInput } from '@caza-precios/shared/schemas';
import { hc, type InferResponseType } from 'hono/client';
import { API_URL } from './config';
import { getSession } from './supabase';

// Cliente tipado de la API: las rutas, parámetros y respuestas salen de apps/api.
const api = hc<AppType>(API_URL, {
  headers: async () => ({ Authorization: `Bearer ${(await getSession()).access_token}` }),
});

export type Store = InferResponseType<typeof api.stores.$get, 200>[number];
export type ProductSummary = InferResponseType<typeof api.products.$get, 200>[number];
export type ProductDetail = InferResponseType<(typeof api.products)[':id']['$get'], 200>;
export type StorePrice = ProductDetail['prices'][number];

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

export async function currentUserId() {
  return (await getSession()).user.id;
}

export async function fetchStores(): Promise<Store[]> {
  const response = await api.stores.$get();
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function fetchProducts(ids: string[]): Promise<ProductSummary[]> {
  if (ids.length === 0) return [];
  const response = await api.products.$get({ query: { ids: ids.join(',') } });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function fetchProduct(id: string): Promise<ProductDetail> {
  const response = await api.products[':id'].$get({ param: { id } });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

// Crea el producto o, si ya existe (409), devuelve el existente.
export async function createOrGetProduct(name: string) {
  const response = await api.products.$post({ json: { name } });
  if (response.status === 201) return response.json();
  if (response.status === 409) return (await response.json()).product;
  throw await toError(response);
}

// Crea la tienda o, si ya existe (409), devuelve la existente.
export async function createOrGetStore(name: string) {
  const response = await api.stores.$post({ json: { name } });
  if (response.status === 201) return response.json();
  if (response.status === 409) return (await response.json()).store;
  throw await toError(response);
}

export async function createPrice(input: { productId: string; storeId: string; price: number }) {
  const response = await api.prices.$post({ json: input });
  if (response.status !== 201) throw await toError(response);
  return response.json();
}

export async function updatePrice(id: string, changes: UpdatePriceInput) {
  const response = await api.prices[':id'].$patch({ param: { id }, json: changes });
  if (response.status !== 200) throw await toError(response);
  return response.json();
}

export async function deletePrice(id: string) {
  const response = await api.prices[':id'].$delete({ param: { id } });
  if (response.status !== 204) throw await toError(response);
}

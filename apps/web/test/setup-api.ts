import path from 'node:path';
import { createTestContext } from '@caza-precios/api/testing';
import { vi } from 'vitest';

// La web habla con la API real (createApp de apps/api) sobre un Postgres en
// memoria (PGlite), sin red ni Supabase: `fetch('/api/...')` del navegador se
// redirige a `app.request(...)`, igual que haría el rewrite de next.config.ts.
export async function startApi() {
  // Vitest se ejecuta desde apps/web.
  const ctx = await createTestContext({
    migrationsFolder: path.resolve(process.cwd(), '../api/drizzle'),
  });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api/')) throw new Error(`Petición inesperada a ${url}`);
    return ctx.app.request(url.slice('/api'.length), init);
  });
  vi.stubGlobal('fetch', fetchMock);

  // Peticiones que ha hecho la web, como "MÉTODO /ruta" (sin query).
  const calls = () =>
    fetchMock.mock.calls.map(([input, init]) => {
      const url = String(input).split('?')[0].slice('/api'.length);
      return `${init?.method ?? 'GET'} ${url}`;
    });

  return { ...ctx, fetchMock, calls };
}

export type TestApi = Awaited<ReturnType<typeof startApi>>;

export type TestUser = { id: string; token: string };

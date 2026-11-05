import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createApp } from '../src/create-app.js';
import * as schema from '../src/db/schema.js';

// Lo mínimo de Supabase que necesitan las migraciones para ejecutarse en PGlite.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create role anon;
  create role authenticated;
  -- Como en Supabase: el id del usuario sale de los claims del JWT de la petición.
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

interface RequestOptions {
  token?: string;
  body?: unknown;
}

export async function createTestContext() {
  const client = new PGlite();
  await client.exec(SUPABASE_STUB);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  // Supabase da estos permisos por defecto; RLS decide después qué filas.
  await client.exec(`
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  `);

  // En los tests el token es una cadena conocida; la verificación JWT real
  // se prueba aparte en auth.test.ts.
  const tokens = new Map<string, string>();
  const app = createApp({
    db,
    verifyToken: async (token) => {
      const id = tokens.get(token);
      if (!id) throw new Error('Token desconocido');
      return { id };
    },
  });

  // Simula un registro en Supabase Auth: el trigger crea el perfil.
  async function createUser(username?: string) {
    const id = randomUUID();
    await client.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [
      id,
      JSON.stringify(username ? { username } : {}),
    ]);
    const token = `token-${id}`;
    tokens.set(token, id);
    return { id, token };
  }

  async function request(method: string, path: string, { token, body }: RequestOptions = {}) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await app.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const json: any = text ? JSON.parse(text) : null;
    return { status: response.status, body: json };
  }

  return { client, createUser, request, close: () => client.close() };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

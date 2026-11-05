import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema.js';

// Cualquier base de datos Postgres de Drizzle con nuestro esquema:
// postgres-js en producción, PGlite en los tests.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDatabase(url: string) {
  // prepare: false → compatible con el pooler de Supabase en modo transacción.
  const client = postgres(url, { prepare: false });
  return {
    db: drizzle({ client, schema }) as Database,
    close: () => client.end(),
  };
}

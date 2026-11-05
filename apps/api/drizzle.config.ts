import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Solo `db:migrate` necesita la URL; `db:generate` funciona sin base de datos.
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // Los roles anon/authenticated ya existen en Supabase: no los gestiona drizzle-kit.
  entities: { roles: { provider: 'supabase' } },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Como en apps/api: los paquetes del workspace se leen desde su TypeScript
// (condición `source`), sin compilar packages/shared.
const conditions = ['source', 'module', 'browser', 'development|production'];

export default defineConfig({
  resolve: {
    conditions,
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssr: { resolve: { conditions, externalConditions: ['source', 'node'] } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    // Cada test arranca su propio Postgres en memoria (PGlite) y aplica las migraciones.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

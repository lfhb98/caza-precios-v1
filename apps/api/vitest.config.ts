import { defineConfig } from 'vitest/config';

// Los tests leen el TypeScript de los paquetes del workspace (condición `source`
// de sus `exports`), igual que `pnpm api`: no hace falta compilar packages/shared.
const conditions = ['source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: ['source', 'node'] } },
});

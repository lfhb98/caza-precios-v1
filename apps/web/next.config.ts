import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(import.meta.dirname, '../..');

// URL de la API a la que se reenvían las peticiones a /api/* (ver README).
const apiUrl = process.env.API_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
    // `@caza-precios/shared` exporta `dist/` para Node; aquí usamos siempre el
    // TypeScript de `src/` (igual que Metro y tsc), así no hay que compilarlo.
    resolveAlias: {
      '@caza-precios/shared': '../../packages/shared/src/index.ts',
      '@caza-precios/shared/schemas': '../../packages/shared/src/schemas.ts',
      // Los componentes compartidos con el móvil (@caza-precios/ui) están hechos
      // con React Native; en la web se pintan con react-native-web.
      'react-native': 'react-native-web',
    },
  },
  // El navegador llama a /api/* en el mismo dominio y Next lo reenvía a la API:
  // sin CORS y sin exponer la URL de la API en el código del cliente.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;

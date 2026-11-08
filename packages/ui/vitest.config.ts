import { defineConfig } from 'vitest/config';

// Los componentes usan React Native; en los tests (jsdom) se pintan con
// react-native-web, igual que en la web.
const conditions = ['source', 'module', 'browser', 'development|production'];

export default defineConfig({
  resolve: {
    conditions,
    alias: { 'react-native': 'react-native-web' },
  },
  ssr: { resolve: { conditions, externalConditions: ['source', 'node'] } },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});

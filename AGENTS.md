# Monorepo CazaPrecios

npm workspaces. Ejecuta `npm install` siempre desde la raíz (hay un único `package-lock.json`).

- `apps/mobile` — app Expo (ver `apps/mobile/AGENTS.md`). Los comandos `expo` y `eas` se ejecutan desde esa carpeta.
- `packages/shared` — tipos y constantes compartidos (`@caza-precios/shared`). Exporta TypeScript sin compilar; Metro y `tsc` lo consumen directamente.

Reglas:

- Las dependencias de una app se declaran en el `package.json` de esa app, no en la raíz.
- `packages/shared` no debe depender de `react` ni `react-native`: una sola versión de cada una en todo el monorepo.
- Para dependencias entre workspaces usa `"@caza-precios/<paquete>": "*"`.

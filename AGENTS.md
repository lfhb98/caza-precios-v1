# Monorepo CazaPrecios

pnpm workspaces (`pnpm-workspace.yaml`). Ejecuta `pnpm install` siempre desde la raíz (hay un único `pnpm-lock.yaml`). Explicación y comandos en `README.md`.

- `apps/mobile` — app Expo (ver `apps/mobile/AGENTS.md`). Los comandos `expo` y `eas` se ejecutan desde esa carpeta, con `pnpm exec expo ...` o `pnpm dlx eas-cli@latest ...`.
- `packages/shared` — tipos y constantes compartidos (`@caza-precios/shared`). Exporta TypeScript sin compilar; Metro y `tsc` lo consumen directamente.

Antes de dar una tarea por terminada: `pnpm check` desde la raíz.

Reglas:

- Las dependencias de una app se declaran en el `package.json` de esa app, no en la raíz.
- `packages/shared` no debe depender de `react` ni `react-native`: una sola versión de cada una en todo el monorepo.
- Para dependencias entre workspaces usa `"@caza-precios/<paquete>": "workspace:*"`.

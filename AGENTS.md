# Monorepo CazaPrecios

pnpm workspaces (`pnpm-workspace.yaml`). Ejecuta `pnpm install` siempre desde la raíz (hay un único `pnpm-lock.yaml`). Explicación y comandos en `README.md`.

- `apps/mobile` — app Expo (ver `apps/mobile/AGENTS.md`). Los comandos `expo` y `eas` se ejecutan desde esa carpeta, con `pnpm exec expo ...` o `pnpm dlx eas-cli@latest ...`.
- `apps/api` — backend Hono + Drizzle + Supabase (ver `apps/api/README.md`). Los cambios de esquema van en `src/db/schema.ts` + `pnpm api:db:generate`; nunca edites a mano una migración ya aplicada.
- `packages/shared` — constantes (`@caza-precios/shared`) y esquemas Zod (`@caza-precios/shared/schemas`). Metro, `tsc`, `pnpm api` (tsx con `--conditions=source`) y Vitest consumen el TypeScript de `src/`; solo Node en producción (Vercel) usa `dist/`, que compila `pnpm --filter @caza-precios/shared build`. Si añades una entrada nueva a sus `exports`, añádela también al script `build`. Imports internos sin extensión (Metro no resuelve `.js` → `.ts`).
- Despliegue de la API: Vercel (ver `apps/api/README.md`), siempre desde la raíz del monorepo.

Antes de dar una tarea por terminada: `pnpm check` desde la raíz.

Reglas:

- Las dependencias de una app se declaran en el `package.json` de esa app, no en la raíz.
- `packages/shared` no debe depender de `react` ni `react-native`: una sola versión de cada una en todo el monorepo.
- Para dependencias entre workspaces usa `"@caza-precios/<paquete>": "workspace:*"`.

Supabase:

- Las migraciones las gestiona **drizzle-kit** (`apps/api/drizzle/`), no la CLI de Supabase. Ignora las indicaciones de la skill `supabase` sobre `supabase migration new`, `supabase db pull` o `apply_migration`: crearían un historial paralelo. SQL que Drizzle no genera (triggers, datos iniciales) → migración custom de drizzle-kit (ver `apps/api/README.md`).
- El MCP de Supabase (`.mcp.json`) apunta al proyecto del dueño del repositorio: antes de escribir en la base de datos (DDL, `execute_sql` que modifique datos), pide confirmación.
- Los usuarios anónimos tienen el rol `authenticated`: tenlo en cuenta al escribir políticas RLS.

# CazaPrecios

Comparador de precios de supermercado: guardas lo que cuesta cada producto en cada tienda (con foto de la etiqueta) y la app te dice dónde está más barato.

## Estructura

Este repositorio es un **monorepo**: varios proyectos relacionados viven juntos y se gestionan con [pnpm workspaces](https://pnpm.io/workspaces).

```
caza-precios/
├─ apps/
│  ├─ api/           Backend: Hono + Drizzle + Supabase         @caza-precios/api
│  └─ mobile/        App Expo / React Native (iOS y Android)    @caza-precios/mobile
├─ packages/
│  └─ shared/        Constantes y esquemas Zod compartidos      @caza-precios/shared
├─ package.json      Scripts para todo el monorepo
├─ pnpm-workspace.yaml
└─ pnpm-lock.yaml    Único lockfile para todos los proyectos
```

Previsto: `apps/web` (frontend web). Cómo configurar y arrancar la API: [`apps/api/README.md`](apps/api/README.md).

## ¿Por qué un monorepo?

Hasta ahora CazaPrecios era solo una app móvil que guardaba todo en el teléfono. Los siguientes pasos son un **backend** (sincronizar datos, cuentas de usuario, fotos en la nube) y una **versión web**. Son tres proyectos que hablan el mismo idioma: productos, precios y supermercados.

- **Una sola definición de los datos.** Los esquemas de validación y la lista de supermercados viven en `packages/shared`, y la app móvil usa los tipos de la API directamente (cliente tipado de Hono). Si cambia un campo, TypeScript marca el error en el móvil, la web y la API a la vez, antes de ejecutar nada.
- **Cambios atómicos.** Añadir un campo nuevo (por ejemplo, la fecha del precio) toca API, móvil y web. En un monorepo es un solo commit y un solo Pull Request, sin coordinar versiones entre repositorios.
- **Una instalación, un lockfile, unos comandos.** `pnpm install` en la raíz prepara todo; `pnpm typecheck` revisa todos los proyectos.
- **Sin publicar paquetes.** `@caza-precios/shared` no se sube a npm: pnpm lo enlaza localmente (`workspace:*`).

Costes, para ser honestos:

- Un poco más de configuración inicial (workspaces, scripts con `--filter`).
- Expo y EAS se ejecutan desde `apps/mobile`, no desde la raíz.
- Hay que vigilar que no haya dos versiones de `react` o `react-native` (ver [Reglas](#reglas)).

### ¿Por qué pnpm?

- **Dependencias estrictas:** cada proyecto solo puede importar lo que declara en su `package.json`. Con npm, un paquete olvidado podía funcionar "por casualidad" en local y romper en EAS Build o en otro ordenador.
- Más rápido y ocupa menos disco: cada versión de un paquete se guarda una sola vez en el equipo.
- Expo lo soporta oficialmente en monorepos (sin `metro.config.js` personalizado desde SDK 52).

## Requisitos

- **Node.js** (versión LTS actual).
- **pnpm**, la versión indicada en `packageManager` de `package.json`. Desde Node 25 Corepack ya no viene incluido; instálalo con:

  ```bash
  npm install -g pnpm
  ```

- Para probar la app: **Expo Go** en el móvil, o un emulador Android / simulador iOS.

## Primeros pasos

```bash
git clone <url-del-repo>
cd caza-precios-v1
pnpm install        # siempre desde la raíz
```

Si pnpm avisa de scripts de compilación ignorados, revisa la lista y apruébalos con `pnpm approve-builds` solo si reconoces los paquetes.

La app móvil necesita la API, y las dos necesitan el proyecto de Supabase:

1. **Supabase** (una vez): en Authentication → Sign In / Providers, activa **Allow anonymous sign-ins**. La app crea un usuario anónimo al abrirse, sin pantalla de login.
2. **API:** configura `apps/api/.env` (ver [`apps/api/README.md`](apps/api/README.md)) y arráncala:

   ```bash
   pnpm api
   ```

3. **App:** copia `apps/mobile/.env.example` como `apps/mobile/.env`, rellena la URL y la *publishable key* de Supabase, y arranca Expo en otra terminal:

   ```bash
   pnpm mobile         # escanea el QR con el móvil (misma red Wi-Fi que el ordenador)
   ```

   En desarrollo la app busca la API en el mismo ordenador que ejecuta Expo, en el puerto 3000. Si tu firewall bloquea ese puerto, el móvil no podrá conectar: permite Node.js en redes privadas.

### Cómo usa la app la API

- **Mi lista** se guarda en el móvil: son los productos del catálogo compartido que te interesan. Al añadir uno que ya existe, se reutiliza; la papelera solo lo quita de tu lista.
- Los **precios son de la comunidad**: cada local muestra su precio más reciente. Solo puedes editar o borrar los que registraste tú.
- Las **fotos** de las etiquetas están desactivadas hasta que la subida a Supabase Storage esté lista.

## Scripts (desde la raíz)

| Comando | Qué hace |
|---|---|
| `pnpm api` | Arranca la API en modo desarrollo (necesita `apps/api/.env`) |
| `pnpm api:test` | Tests de la API (Postgres en memoria, no necesita Supabase) |
| `pnpm api:db:generate` | Genera una migración a partir de `apps/api/src/db/schema.ts` |
| `pnpm api:db:migrate` | Aplica las migraciones pendientes a la base de datos de `DATABASE_URL` |
| `pnpm mobile` | Arranca el servidor de desarrollo de Expo |
| `pnpm mobile:android` | Igual, abriendo directamente el emulador Android |
| `pnpm mobile:ios` | Igual, abriendo el simulador iOS (solo macOS) |
| `pnpm mobile:web` | Igual, en el navegador |
| `pnpm mobile:doctor` | Diagnóstico de Expo (versiones y configuración) |
| `pnpm typecheck` | TypeScript en todos los proyectos |
| `pnpm test` | Tests de todos los proyectos que los tengan |
| `pnpm lint` | Lint en todos los proyectos (ESLint aún no está configurado en `mobile`: la primera vez ofrecerá instalarlo) |
| `pnpm check` | `typecheck` + `test` + `mobile:doctor`; pásalo antes de abrir un Pull Request |

Cómo funcionan por dentro:

- `pnpm --filter <paquete> run <script>` ejecuta un script en un proyecto concreto.
- `pnpm -r run <script>` lo ejecuta en todos los proyectos que lo tengan (`--if-present` salta los que no).

## Trabajar con los proyectos

### Añadir dependencias

Cada dependencia se declara en el proyecto que la usa, nunca en la raíz:

```bash
# Librerías de Expo / React Native: usar expo install (elige la versión compatible con el SDK)
cd apps/mobile
pnpm exec expo install expo-camera

# Cualquier otra librería, desde la raíz
pnpm --filter @caza-precios/shared add -D typescript
```

### Usar el paquete compartido

En el `package.json` del proyecto que lo necesite:

```json
"@caza-precios/shared": "workspace:*"
```

Y en el código:

```ts
import { DEFAULT_STORES } from '@caza-precios/shared';            // constantes
import { createPriceSchema } from '@caza-precios/shared/schemas';  // validación con Zod
```

Los esquemas van en una entrada aparte para que la app móvil no cargue Zod (unos 0,7 MB en el bundle) hasta que los use.

`packages/shared` exporta TypeScript sin compilar; Metro, `tsx` y `tsc` lo leen directamente. Sus imports internos van **sin extensión** (`./stores`, no `./stores.js`): Metro no resuelve `.js` a `.ts`.

### Herramientas sueltas

- `pnpm exec <cmd>`: herramienta ya instalada en el proyecto (equivale a `npx` con algo instalado).
- `pnpm dlx <cmd>`: descarga y ejecuta sin instalar (equivale a `npx paquete@latest`).

## Builds con EAS

Todos los comandos de EAS se ejecutan **dentro de `apps/mobile`**, donde está `eas.json`:

```bash
cd apps/mobile
pnpm dlx eas-cli@latest build -p android --profile preview   # APK para instalar en un móvil
```

| Perfil | Resultado |
|---|---|
| `development` | APK de desarrollo (necesita el servidor de Expo arrancado) |
| `preview` | APK instalable para pruebas internas |
| `production` | AAB para Google Play |

El proyecto EAS (`extra.eas.projectId` en `app.json`) pertenece a la cuenta de Expo del propietario. Para compilar necesitas que te añada a su cuenta u organización en expo.dev; no lo compiles con una cuenta propia, porque las credenciales de firma (keystore) deben quedar en la suya.

## Agentes de IA (Claude Code y otros)

El repositorio incluye configuración para trabajar con agentes:

- **`AGENTS.md`**: reglas del proyecto para cualquier agente (hay uno en la raíz y otro en `apps/mobile`).
- **`.mcp.json`**: servidor MCP de Supabase limitado a este proyecto. La primera vez, aprueba el servidor al abrir Claude Code y autentícate con `/mcp` → `supabase` usando una cuenta con acceso a la organización del proyecto. No contiene credenciales.
- **Skills de Supabase** en `.agents/skills/` (versión fijada en `skills-lock.json`). Para que Claude Code las vea, crea los enlaces locales una vez:

  ```bash
  npx skills add supabase/agent-skills
  ```

  Los enlaces (`.claude/skills/`) no se suben a git: en Windows sin `core.symlinks` se convertirían en copias.

## Reglas

- `pnpm install` solo desde la raíz. No crees `package-lock.json` ni lockfiles dentro de `apps/*`.
- Las dependencias de cada app van en su `package.json`, no en la raíz.
- `packages/shared` no depende de `react` ni `react-native`: debe haber una sola versión de cada una en todo el monorepo (compruébalo con `pnpm why react-native`).
- Entre proyectos del monorepo, siempre `"workspace:*"`.
- `ios/` y `android/` se generan (Continuous Native Generation) y están ignorados por git: la configuración nativa va en `app.json`.

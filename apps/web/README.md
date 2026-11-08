# Web de CazaPrecios

SPA hecha con [Next.js](https://nextjs.org) (App Router): una sola página donde se ven los productos con su precio más barato, el precio actual en cada tienda y su historial, y se registran, corrigen y borran precios. También se pueden añadir productos y tiendas, y entrar con tu email.

## Puesta en marcha

```bash
cp .env.example .env.local    # dentro de apps/web; rellena la URL y la publishable key de Supabase
pnpm api                      # desde la raíz, en una terminal (API en el puerto 3000)
pnpm web                      # desde la raíz, en otra (web en http://localhost:3001)
```

Para usar la API desplegada en vez de la local, pon `API_URL=https://caza-precios-api.vercel.app` en `.env.local`.

## Cómo funciona

- **Entrar es opcional.** Sin entrar, igual que la app móvil: al registrar algo por primera vez, el navegador crea un usuario anónimo de Supabase (se guarda en `localStorage`). Solo leer no crea usuario.
- **Login con email y código** (botón *Entrar* de la cabecera). Solo se pide el email; Supabase envía un código y con él se entra, sin contraseña. Si ya tenías un usuario anónimo, pasa a ser tu cuenta y conservas tus precios. Con la cuenta ves como tuyos los precios que registraste en otros dispositivos. El formulario es el mismo componente que el del móvil: está en [`packages/ui`](../../packages/ui/README.md), donde también se explica qué hay que configurar en Supabase.
- **API por `/api/*`.** El navegador llama a `/api/...` en el mismo dominio y Next lo reenvía a `API_URL` (`rewrites` en `next.config.ts`). Así no hace falta configurar CORS en la API.
- **Cliente tipado.** `src/lib/api.ts` usa `hc<AppType>` de Hono, como `apps/mobile/src/lib/api.ts`: si cambia una ruta de la API, TypeScript avisa en la web.
- **Código compartido con el móvil** (`@caza-precios/shared`): formato de precios y fechas, colores de la marca (variables CSS `--primary`, `--cheapest`... generadas en `src/app/layout.tsx`) y los esquemas Zod, con los que se valida el precio antes de enviarlo.

### ¿Qué componentes comparte con el móvil?

Los que viven en `packages/ui`, de momento el login. Están hechos con React Native y Next los pinta con `react-native-web` (`'react-native': 'react-native-web'` en `resolveAlias` de `next.config.ts`; lo mismo en `vitest.config.ts`).

Las pantallas del móvil (`apps/mobile/src/app`) no se reutilizan: dependen de `expo-router`, `Alert`, `Modal`, `Animated` y `AsyncStorage`. Para compartir una de ellas habría que sacar la parte reutilizable a `packages/ui` sin esas dependencias. Del resto se comparte la lógica (cliente de la API, formato, validación, colores).

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx     HTML base y colores de la marca como variables CSS
│  ├─ page.tsx       La única página: monta <CazaPreciosApp />
│  └─ globals.css    Estilos (sin librerías)
├─ components/
│  ├─ caza-precios-app.tsx  Pestañas Productos / Tiendas, "Mi cuenta" y producto seleccionado
│  ├─ product-list.tsx      Buscar y crear productos
│  ├─ product-detail.tsx    Precios por tienda, registrar precio e historial
│  ├─ price-row.tsx         Editar y borrar un precio propio
│  └─ stores-panel.tsx      Ver y crear tiendas
└─ lib/
   ├─ api.ts         Cliente tipado de la API
   ├─ supabase.ts    Sesión de Supabase (anónima o con cuenta) y accountService
   └─ price.ts       Validación del precio con el esquema compartido
```

`next.config.ts` hace que Next lea `packages/shared/src` directamente (alias de Turbopack), así que no hace falta compilar `packages/shared` para la web.

## Tests

```bash
pnpm --filter @caza-precios/web test    # o `pnpm test` desde la raíz para todo el monorepo
```

No necesitan Supabase ni red. `test/account.test.tsx` comprueba el login dentro de la web: entrar, cerrar sesión y que al entrar en tu cuenta aparezcan como tuyos los precios registrados en otro dispositivo. `test/crud.test.tsx` pinta la web real (`<CazaPreciosApp />`) en jsdom con Testing Library, y sus llamadas a `/api/*` las responde **la API real** (`createApp`) sobre un Postgres en memoria, el mismo de los tests de la API (`@caza-precios/api/testing`). Solo se simula la sesión de Supabase. Cada test comprueba la pantalla y también lo que queda en la base de datos: leer, buscar, crear productos, tiendas y precios, editar, borrar, los permisos (solo tus precios) y la validación.

## Lo que la API aún no permite

- Renombrar o borrar productos y tiendas (solo crearlos).
- Subir fotos de las etiquetas.

## Despliegue

Producción: https://caza-precios-web.vercel.app

Es un proyecto de Vercel aparte del de la API (`caza-precios-web`), con *Root Directory* `apps/web` y preset Next.js. `vercel.json` instala solo la web y sus dependencias del monorepo (`--filter @caza-precios/web...`) y fija la región `dub1`, la misma que la API.

Variables (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `API_URL=https://caza-precios-api.vercel.app`. Next las fija **al compilar**: si cambias alguna, hay que volver a desplegar.

Se despliega desde la raíz del monorepo. Como `.vercel/project.json` de la raíz está enlazado a la API, se indica el proyecto con variables en vez de hacer `vercel link`:

```bash
VERCEL_ORG_ID=<id del equipo> VERCEL_PROJECT_ID=<id de caza-precios-web> pnpm dlx vercel deploy --prod
```

Los dos IDs están en el panel de Vercel (Settings del proyecto) o en `vercel project inspect caza-precios-web`.

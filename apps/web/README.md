# Web de CazaPrecios

SPA hecha con [Next.js](https://nextjs.org) (App Router): una sola página donde se ven los productos con su precio más barato, el precio actual en cada tienda y su historial, y se registran, corrigen y borran precios. También se pueden añadir productos y tiendas.

## Puesta en marcha

```bash
cp .env.example .env.local    # dentro de apps/web; rellena la URL y la publishable key de Supabase
pnpm api                      # desde la raíz, en una terminal (API en el puerto 3000)
pnpm web                      # desde la raíz, en otra (web en http://localhost:3001)
```

Para usar la API desplegada en vez de la local, pon `API_URL=https://caza-precios-api.vercel.app` en `.env.local`.

## Cómo funciona

- **Sin login.** Igual que la app móvil: al registrar algo por primera vez, el navegador crea un usuario anónimo de Supabase (se guarda en `localStorage`). Solo leer no crea usuario. Cada navegador es un usuario distinto, así que solo puedes editar los precios registrados desde ese navegador.
- **API por `/api/*`.** El navegador llama a `/api/...` en el mismo dominio y Next lo reenvía a `API_URL` (`rewrites` en `next.config.ts`). Así no hace falta configurar CORS en la API.
- **Cliente tipado.** `src/lib/api.ts` usa `hc<AppType>` de Hono, como `apps/mobile/src/lib/api.ts`: si cambia una ruta de la API, TypeScript avisa en la web.
- **Código compartido con el móvil** (`@caza-precios/shared`): formato de precios y fechas, colores de la marca (variables CSS `--primary`, `--cheapest`... generadas en `src/app/layout.tsx`) y los esquemas Zod, con los que se valida el precio antes de enviarlo.

### ¿Por qué no reutiliza los componentes de React Native?

Se valoró usar `react-native-web` dentro de Next, pero las pantallas del móvil son pantallas completas que dependen de `expo-router`, `Alert`, `Modal`, `Animated` y `AsyncStorage`, y los componentes sueltos (`ThemedText`, `ThemedView`...) son restos de la plantilla de Expo que las pantallas no usan. Reutilizarlos obligaría a configurar `react-native-web` en Next y a refactorizar el móvil, para ganar poco. Se comparte la lógica (cliente de la API, formato, validación, colores) y la interfaz de cada plataforma es nativa de esa plataforma.

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx     HTML base y colores de la marca como variables CSS
│  ├─ page.tsx       La única página: monta <CazaPreciosApp />
│  └─ globals.css    Estilos (sin librerías)
├─ components/
│  ├─ caza-precios-app.tsx  Pestañas Productos / Tiendas y producto seleccionado
│  ├─ product-list.tsx      Buscar y crear productos
│  ├─ product-detail.tsx    Precios por tienda, registrar precio e historial
│  ├─ price-row.tsx         Editar y borrar un precio propio
│  └─ stores-panel.tsx      Ver y crear tiendas
└─ lib/
   ├─ api.ts         Cliente tipado de la API
   ├─ supabase.ts    Sesión anónima de Supabase
   └─ price.ts       Validación del precio con el esquema compartido
```

`next.config.ts` hace que Next lea `packages/shared/src` directamente (alias de Turbopack), así que no hace falta compilar `packages/shared` para la web.

## Tests

```bash
pnpm --filter @caza-precios/web test    # o `pnpm test` desde la raíz para todo el monorepo
```

No necesitan Supabase ni red. `test/crud.test.tsx` pinta la web real (`<CazaPreciosApp />`) en jsdom con Testing Library, y sus llamadas a `/api/*` las responde **la API real** (`createApp`) sobre un Postgres en memoria, el mismo de los tests de la API (`@caza-precios/api/testing`). Solo se simula la sesión de Supabase. Cada test comprueba la pantalla y también lo que queda en la base de datos: leer, buscar, crear productos, tiendas y precios, editar, borrar, los permisos (solo tus precios) y la validación.

## Lo que la API aún no permite

- Renombrar o borrar productos y tiendas (solo crearlos).
- Subir fotos de las etiquetas.

## Despliegue (pendiente)

En Vercel sería un proyecto aparte con *Root Directory* `apps/web` y preset Next.js, con las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `API_URL`.

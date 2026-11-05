# API de CazaPrecios

Backend HTTP de CazaPrecios: catálogo de productos y tiendas, y precios compartidos por la comunidad con historial.

**Stack:** [Hono](https://hono.dev) (servidor) · [Zod](https://zod.dev) (validación) · [Drizzle ORM](https://orm.drizzle.team) (base de datos) · PostgreSQL y Auth de [Supabase](https://supabase.com).

El diseño de la base de datos (tablas, relaciones y permisos) está explicado en `docs/database.md`.

## Puesta en marcha

### 1. Proyecto de Supabase (lo crea el dueño del proyecto)

1. Crear el proyecto en supabase.com.
2. Comprobar que usa **claves de firma JWT asimétricas** (Project Settings → JWT Keys). La API verifica los tokens con las claves públicas de `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`; con el secreto HS256 antiguo esa lista está vacía y todas las peticiones con sesión darían 401.

### 2. Variables de entorno

```bash
cp .env.example .env    # dentro de apps/api
```

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Supabase (Connect). Para la API, el *pooler* en modo transacción (puerto 6543). |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `PORT` | Puerto de la API (por defecto 3000) |
| `CORS_ORIGINS` | Orígenes del frontend web, separados por comas. La app móvil no lo necesita. |

Si falta alguna o es inválida, la API no arranca y dice cuál.

### 3. Crear las tablas

```bash
pnpm api:db:migrate     # desde la raíz
```

Las migraciones crean las tablas, los índices, las políticas RLS, el trigger que crea el perfil al registrarse y las tiendas por defecto. Para las migraciones usa la conexión directa o el pooler en modo **sesión** (puerto 5432): el modo transacción no es adecuado para cambios de esquema.

### 4. Arrancar

```bash
pnpm api                # desarrollo, se reinicia al guardar
```

## Endpoints

🔒 = requiere `Authorization: Bearer <access_token de Supabase>`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Comprueba que la API está viva |
| `GET` | `/stores` | Tiendas; las precargadas primero |
| `POST` 🔒 | `/stores` | Crea una tienda (`{ name }`). Si ya existe → 409 con la existente en `store` |
| `GET` | `/products?search=&limit=&offset=` | Productos con su precio más barato actual (`cheapest`, o `null`) |
| `POST` 🔒 | `/products` | Crea un producto (`{ name }`). Si ya existe → 409 con el existente en `product` |
| `GET` | `/products/:id` | Producto con el precio actual en cada tienda, de más barato a más caro |
| `GET` | `/products/:id/history?storeId=&limit=` | Historial de precios, del más reciente al más antiguo |
| `POST` 🔒 | `/prices` | Registra un precio (`{ productId, storeId, price, observedAt?, imagePath? }`) |
| `PATCH` 🔒 | `/prices/:id` | Corrige un precio propio |
| `DELETE` 🔒 | `/prices/:id` | Borra un precio propio |
| `GET` 🔒 | `/me` | Perfil del usuario con sesión |

Los esquemas de entrada están en `@caza-precios/shared/schemas`, para reutilizarlos en los formularios del móvil y la web.

### Respuestas de error

Siempre JSON con un campo `error`:

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos (`issues` indica qué campo y por qué), o el producto/tienda no existe |
| 401 | Sin token o token inválido/caducado |
| 403 | Intentar modificar un precio de otro usuario |
| 404 | El recurso no existe |
| 409 | Nombre de producto o tienda repetido (sin distinguir mayúsculas ni espacios) |

## Decisiones importantes

- **Precio actual = la observación más reciente** de cada producto en cada tienda, no la más barata. Si el arroz bajó y luego subió en Lidl, el precio actual de Lidl es el último. Las anteriores quedan en el historial.
- **Dinero en `numeric(10,2)`**, nunca `float`. La API lo devuelve como número JSON y acepta como máximo 2 decimales.
- **La API se conecta como propietaria de las tablas**, así que las políticas RLS no se le aplican: comprueba los permisos en las rutas (por ejemplo, solo el autor edita su precio). Las políticas RLS siguen activas para quien use el cliente de Supabase directamente; las dos capas aplican las mismas reglas y los tests comprueban ambas.
- **`observed_at` admite 5 minutos de margen** hacia el futuro, por relojes de móvil adelantados (el diseño original decía `<= now()`).

## Estructura

```
src/
├─ index.ts        Arranque: lee .env, conecta la base de datos, levanta el servidor
├─ app.ts          Construye la app Hono a partir de sus dependencias (BD, verificador de tokens)
├─ env.ts          Validación de variables de entorno
├─ auth.ts         Verificación de JWT de Supabase y middleware requireAuth
├─ errors.ts       Errores → respuestas HTTP (incluidos los de Postgres)
├─ db/
│  ├─ schema.ts    Tablas, índices y políticas RLS (Drizzle)
│  ├─ client.ts    Conexión a Postgres
│  └─ queries.ts   Consultas compartidas (precio actual por tienda)
└─ routes/         Una ruta por recurso
drizzle/           Migraciones SQL (generadas + 0001 escrita a mano)
test/              Tests con Vitest y Postgres en memoria (PGlite)
```

## Tests

```bash
pnpm api:test           # desde la raíz
```

No necesitan Supabase ni Docker: cada archivo de test arranca un Postgres en memoria con [PGlite](https://pglite.dev), simula lo mínimo de Supabase (`auth.users`, roles, `auth.uid()`) y aplica las migraciones reales. Cubren las rutas, el trigger de perfiles, las políticas RLS y la verificación de JWT.

## Cambiar el esquema

1. Editar `src/db/schema.ts`.
2. `pnpm api:db:generate` crea una migración nueva en `drizzle/`. Revisa el SQL antes de subirla.
3. `pnpm api:db:migrate` la aplica.

Para SQL que Drizzle no sabe generar (triggers, datos iniciales): `pnpm --filter @caza-precios/api exec drizzle-kit generate --custom --name <nombre>`.

## Pendiente

- **Fotos:** subida a Supabase Storage (bucket `price-images` del diseño). La API ya guarda `imagePath`, pero aún no gestiona la subida.
- **Despliegue:** elegir dónde (Railway, Fly.io, Render...) y un paso de build.
- **Clientes:** conectar el móvil con el cliente tipado de Hono (`hc<AppType>`, exportado en `src/app.ts`).

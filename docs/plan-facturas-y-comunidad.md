# Plan: facturas automáticas y precios de la comunidad

> Estado: **propuesta** (8 de noviembre de 2026). Las decisiones marcadas como *abiertas* son de lfhb98, dueño del proyecto.
> Protección de datos: ver [`proteccion-de-datos.md`](proteccion-de-datos.md). Varias tareas de este plan dependen de él.

## Objetivo

Llevar el control de lo que pagas y de lo que cuestan las cosas en cada tienda, con el mínimo esfuerzo:

1. **Subes una foto o un PDF de la factura** y la app saca la tienda, la fecha y la lista de productos con su precio. Tú revisas y confirmas.
2. **Tu historial de compras:** tus facturas, con productos, precios, fecha y tienda.
3. **Para la comunidad:** cada tienda con sus productos, el **precio medio** y el de **tu última compra**.
4. **En el futuro:** sugerir en qué tienda está más barato un producto, o tu lista de la compra entera.

## De dónde partimos

| Pieza | Estado | Dónde |
|---|---|---|
| API Hono + Drizzle, desplegada en Vercel (`dub1`) | ✅ | `apps/api` |
| Postgres y Auth en Supabase, migraciones con drizzle-kit | ✅ | `apps/api/drizzle` |
| Web Next.js (SPA), desplegada en Vercel | ✅ | `apps/web` |
| App móvil Expo | ✅ | `apps/mobile` |
| Usuarios anónimos (se crean al registrar algo sin entrar) | ✅ | `lib/supabase.ts` de cada app |
| **Login con email** (enlace o código), compartido web/móvil | ✅ en `feat/login` | `packages/ui` |
| Perfiles (`profiles`, nombre generado por trigger) | ✅ | `0001_profiles_trigger_and_default_stores.sql` |
| Tablas `products`, `stores`, `prices` (precio por tienda y fecha, historial) | ✅ | `apps/api/src/db/schema.ts` |
| `prices.image_path` (foto de la etiqueta) | 🟡 existe la columna, no se usa | — |
| Supabase Storage (subir archivos) | ❌ | — |
| Envío de emails (SMTP propio) | ❌ solo llegan a los miembros del proyecto | Panel de Supabase |
| Borrar o renombrar productos y tiendas | ❌ | — |

## ¿Lo permite la base de datos?

En parte. Lo que hay sirve de base; faltan tablas para la factura y datos para comparar bien.

| Necesidad | ¿Hoy? | Qué falta |
|---|---|---|
| Precio de un producto en una tienda y una fecha | ✅ `prices` | Nada: cada línea confirmada de una factura genera un `price` |
| Agrupar las líneas en una factura de un usuario | ❌ | Tablas `receipts` y `receipt_lines` |
| Guardar la foto o el PDF | ❌ | Bucket **privado** de Supabase Storage |
| Reconocer "LECHE ENT HACEND 1L" como "Leche entera" | ❌ | Tabla `product_aliases` |
| Comparar 1 L con 1,5 L, o fruta por kg | ❌ solo hay precio total | `products.unit` y `products.size`; `receipt_lines.quantity` |
| Descuentos ("2ª unidad -50 %") | ⚠️ el `check price > 0` rechaza líneas negativas | Aplicar el descuento a su línea antes de guardar |
| Precio medio por tienda y producto | ✅ con SQL sobre `prices` | Ruta nueva; índice `(store_id, product_id, observed_at)` |
| "Tu última compra" | ✅ último `price` tuyo | Ruta nueva (solo te la devuelve a ti) |
| Facturas solo de cuentas reales | ✅ el JWT trae `is_anonymous` | Exigirlo en la API y en RLS |

## Modelo de datos propuesto

```
profiles 1──n receipts 1──n receipt_lines n──1 products
                 │                 │
                 n                 └──1 prices   (la observación pública que genera)
                 1
               stores

products 1──n product_aliases n──1 stores (opcional)
```

### `receipts`: la factura (privada)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid → `profiles` | `on delete cascade`: si borras la cuenta, se borran tus facturas |
| `store_id` | uuid → `stores`, nullable | Nula hasta que confirmas la tienda |
| `purchased_at` | timestamptz | Fecha de compra (no futura) |
| `total` | numeric(10,2) | Total del ticket, para cuadrar con la suma de líneas |
| `status` | `draft` \| `confirmed` | Borrador mientras lo revisas |
| `file_path` | text, nullable | Ruta en el bucket privado; se borra según la política de conservación |
| `extraction` | jsonb, nullable | Respuesta del modelo, para depurar; se borra al confirmar |
| `created_at` | timestamptz | |

### `receipt_lines`: cada línea del ticket (privada)

| Columna | Tipo | Notas |
|---|---|---|
| `id`, `receipt_id` (→ `receipts`, cascade), `position` | | |
| `raw_text` | text | Tal cual sale en el ticket |
| `product_id` | uuid → `products`, nullable | Nulo hasta emparejarlo |
| `quantity` | numeric(10,3) | Unidades o kg |
| `line_total` | numeric(10,2) | Ya con su descuento aplicado |
| `price_id` | uuid → `prices`, nullable | El precio público que generó al confirmar |

### Cambios en tablas existentes

- `products`: `unit` (`ud` \| `kg` \| `l`) y `size` (por ejemplo `1.5` para 1,5 L). Con eso, **€/kg o €/L = precio / (cantidad × tamaño)**.
- `prices`: `source` (`manual` \| `receipt`), para poder ponderar o filtrar en las estadísticas.
- `stores`: `tax_id` (NIF de la empresa, que sale en todos los tickets). Ayuda a reconocer la tienda; no es un dato personal.

### `product_aliases`

`(store_id nullable, alias_normalized) → product_id`, único por tienda. Al confirmar una factura, cada línea emparejada guarda su alias; la siguiente vez ese texto se reconoce solo.

### RLS (la API se conecta como dueña y aplica las mismas reglas en las rutas)

- `receipts` y `receipt_lines`: solo el dueño puede leer, crear, editar y borrar (`to authenticated`, con `user_id = auth.uid()`), y además una política **restrictiva** que exige `is_anonymous = false` para crear.
- `product_aliases`: lectura pública; escritura solo desde la API.
- **UPDATE necesita `using` y `with check`**, y las políticas de UPDATE necesitan una de SELECT, como ya se hace en `prices`.

## Leer la factura

### Flujo

```
App/Web ──(1) pide URL de subida──► API ──► Storage: URL firmada para receipts/{user_id}/{receipt_id}
   │
   ├──(2) sube la foto/PDF directo a Storage
   │
   └──(3) POST /receipts/:id/extract ──► API descarga el archivo ──► Claude (imagen o PDF) ──► JSON
                                          └─► empareja tienda y productos (alias, nombre parecido)
   ◄── borrador: tienda, fecha, total, líneas con sugerencias ──┘
   │
 Pantalla "Revisa tu factura": corriges y confirmas
   │
   └──(4) POST /receipts/:id/confirm ──► una transacción: líneas + prices + alias nuevos
```

### Extracción con IA

- **Dónde:** solo en la API (`apps/api`). La clave de Anthropic va en una variable de entorno de Vercel, nunca en las apps.
- **Modelo:** `claude-opus-5-5` con esfuerzo `low`. Es una extracción; no necesita razonar mucho. Lee fotos (bloque `image`) y PDF (bloque `document`) directamente, sin OCR aparte.
- **Salida estructurada:** `output_config.format` con un esquema JSON, o `messages.parse` con Zod. El esquema (`receiptExtractionSchema`) va en `packages/shared/src/schemas.ts`, así la API y la pantalla de revisión usan el mismo tipo:
  ```
  { storeName, storeTaxId?, purchasedAt, total,
    lines: [{ rawText, normalizedName, quantity, unit?, size?, lineTotal }] }
  ```
- **Instrucciones clave para el modelo:**
  - Tickets españoles ("factura simplificada").
  - Líneas por peso ("0,532 kg x 1,99 €/kg").
  - Descuentos que se aplican a la línea anterior.
  - Ignorar IVA, subtotales, cambio y forma de pago.
  - **No extraer** datos personales: tarjeta, nombre del cajero, número de socio. Ver el documento de protección de datos.
- **Coste aproximado:** 3-5 céntimos por ticket. Una foto son unos 2.000-3.000 tokens de entrada, y la salida unos 1.000-2.000, a 4 $ y 20 $ por millón. Reducir la foto (lado largo de unos 1.500 px) antes de subirla baja el coste y el tiempo.
- **Alternativa barata:** `claude-haiku-5-5` cuesta unas 40 veces menos. Antes de cambiar, medir con 20-30 tickets reales si acierta igual (*decisión abierta*).
- **Al implementarlo:** comprobar `stop_reason` (por ejemplo `refusal`) antes de leer la respuesta, y activar los *fallbacks* del servidor.

### Comprobaciones antes de mostrar el borrador

- La suma de líneas debe cuadrar con el total (±0,02 €); si no, se marca en rojo.
- Fecha no futura y precios mayores que 0, con los mismos esquemas que ya usa la API.
- Tienda: primero por `tax_id`, luego por nombre normalizado y si no, se propone crearla.
- Producto: primero por `product_aliases`, luego por nombre parecido (extensión `pg_trgm`) y si no, se propone crear uno nuevo.

**Nunca se guarda nada sin que el usuario confirme.**

### Pantalla de revisión

Un componente en `packages/ui`, como el login, para que sea el mismo en la web y en el móvil. Muestra:
- La tienda, la fecha y el total.
- Una lista editable de líneas, cada una con su producto sugerido, el precio y un aviso si no cuadra.

## Vista de la comunidad

- `GET /stores/:id/products`: por cada producto, **precio medio** (últimos 90 días), mínimo, nº de observaciones, último precio y, si has entrado, **tu última compra**.
- `GET /products/:id/stores`: el mismo producto en todas las tiendas, ordenado por €/kg o €/L.
- **Medias con un mínimo de observaciones** (por ejemplo 3) y de varios usuarios. Así no se puede deducir lo que compró una persona concreta (ver el documento de protección de datos). Si hay menos, se muestra solo el último precio.
- Si va lento, una vista materializada que se refresca cada noche. Con el volumen actual no hace falta.

## Sugerencias (más adelante)

- **"¿Dónde está más barato X?":** el €/kg o €/L más bajo, dando más peso a los precios recientes. Es lo que ya hace `cheapest` en `/products`, pero con precio por unidad.
- **Lista de la compra:** qué tienda (o qué combinación de dos) sale más barata para toda la lista.
- **Avisos:** "la leche ha subido un 15 % en tu tienda habitual".

## Fases

Cada fase se puede probar sola. Las rutas de la API las implementas tú, con guía paso a paso.

### Fase 0: requisitos previos

- [ ] Arreglar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en Vercel: hoy tiene como valor su propio nombre. Después, volver a desplegar la web.
- [ ] SMTP propio en Supabase (Brevo, Resend…): sin él, los usuarios reales no reciben el email para entrar.
- [ ] Fusionar en `main` las ramas `feat/deploy-vercel` → `feat/web` → `feat/login`, en ese orden.
- [ ] Crear `docs/database.md`: lo cita `apps/api/src/db/schema.ts` y no existe.
- [ ] Política de privacidad publicada (ver `proteccion-de-datos.md`, fase 0).

**Hecho cuando:** una persona que no es del equipo puede entrar con su email en la web desplegada.

### Fase 1: modelo de datos y facturas "a mano"

- [ ] `products.unit/size`, `prices.source`, `stores.tax_id`, `receipts`, `receipt_lines`, `product_aliases` en `schema.ts` y `pnpm api:db:generate`.
- [ ] Políticas RLS y comprobación con `get_advisors`.
- [ ] Rutas: `POST /receipts` (crear borrador), `GET /receipts`, `GET /receipts/:id`, `PATCH` de líneas, `POST /receipts/:id/confirm` (transacción) y `DELETE /receipts/:id`.
- [ ] Tests con PGlite: permisos (solo el dueño, solo cuentas reales), que confirmar crea los `prices` y que cuadra el total.

**Hecho cuando:** se puede registrar una factura escrita a mano y sus precios aparecen en la comunidad.

### Fase 2: subir la foto o el PDF

- [ ] Bucket privado `receipts`, con políticas por carpeta `{user_id}/`.
- [ ] `POST /receipts/:id/upload-url` (URL firmada), con límite de tamaño (10 MB) y tipos (JPEG, PNG, HEIC, PDF).
- [ ] Móvil: cámara y galería, que ya tiene `expo-image-picker`, reduciendo y convirtiendo a JPEG antes de subir. Web: `<input type="file">`.
- [ ] Borrado del archivo según la política de conservación.

### Fase 3: extracción con IA y revisión

- [ ] `receiptExtractionSchema` en `packages/shared`.
- [ ] `POST /receipts/:id/extract` con Claude, con límite diario por usuario (por ejemplo 10 facturas al día).
- [ ] Emparejar tiendas y productos; activar `pg_trgm`.
- [ ] Pantalla de revisión en `packages/ui`.
- [ ] Banco de pruebas: 20-30 tickets reales anonimizados, midiendo el % de líneas correctas, el coste y el tiempo por ticket.

**Hecho cuando:** en el banco de pruebas, más del 90 % de las líneas salen bien sin tocar nada.

### Fase 4: vista de la comunidad

- [ ] `GET /stores/:id/products` y `GET /products/:id/stores`, con medias, mínimo de observaciones y tu última compra.
- [ ] Pantallas en la web y en el móvil.
- [ ] Quitar el `userId` de las respuestas públicas y devolver `isOwn` (ver protección de datos).

### Fase 5: sugerencias

- [ ] "Más barato en…" por precio por unidad.
- [ ] Lista de la compra optimizada.

## Decisiones abiertas (lfhb98)

1. **Modelo de IA y presupuesto mensual:** Opus 5.5 o Haiku 5.5, tras medir.
2. **¿Se guarda la foto de la factura?** Recomendado: borrarla al confirmar, o a los 30 días como máximo.
3. **¿Quién crea productos nuevos desde una factura?** Cualquiera, o quedan pendientes de revisión.
4. **¿Productos genéricos ("Leche entera 1 L") o de marca ("Hacendado")?** Afecta a cómo se compara.
5. **Usuarios anónimos:** ¿se borran tras X días sin actividad?

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo lee mal un precio | Revisión obligatoria y comprobar que cuadra el total |
| Productos duplicados ("Leche" / "leche entera") | Alias, sugerencias por parecido y, más adelante, fusionar productos |
| Coste de IA por abuso | Solo cuentas reales, límite diario, alertas de gasto en Anthropic |
| Datos personales en los tickets | No extraerlos, bucket privado, borrar la foto (ver protección de datos) |
| Precios falsos | Medias con mínimo de observaciones; más adelante, reportar precios |

# Protección de datos (RGPD y LOPDGDD)

> **Esto no es asesoramiento legal.** Es una guía práctica para el proyecto, a 8 de noviembre de 2026, basada en el código actual. Antes de abrir la app al público, revisadlo con un profesional o con las herramientas de la AEPD (Facilita RGPD y las guías para emprendedores, en [aepd.es](https://www.aepd.es)).
>
> Normas que aplican: el **RGPD** (Reglamento UE 2016/679), la **LOPDGDD** (Ley Orgánica 3/2018) y, para cookies y emails comerciales, la **LSSI-CE** (Ley 34/2002).

## Quién es quién

| Rol | Quién | Qué hay que hacer |
|---|---|---|
| **Responsable del tratamiento** | Quien publica la app: lfhb98 (persona física) o la empresa, si se crea | Identificarse en la política de privacidad, con un email de contacto para temas de privacidad |
| **Encargado: Supabase** | Base de datos, Auth y, en el futuro, Storage | Aceptar su DPA; **comprobar la región del proyecto** (mejor en la UE) |
| **Encargado: Vercel** | Aloja la API y la web; guarda logs con IP | DPA; las funciones van en `dub1` (Irlanda), pero Vercel es una empresa de EE. UU. |
| **Encargado: Anthropic** *(cuando haya facturas)* | Lee las fotos de las facturas | DPA; revisar sus condiciones de retención y uso de datos de la API |
| **Encargado: proveedor de SMTP** *(cuando lo haya)* | Envía los emails de acceso | DPA; mejor uno con servidores en la UE |
| **Encargado: Expo/EAS** | Builds y actualizaciones de la app | Revisar si recibe datos de usuarios (en principio no) |

Con cada encargado debe haber un **contrato de encargo** (art. 28 RGPD). Normalmente es su DPA estándar, que se acepta en el panel o en sus condiciones.

## Qué datos se tratan

### Hoy (rama `feat/login`)

| Dato | Dónde | ¿Público? | Comentario |
|---|---|---|---|
| Email | `auth.users` (Supabase) | No | Único dato que se pide para entrar ✅ minimización |
| Id de usuario (UUID) | `auth.users`, `profiles`, `prices.user_id` | ⚠️ **Sí**: la API lo devuelve en cada precio | Ver "Problemas actuales" |
| Nombre de usuario (`usuario_xxxx`) | `profiles` | Sí (RLS `profiles_select` para todos) | Generado, no identifica a nadie por sí solo |
| Usuario anónimo | `auth.users` (`is_anonymous`) | No | Se crea al registrar algo sin entrar |
| Precios registrados (tienda, producto, fecha) | `prices` | Sí | Es el objetivo de la app; junto al id de usuario, dicen dónde y cuándo compra alguien |
| IP, navegador, hora | Logs de Vercel y de Supabase Auth | No | Seguridad y diagnóstico |
| Sesión (tokens) | `localStorage` (web), AsyncStorage (móvil) | No | Almacenamiento estrictamente necesario |

### Con las facturas (ver [`plan-facturas-y-comunidad.md`](plan-facturas-y-comunidad.md))

| Dato | Riesgo | Medida |
|---|---|---|
| Historial de compras (qué, dónde, cuándo, cuánto) | **Alto**: revela hábitos, zona donde vives, horarios y, a veces, salud (farmacia, dietas) o religión (alimentación) | Siempre privado; RLS solo del dueño; en la comunidad solo agregados |
| Foto o PDF de la factura | Puede incluir **últimos dígitos de la tarjeta**, **nº y nombre de socio**, **nombre del cajero** (dato de un tercero) y dirección de la tienda | Bucket privado, URLs firmadas, **borrarla al confirmar** (o a los 30 días como máximo) |
| Texto extraído por la IA | Igual que la foto | Pedir al modelo que **no extraiga** esos datos; borrar `extraction` al confirmar |
| Envío a Anthropic | Transferencia internacional (EE. UU.) | Ver "Transferencias internacionales" |

## Bases jurídicas (art. 6 RGPD)

| Tratamiento | Base |
|---|---|
| Cuenta, login y guardar tus precios y facturas | **Ejecución del contrato** (6.1.b): es el servicio que pides |
| Leer la factura con IA | Ejecución del contrato, porque es la función que usas. Informar claramente de que la procesa un tercero |
| Publicar precios en la comunidad (sin identificarte) | **Interés legítimo** (6.1.f), con agregados y sin datos de quién los registró |
| Logs, límites de uso y prevención de abuso | Interés legítimo (seguridad) |
| Emails comerciales o analítica *(no hay hoy)* | **Consentimiento**; los emails comerciales también requieren consentimiento según la LSSI |

Si en algún momento se quiere usar las facturas para otra cosa (entrenar modelos, vender estadísticas…), hace falta una base nueva, normalmente consentimiento, y avisar antes.

## Principios aplicados al proyecto

- **Minimización:** solo email, sin contraseña ni nombre ✅. No pedir más datos (nombre, teléfono, código postal) salvo que haga falta para una función concreta.
- **Limitación de la finalidad:** los datos de las facturas son para tu historial y para los precios agregados de la comunidad.
- **Limitación del plazo de conservación** (propuesta, *decisión de lfhb98*):

  | Dato | Plazo |
  |---|---|
  | Foto/PDF de la factura | Se borra al confirmar (o a los 30 días si no se confirma) |
  | `extraction` (JSON del modelo) | Se borra al confirmar |
  | Facturas confirmadas | Mientras tengas la cuenta |
  | Cuentas sin actividad | Aviso y borrado tras 24 meses |
  | Usuarios anónimos sin actividad | Borrado tras 90 días (los precios quedan con `user_id` a `null`) |
  | Logs | Lo que retengan Vercel y Supabase por defecto (días o semanas) |

- **Exactitud:** puedes editar y borrar tus precios ✅. Las facturas también serán editables.
- **Seguridad** (art. 32):
  - Medidas que ya hay: RLS en todas las tablas, HTTPS, tokens JWT verificados en la API y claves secretas solo en el servidor.
  - Pendientes: bucket privado, URLs firmadas de corta duración, revisar `get_advisors` de Supabase y no dar acceso de producción a más personas de las necesarias. Esto último incluye el MCP de Supabase de los desarrolladores.

## Problemas actuales y cómo arreglarlos

1. **⚠️ El `userId` es público.** `GET /products/:id`, el historial y las rutas de precios devuelven el `userId` de quien registró cada precio, y la RLS de `prices` deja leerlo a cualquiera.
   - Con usuarios anónimos el riesgo es bajo. Con cuentas y facturas, permite **seguir todas las compras de una persona**.
   - **Arreglo:** que la API no devuelva `userId` en rutas públicas y calcule `isOwn` con el token. La web y el móvil ya solo lo usan para mostrar "tuyo". Además, quitar `user_id` de la lectura pública en la base de datos (vista o columnas permitidas).
2. **No hay política de privacidad** ni aviso en el formulario de login.
3. **No se pueden ejercer los derechos desde la app** (borrar la cuenta y exportar datos).
4. **Región de Supabase sin comprobar.**

## Derechos de los usuarios (arts. 15-22 RGPD)

Hay que responder en **1 mes** (ampliable 2 meses más en casos complejos), gratis.

| Derecho | Cómo cumplirlo en la app |
|---|---|
| Acceso y portabilidad | "Descargar mis datos": un JSON con tu cuenta, precios y facturas (`GET /me/export`) |
| Rectificación | Editar precios y facturas ✅ (facturas pendientes) |
| Supresión | "Borrar mi cuenta": borra el usuario de Auth. `profiles` y `receipts` se borran en cascada, y los `prices` quedan con `user_id = null` (anónimos), así que tu aportación a la comunidad sigue sin identificarte. **Decirlo en la política.** |
| Oposición y limitación | Por email al contacto de privacidad |
| No ser objeto de decisiones automatizadas | No aplica: la IA solo propone y tú confirmas |

Además, un email de contacto para privacidad, y saber que el usuario puede reclamar ante la **AEPD**.

## Deber de informar (art. 13 RGPD)

**Política de privacidad** accesible desde la web, la app y el formulario de login. Información por capas, como recomienda la AEPD:

- **Capa 1, junto al botón "Enviarme el email":** "Usamos tu email solo para que entres. Responsable: [nombre]. Puedes acceder, borrar o exportar tus datos. Más información en la [política de privacidad]."
- **Capa 2, la política completa:**
  - Responsable y contacto.
  - Qué datos se tratan y para qué.
  - Bases jurídicas.
  - Encargados y transferencias.
  - Plazos de conservación.
  - Derechos y cómo ejercerlos.
  - Derecho a reclamar ante la AEPD.
- **Al subir la primera factura:** aviso de que la imagen la procesa un proveedor de IA (Anthropic, EE. UU.), de que no se extraen datos de pago y de que se borra al confirmar.

## Transferencias internacionales (cap. V RGPD)

Vercel, Anthropic y, según la región, Supabase son empresas de EE. UU. Para cada una, comprobar en su DPA en qué se basa la transferencia: adhesión al **EU-US Data Privacy Framework** o **cláusulas contractuales tipo**. Hay que nombrarlas en la política de privacidad.

Para reducir el riesgo:
- Proyecto de Supabase en una región de la UE.
- No enviar a la IA más de lo necesario (solo la imagen del ticket, sin datos de la cuenta).
- Revisar si Anthropic ofrece retención cero o reducida para la API.

## Menores

En España, el consentimiento de un menor solo es válido **a partir de 14 años** (art. 7 LOPDGDD). Indicarlo en las condiciones: "servicio para mayores de 14 años".

## Cookies y almacenamiento local (LSSI art. 22.2)

Hoy solo se guarda la sesión, que es **estrictamente necesaria**: no requiere banner de consentimiento, pero sí mencionarla en la política. Si se añade analítica (Vercel Analytics, Google Analytics…) o publicidad, hará falta un **banner de consentimiento** antes de cargarla.

## Registro de actividades de tratamiento (art. 30 RGPD)

La excepción para empresas de menos de 250 empleados **no aplica** si el tratamiento no es ocasional, y aquí es continuo. Conviene tener un registro sencillo; Facilita RGPD lo genera. Una fila por tratamiento:

| Tratamiento | Finalidad | Interesados | Datos | Base | Destinatarios/encargados | Transferencias | Plazo | Medidas |
|---|---|---|---|---|---|---|---|---|
| Cuentas | Acceso a la app | Usuarios | Email, id | 6.1.b | Supabase, SMTP | Según región | Mientras exista la cuenta | RLS, HTTPS |
| Precios | Comparador | Usuarios | Precio, tienda, fecha, id | 6.1.b / 6.1.f | Supabase, Vercel | EE. UU. (Vercel) | Indefinido, anonimizado al borrar la cuenta | RLS |
| Facturas | Historial y precios | Usuarios | Compras, imagen | 6.1.b | Supabase, Anthropic | EE. UU. (Anthropic) | Imagen: al confirmar | Bucket privado |

## ¿Evaluación de impacto (EIPD)?

Probablemente **no es obligatoria** al principio, pero conviene una evaluación breve antes de lanzar las facturas, porque son un historial de hábitos de consumo. Pasa a ser recomendable o necesaria si se hace a gran escala o si se elaboran perfiles (sugerencias personalizadas con el historial de compras). Facilita RGPD y la lista de tratamientos de la AEPD ayudan a decidirlo.

**DPO (delegado de protección de datos):** no parece obligatorio (arts. 37 RGPD y 34 LOPDGDD) mientras el proyecto sea pequeño y no haga seguimiento sistemático a gran escala.

## Brechas de seguridad (arts. 33-34 RGPD)

Si se filtran datos personales (por ejemplo, la base de datos, o fotos de facturas por un bucket mal configurado):
1. Contener el problema y documentarlo: qué pasó, qué datos, cuántas personas y qué se hizo.
2. **Notificar a la AEPD en un máximo de 72 horas** si hay riesgo para las personas.
3. Avisar a los afectados si el riesgo es alto.

Hay que tener a mano quién decide y quién notifica.

## Checklist

### Fase 0: antes de abrir la app al público (ya, con el login)

- [ ] Comprobar la región del proyecto de Supabase y aceptar los DPA de Supabase y Vercel.
- [ ] Política de privacidad (responsable, contacto, datos, bases, encargados, plazos, derechos, AEPD) y enlace en el login, la web y la app.
- [ ] Texto de la capa 1 junto al formulario de login.
- [ ] Quitar el `userId` de las respuestas públicas de la API (devolver `isOwn`).
- [ ] Indicar la edad mínima (14 años).
- [ ] Email de contacto de privacidad.

### Fase 1: derechos

- [ ] "Borrar mi cuenta" en la web y el móvil, con borrado en cascada y precios anonimizados.
- [ ] "Descargar mis datos" (JSON).
- [ ] Borrado automático de usuarios anónimos inactivos.

### Fase 2: antes de lanzar las facturas

- [ ] Bucket privado, URLs firmadas y borrado de la foto al confirmar.
- [ ] El modelo no extrae datos de pago, socio ni cajero, y se comprueba con los tickets de prueba.
- [ ] DPA de Anthropic y revisión de su retención de datos.
- [ ] Aviso al subir la primera factura.
- [ ] Medias de la comunidad con un mínimo de observaciones y de usuarios.
- [ ] EIPD breve.
- [ ] Registro de actividades actualizado.

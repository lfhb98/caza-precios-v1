# @caza-precios/ui

Componentes de React Native compartidos por el móvil y la web. De momento, el **login** con email (enlace o código):

| Export | Qué es |
|---|---|
| `createAccountService(getClient, { redirectTo })` | Lógica de la cuenta sobre el cliente de Supabase de cada app: enviar el email, entrar con el enlace o el código, cuenta actual, cerrar sesión |
| `useAccount(service)` | Hook con la cuenta actual (`account`, `ready`, `isSignedIn`) |
| `AccountPanel` | "Mi cuenta": el formulario si no has entrado, o tu email y "Cerrar sesión" |
| `EmailLoginForm` | Solo el formulario (email → enlace o código) |

```tsx
import { AccountPanel, createAccountService } from '@caza-precios/ui';

const accountService = createAccountService(() => supabase, { redirectTo: () => window.location.origin });
<AccountPanel service={accountService} />;
```

## Cómo se comparte

- Los componentes usan las primitivas de React Native (`View`, `Text`, `TextInput`, `Pressable`).
- **Móvil:** Metro los empaqueta como cualquier otro componente.
- **Web:** Next cambia `react-native` por **react-native-web** (`resolveAlias` en `apps/web/next.config.ts`), que los pinta como HTML.
- `react`, `react-native` y `@supabase/supabase-js` son *peerDependencies*: se usa la versión de la app, así que sigue habiendo una sola copia de cada uno en el monorepo. Las `devDependencies` son para el typecheck y los tests de este paquete.
- Como `packages/shared`, exporta TypeScript sin compilar y sus imports internos van sin extensión.

## Login: solo el email

Solo se pide el **email**. Supabase envía un email con un **enlace** para entrar y, si la plantilla lo incluye, también un **código** (6 dígitos por defecto) que se puede escribir en el formulario. No hay contraseña ni nombre de usuario; el trigger `handle_new_user` le genera uno al perfil.

- **Sin sesión** (o al volver después de cerrar sesión): `signInWithOtp`. Si el email es nuevo, se crea la cuenta.
- **Con un usuario anónimo**, el que se crea al registrar un precio sin entrar: `updateUser({ email })`. Es el **mismo usuario**, así que conserva sus precios.
- **Anónimo con un email que ya tiene cuenta:** se entra en esa cuenta. Los precios del usuario anónimo se quedan en el anónimo; no se fusionan.
- **El enlace** vuelve a la app con la sesión en la URL (`#access_token=…&refresh_token=…`, flujo *implicit* de Supabase). `completeSignInFromUrl` la guarda con `setSession`. Si el enlace ha caducado, la URL trae `error_code` y se muestra el aviso.
  - **Web:** vuelve a la misma web (`window.location.origin`); `caza-precios-app.tsx` lo procesa al cargar y limpia la URL.
  - **Móvil:** abre la pantalla "Mi cuenta" de la app, en `cazaprecios://account` (app instalada) o `exp://<ip>:8081/--/account` (Expo Go); lo procesa `src/app/_layout.tsx`. Hay que abrir el email **en el móvil**: desde el ordenador el enlace no puede abrir la app.
- **El código:** `verifyOtp` con `type: 'email'`, o `'email_change'` si era un usuario anónimo.
- **Cerrar sesión** cierra solo este dispositivo (`scope: 'local'`). Si después registras algo sin entrar, se crea otro usuario anónimo, como antes.

Entrar es opcional: se puede seguir usando la app sin cuenta.

## Configuración de Supabase (una vez, en el panel del proyecto)

1. **Authentication → URL Configuration:**
   - **Site URL:** `https://caza-precios-web.vercel.app`.
   - **Redirect URLs:** las URLs a las que puede volver el enlace del email. Una que no esté en la lista se cambia por la Site URL.
     ```
     http://localhost:3001/**
     https://caza-precios-web.vercel.app/**
     cazaprecios://**
     exp://**
     ```
     `exp://**` es para probar con Expo Go en desarrollo.
2. **Authentication → Sign In / Providers:** activar **Allow manual linking**. Es lo que permite convertir el usuario anónimo en una cuenta con email.
3. **Envío de emails:** sin un SMTP propio, Supabase solo envía a los miembros del equipo del proyecto, muy pocos emails por hora, y no deja editar las plantillas, que solo traen el enlace. Para usuarios reales hay que configurar un SMTP (Resend, Brevo, Amazon SES…) en Authentication → Emails → SMTP Settings. Sin él, Supabase devuelve `email_address_not_authorized` y el formulario lo explica.
4. *(Con SMTP, opcional)* Para enviar también el código, añadir `{{ .Token }}` a las plantillas **Magic Link**, **Confirm signup** y **Change email address**. Por ejemplo: `<p>O escribe este código: <strong>{{ .Token }}</strong></p>`. El formulario admite códigos de 6 a 10 dígitos.

## Tests

```bash
pnpm --filter @caza-precios/ui test
```

- `test/account.test.ts`: qué llamadas a Supabase se hacen en cada caso (sin sesión, anónimo, email ya registrado, errores, vuelta del enlace en la web y en el móvil), con un cliente de Supabase falso.
- `test/account-panel.test.tsx`: el formulario pintado con react-native-web en jsdom (validación, código, reenviar, cambiar de email, aviso de enlace caducado, cerrar sesión).

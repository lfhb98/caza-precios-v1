# @caza-precios/ui

Componentes de React Native compartidos por el móvil y la web. De momento, el **login**:

| Export | Qué es |
|---|---|
| `createAccountService(getClient)` | Lógica de la cuenta sobre el cliente de Supabase de cada app: enviar y verificar el código, cuenta actual, cerrar sesión |
| `useAccount(service)` | Hook con la cuenta actual (`account`, `ready`, `isSignedIn`) |
| `AccountPanel` | "Mi cuenta": el formulario si no has entrado, o tu email y "Cerrar sesión" |
| `EmailLoginForm` | Solo el formulario (email → código) |

```tsx
import { AccountPanel, createAccountService } from '@caza-precios/ui';

const accountService = createAccountService(() => supabase);
<AccountPanel service={accountService} />;
```

## Cómo se comparte

- Los componentes usan las primitivas de React Native (`View`, `Text`, `TextInput`, `Pressable`).
- **Móvil:** Metro los empaqueta como cualquier otro componente.
- **Web:** Next cambia `react-native` por **react-native-web** (`resolveAlias` en `apps/web/next.config.ts`), que los pinta como HTML.
- `react`, `react-native` y `@supabase/supabase-js` son *peerDependencies*: se usa la versión de la app, así que sigue habiendo una sola copia de cada uno en el monorepo. Las `devDependencies` son para el typecheck y los tests de este paquete.
- Como `packages/shared`, exporta TypeScript sin compilar y sus imports internos van sin extensión.

## Login: solo email y código

Solo se pide el **email**. Supabase envía un código de un solo uso (6 dígitos por defecto) y con él se entra. No hay contraseña ni nombre de usuario; el trigger `handle_new_user` le genera uno al perfil.

- **Sin sesión** (o al volver después de cerrar sesión): `signInWithOtp` + `verifyOtp({ type: 'email' })`. Si el email es nuevo, se crea la cuenta.
- **Con un usuario anónimo**, el que se crea al registrar un precio sin entrar: `updateUser({ email })` + `verifyOtp({ type: 'email_change' })`. Es el **mismo usuario**, así que conserva sus precios.
- **Anónimo con un email que ya tiene cuenta:** se entra en esa cuenta. Los precios del usuario anónimo se quedan en el anónimo; no se fusionan.
- **Cerrar sesión** cierra solo este dispositivo (`scope: 'local'`). Si después registras algo sin entrar, se crea otro usuario anónimo, como antes.

Entrar es opcional: se puede seguir usando la app sin cuenta.

## Configuración de Supabase (una vez, en el panel del proyecto)

1. **Authentication → Emails → Templates:** las plantillas **Magic Link**, **Confirm signup** y **Change email address** deben incluir el código, `{{ .Token }}`. Por ejemplo: `<p>Tu código para entrar en CazaPrecios: <strong>{{ .Token }}</strong></p>`. Si la plantilla solo tiene `{{ .ConfirmationURL }}`, Supabase envía un enlace en vez del código.
2. **Authentication → Sign In / Providers:** activar **Allow manual linking**. Es lo que permite convertir el usuario anónimo en una cuenta con email.
3. **Envío de emails (SMTP propio):** el servidor de correo de prueba de Supabase solo envía a los miembros del equipo del proyecto y muy pocos emails por hora. Para usuarios reales hay que configurar un SMTP (Resend, Brevo, Amazon SES…) en Authentication → Emails → SMTP Settings. Sin él, Supabase devuelve `email_address_not_authorized` y el formulario lo explica.
4. *(Opcional)* La longitud del código (6-10 dígitos) y su caducidad están en Authentication → Providers → Email. El formulario admite de 6 a 10 dígitos.

## Tests

```bash
pnpm --filter @caza-precios/ui test
```

- `test/account.test.ts`: qué llamadas a Supabase se hacen en cada caso (sin sesión, anónimo, email ya registrado, errores), con un cliente de Supabase falso.
- `test/account-panel.test.tsx`: el formulario pintado con react-native-web en jsdom (validación, código, reenviar, cambiar de email, cerrar sesión).

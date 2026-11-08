import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js';

// Cuenta del usuario a partir de la sesión de Supabase. Lo usan la web y el
// móvil: cada app pasa su propio cliente de Supabase.

export type Account = {
  id: string;
  email: string | null;
  // Usuario anónimo: el que se crea solo al registrar algo sin haber entrado.
  isAnonymous: boolean;
};

// Login sin contraseña: se envía un email con un enlace (y un código, si la
// plantilla de Supabase lo incluye). Se entra abriendo el enlace o escribiendo el código.
export interface EmailAuth {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
}

export interface AccountService extends EmailAuth {
  getAccount(): Promise<Account | null>;
  onAccountChange(listener: (account: Account | null) => void): () => void;
  signOut(): Promise<void>;
  // Completa el login al volver del enlace del email: la URL trae la sesión
  // (#access_token=...&refresh_token=...) o un error. Devuelve false si la URL
  // no tiene nada de eso.
  completeSignInFromUrl(url: string): Promise<boolean>;
}

export type AccountServiceOptions = {
  // URL a la que vuelve el enlace del email. Debe estar en Authentication →
  // URL Configuration → Redirect URLs de Supabase.
  redirectTo?: () => string;
};

function toAccount(user: User | null | undefined): Account | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, isAnonymous: user.is_anonymous ?? false };
}

// Mensajes en español para los errores de Supabase Auth que puede ver el usuario.
// https://supabase.com/docs/guides/auth/debugging/error-codes
const AUTH_MESSAGES: Record<string, string> = {
  otp_expired: 'El código o el enlace no es válido o ha caducado. Pide uno nuevo.',
  over_email_send_rate_limit: 'Has pedido demasiados códigos. Espera un poco y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos. Espera un poco y vuelve a intentarlo.',
  email_address_invalid: 'Ese email no parece válido.',
  email_address_not_authorized:
    'Ahora mismo no se pueden enviar emails a esa dirección (falta configurar el envío de correos).',
  signup_disabled: 'El registro de usuarios nuevos está desactivado.',
  otp_disabled: 'El acceso con código por email está desactivado.',
};

export class AccountError extends Error {}

function message(code: string | null | undefined, fallback: string) {
  return (code && AUTH_MESSAGES[code]) || fallback;
}

function fail(error: AuthError): never {
  throw new AccountError(message(error.code, error.message));
}

// Parámetros del fragmento (#...) y de la query (?...) de una URL, juntos.
function urlParams(url: string) {
  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

export function createAccountService(
  getClient: () => SupabaseClient,
  { redirectTo }: AccountServiceOptions = {}
): AccountService {
  // Tipo del código pendiente de verificar: `email_change` si se está convirtiendo
  // el usuario anónimo en una cuenta con email, `email` si se entra en una cuenta.
  let pendingType: 'email' | 'email_change' = 'email';

  return {
    async getAccount() {
      const { data } = await getClient().auth.getSession();
      return toAccount(data.session?.user);
    },

    onAccountChange(listener) {
      const { data } = getClient().auth.onAuthStateChange((_event, session) => {
        listener(toAccount(session?.user));
      });
      return () => data.subscription.unsubscribe();
    },

    async sendCode(email) {
      const supabase = getClient();
      const { data } = await supabase.auth.getSession();

      // Si ya hay un usuario anónimo (registró precios sin entrar), se le añade
      // el email: es el mismo usuario y conserva sus precios.
      if (data.session?.user.is_anonymous) {
        const { error } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: redirectTo?.() }
        );
        if (!error) {
          pendingType = 'email_change';
          return;
        }
        // Si el email ya es de otra cuenta, se entra en esa cuenta (abajo).
        // Los precios del usuario anónimo se quedan en el usuario anónimo.
        if (error.code !== 'email_exists' && error.code !== 'user_already_exists') fail(error);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo?.() },
      });
      if (error) fail(error);
      pendingType = 'email';
    },

    async verifyCode(email, code) {
      const { error } = await getClient().auth.verifyOtp({ email, token: code, type: pendingType });
      if (error) fail(error);
    },

    async completeSignInFromUrl(url) {
      const params = urlParams(url);
      const errorCode = params.get('error_code') ?? params.get('error');
      if (errorCode) {
        throw new AccountError(
          message(errorCode, params.get('error_description') ?? 'No se pudo entrar con el enlace.')
        );
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return false;

      const { error } = await getClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) fail(error);
      return true;
    },

    async signOut() {
      // Solo en este dispositivo; las sesiones de otros dispositivos siguen abiertas.
      const { error } = await getClient().auth.signOut({ scope: 'local' });
      if (error) fail(error);
    },
  };
}

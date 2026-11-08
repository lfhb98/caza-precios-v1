import { createAccountService } from '@caza-precios/ui';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

// Sesión de Supabase (se guarda en localStorage). Sin entrar, el navegador
// obtiene un usuario anónimo al registrar algo; con "Entrar" (email + código)
// ese usuario pasa a ser una cuenta. Con su token la API sabe quién registra
// cada precio.

let client: SupabaseClient | null = null;

// Se crea al primer uso (en el navegador), no al importar el módulo.
function getClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'No se pudo iniciar sesión: faltan NEXT_PUBLIC_SUPABASE_URL o ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copia apps/web/.env.example como .env.local.'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

// Login con email y código, el mismo que el móvil (ver packages/ui).
export const accountService = createAccountService(getClient);

// Id del usuario si ya tiene sesión, sin crear una: solo leer no necesita usuario.
export async function existingUserId(): Promise<string | null> {
  const { data } = await getClient().auth.getSession();
  return data.session?.user.id ?? null;
}

let signingIn: Promise<Session> | null = null;

// Devuelve la sesión actual; si no hay, crea un usuario anónimo.
// Las peticiones en paralelo comparten el mismo inicio de sesión.
export async function getSession(): Promise<Session> {
  const supabase = getClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  signingIn ??= supabase.auth
    .signInAnonymously()
    .then(({ data: result, error }) => {
      if (error || !result.session) {
        throw new Error(`No se pudo iniciar sesión: ${error?.message ?? 'sin sesión'}`);
      }
      return result.session;
    })
    .finally(() => {
      signingIn = null;
    });

  return signingIn;
}

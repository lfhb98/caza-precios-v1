import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copia apps/mobile/.env.example como .env y reinicia Expo.'
  );
}

// https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresca el token solo mientras la app está en primer plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

let signingIn: Promise<Session> | null = null;

// Devuelve la sesión actual; si no hay, crea un usuario anónimo.
// Las peticiones en paralelo comparten el mismo inicio de sesión.
export async function getSession(): Promise<Session> {
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

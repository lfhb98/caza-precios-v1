import Constants from 'expo-constants';

// Variables EXPO_PUBLIC_* de apps/mobile/.env (se incrustan al compilar).
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// En desarrollo, si no se indica EXPO_PUBLIC_API_URL, se asume que la API corre
// en el mismo ordenador que el servidor de Expo (puerto 3000). Así funciona
// también desde un móvil físico en la misma red.
function devApiUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3000`;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || devApiUrl();

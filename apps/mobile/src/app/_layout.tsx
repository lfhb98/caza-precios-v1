import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { accountService } from '../lib/supabase';

// Al abrir la app desde el enlace del email, la URL trae la sesión (o un error).
function useSignInFromEmailLink() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      accountService.completeSignInFromUrl(url).catch((error) => {
        Alert.alert('No se pudo entrar', error instanceof Error ? error.message : String(error));
      });
    };

    Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);
}

export default function Layout() {
  useSignInFromEmailLink();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

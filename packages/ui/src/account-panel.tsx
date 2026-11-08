import { THEME } from '@caza-precios/shared';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { AccountService } from './account';
import { Button, EmailLoginForm } from './email-login-form';
import { useAccount } from './use-account';

// "Mi cuenta": el formulario de login si no has entrado, o tu email y el botón
// de cerrar sesión si ya has entrado. Lo usan la web y el móvil.

type Props = {
  service: AccountService;
  onSignedIn?: () => void;
  // Error que viene de fuera del panel, p. ej. al volver de un enlace caducado.
  notice?: string | null;
};

export function AccountPanel({ service, onSignedIn, notice }: Props) {
  const { account, ready, isSignedIn } = useAccount(service);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      await service.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la sesión.');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!ready) return <ActivityIndicator color={THEME.primary} />;

  if (isSignedIn) {
    return (
      <View style={styles.panel}>
        <Text style={styles.text}>
          Has entrado como <Text style={styles.strong}>{account?.email}</Text>.
        </Text>
        <Text style={styles.hint}>
          Los precios que registres quedan en tu cuenta, desde cualquier dispositivo.
        </Text>
        <Button label="Cerrar sesión" variant="secondary" busy={isSigningOut} onPress={signOut} />
        {error && (
          <Text style={styles.error} role="alert">
            {error}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {notice && (
        <Text style={styles.notice} role="alert">
          {notice}
        </Text>
      )}
      <Text style={styles.text}>Entra para guardar tus precios en tu cuenta y verlos en otros dispositivos.</Text>
      {account?.isAnonymous && (
        <Text style={styles.hint}>
          Los precios que ya registraste desde aquí pasarán a tu cuenta.
        </Text>
      )}
      <EmailLoginForm auth={service} onSignedIn={onSignedIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12, width: '100%', maxWidth: 420 },
  text: { fontSize: 15, color: THEME.text, lineHeight: 22 },
  strong: { fontWeight: '700' },
  hint: { fontSize: 14, color: THEME.subtext, lineHeight: 20 },
  error: { fontSize: 14, color: THEME.danger },
  notice: {
    fontSize: 14,
    color: THEME.danger,
    backgroundColor: '#fdecec',
    padding: 10,
    borderRadius: 8,
  },
});

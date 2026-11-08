import { THEME } from '@caza-precios/shared';
import { emailSchema, otpCodeSchema } from '@caza-precios/shared/schemas';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EmailAuth } from './account';

// Formulario de login sin contraseña, el mismo en el móvil (React Native) y en
// la web (react-native-web). Solo pide el email y el código que llega por correo.

type Props = {
  auth: EmailAuth;
  onSignedIn?: () => void;
};

type Step = 'email' | 'code';

export function EmailLoginForm({ auth, onSignedIn }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo ha fallado. Inténtalo de nuevo.');
    } finally {
      setIsBusy(false);
    }
  };

  const sendCode = (isResend = false) => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ese email no parece válido');
      return;
    }
    return run(async () => {
      await auth.sendCode(parsed.data);
      setEmail(parsed.data);
      setCode('');
      setStep('code');
      setInfo(isResend ? 'Te hemos enviado un código nuevo.' : null);
    });
  };

  const verify = () => {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Código no válido');
      return;
    }
    return run(async () => {
      await auth.verifyCode(email, parsed.data);
      onSignedIn?.();
    });
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setInfo(null);
  };

  return (
    <View style={styles.form}>
      {step === 'email' ? (
        <>
          <Text style={styles.label}>
            Email
          </Text>
          <TextInput
            style={styles.input}
            aria-label="Email"
            placeholder="tu@email.com"
            placeholderTextColor={THEME.subtext}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => sendCode()}
            inputMode="email"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            editable={!isBusy}
            autoFocus
          />
          <Text style={styles.hint}>
            Te enviaremos un código para entrar. No necesitas contraseña.
          </Text>
          <Button label="Enviarme un código" busy={isBusy} onPress={() => sendCode()} />
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Hemos enviado un código a <Text style={styles.strong}>{email}</Text>. Escríbelo aquí.
          </Text>
          <Text style={styles.label}>
            Código
          </Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            aria-label="Código"
            placeholder="123456"
            placeholderTextColor={THEME.subtext}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            onSubmitEditing={verify}
            inputMode="numeric"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            editable={!isBusy}
            autoFocus
          />
          <Button label="Entrar" busy={isBusy} onPress={verify} />
          <View style={styles.links}>
            <LinkButton label="Usar otro email" onPress={changeEmail} disabled={isBusy} />
            <LinkButton label="Reenviar código" onPress={() => sendCode(true)} disabled={isBusy} />
          </View>
        </>
      )}

      {info && !error && (
        <Text style={styles.info} role="status">
          {info}
        </Text>
      )}
      {error && (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  busy = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={busy}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || busy) && styles.buttonPressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? '#ffffff' : THEME.primary} />
      ) : (
        <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function LinkButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable role="button" aria-label={label} disabled={disabled} onPress={onPress}>
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  form: { gap: 10, width: '100%', maxWidth: 420 },
  label: { fontSize: 14, fontWeight: '600', color: THEME.text },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: THEME.text,
    backgroundColor: THEME.card,
  },
  codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  hint: { fontSize: 14, color: THEME.subtext, lineHeight: 20 },
  strong: { fontWeight: '700', color: THEME.text },
  button: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: { backgroundColor: THEME.primary },
  buttonSecondary: { backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  buttonPressed: { opacity: 0.75 },
  buttonPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  buttonSecondaryText: { color: THEME.text, fontSize: 16, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  link: { color: THEME.primary, fontSize: 14, fontWeight: '600', paddingVertical: 6 },
  linkDisabled: { opacity: 0.5 },
  info: { fontSize: 14, color: THEME.primary },
  error: {
    fontSize: 14,
    color: THEME.danger,
    backgroundColor: '#fdecec',
    padding: 10,
    borderRadius: 8,
  },
});

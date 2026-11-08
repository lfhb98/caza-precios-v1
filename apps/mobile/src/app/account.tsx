import { AccountPanel } from '@caza-precios/ui';
import { Stack, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { THEME } from '../constants/theme';
import { accountService } from '../lib/supabase';

// "Mi cuenta": entrar con email y código, o cerrar sesión. El formulario es el
// mismo que el de la web (packages/ui).
export default function AccountScreen() {
  const router = useRouter();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Mi cuenta</Text>
        <View style={styles.card}>
          <AccountPanel service={accountService} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  container: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButton: { paddingVertical: 8, paddingRight: 15 },
  backButtonText: { fontSize: 17, fontWeight: '600', color: THEME.primary },
  title: { fontSize: 26, fontWeight: 'bold', color: THEME.text, marginBottom: 16 },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border,
  },
});

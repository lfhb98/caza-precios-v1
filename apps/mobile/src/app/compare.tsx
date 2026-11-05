import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { THEME } from '../constants/theme';
import {
  createOrGetStore,
  createPrice,
  currentUserId,
  deletePrice,
  errorMessage,
  fetchProduct,
  fetchStores,
  type StorePrice,
  type Store,
} from '../lib/api';
import { cleanPriceInput, formatDate, formatPrice } from '../lib/format';

const OTHER_STORE = 'other';

export default function CompareScreen() {
  const router = useRouter();
  const { productId, productName } = useLocalSearchParams<{
    productId: string;
    productName: string;
  }>();

  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [customStore, setCustomStore] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPrices = useCallback(async () => {
    try {
      const [product, storeList, uid] = await Promise.all([
        fetchProduct(productId),
        fetchStores(),
        currentUserId(),
      ]);
      setPrices(product.prices);
      setStores(storeList);
      setUserId(uid);
      setStoreId((current) => current ?? storeList[0]?.id ?? OTHER_STORE);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      loadPrices();
    }, [loadPrices])
  );

  const addPriceEntry = async () => {
    Keyboard.dismiss();

    if (!price) {
      Alert.alert('Atención', 'Por favor ingresa un precio.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Atención', 'Ingresa un precio válido en euros.');
      return;
    }

    if (storeId === OTHER_STORE && !customStore.trim()) {
      Alert.alert('Atención', 'Por favor escribe el nombre del local.');
      return;
    }

    setIsSaving(true);
    try {
      const finalStoreId =
        storeId === OTHER_STORE ? (await createOrGetStore(customStore.trim())).id : storeId!;
      await createPrice({ productId, storeId: finalStoreId, price: numericPrice });

      setPrice('');
      setCustomStore('');
      if (storeId === OTHER_STORE) setStoreId(finalStoreId);
      await loadPrices();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteEntry = (entry: StorePrice) => {
    Alert.alert(
      'Eliminar precio',
      `¿Deseas quitar tu registro de ${entry.storeName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePrice(entry.id);
              await loadPrices();
            } catch (e) {
              Alert.alert('Error', errorMessage(e));
            }
          },
        },
      ]
    );
  };

  const openDetailScreen = (priceId: string) => {
    router.push({
      pathname: '/detail',
      params: { productId, productName, priceId },
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.productBanner}>
          <Text style={styles.productBannerLabel}>Producto a comparar:</Text>
          <Text style={styles.productBannerTitle}>{productName || 'Producto'}</Text>
        </View>

        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={loadPrices}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.form}>
          <Text style={styles.label}>1. Selecciona el local:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.storesContainer}
            keyboardShouldPersistTaps="handled"
          >
            {[...stores, { id: OTHER_STORE, name: 'Otro' }].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.storeChip, storeId === item.id && styles.storeChipSelected]}
                onPress={() => setStoreId(item.id)}
              >
                <Text
                  style={[
                    styles.storeChipText,
                    storeId === item.id && styles.storeChipTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {storeId === OTHER_STORE && (
            <TextInput
              style={styles.input}
              placeholder="Escribe el nombre del local..."
              placeholderTextColor={THEME.subtext}
              value={customStore}
              onChangeText={setCustomStore}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          )}

          <Text style={styles.label}>2. Ingresa el precio:</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>€</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="0.00"
              placeholderTextColor={THEME.subtext}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={(text) => setPrice(cleanPriceInput(text))}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (isSaving || !storeId) && styles.buttonDisabled]}
            onPress={addPriceEntry}
            disabled={isSaving || !storeId}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Guardar y Comparar</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Precio actual en cada local (Toca para ver detalle):</Text>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} size="large" color={THEME.primary} />
        ) : (
          <FlatList
            data={prices}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => openDetailScreen(item.id)}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.productStore}>📍 {item.storeName}</Text>
                    <Text style={styles.badge}>#{index + 1} Más barato</Text>
                  </View>
                  <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
                  <Text style={styles.metaText}>
                    {formatDate(item.observedAt)}
                    {item.userId === userId ? ' · registrado por ti' : ''}
                  </Text>
                </View>

                {item.userId === userId && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteEntry(item)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Aún no hay precios para {productName}. ¡Registra el primero!
              </Text>
            }
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: THEME.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 15,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.primary,
  },
  productBanner: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
  productBannerLabel: {
    color: THEME.primaryLight,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  productBannerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: THEME.card,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: THEME.card,
    color: THEME.text,
  },
  storesContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  storeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.chipBg,
    marginRight: 8,
  },
  storeChipSelected: {
    backgroundColor: THEME.primary,
  },
  storeChipText: {
    fontSize: 14,
    color: THEME.text,
    fontWeight: '500',
  },
  storeChipTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.primary,
    marginRight: 8,
    marginBottom: 12,
  },
  priceInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: THEME.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: THEME.text,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: THEME.cheapest,
  },
  cardContent: {
    flex: 1,
  },
  productStore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: 'bold',
    color: THEME.primary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: THEME.subtext,
    marginTop: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: THEME.danger,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: THEME.text,
    marginRight: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loader: {
    marginTop: 30,
  },
  metaText: {
    fontSize: 12,
    color: THEME.subtext,
    marginTop: 2,
  },
});
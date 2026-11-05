import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { THEME } from '../constants/theme';
import {
  createOrGetStore,
  currentUserId,
  deletePrice,
  errorMessage,
  fetchProduct,
  fetchStores,
  updatePrice,
  type Store,
  type StorePrice,
} from '../lib/api';
import { cleanPriceInput, formatDate, formatPrice } from '../lib/format';

const OTHER_STORE = 'other';

export default function DetailScreen() {
  const router = useRouter();
  const { productId, productName, priceId } = useLocalSearchParams<{
    productId: string;
    productName: string;
    priceId: string;
  }>();

  const [entry, setEntry] = useState<StorePrice | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [isOwn, setIsOwn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [customStore, setCustomStore] = useState('');
  const [price, setPrice] = useState('');

  const loadEntry = useCallback(async () => {
    try {
      const [product, storeList, uid] = await Promise.all([
        fetchProduct(productId),
        fetchStores(),
        currentUserId(),
      ]);
      const item = product.prices.find((p) => p.id === priceId) ?? null;
      setEntry(item);
      setStores(storeList);
      setIsOwn(item?.userId === uid);
      if (item) resetForm(item);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [productId, priceId]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  const resetForm = (item: StorePrice) => {
    setStoreId(item.storeId);
    setCustomStore('');
    setPrice(item.price.toFixed(2));
  };

  const openMaps = (storeName: string) => {
    const query = encodeURIComponent(`${storeName}`);

    Alert.alert(
      'Buscar local cercano',
      `¿En qué aplicación deseas buscar el ${storeName} más cercano?`,
      [
        {
          text: 'Apple Maps 🍏',
          onPress: () => {
            const url = `maps://?q=${query}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'No se pudo abrir Apple Maps.');
            });
          },
        },
        {
          text: 'Google Maps 🌐',
          onPress: () => {
            const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'No se pudo abrir Google Maps.');
            });
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const saveChanges = async () => {
    Keyboard.dismiss();

    const numericPrice = parseFloat(price);
    if (!price || isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Atención', 'Ingresa un precio válido.');
      return;
    }

    if (storeId === OTHER_STORE && !customStore.trim()) {
      Alert.alert('Atención', 'Por favor escribe el nombre del local.');
      return;
    }

    setIsSaving(true);
    try {
      const finalStoreId =
        storeId === OTHER_STORE ? (await createOrGetStore(customStore.trim())).id : storeId;
      await updatePrice(priceId, { storeId: finalStoreId, price: numericPrice });
      // Si cambió de local, este registro puede dejar de ser el precio actual:
      // se vuelve a la comparativa, que muestra el estado real.
      Alert.alert('Éxito', 'Registro actualizado correctamente.');
      router.back();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar registro',
      `¿Deseas quitar este precio de ${entry?.storeName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePrice(priceId);
              router.back();
            } catch (e) {
              Alert.alert('Error', errorMessage(e));
            }
          },
        },
      ]
    );
  };

  if (isLoading || !entry) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        {isLoading ? (
          <ActivityIndicator size="large" color={THEME.primary} />
        ) : (
          <>
            <Text style={styles.emptyText}>
              {loadError ?? 'Este precio ya no está disponible.'}
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.productBanner}>
          <Text style={styles.productBannerLabel}>Detalle para:</Text>
          <Text style={styles.productBannerTitle}>{productName}</Text>
        </View>

        {!isEditing ? (
          <View style={styles.detailCard}>
            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Supermercado / Local:</Text>
              <Text style={styles.infoValue}>📍 {entry.storeName}</Text>
            </View>

            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Precio:</Text>
              <Text style={styles.priceValue}>{formatPrice(entry.price)}</Text>
            </View>

            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Visto el:</Text>
              <Text style={styles.infoValue}>
                {formatDate(entry.observedAt)}
                {isOwn ? ' · registrado por ti' : ''}
              </Text>
            </View>

            <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(entry.storeName)}>
              <Text style={styles.mapBtnText}>🗺️ Buscar {entry.storeName} más cercano</Text>
            </TouchableOpacity>

            {isOwn && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.actionBtnText}>✏️ Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={handleDelete}
                >
                  <Text style={styles.actionBtnText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.sectionHeader}>Editar Datos del Registro</Text>

            <Text style={styles.label}>Local / Supermercado:</Text>
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
                placeholder="Nombre del local..."
                placeholderTextColor={THEME.subtext}
                value={customStore}
                onChangeText={setCustomStore}
              />
            )}

            <Text style={styles.label}>Precio (€):</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>€</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="0.00"
                placeholderTextColor={THEME.subtext}
                keyboardType="decimal-pad"
                value={price}
                onChangeText={(text) => setPrice(cleanPriceInput(text))}
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn, isSaving && styles.buttonDisabled]}
                onPress={saveChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>💾 Guardar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setIsEditing(false);
                  resetForm(entry);
                }}
              >
                <Text style={styles.actionBtnText}>❌ Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  detailCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoGroup: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: THEME.subtext,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: THEME.cheapest,
  },
  mapBtn: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  mapBtnText: {
    color: THEME.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  editBtn: {
    backgroundColor: THEME.primary,
  },
  deleteBtn: {
    backgroundColor: THEME.danger,
  },
  saveBtn: {
    backgroundColor: THEME.cheapest,
  },
  cancelBtn: {
    backgroundColor: THEME.subtext,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  formCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 15,
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
  emptyText: {
    textAlign: 'center',
    color: THEME.subtext,
    marginTop: 50,
    fontSize: 16,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
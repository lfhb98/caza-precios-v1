import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../constants/theme';

interface PriceEntry {
  id: string;
  store: string;
  price: number;
  imageUri: string | null;
}

const AVAILABLE_STORES = [
  'Mercadona',
  'Carrefour',
  'Consum',
  'Lidl',
  'Dia',
  'Alcampo',
  'Eroski',
  'Otro',
];

export default function CompareScreen() {
  const router = useRouter();
  const { productName } = useLocalSearchParams<{ productName: string }>();

  const storageKey = `@prices_${(productName || 'unknown').toLowerCase()}`;

  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [store, setStore] = useState(AVAILABLE_STORES[0]);
  const [customStore, setCustomStore] = useState('');
  const [price, setPrice] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadPrices();
    }, [productName])
  );

  const loadPrices = async () => {
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored !== null) {
        setEntries(JSON.parse(stored));
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.error('Error al cargar precios:', e);
    }
  };

  const savePrices = async (newList: PriceEntry[]) => {
    try {
      setEntries(newList);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.error('Error al guardar precios:', e);
    }
  };

  const handlePriceChange = (text: string) => {
    let cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    setPrice(cleaned);
  };

  const takePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permiso requerido', 'Se requiere acceso a la galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const selectImageSource = () => {
    Alert.alert(
      'Agregar foto del precio / producto',
      'Selecciona una opción:',
      [
        { text: '📷 Tomar foto con la cámara', onPress: takePhoto },
        { text: '🖼️ Elegir de la galería', onPress: pickFromGallery },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const addPriceEntry = () => {
    Keyboard.dismiss();

    if (!price) {
      Alert.alert('Atención', 'Por favor ingresa un precio.');
      return;
    }

    const finalStore = store === 'Otro' ? customStore.trim() : store;
    if (store === 'Otro' && !finalStore) {
      Alert.alert('Atención', 'Por favor escribe el nombre del local.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert('Atención', 'Ingresa un precio válido en euros.');
      return;
    }

    const newEntry: PriceEntry = {
      id: Date.now().toString(),
      store: finalStore,
      price: numericPrice,
      imageUri,
    };

    const updatedList = [...entries, newEntry].sort((a, b) => a.price - b.price);

    savePrices(updatedList);
    setPrice('');
    setCustomStore('');
    setImageUri(null);
  };

  const confirmDeleteEntry = (id: string, storeName: string) => {
    Alert.alert(
      'Eliminar precio',
      `¿Deseas quitar el registro de ${storeName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const updated = entries.filter((item) => item.id !== id);
            savePrices(updated);
          },
        },
      ]
    );
  };

  const openDetailScreen = (entryId: string) => {
    router.push({
      pathname: '/detail',
      params: { productName, entryId },
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

        <View style={styles.form}>
          <Text style={styles.label}>1. Selecciona el local:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.storesContainer}
            keyboardShouldPersistTaps="handled"
          >
            {AVAILABLE_STORES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.storeChip, store === item && styles.storeChipSelected]}
                onPress={() => setStore(item)}
              >
                <Text
                  style={[
                    styles.storeChipText,
                    store === item && styles.storeChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {store === 'Otro' && (
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
              onChangeText={handlePriceChange}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <View style={styles.imagePickerContainer}>
            <TouchableOpacity style={styles.secondaryButton} onPress={selectImageSource}>
              <Text style={styles.secondaryButtonText}>
                {imageUri ? '📷 / 🖼️ Cambiar Foto' : '📷 / 🖼️ Adjuntar Foto'}
              </Text>
            </TouchableOpacity>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={addPriceEntry}>
            <Text style={styles.primaryButtonText}>Guardar y Comparar</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Precios registrados (Toca para ver detalle):</Text>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => openDetailScreen(item.id)}
            >
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={{ color: THEME.subtext, fontSize: 10 }}>Sin Foto</Text>
                </View>
              )}

              <View style={styles.cardContent}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.productStore}>📍 {item.store}</Text>
                  <Text style={styles.badge}>#{index + 1} Más barato</Text>
                </View>
                <Text style={styles.productPrice}>{item.price.toFixed(2)} €</Text>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => confirmDeleteEntry(item.id, item.store)}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Aún no has registrado precios para {productName}.
            </Text>
          }
        />
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
  imagePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: THEME.chipBg,
    padding: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: THEME.text,
    fontWeight: '600',
  },
  previewImage: {
    width: 45,
    height: 45,
    borderRadius: 8,
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
  cardImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: THEME.chipBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
});
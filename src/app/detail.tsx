import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
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

export default function DetailScreen() {
  const router = useRouter();
  const { productName, entryId } = useLocalSearchParams<{
    productName: string;
    entryId: string;
  }>();

  const storageKey = `@prices_${(productName || 'unknown').toLowerCase()}`;

  const [isEditing, setIsEditing] = useState(false);
  const [store, setStore] = useState('');
  const [customStore, setCustomStore] = useState('');
  const [price, setPrice] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalEntry, setOriginalEntry] = useState<PriceEntry | null>(null);

  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);

  useEffect(() => {
    loadEntry();
  }, [entryId]);

  const loadEntry = async () => {
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored !== null) {
        const list: PriceEntry[] = JSON.parse(stored);
        const item = list.find((e) => e.id === entryId);
        if (item) {
          setOriginalEntry(item);
          setPrice(item.price.toString());
          setImageUri(item.imageUri);

          if (AVAILABLE_STORES.includes(item.store)) {
            setStore(item.store);
            setCustomStore('');
          } else {
            setStore('Otro');
            setCustomStore(item.store);
          }
        }
      }
    } catch (e) {
      console.error('Error al cargar detalle:', e);
    }
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
      'Foto del registro',
      'Selecciona una opción:',
      [
        { text: '📷 Tomar foto con la cámara', onPress: takePhoto },
        { text: '🖼️ Elegir de la galería', onPress: pickFromGallery },
        imageUri
          ? {
              text: '🗑️ Quitar foto',
              style: 'destructive',
              onPress: () => setImageUri(null),
            }
          : null,
        { text: 'Cancelar', style: 'cancel' },
      ].filter(Boolean) as any
    );
  };

  const saveChanges = async () => {
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
      Alert.alert('Atención', 'Ingresa un precio válido.');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored !== null) {
        let list: PriceEntry[] = JSON.parse(stored);
        list = list.map((item) => {
          if (item.id === entryId) {
            return {
              ...item,
              store: finalStore,
              price: numericPrice,
              imageUri,
            };
          }
          return item;
        });

        list.sort((a, b) => a.price - b.price);
        await AsyncStorage.setItem(storageKey, JSON.stringify(list));
        Alert.alert('Éxito', 'Registro actualizado correctamente.');
        setIsEditing(false);
        loadEntry();
      }
    } catch (e) {
      console.error('Error al guardar cambios:', e);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar registro',
      `¿Deseas quitar este precio de ${originalEntry?.store}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(storageKey);
              if (stored !== null) {
                let list: PriceEntry[] = JSON.parse(stored);
                list = list.filter((item) => item.id !== entryId);
                await AsyncStorage.setItem(storageKey, JSON.stringify(list));
                router.back();
              }
            } catch (e) {
              console.error('Error al eliminar:', e);
            }
          },
        },
      ]
    );
  };

  if (!originalEntry) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Cargando detalle...</Text>
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
            {originalEntry.imageUri ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setIsImageViewerVisible(true)}
              >
                <Image
                  source={{ uri: originalEntry.imageUri }}
                  style={styles.largeImage}
                />
                <View style={styles.zoomHintBadge}>
                  <Text style={styles.zoomHintText}>🔍 Toca para ampliar</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.largePlaceholderImage}>
                <Text style={styles.placeholderText}>📷 Sin Foto Adjunta</Text>
              </View>
            )}

            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Supermercado / Local:</Text>
              <Text style={styles.infoValue}>📍 {originalEntry.store}</Text>
            </View>

            <View style={styles.infoGroup}>
              <Text style={styles.infoLabel}>Precio:</Text>
              <Text style={styles.priceValue}>{originalEntry.price.toFixed(2)} €</Text>
            </View>

            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => openMaps(originalEntry.store)}
            >
              <Text style={styles.mapBtnText}>🗺️ Buscar {originalEntry.store} más cercano</Text>
            </TouchableOpacity>

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
              {AVAILABLE_STORES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.storeChip,
                    store === item && styles.storeChipSelected,
                  ]}
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
                onChangeText={handlePriceChange}
              />
            </View>

            <Text style={styles.label}>Foto:</Text>
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={selectImageSource}
              >
                <Text style={styles.secondaryButtonText}>
                  {imageUri ? '📷 / 🖼️ Cambiar Foto' : '📷 / 🖼️ Adjuntar Foto'}
                </Text>
              </TouchableOpacity>
              {imageUri && (
                <TouchableOpacity onPress={() => setIsImageViewerVisible(true)}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={saveChanges}
              >
                <Text style={styles.actionBtnText}>💾 Guardar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setIsEditing(false);
                  loadEntry();
                }}
              >
                <Text style={styles.actionBtnText}>❌ Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {originalEntry.imageUri && (
          <Modal
            visible={isImageViewerVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsImageViewerVisible(false)}
          >
            <SafeAreaView style={styles.modalBackground}>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsImageViewerVisible(false)}
              >
                <Text style={styles.closeModalButtonText}>✕ Cerrar</Text>
              </TouchableOpacity>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                maximumZoomScale={5}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                centerContent={true}
                bouncesZoom={true}
              >
                <Image
                  source={{ uri: isEditing && imageUri ? imageUri : originalEntry.imageUri }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
              </ScrollView>
            </SafeAreaView>
          </Modal>
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
  largeImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  zoomHintBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  zoomHintText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  largePlaceholderImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: THEME.chipBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    color: THEME.subtext,
    fontSize: 16,
    fontWeight: '500',
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
  imagePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
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
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: THEME.subtext,
    marginTop: 50,
    fontSize: 16,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeModalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  ScrollView,
  SafeAreaView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { DEFAULT_STORES } from '@caza-precios/shared';
import { THEME } from '../constants/theme';
import { createOrGetProduct, errorMessage, fetchProducts, type ProductSummary } from '../lib/api';
import { formatPrice } from '../lib/format';
import { loadMyList, saveMyList } from '../lib/my-list';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const byName = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStoresExpanded, setIsStoresExpanded] = useState(true);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const items = await fetchProducts(await loadMyList());
      setProducts(items.sort((a, b) => byName(a.name, b.name)));
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const refresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const openMenu = () => {
    setIsMenuOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = (onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsMenuOpen(false);
      if (onComplete) onComplete();
    });
  };

  // Añade a "mi lista" un producto del catálogo; si no existe, lo crea.
  const addProduct = async () => {
    Keyboard.dismiss();
    const cleanName = newProductName.trim();

    if (!cleanName) {
      Alert.alert('Atención', 'Ingresa un nombre para el producto.');
      return;
    }

    setIsCreating(true);
    try {
      const product = await createOrGetProduct(cleanName);
      const myList = await loadMyList();

      if (myList.includes(product.id)) {
        Alert.alert('Atención', `"${product.name}" ya está en tu lista.`);
        return;
      }

      await saveMyList([...myList, product.id]);
      setNewProductName('');
      await loadData();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setIsCreating(false);
    }
  };

  const confirmRemoveProduct = (product: ProductSummary) => {
    Alert.alert(
      'Quitar de mi lista',
      `¿Deseas quitar "${product.name}" de tu lista? Sus precios seguirán disponibles para la comunidad.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            const myList = await loadMyList();
            await saveMyList(myList.filter((id) => id !== product.id));
            setProducts((current) => current.filter((item) => item.id !== product.id));
          },
        },
      ]
    );
  };

  const openCompareScreen = (product: ProductSummary) => {
    router.push({
      pathname: '/compare',
      params: { productId: product.id, productName: product.name },
    });
  };

  const getActiveStoresList = () => {
    const storesFromCheapest = products.flatMap((product) =>
      product.cheapest ? [product.cheapest.storeName] : []
    );
    return Array.from(new Set([...DEFAULT_STORES, ...storesFromCheapest])).sort(byName);
  };

  const getCheapestCountForStore = (storeName: string) => {
    return products.filter((product) => product.cheapest?.storeName === storeName).length;
  };

  const displayedProducts = selectedStoreFilter
    ? products.filter((product) => product.cheapest?.storeName === selectedStoreFilter)
    : products;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.menuIconButton} onPress={openMenu}>
            <Text style={styles.menuIconText}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi Lista 🛒</Text>
        </View>

        {/* Banner Filtro */}
        {selectedStoreFilter && (
          <View style={styles.activeFilterBanner}>
            <Text style={styles.activeFilterText}>
              Filtrado por: <Text style={styles.activeFilterHighlight}>📍 {selectedStoreFilter}</Text>
            </Text>
            <TouchableOpacity onPress={() => setSelectedStoreFilter(null)}>
              <Text style={styles.clearFilterText}>✕ Ver todos</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error de conexión */}
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Formulario */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nuevo producto (ej. Aceite)"
            placeholderTextColor={THEME.subtext}
            value={newProductName}
            onChangeText={setNewProductName}
            returnKeyType="done"
            onSubmitEditing={addProduct}
            editable={!isCreating}
          />
          <TouchableOpacity
            style={[styles.addButton, isCreating && styles.buttonDisabled]}
            onPress={addProduct}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.addButtonText}>+ Añadir</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          {selectedStoreFilter
            ? `Más baratos en ${selectedStoreFilter}:`
            : 'Selecciona para comparar:'}
        </Text>

        {/* Lista en Cuadrícula */}
        {isLoading ? (
          <ActivityIndicator style={styles.loader} size="large" color={THEME.primary} />
        ) : (
          <FlatList
            data={displayedProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={displayedProducts.length > 1 ? styles.rowWrapper : undefined}
            keyboardShouldPersistTaps="handled"
            refreshing={isRefreshing}
            onRefresh={refresh}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => openCompareScreen(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryIcon}>📦</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmRemoveProduct(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.categoryTitle} numberOfLines={1}>
                  {item.name}
                </Text>

                <View style={styles.cheapestFooter}>
                  {item.cheapest ? (
                    <>
                      <Text style={styles.cheapestLabel}>Más barato en:</Text>
                      <Text style={styles.cheapestStore} numberOfLines={1}>
                        📍 {item.cheapest.storeName}
                      </Text>
                      <Text style={styles.cheapestPrice}>{formatPrice(item.cheapest.price)}</Text>
                    </>
                  ) : (
                    <Text style={styles.noPricesText}>Sin precios</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {selectedStoreFilter
                  ? `No hay productos registrados donde ${selectedStoreFilter} sea el más barato.`
                  : 'Tu lista está vacía. Añade un producto para ver dónde está más barato.'}
              </Text>
            }
          />
        )}

        {/* Modal / Menú Lateral */}
        <Modal
          visible={isMenuOpen}
          animationType="none"
          transparent={true}
          onRequestClose={() => closeMenu()}
        >
          <View style={styles.drawerOverlay}>
            <TouchableWithoutFeedback onPress={() => closeMenu()}>
              <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View
              style={[
                styles.drawerContainer,
                { transform: [{ translateX: slideAnim }] },
              ]}
            >
              <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.drawerHeader}>
                  <Text style={styles.drawerTitle}>Menú 🛍️</Text>
                  <TouchableOpacity onPress={() => closeMenu()}>
                    <Text style={styles.closeDrawerText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.drawerContent}>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      selectedStoreFilter === null && styles.menuItemSelected,
                    ]}
                    onPress={() => {
                      closeMenu(() => setSelectedStoreFilter(null));
                    }}
                  >
                    <Text style={styles.menuItemText}>🏠 Inicio (Ver todos)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => closeMenu(() => router.push('/account'))}
                  >
                    <Text style={styles.menuItemText}>👤 Mi cuenta</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItemHeader}
                    onPress={() => setIsStoresExpanded(!isStoresExpanded)}
                  >
                    <Text style={styles.menuItemHeaderText}>🏪 Supermercados</Text>
                    <Text style={styles.accordionArrow}>
                      {isStoresExpanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {isStoresExpanded && (
                    <View style={styles.storesSubmenu}>
                      {getActiveStoresList().map((storeName) => {
                        const count = getCheapestCountForStore(storeName);
                        const isSelected = selectedStoreFilter === storeName;

                        return (
                          <TouchableOpacity
                            key={storeName}
                            style={[
                              styles.subMenuItem,
                              isSelected && styles.subMenuItemSelected,
                            ]}
                            onPress={() => {
                              closeMenu(() => setSelectedStoreFilter(storeName));
                            }}
                          >
                            <Text
                              style={[
                                styles.subMenuItemText,
                                isSelected && styles.subMenuItemTextSelected,
                              ]}
                            >
                              📍 {storeName}
                            </Text>
                            {count > 0 && (
                              <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{count}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  menuIconButton: {
    paddingRight: 15,
    paddingVertical: 5,
  },
  menuIconText: {
    fontSize: 26,
    color: THEME.primary,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.text,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.primaryLight,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  activeFilterText: {
    fontSize: 14,
    color: THEME.text,
  },
  activeFilterHighlight: {
    fontWeight: 'bold',
    color: THEME.primary,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME.danger,
  },
  formContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: THEME.card,
    color: THEME.text,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: THEME.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: THEME.text,
  },
  rowWrapper: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCard: {
    flex: 0.48,
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
    minHeight: 155,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 24,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    marginVertical: 6,
  },
  cheapestFooter: {
    backgroundColor: THEME.cheapestBg,
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  cheapestLabel: {
    fontSize: 10,
    color: THEME.cheapest,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cheapestStore: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME.text,
    marginTop: 2,
  },
  cheapestPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.cheapest,
    marginTop: 1,
  },
  noPricesText: {
    fontSize: 12,
    color: THEME.subtext,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: THEME.subtext,
    marginTop: 30,
    fontSize: 15,
    paddingHorizontal: 20,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: THEME.card,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.chipBg,
    paddingBottom: 15,
    marginTop: 10,
    marginBottom: 15,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.text,
  },
  closeDrawerText: {
    fontSize: 22,
    color: THEME.subtext,
    fontWeight: 'bold',
    padding: 5,
  },
  drawerContent: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  menuItemSelected: {
    backgroundColor: THEME.primaryLight,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.primary,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 5,
  },
  menuItemHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
  },
  accordionArrow: {
    fontSize: 12,
    color: THEME.subtext,
  },
  storesSubmenu: {
    paddingLeft: 10,
  },
  subMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  subMenuItemSelected: {
    backgroundColor: THEME.primary,
  },
  subMenuItemText: {
    fontSize: 15,
    color: THEME.text,
    fontWeight: '500',
  },
  subMenuItemTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  countBadge: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
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
});
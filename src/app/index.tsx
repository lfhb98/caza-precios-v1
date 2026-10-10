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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../constants/theme';

const STORAGE_KEY = '@products_list_v1';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const DEFAULT_STORES = [
  'Mercadona',
  'Carrefour',
  'Consum',
  'Lidl',
  'Dia',
  'Alcampo',
  'Eroski',
];

interface CheapestInfo {
  store: string;
  price: number;
}

const sortAlphabetically = (list: string[]) => {
  return [...list].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [cheapestInfoMap, setCheapestInfoMap] = useState<
    Record<string, CheapestInfo | null>
  >({});
  const [newCategory, setNewCategory] = useState('');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStoresExpanded, setIsStoresExpanded] = useState(true);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

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

  const loadData = async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      let currentCategories: string[] = [];

      if (storedData !== null) {
        currentCategories = JSON.parse(storedData);
      } else {
        currentCategories = sortAlphabetically(['Arroz', 'Huevos', 'Leche', 'Pan']);
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(currentCategories)
        );
      }

      setCategories(currentCategories);
      await loadCheapestPrices(currentCategories);
    } catch (e) {
      console.error('Error al cargar datos:', e);
    }
  };

  const loadCheapestPrices = async (products: string[]) => {
    const map: Record<string, CheapestInfo | null> = {};

    for (const prod of products) {
      try {
        const priceData = await AsyncStorage.getItem(
          `@prices_${prod.toLowerCase()}`
        );
        if (priceData) {
          const entries = JSON.parse(priceData);
          if (entries.length > 0) {
            const minEntry = entries.reduce(
              (min: any, item: any) => (item.price < min.price ? item : min),
              entries[0]
            );
            map[prod] = { store: minEntry.store, price: minEntry.price };
          } else {
            map[prod] = null;
          }
        } else {
          map[prod] = null;
        }
      } catch (e) {
        map[prod] = null;
      }
    }

    setCheapestInfoMap(map);
  };

  const saveCategories = async (newList: string[]) => {
    try {
      setCategories(newList);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
      await loadCheapestPrices(newList);
    } catch (e) {
      console.error('Error al guardar productos:', e);
    }
  };

  const addCategory = () => {
    Keyboard.dismiss();
    const cleanName = newCategory.trim();

    if (!cleanName) {
      Alert.alert('Atención', 'Ingresa un nombre para el producto.');
      return;
    }

    if (
      categories.some(
        (item) => item.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      Alert.alert('Atención', 'Este producto ya existe en tu lista.');
      return;
    }

    const updatedCategories = sortAlphabetically([...categories, cleanName]);
    saveCategories(updatedCategories);
    setNewCategory('');
  };

  const confirmDeleteCategory = (categoryName: string) => {
    Alert.alert(
      'Eliminar producto',
      `¿Deseas eliminar "${categoryName}" de la lista y sus precios guardados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updated = categories.filter((item) => item !== categoryName);
            await saveCategories(updated);
            await AsyncStorage.removeItem(
              `@prices_${categoryName.toLowerCase()}`
            );
          },
        },
      ]
    );
  };

  const openCompareScreen = (productName: string) => {
    router.push({
      pathname: '/compare',
      params: { productName },
    });
  };

  const getActiveStoresList = () => {
    const customStoresFromCheapest = Object.values(cheapestInfoMap)
      .filter((info): info is CheapestInfo => info !== null)
      .map((info) => info.store);

    const allUniqueStores = Array.from(
      new Set([...DEFAULT_STORES, ...customStoresFromCheapest])
    );

    return allUniqueStores.sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  };

  const getCheapestCountForStore = (storeName: string) => {
    return Object.values(cheapestInfoMap).filter(
      (info) => info !== null && info.store.toLowerCase() === storeName.toLowerCase()
    ).length;
  };

  const displayedCategories = selectedStoreFilter
    ? categories.filter(
        (prod) =>
          cheapestInfoMap[prod]?.store.toLowerCase() ===
          selectedStoreFilter.toLowerCase()
      )
    : categories;

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

        {/* Formulario */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nuevo producto (ej. Aceite)"
            placeholderTextColor={THEME.subtext}
            value={newCategory}
            onChangeText={setNewCategory}
            returnKeyType="done"
            onSubmitEditing={addCategory}
          />
          <TouchableOpacity style={styles.addButton} onPress={addCategory}>
            <Text style={styles.addButtonText}>+ Crear</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          {selectedStoreFilter
            ? `Más baratos en ${selectedStoreFilter}:`
            : 'Selecciona para comparar:'}
        </Text>

        {/* Lista en Cuadrícula */}
        <FlatList
          data={displayedCategories}
          keyExtractor={(item) => item}
          numColumns={2}
          columnWrapperStyle={displayedCategories.length > 1 ? styles.rowWrapper : undefined}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const cheapest = cheapestInfoMap[item];

            return (
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => openCompareScreen(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryIcon}>📦</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteCategory(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.categoryTitle} numberOfLines={1}>
                  {item}
                </Text>

                <View style={styles.cheapestFooter}>
                  {cheapest ? (
                    <>
                      <Text style={styles.cheapestLabel}>Más barato en:</Text>
                      <Text style={styles.cheapestStore} numberOfLines={1}>
                        📍 {cheapest.store}
                      </Text>
                      <Text style={styles.cheapestPrice}>
                        {cheapest.price.toFixed(2)} €
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.noPricesText}>Sin precios</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {selectedStoreFilter
                ? `No hay productos registrados donde ${selectedStoreFilter} sea el más barato.`
                : 'No tienes productos en tu lista.'}
            </Text>
          }
        />

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
});
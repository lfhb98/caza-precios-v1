import AsyncStorage from '@react-native-async-storage/async-storage';

// "Mi lista": los productos del catálogo compartido que le interesan a este
// usuario. Se guarda solo en el móvil; los datos vienen de la API.
const MY_LIST_KEY = '@my_products_v2';

export async function loadMyList(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(MY_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveMyList(productIds: string[]) {
  await AsyncStorage.setItem(MY_LIST_KEY, JSON.stringify(productIds));
}


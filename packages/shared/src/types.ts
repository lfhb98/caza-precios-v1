export interface PriceEntry {
  id: string;
  store: string;
  price: number;
  imageUri: string | null;
}

export interface CheapestInfo {
  store: string;
  price: number;
}

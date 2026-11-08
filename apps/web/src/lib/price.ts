import { priceAmountSchema } from '@caza-precios/shared/schemas';

// Convierte lo que escribe el usuario ("1,5") en un precio válido para la API,
// con las mismas reglas que valida la API (@caza-precios/shared/schemas).
export function parsePrice(text: string): { price: number } | { error: string } {
  if (!text.trim()) return { error: 'Escribe un precio' };
  const result = priceAmountSchema.safeParse(Number(text.replace(',', '.')));
  return result.success ? { price: result.data } : { error: result.error.issues[0].message };
}

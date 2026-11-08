// Formato de precios y fechas, igual en la app móvil y la web.

// Precio introducido por el usuario: coma o punto, como máximo 2 decimales.
export function cleanPriceInput(text: string) {
  const [integer, ...rest] = text.replace(',', '.').replace(/[^0-9.]/g, '').split('.');
  return rest.length > 0 ? `${integer}.${rest.join('').slice(0, 2)}` : integer;
}

export const formatPrice = (price: number) => `${price.toFixed(2)} €`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

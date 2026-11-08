import { z } from 'zod';

// Esquemas de entrada de la API. Los usan la API (validación) y los
// clientes (formularios, tipos de las peticiones).

const MAX_PRICE = 99_999_999.99; // numeric(10,2) en la base de datos

const name = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(max, `El nombre no puede superar ${max} caracteres`);

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

export const priceAmountSchema = z
  .number()
  .positive('El precio debe ser mayor que 0')
  .max(MAX_PRICE, 'El precio es demasiado alto')
  .refine(hasAtMostTwoDecimals, 'El precio admite como máximo 2 decimales');

export const observedAtSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => new Date(value).getTime() <= Date.now() + 5 * 60_000,
    'La fecha no puede estar en el futuro'
  );

export const createStoreSchema = z.object({
  name: name(60),
});

export const createProductSchema = z.object({
  name: name(100),
});

export const createPriceSchema = z.object({
  productId: z.uuid(),
  storeId: z.uuid(),
  price: priceAmountSchema,
  observedAt: observedAtSchema.optional(),
  imagePath: z.string().min(1).max(500).nullable().optional(),
});

export const updatePriceSchema = z
  .object({
    storeId: z.uuid(),
    price: priceAmountSchema,
    observedAt: observedAtSchema,
    imagePath: z.string().min(1).max(500).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'No hay nada que actualizar');

// Login sin contraseña: solo se pide el email y el código que llega por correo.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Escribe tu email')
  .pipe(z.email('Ese email no parece válido'));

// Supabase envía 6 dígitos por defecto; la longitud se puede configurar hasta 10.
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6,10}$/, 'El código son los números que te hemos enviado por email');

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreatePriceInput = z.infer<typeof createPriceSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

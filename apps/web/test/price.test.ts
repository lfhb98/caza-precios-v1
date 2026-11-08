import { describe, expect, it } from 'vitest';
import { parsePrice } from '@/lib/price';

describe('parsePrice', () => {
  it.each([
    ['1,5', 1.5],
    ['1.50', 1.5],
    ['0.01', 0.01],
    ['99999999.99', 99_999_999.99],
  ])('acepta "%s"', (text, price) => {
    expect(parsePrice(text)).toEqual({ price });
  });

  it.each([
    ['', 'Escribe un precio'],
    ['   ', 'Escribe un precio'],
    ['0', 'El precio debe ser mayor que 0'],
    ['-1', 'El precio debe ser mayor que 0'],
    ['1.234', 'El precio admite como máximo 2 decimales'],
    ['100000000', 'El precio es demasiado alto'],
  ])('rechaza "%s"', (text, error) => {
    expect(parsePrice(text)).toEqual({ error });
  });
});

import { DEFAULT_STORES } from '@caza-precios/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;
let ana: { id: string; token: string };
let luis: { id: string; token: string };

beforeAll(async () => {
  ctx = await createTestContext();
  ana = await ctx.createUser('ana');
  luis = await ctx.createUser();
});

afterAll(() => ctx.close());

async function createProduct(name: string) {
  const { status, body } = await ctx.request('POST', '/products', { token: ana.token, body: { name } });
  expect(status).toBe(201);
  return body as { id: string; name: string };
}

async function storeId(name: string) {
  const { body } = await ctx.request('GET', '/stores');
  return (body as { id: string; name: string }[]).find((store) => store.name === name)!.id;
}

describe('general', () => {
  it('GET /health responde 200', async () => {
    const { status, body } = await ctx.request('GET', '/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('una ruta inexistente responde 404 en JSON', async () => {
    const { status, body } = await ctx.request('GET', '/nada');
    expect(status).toBe(404);
    expect(body.error).toBeTypeOf('string');
  });
});

describe('perfiles', () => {
  it('el trigger crea el perfil con el username elegido o uno generado', async () => {
    const own = await ctx.request('GET', '/me', { token: ana.token });
    expect(own.status).toBe(200);
    expect(own.body.username).toBe('ana');

    const generated = await ctx.request('GET', '/me', { token: luis.token });
    expect(generated.body.username).toMatch(/^usuario_[0-9a-f]{12}$/);
  });

  it('si el username está cogido, usa uno generado en vez de fallar el registro', async () => {
    const other = await ctx.createUser('ana');
    const { body } = await ctx.request('GET', '/me', { token: other.token });
    expect(body.username).toMatch(/^usuario_/);
  });

  it('GET /me sin token responde 401', async () => {
    expect((await ctx.request('GET', '/me')).status).toBe(401);
    expect((await ctx.request('GET', '/me', { token: 'falso' })).status).toBe(401);
  });
});

describe('tiendas', () => {
  it('las tiendas por defecto vienen precargadas y primero', async () => {
    const { status, body } = await ctx.request('GET', '/stores');
    expect(status).toBe(200);
    const defaults = body.filter((store: { isDefault: boolean }) => store.isDefault);
    expect(defaults.map((store: { name: string }) => store.name).sort()).toEqual([...DEFAULT_STORES].sort());
  });

  it('crear una tienda requiere sesión', async () => {
    const { status } = await ctx.request('POST', '/stores', { body: { name: 'Aldi' } });
    expect(status).toBe(401);
  });

  it('crea una tienda nueva y rechaza duplicados sin distinguir mayúsculas', async () => {
    const created = await ctx.request('POST', '/stores', { token: ana.token, body: { name: '  Aldi ' } });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Aldi', isDefault: false });

    const duplicate = await ctx.request('POST', '/stores', { token: luis.token, body: { name: 'ALDI' } });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.store.id).toBe(created.body.id);
  });

  it('rechaza un nombre vacío con 400', async () => {
    const { status, body } = await ctx.request('POST', '/stores', { token: ana.token, body: { name: '   ' } });
    expect(status).toBe(400);
    expect(body.issues[0].path).toBe('name');
  });
});

describe('productos', () => {
  it('crea productos y rechaza duplicados', async () => {
    const leche = await createProduct('Leche');
    const duplicate = await ctx.request('POST', '/products', { token: luis.token, body: { name: ' leche ' } });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.product.id).toBe(leche.id);
  });

  it('busca por nombre y escapa los comodines', async () => {
    await createProduct('Arroz redondo');
    await createProduct('Aceite 100%');

    const { body } = await ctx.request('GET', '/products?search=arroz');
    expect(body.map((p: { name: string }) => p.name)).toEqual(['Arroz redondo']);

    const percent = await ctx.request('GET', `/products?search=${encodeURIComponent('%')}`);
    expect(percent.body.map((p: { name: string }) => p.name)).toEqual(['Aceite 100%']);
  });

  it('valida id y paginación', async () => {
    expect((await ctx.request('GET', '/products/no-es-un-uuid')).status).toBe(400);
    expect((await ctx.request('GET', '/products?limit=0')).status).toBe(400);
    const missing = await ctx.request('GET', '/products/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
  });
});

describe('precios', () => {
  it('el precio actual por tienda es la observación más reciente, no la más barata', async () => {
    const huevos = await createProduct('Huevos');
    const lidl = await storeId('Lidl');
    const dia = await storeId('Dia');

    const post = (store: string, price: number, observedAt: string) =>
      ctx.request('POST', '/prices', {
        token: ana.token,
        body: { productId: huevos.id, storeId: store, price, observedAt },
      });

    expect((await post(lidl, 1.5, '2026-01-01T10:00:00Z')).status).toBe(201);
    expect((await post(lidl, 2.1, '2026-02-01T10:00:00Z')).status).toBe(201); // subió
    expect((await post(dia, 1.99, '2026-01-15T10:00:00Z')).status).toBe(201);

    const detail = await ctx.request('GET', `/products/${huevos.id}`);
    expect(detail.body.prices.map((p: { storeName: string; price: number }) => [p.storeName, p.price])).toEqual([
      ['Dia', 1.99],
      ['Lidl', 2.1],
    ]);

    const list = await ctx.request('GET', '/products?search=huevos');
    expect(list.body[0].cheapest).toMatchObject({ storeName: 'Dia', price: 1.99 });

    const history = await ctx.request('GET', `/products/${huevos.id}/history?storeId=${lidl}`);
    expect(history.body.history.map((p: { price: number }) => p.price)).toEqual([2.1, 1.5]);
  });

  it('un producto sin precios tiene cheapest null', async () => {
    await createProduct('Sal');
    const { body } = await ctx.request('GET', '/products?search=sal');
    expect(body[0].cheapest).toBeNull();
  });

  it('valida el importe, la fecha y que existan producto y tienda', async () => {
    const pan = await createProduct('Pan');
    const mercadona = await storeId('Mercadona');
    const send = (body: object) =>
      ctx.request('POST', '/prices', {
        token: ana.token,
        body: { productId: pan.id, storeId: mercadona, ...body },
      });

    expect((await send({ price: 0 })).status).toBe(400);
    expect((await send({ price: 1.234 })).status).toBe(400);
    expect((await send({ price: 1.1 })).status).toBe(201);
    expect((await send({ price: 1, observedAt: '2999-01-01T00:00:00Z' })).status).toBe(400);
    expect((await send({ price: 1, productId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
  });

  it('solo quien registró un precio puede editarlo o borrarlo', async () => {
    const atun = await createProduct('Atún');
    const created = await ctx.request('POST', '/prices', {
      token: ana.token,
      body: { productId: atun.id, storeId: await storeId('Consum'), price: 3.45 },
    });
    expect(created.body.userId).toBe(ana.id);
    const path = `/prices/${created.body.id}`;

    expect((await ctx.request('PATCH', path, { token: luis.token, body: { price: 0.01 } })).status).toBe(403);
    expect((await ctx.request('DELETE', path, { token: luis.token })).status).toBe(403);
    expect((await ctx.request('PATCH', path, { token: ana.token, body: {} })).status).toBe(400);

    const updated = await ctx.request('PATCH', path, { token: ana.token, body: { price: 3.2 } });
    expect(updated.status).toBe(200);
    expect(updated.body.price).toBe(3.2);

    expect((await ctx.request('DELETE', path, { token: ana.token })).status).toBe(204);
    expect((await ctx.request('DELETE', path, { token: ana.token })).status).toBe(404);
  });

  it('registrar precios requiere sesión', async () => {
    const { status } = await ctx.request('POST', '/prices', { body: {} });
    expect(status).toBe(401);
  });
});

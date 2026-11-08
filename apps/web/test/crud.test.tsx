import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CazaPreciosApp } from '@/components/caza-precios-app';
import { startApi, type TestApi, type TestUser } from './setup-api';

// Sesión de Supabase simulada: como en la web real, el usuario anónimo se crea
// en la primera escritura (getSession) y leer no lo crea (existingUserId).
const session = vi.hoisted(() => ({
  user: null as { id: string; token: string } | null,
  signIn: null as null | (() => Promise<{ id: string; token: string }>),
}));

vi.mock('@/lib/supabase', () => ({
  getSession: async () => {
    session.user ??= await session.signIn!();
    return { access_token: session.user.token, user: { id: session.user.id } };
  },
  existingUserId: async () => session.user?.id ?? null,
  // Estos tests no entran con email (eso está en account.test.tsx).
  accountService: {
    getAccount: async () => null,
    onAccountChange: () => () => {},
  },
}));

let api: TestApi;

beforeEach(async () => {
  api = await startApi();
  session.user = null;
  session.signIn = () => api.createUser();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await api.close();
});

// --- Utilidades ---

async function storeId(name: string) {
  const { body } = await api.request('GET', '/stores');
  return body.find((store: { name: string }) => store.name === name).id as string;
}

async function seedProduct(name: string, user: TestUser) {
  const { status, body } = await api.request('POST', '/products', { token: user.token, body: { name } });
  expect(status).toBe(201);
  return body.id as string;
}

async function seedPrice(
  user: TestUser,
  productId: string,
  store: string,
  price: number,
  observedAt?: string
) {
  const { status, body } = await api.request('POST', '/prices', {
    token: user.token,
    body: { productId, storeId: await storeId(store), price, observedAt },
  });
  expect(status).toBe(201);
  return body.id as string;
}

async function productDetail(productId: string) {
  return (await api.request('GET', `/products/${productId}`)).body;
}

// Inicia sesión "como si" este navegador ya hubiera escrito antes.
async function signedInUser() {
  session.user = await api.createUser();
  return session.user;
}

function renderApp() {
  const user = userEvent.setup();
  render(<CazaPreciosApp />);
  return user;
}

async function openProduct(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
  await screen.findByRole('heading', { level: 2, name });
}

// La fila de la tabla de precios de esa tienda (no el formulario de alta).
const priceRow = (store: string) => screen.getByRole('row', { name: new RegExp(store) });

// --- Leer ---

describe('leer', () => {
  it('lista los productos con su precio más barato, sin crear usuario', async () => {
    const owner = await api.createUser();
    const milk = await seedProduct('Leche', owner);
    await seedPrice(owner, milk, 'Lidl', 1.1);
    await seedPrice(owner, milk, 'Mercadona', 0.95);
    await seedProduct('Aceite', owner);

    renderApp();

    const milkItem = await screen.findByRole('button', { name: /^Leche/ });
    expect(milkItem.textContent).toContain('0.95 € · Mercadona');
    expect(screen.getByRole('button', { name: /^Aceite/ }).textContent).toContain('Sin precios');
    expect(session.user).toBeNull();
  });

  it('busca productos por nombre', async () => {
    const owner = await api.createUser();
    await seedProduct('Leche entera', owner);
    await seedProduct('Aceite de oliva', owner);
    const user = renderApp();
    await screen.findByRole('button', { name: /^Aceite de oliva/ });

    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'LECHE');

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Aceite de oliva/ })).toBeNull()
    );
    expect(screen.getByRole('button', { name: /^Leche entera/ })).toBeTruthy();
  });

  it('muestra los precios por tienda, del más barato al más caro, y el historial', async () => {
    const owner = await api.createUser();
    const milk = await seedProduct('Leche', owner);
    await seedPrice(owner, milk, 'Lidl', 1.2, '2026-01-01T10:00:00Z');
    await seedPrice(owner, milk, 'Lidl', 1.1, '2026-02-01T10:00:00Z');
    await seedPrice(owner, milk, 'Dia', 1.3, '2026-01-15T10:00:00Z');
    const user = renderApp();

    await openProduct(user, 'Leche');

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Lidl1\.10 €más barato/),
      expect.stringMatching(/^Dia1\.30 €/),
    ]);

    await user.click(screen.getByRole('button', { name: 'Ver historial de precios' }));
    const history = await screen.findByRole('list', { name: 'Historial de precios' });
    const entries = within(history).getAllByRole('listitem');
    expect(entries.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Lidl1.10 €'),
      expect.stringContaining('Dia1.30 €'),
      expect.stringContaining('Lidl1.20 €'),
    ]);
  });
});

// --- Crear ---

describe('crear', () => {
  it('crea un producto, lo selecciona y crea el usuario anónimo', async () => {
    const user = renderApp();
    await screen.findByText('Aún no hay productos.');

    await user.type(screen.getByRole('textbox', { name: 'Nombre del producto nuevo' }), 'Aceite');
    await user.click(screen.getByRole('button', { name: '+ Añadir' }));

    await screen.findByText('"Aceite" añadido al catálogo.');
    await screen.findByRole('heading', { level: 2, name: 'Aceite' });
    expect(await screen.findByRole('button', { name: /^Aceite/ })).toBeTruthy();

    const { body } = await api.request('GET', '/products');
    expect(body.map((product: { name: string }) => product.name)).toEqual(['Aceite']);
    expect(session.user).not.toBeNull();
  });

  it('no duplica un producto que ya existe', async () => {
    await seedProduct('Aceite', await api.createUser());
    const user = renderApp();
    await screen.findByRole('button', { name: /^Aceite/ });

    await user.type(screen.getByRole('textbox', { name: 'Nombre del producto nuevo' }), ' aceite ');
    await user.click(screen.getByRole('button', { name: '+ Añadir' }));

    await screen.findByText('"Aceite" ya existía; te lo mostramos.');
    expect((await api.request('GET', '/products')).body).toHaveLength(1);
  });

  it('no envía un producto sin nombre', async () => {
    const user = renderApp();
    await screen.findByText('Aún no hay productos.');

    await user.click(screen.getByRole('button', { name: '+ Añadir' }));

    expect(screen.getByText('Escribe el nombre del producto.')).toBeTruthy();
    expect(api.calls()).not.toContain('POST /products');
  });

  it('registra un precio en la tienda elegida', async () => {
    const productId = await seedProduct('Arroz', await api.createUser());
    const user = renderApp();
    await openProduct(user, 'Arroz');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tienda' }), 'Lidl');
    await user.type(screen.getByRole('textbox', { name: 'Precio en euros' }), '1,5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(priceRow('Lidl').textContent).toContain('1.50 €'));
    expect(priceRow('Lidl').textContent).toContain('tuyo');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Arroz/ }).textContent).toContain('1.50 € · Lidl')
    );

    const detail = await productDetail(productId);
    expect(detail.prices).toHaveLength(1);
    expect(detail.prices[0]).toMatchObject({
      storeName: 'Lidl',
      price: 1.5,
      userId: session.user!.id,
    });
  });

  it.each([
    ['', 'Escribe un precio'],
    ['0', 'El precio debe ser mayor que 0'],
    ['100000000', 'El precio es demasiado alto'],
  ])('rechaza el precio "%s" sin llamar a la API', async (text, message) => {
    await seedProduct('Arroz', await api.createUser());
    const user = renderApp();
    await openProduct(user, 'Arroz');

    if (text) await user.type(screen.getByRole('textbox', { name: 'Precio en euros' }), text);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(api.calls()).not.toContain('POST /prices');
  });

  it('crea una tienda y avisa si ya existe', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Tiendas' }));
    await screen.findByText('📍 Mercadona');

    const input = screen.getByRole('textbox', { name: 'Nombre de la tienda nueva' });
    await user.type(input, 'Ahorramás');
    await user.click(screen.getByRole('button', { name: '+ Añadir' }));
    await screen.findByText('"Ahorramás" añadida.');
    expect(await screen.findByText('📍 Ahorramás')).toBeTruthy();

    await user.type(input, 'mercadona');
    await user.click(screen.getByRole('button', { name: '+ Añadir' }));
    await screen.findByText('Ya existe una tienda llamada "Mercadona".');

    const { body } = await api.request('GET', '/stores');
    expect(body.filter((store: { name: string }) => /mercadona|ahorramás/i.test(store.name))).toHaveLength(2);
  });
});

// --- Editar ---

describe('editar', () => {
  it('corrige el precio y la tienda de un precio propio', async () => {
    const me = await signedInUser();
    const productId = await seedProduct('Arroz', me);
    const priceId = await seedPrice(me, productId, 'Lidl', 1.2);
    const user = renderApp();
    await openProduct(user, 'Arroz');

    await user.click(within(priceRow('Lidl')).getByRole('button', { name: 'Editar' }));
    const input = within(screen.getByRole('table')).getByRole('textbox', { name: 'Precio en euros' });
    const editRow = input.closest('tr')!;
    await user.selectOptions(within(editRow).getByRole('combobox', { name: 'Tienda' }), 'Dia');
    await user.clear(input);
    await user.type(input, '0.99');
    await user.click(within(editRow).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(priceRow('Dia').textContent).toContain('0.99 €'));
    expect(screen.queryByRole('row', { name: /Lidl/ })).toBeNull();

    // Se corrige el mismo precio (PATCH), no se crea otro.
    expect(api.calls()).toContain('PATCH /prices/' + priceId);
    const detail = await productDetail(productId);
    expect(detail.prices).toEqual([
      expect.objectContaining({ id: priceId, storeName: 'Dia', price: 0.99 }),
    ]);
  });

  it('cancelar la edición no cambia nada', async () => {
    const me = await signedInUser();
    const productId = await seedProduct('Arroz', me);
    await seedPrice(me, productId, 'Lidl', 1.2);
    const user = renderApp();
    await openProduct(user, 'Arroz');

    await user.click(within(priceRow('Lidl')).getByRole('button', { name: 'Editar' }));
    const input = within(screen.getByRole('table')).getByRole('textbox', { name: 'Precio en euros' });
    await user.clear(input);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(priceRow('Lidl').textContent).toContain('1.20 €');
    expect(api.calls().some((call) => call.startsWith('PATCH'))).toBe(false);
  });

  it('no deja editar ni borrar precios de otros usuarios', async () => {
    const me = await signedInUser();
    const other = await api.createUser();
    const productId = await seedProduct('Arroz', other);
    await seedPrice(other, productId, 'Lidl', 1.2);
    await seedPrice(me, productId, 'Dia', 1.4);
    const user = renderApp();
    await openProduct(user, 'Arroz');

    const othersRow = priceRow('Lidl');
    expect(within(othersRow).queryByRole('button')).toBeNull();
    expect(othersRow.textContent).not.toContain('tuyo');

    const myRow = priceRow('Dia');
    expect(within(myRow).getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(within(myRow).getByRole('button', { name: 'Borrar' })).toBeTruthy();
  });
});

// --- Borrar ---

describe('borrar', () => {
  it('borra un precio propio tras confirmar', async () => {
    const me = await signedInUser();
    const productId = await seedProduct('Arroz', me);
    const priceId = await seedPrice(me, productId, 'Lidl', 1.2);
    const user = renderApp();
    await openProduct(user, 'Arroz');

    await user.click(within(priceRow('Lidl')).getByRole('button', { name: 'Borrar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    await screen.findByText('Nadie ha registrado todavía un precio de este producto.');
    expect(api.calls()).toContain('DELETE /prices/' + priceId);
    expect((await productDetail(productId)).prices).toEqual([]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Arroz/ }).textContent).toContain('Sin precios')
    );
  });

  it('decir "No" al confirmar no borra', async () => {
    const me = await signedInUser();
    const productId = await seedProduct('Arroz', me);
    await seedPrice(me, productId, 'Lidl', 1.2);
    const user = renderApp();
    await openProduct(user, 'Arroz');

    await user.click(within(priceRow('Lidl')).getByRole('button', { name: 'Borrar' }));
    await user.click(screen.getByRole('button', { name: 'No' }));

    expect(priceRow('Lidl').textContent).toContain('1.20 €');
    expect(api.calls().some((call) => call.startsWith('DELETE'))).toBe(false);
    expect((await productDetail(productId)).prices).toHaveLength(1);
  });

  it('al borrar el precio actual vuelve a mostrarse el anterior de esa tienda', async () => {
    const me = await signedInUser();
    const productId = await seedProduct('Arroz', me);
    await seedPrice(me, productId, 'Lidl', 1.2, '2026-01-01T10:00:00Z');
    await seedPrice(me, productId, 'Lidl', 1.5, '2026-02-01T10:00:00Z');
    const user = renderApp();
    await openProduct(user, 'Arroz');
    expect(priceRow('Lidl').textContent).toContain('1.50 €');

    await user.click(within(priceRow('Lidl')).getByRole('button', { name: 'Borrar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    await waitFor(() => expect(priceRow('Lidl').textContent).toContain('1.20 €'));
  });
});

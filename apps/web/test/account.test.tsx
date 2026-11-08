import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Account, AccountService } from '@caza-precios/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CazaPreciosApp } from '@/components/caza-precios-app';
import { startApi, type TestApi, type TestUser } from './setup-api';

// Login en la web: el formulario es el de @caza-precios/ui (React Native,
// pintado con react-native-web). Supabase se simula: "verificar el código"
// cambia la sesión al usuario indicado en `auth.nextUser`.
const auth = vi.hoisted(() => ({
  user: null as { id: string; token: string; email: string | null } | null,
  nextUser: null as { id: string; token: string; email: string } | null,
  listeners: new Set<(account: unknown) => void>(),
}));

vi.mock('@/lib/supabase', () => {
  const toAccount = () =>
    auth.user ? { id: auth.user.id, email: auth.user.email, isAnonymous: auth.user.email === null } : null;
  const notify = () => auth.listeners.forEach((listener) => listener(toAccount()));

  const accountService: AccountService = {
    getAccount: async () => toAccount() as Account | null,
    onAccountChange: (listener) => {
      auth.listeners.add(listener as (account: unknown) => void);
      return () => auth.listeners.delete(listener as (account: unknown) => void);
    },
    sendCode: async () => {},
    verifyCode: async () => {
      auth.user = auth.nextUser;
      notify();
    },
    signOut: async () => {
      auth.user = null;
      notify();
    },
  };

  return {
    accountService,
    getSession: async () => ({ access_token: auth.user!.token, user: { id: auth.user!.id } }),
    existingUserId: async () => auth.user?.id ?? null,
  };
});

let api: TestApi;

beforeEach(async () => {
  api = await startApi();
  auth.user = null;
  auth.nextUser = null;
  auth.listeners.clear();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await api.close();
});

async function login(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.click(await screen.findByRole('button', { name: 'Entrar' }));
  const panel = screen.getByRole('region', { name: 'Mi cuenta' });
  await user.type(await within(panel).findByRole('textbox', { name: 'Email' }), email);
  await user.click(within(panel).getByRole('button', { name: 'Enviarme un código' }));
  await user.type(await within(panel).findByRole('textbox', { name: 'Código' }), '123456');
  await user.click(within(panel).getByRole('button', { name: 'Entrar' }));
}

async function seedPriceFor(owner: TestUser, product: string) {
  const { body: created } = await api.request('POST', '/products', {
    token: owner.token,
    body: { name: product },
  });
  const { body: stores } = await api.request('GET', '/stores');
  await api.request('POST', '/prices', {
    token: owner.token,
    body: { productId: created.id, storeId: stores[0].id, price: 1.5 },
  });
}

describe('login', () => {
  it('entra con email y código desde la cabecera', async () => {
    const user = userEvent.setup();
    const ana = await api.createUser();
    auth.nextUser = { ...ana, email: 'ana@example.com' };
    render(<CazaPreciosApp />);

    await login(user, 'ana@example.com');

    // El panel se cierra y la cabecera muestra la cuenta.
    expect(await screen.findByRole('button', { name: '👤 ana@example.com' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Mi cuenta' })).toBeNull();
  });

  it('cierra la sesión', async () => {
    const user = userEvent.setup();
    const ana = await api.createUser();
    auth.user = { ...ana, email: 'ana@example.com' };
    render(<CazaPreciosApp />);

    await user.click(await screen.findByRole('button', { name: '👤 ana@example.com' }));
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('al entrar en tu cuenta aparecen como "tuyos" los precios que registraste en otro dispositivo', async () => {
    const user = userEvent.setup();
    const ana = await api.createUser();
    await seedPriceFor(ana, 'Leche');
    // En este navegador hay un usuario anónimo distinto.
    const anonymous = await api.createUser();
    auth.user = { ...anonymous, email: null };
    auth.nextUser = { ...ana, email: 'ana@example.com' };
    render(<CazaPreciosApp />);

    await user.click(await screen.findByRole('button', { name: /^Leche/ }));
    const table = await screen.findByRole('table');
    expect(within(table).queryByText('tuyo')).toBeNull();

    await login(user, 'ana@example.com');

    expect(await within(await screen.findByRole('table')).findByText('tuyo')).toBeTruthy();
  });
});

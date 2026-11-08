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
    // Como Supabase: el enlace del email vuelve con la sesión en el fragmento.
    completeSignInFromUrl: async (url) => {
      if (url.includes('error_code=otp_expired')) {
        throw new Error('El código o el enlace no es válido o ha caducado. Pide uno nuevo.');
      }
      if (!url.includes('access_token=')) return false;
      auth.user = auth.nextUser;
      notify();
      return true;
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
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  await api.close();
});

async function login(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.click(await screen.findByRole('button', { name: 'Entrar' }));
  const panel = screen.getByRole('region', { name: 'Mi cuenta' });
  await user.type(await within(panel).findByRole('textbox', { name: 'Email' }), email);
  await user.click(within(panel).getByRole('button', { name: 'Enviarme el email' }));
  await user.type(await within(panel).findByRole('textbox', { name: 'Código' }), '123456');
  await user.click(within(panel).getByRole('button', { name: 'Entrar con el código' }));
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

  it('entra al volver del enlace del email y quita el token de la URL', async () => {
    const ana = await api.createUser();
    auth.nextUser = { ...ana, email: 'ana@example.com' };
    window.history.replaceState(null, '', '/#access_token=AT&refresh_token=RT&type=magiclink');
    render(<CazaPreciosApp />);

    expect(await screen.findByRole('button', { name: '👤 ana@example.com' })).toBeTruthy();
    expect(window.location.hash).toBe('');
  });

  it('si el enlace ha caducado, abre "Mi cuenta" con el aviso', async () => {
    window.history.replaceState(
      null,
      '',
      '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
    );
    render(<CazaPreciosApp />);

    const panel = await screen.findByRole('region', { name: 'Mi cuenta' });
    expect((await within(panel).findByRole('alert')).textContent).toMatch(/ha caducado/);
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
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

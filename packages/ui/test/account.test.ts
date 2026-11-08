import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AccountError, createAccountService } from '../src/account';

type FakeUser = { id: string; email?: string; is_anonymous?: boolean };

// Cliente de Supabase falso: solo los métodos de auth que usa el servicio.
function fakeSupabase(user: FakeUser | null, overrides: Record<string, unknown> = {}) {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: user ? { user } : null } })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn(),
    ...overrides,
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

const authError = (code: string, message = code) => ({ data: {}, error: { code, message } });

describe('createAccountService', () => {
  it('sin sesión: envía el código para entrar y lo verifica como login', async () => {
    const { client, auth } = fakeSupabase(null);
    const service = createAccountService(() => client);

    await service.sendCode('ana@example.com');
    await service.verifyCode('ana@example.com', '123456');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      options: { shouldCreateUser: true },
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('usuario anónimo: le añade el email (conserva sus precios) y verifica el cambio de email', async () => {
    const { client, auth } = fakeSupabase({ id: 'anon-1', is_anonymous: true });
    const service = createAccountService(() => client);

    await service.sendCode('ana@example.com');
    await service.verifyCode('ana@example.com', '123456');

    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'ana@example.com' });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ type: 'email_change' }));
  });

  it('usuario anónimo con un email que ya tiene cuenta: entra en esa cuenta', async () => {
    const { client, auth } = fakeSupabase(
      { id: 'anon-1', is_anonymous: true },
      { updateUser: vi.fn(async () => authError('email_exists')) }
    );
    const service = createAccountService(() => client);

    await service.sendCode('ana@example.com');
    await service.verifyCode('ana@example.com', '123456');

    expect(auth.signInWithOtp).toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ type: 'email' }));
  });

  it('traduce los errores conocidos de Supabase', async () => {
    const { client } = fakeSupabase(null, {
      verifyOtp: vi.fn(async () => authError('otp_expired', 'Token has expired or is invalid')),
    });
    const service = createAccountService(() => client);

    await expect(service.verifyCode('ana@example.com', '000000')).rejects.toThrow(
      new AccountError('El código no es correcto o ha caducado. Pide uno nuevo.')
    );
  });

  it('un error desconocido al añadir el email no intenta entrar en otra cuenta', async () => {
    const { client, auth } = fakeSupabase(
      { id: 'anon-1', is_anonymous: true },
      { updateUser: vi.fn(async () => authError('over_email_send_rate_limit')) }
    );
    const service = createAccountService(() => client);

    await expect(service.sendCode('ana@example.com')).rejects.toThrow(/demasiados códigos/);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('getAccount distingue usuario anónimo, cuenta con email y sin sesión', async () => {
    const anon = createAccountService(() => fakeSupabase({ id: 'a', is_anonymous: true }).client);
    const real = createAccountService(() => fakeSupabase({ id: 'b', email: 'b@example.com' }).client);
    const none = createAccountService(() => fakeSupabase(null).client);

    expect(await anon.getAccount()).toEqual({ id: 'a', email: null, isAnonymous: true });
    expect(await real.getAccount()).toEqual({ id: 'b', email: 'b@example.com', isAnonymous: false });
    expect(await none.getAccount()).toBeNull();
  });

  it('cierra la sesión solo en este dispositivo', async () => {
    const { client, auth } = fakeSupabase({ id: 'b', email: 'b@example.com' });
    await createAccountService(() => client).signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

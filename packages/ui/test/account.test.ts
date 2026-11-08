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
    setSession: vi.fn(async () => ({ data: {}, error: null })),
    onAuthStateChange: vi.fn(),
    ...overrides,
  };
  return { client: { auth } as unknown as SupabaseClient, auth };
}

const authError = (code: string, message = code) => ({ data: {}, error: { code, message } });

describe('createAccountService', () => {
  it('sin sesión: envía el email para entrar y verifica el código como login', async () => {
    const { client, auth } = fakeSupabase(null);
    const service = createAccountService(() => client, {
      redirectTo: () => 'https://web.example/',
    });

    await service.sendCode('ana@example.com');
    await service.verifyCode('ana@example.com', '123456');

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      options: { shouldCreateUser: true, emailRedirectTo: 'https://web.example/' },
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
    const service = createAccountService(() => client, {
      redirectTo: () => 'https://web.example/',
    });

    await service.sendCode('ana@example.com');
    await service.verifyCode('ana@example.com', '123456');

    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: 'ana@example.com' },
      { emailRedirectTo: 'https://web.example/' }
    );
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
      new AccountError('El código o el enlace no es válido o ha caducado. Pide uno nuevo.')
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

  describe('al volver del enlace del email', () => {
    it('guarda la sesión que trae la URL (#access_token...)', async () => {
      const { client, auth } = fakeSupabase(null);
      const service = createAccountService(() => client);

      const handled = await service.completeSignInFromUrl(
        'https://web.example/#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=magiclink'
      );

      expect(handled).toBe(true);
      expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    });

    it('también en la app móvil (exp://.../--/account#...)', async () => {
      const { client, auth } = fakeSupabase(null);
      const service = createAccountService(() => client);

      await service.completeSignInFromUrl(
        'exp://192.168.1.20:8081/--/account#access_token=AT&refresh_token=RT&type=email_change'
      );

      expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    });

    it('explica el error si el enlace ha caducado', async () => {
      const { client, auth } = fakeSupabase(null);
      const service = createAccountService(() => client);

      await expect(
        service.completeSignInFromUrl(
          'https://web.example/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
        )
      ).rejects.toThrow(/no es válido o ha caducado/);
      expect(auth.setSession).not.toHaveBeenCalled();
    });

    it('una URL normal no hace nada', async () => {
      const { client, auth } = fakeSupabase(null);
      const service = createAccountService(() => client);

      expect(await service.completeSignInFromUrl('https://web.example/?q=leche#top')).toBe(false);
      expect(auth.setSession).not.toHaveBeenCalled();
    });
  });

  it('cierra la sesión solo en este dispositivo', async () => {
    const { client, auth } = fakeSupabase({ id: 'b', email: 'b@example.com' });
    await createAccountService(() => client).signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, AccountService } from '../src/account';
import { AccountError } from '../src/account';
import { AccountPanel } from '../src/account-panel';

// Servicio de cuenta falso con una sesión que se puede cambiar desde el test.
function fakeService(initial: Account | null, overrides: Partial<AccountService> = {}) {
  let listener: ((account: Account | null) => void) | null = null;
  const service: AccountService = {
    getAccount: vi.fn(async () => initial),
    onAccountChange: vi.fn((next) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
    sendCode: vi.fn(async () => {}),
    verifyCode: vi.fn(async () => {
      listener?.({ id: 'u1', email: 'ana@example.com', isAnonymous: false });
    }),
    signOut: vi.fn(async () => listener?.(null)),
    ...overrides,
  };
  return service;
}

afterEach(cleanup);

const emailInput = () => screen.findByRole('textbox', { name: 'Email' });
const button = (name: string) => screen.getByRole('button', { name });

describe('AccountPanel (formulario compartido web/móvil)', () => {
  it('entra con email y código, y luego muestra la cuenta', async () => {
    const user = userEvent.setup();
    const service = fakeService(null);
    const onSignedIn = vi.fn();
    render(<AccountPanel service={service} onSignedIn={onSignedIn} />);

    await user.type(await emailInput(), '  Ana@Example.com ');
    await user.click(button('Enviarme un código'));

    // Se envía el email normalizado y se pasa al paso del código.
    expect(service.sendCode).toHaveBeenCalledWith('ana@example.com');
    expect(await screen.findByText(/Hemos enviado un código a/)).toBeTruthy();

    await user.type(screen.getByRole('textbox', { name: 'Código' }), '12 34-56');
    await user.click(button('Entrar'));

    expect(service.verifyCode).toHaveBeenCalledWith('ana@example.com', '123456');
    expect(onSignedIn).toHaveBeenCalled();
    expect(await screen.findByText(/Has entrado como/)).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
  });

  it('valida el email antes de enviar nada', async () => {
    const user = userEvent.setup();
    const service = fakeService(null);
    render(<AccountPanel service={service} />);

    await user.click(await screen.findByRole('button', { name: 'Enviarme un código' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Escribe tu email');

    await user.type(await emailInput(), 'ana@');
    await user.click(button('Enviarme un código'));
    expect(screen.getByRole('alert').textContent).toBe('Ese email no parece válido');
    expect(service.sendCode).not.toHaveBeenCalled();
  });

  it('valida el código y muestra los errores de Supabase', async () => {
    const user = userEvent.setup();
    const service = fakeService(null, {
      verifyCode: vi.fn(async () => {
        throw new AccountError('El código no es correcto o ha caducado. Pide uno nuevo.');
      }),
    });
    render(<AccountPanel service={service} />);

    await user.type(await emailInput(), 'ana@example.com');
    await user.click(button('Enviarme un código'));
    await user.type(await screen.findByRole('textbox', { name: 'Código' }), '123');
    await user.click(button('Entrar'));
    expect(screen.getByRole('alert').textContent).toMatch(/números que te hemos enviado/);
    expect(service.verifyCode).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Código' }), '456');
    await user.click(button('Entrar'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ha caducado/);
    expect(screen.queryByText(/Has entrado como/)).toBeNull();
  });

  it('permite cambiar de email y reenviar el código', async () => {
    const user = userEvent.setup();
    const service = fakeService(null);
    render(<AccountPanel service={service} />);

    await user.type(await emailInput(), 'ana@example.com');
    await user.click(button('Enviarme un código'));
    await user.click(await screen.findByRole('button', { name: 'Reenviar código' }));
    expect(service.sendCode).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toBeTruthy();

    await user.click(button('Usar otro email'));
    expect(await emailInput()).toBeTruthy();
  });

  it('a un usuario anónimo le avisa de que conserva sus precios', async () => {
    render(<AccountPanel service={fakeService({ id: 'a', email: null, isAnonymous: true })} />);
    expect(await screen.findByText(/pasarán a tu cuenta/)).toBeTruthy();
  });

  it('con sesión, cierra la sesión y vuelve al formulario', async () => {
    const user = userEvent.setup();
    const service = fakeService({ id: 'u1', email: 'ana@example.com', isAnonymous: false });
    render(<AccountPanel service={service} />);

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(service.signOut).toHaveBeenCalled();
    expect(await emailInput()).toBeTruthy();
  });
});

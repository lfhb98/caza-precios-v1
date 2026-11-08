import { useEffect, useState } from 'react';
import type { Account, AccountService } from './account';

// Cuenta actual, actualizada al entrar, salir o refrescar la sesión.
// `ready` es false hasta saber si hay sesión (para no mostrar "Entrar" de más).
export function useAccount(service: AccountService) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const update = (next: Account | null) => {
      if (!active) return;
      setAccount(next);
      setReady(true);
    };

    service.getAccount().then(update, () => update(null));
    let unsubscribe = () => {};
    try {
      unsubscribe = service.onAccountChange(update);
    } catch {
      update(null);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  return { account, ready, isSignedIn: account !== null && !account.isAnonymous };
}

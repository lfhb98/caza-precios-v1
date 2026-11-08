'use client';

import { cleanPriceInput, formatDate, formatPrice } from '@caza-precios/shared';
import { useState, type FormEvent } from 'react';
import { deletePrice, errorMessage, updatePrice, type Store, type StorePrice } from '@/lib/api';
import { parsePrice } from '@/lib/price';

type Props = {
  price: StorePrice;
  isCheapest: boolean;
  isOwn: boolean;
  stores: Store[];
  onChanged: () => Promise<void>;
};

type Mode = 'view' | 'edit' | 'confirm-delete';

// Una fila de la tabla de precios: ver, editar en línea o borrar (solo los propios).
export function PriceRow({ price, isCheapest, isOwn, stores, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [storeId, setStoreId] = useState(price.storeId);
  const [priceText, setPriceText] = useState(price.price.toFixed(2));
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setStoreId(price.storeId);
    setPriceText(price.price.toFixed(2));
    setError(null);
    setMode('edit');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parsePrice(priceText);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }

    const changes = {
      ...(storeId !== price.storeId && { storeId }),
      ...(parsed.price !== price.price && { price: parsed.price }),
    };
    if (Object.keys(changes).length === 0) {
      setMode('view');
      return;
    }

    await run(() => updatePrice(price.id, changes));
  };

  const remove = () => run(() => deletePrice(price.id));

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      setMode('view');
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  if (mode === 'edit') {
    return (
      <tr className="editing">
        <td colSpan={4}>
          <form className="inline-form" onSubmit={save}>
            <select
              aria-label="Tienda"
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              disabled={isBusy}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Precio en euros"
              inputMode="decimal"
              value={priceText}
              onChange={(event) => setPriceText(cleanPriceInput(event.target.value))}
              disabled={isBusy}
              autoFocus
            />
            <button className="button primary" type="submit" disabled={isBusy}>
              {isBusy ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="button" type="button" onClick={() => setMode('view')} disabled={isBusy}>
              Cancelar
            </button>
          </form>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className={isCheapest ? 'cheapest' : undefined}>
      <td>
        {price.storeName}
        {isOwn && <span className="badge">tuyo</span>}
      </td>
      <td className="price">
        {formatPrice(price.price)}
        {isCheapest && <span className="badge cheapest-badge">más barato</span>}
      </td>
      <td className="muted">{formatDate(price.observedAt)}</td>
      <td className="actions">
        {isOwn &&
          (mode === 'confirm-delete' ? (
            <>
              <span className="small">¿Borrar?</span>
              <button className="button danger" onClick={remove} disabled={isBusy}>
                Sí, borrar
              </button>
              <button className="button" onClick={() => setMode('view')} disabled={isBusy}>
                No
              </button>
            </>
          ) : (
            <>
              <button className="button" onClick={startEditing}>
                Editar
              </button>
              <button className="button danger-outline" onClick={() => setMode('confirm-delete')}>
                Borrar
              </button>
            </>
          ))}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

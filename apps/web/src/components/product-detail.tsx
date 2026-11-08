'use client';

import { cleanPriceInput, formatDate, formatPrice } from '@caza-precios/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  createPrice,
  errorMessage,
  existingUserId,
  fetchHistory,
  fetchProduct,
  type PriceHistory,
  type ProductDetail as Product,
  type Store,
} from '@/lib/api';
import { parsePrice } from '@/lib/price';
import { PriceRow } from './price-row';

type Props = {
  productId: string;
  stores: Store[];
  storesError: string | null;
  onPricesChanged: () => void;
  onBack: () => void;
};

export function ProductDetail({ productId, stores, storesError, onPricesChanged, onBack }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      const [item, uid] = await Promise.all([fetchProduct(productId), existingUserId()]);
      setProduct(item);
      setUserId(uid);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [productId]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchHistory(productId));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // Tras crear, editar o borrar un precio: recarga este producto, su historial y la lista.
  const handleChanged = async () => {
    await Promise.all([load(), showHistory ? loadHistory() : null]);
    onPricesChanged();
  };

  return (
    <section className="panel product-detail" aria-labelledby="detail-title">
      <button className="link-button back-button" onClick={onBack}>
        ← Volver a la lista
      </button>

      {loadError && (
        <div className="notice error" role="alert">
          <span>{loadError}</span>
          <button className="link-button" onClick={load}>
            Reintentar
          </button>
        </div>
      )}

      {!product ? (
        !loadError && <p className="muted">Cargando…</p>
      ) : (
        <>
          <h2 id="detail-title">{product.name}</h2>

          <h3>Precio actual en cada tienda</h3>
          {product.prices.length === 0 ? (
            <p className="muted">Nadie ha registrado todavía un precio de este producto.</p>
          ) : (
            <table className="prices-table">
              <thead>
                <tr>
                  <th scope="col">Tienda</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {product.prices.map((price, index) => (
                  <PriceRow
                    key={price.id}
                    price={price}
                    isCheapest={index === 0 && product.prices.length > 1}
                    isOwn={price.userId === userId}
                    stores={stores}
                    onChanged={handleChanged}
                  />
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">
            Los precios son de la comunidad: solo puedes editar o borrar los que registraste tú.
          </p>

          <AddPriceForm
            productId={product.id}
            stores={stores}
            storesError={storesError}
            onCreated={handleChanged}
          />

          <button className="link-button" onClick={() => setShowHistory((value) => !value)}>
            {showHistory ? 'Ocultar historial' : 'Ver historial de precios'}
          </button>
          {showHistory &&
            (history === null ? (
              <p className="muted">Cargando historial…</p>
            ) : history.length === 0 ? (
              <p className="muted">Sin historial.</p>
            ) : (
              <ul className="history" aria-label="Historial de precios">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <span>{formatDate(entry.observedAt)}</span>
                    <span>{entry.storeName}</span>
                    <strong>{formatPrice(entry.price)}</strong>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  );
}

type AddPriceFormProps = {
  productId: string;
  stores: Store[];
  storesError: string | null;
  onCreated: () => Promise<void>;
};

function AddPriceForm({ productId, stores, storesError, onCreated }: AddPriceFormProps) {
  const [storeId, setStoreId] = useState('');
  const [priceText, setPriceText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStoreId = storeId || stores[0]?.id || '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parsePrice(priceText);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    if (!selectedStoreId) {
      setError('Elige una tienda');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createPrice({ productId, storeId: selectedStoreId, price: parsed.price });
      setPriceText('');
      await onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="add-price" onSubmit={submit}>
      <h3>Registrar un precio</h3>
      {storesError && <p className="notice error">No se pudieron cargar las tiendas: {storesError}</p>}
      <div className="inline-form">
        <select
          aria-label="Tienda"
          value={selectedStoreId}
          onChange={(event) => setStoreId(event.target.value)}
          disabled={isSaving || stores.length === 0}
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
          placeholder="0,00 €"
          value={priceText}
          onChange={(event) => setPriceText(cleanPriceInput(event.target.value))}
          disabled={isSaving}
        />
        <button className="button primary" type="submit" disabled={isSaving || stores.length === 0}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        Si la tienda ya tenía precio, el nuevo pasa a ser el actual y el anterior queda en el
        historial.
      </p>
    </form>
  );
}

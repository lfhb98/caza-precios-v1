'use client';

import { formatPrice } from '@caza-precios/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { createProduct, errorMessage, searchProducts, type ProductSummary } from '@/lib/api';

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  pricesVersion: number;
};

export function ProductList({ selectedId, onSelect, pricesVersion }: Props) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  // Busca al dejar de escribir (250 ms) y descarta respuestas de búsquedas anteriores.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const items = await searchProducts(search);
        if (cancelled) return;
        setProducts(items);
        setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, pricesVersion, reloadKey]);

  const addProduct = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setNotice({ type: 'error', text: 'Escribe el nombre del producto.' });
      return;
    }

    setIsCreating(true);
    setNotice(null);
    try {
      const { product, existed } = await createProduct(name);
      setNewName('');
      setNotice({
        type: 'info',
        text: existed
          ? `"${product.name}" ya existía; te lo mostramos.`
          : `"${product.name}" añadido al catálogo.`,
      });
      setReloadKey((key) => key + 1);
      onSelect(product.id);
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setIsCreating(false);
    }
  };

  const trimmedSearch = search.trim();

  return (
    <section className="panel product-list" aria-labelledby="products-title">
      <h2 id="products-title">Productos</h2>

      <form className="inline-form" onSubmit={addProduct}>
        <input
          aria-label="Nombre del producto nuevo"
          placeholder="Nuevo producto (ej. Aceite)"
          value={newName}
          maxLength={100}
          onChange={(event) => setNewName(event.target.value)}
          disabled={isCreating}
        />
        <button className="button primary" type="submit" disabled={isCreating}>
          {isCreating ? 'Añadiendo…' : '+ Añadir'}
        </button>
      </form>
      {notice && (
        <p className={notice.type === 'error' ? 'notice error' : 'notice'} role="status">
          {notice.text}
        </p>
      )}

      <input
        type="search"
        aria-label="Buscar productos"
        placeholder="Buscar…"
        value={search}
        maxLength={100}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loadError && (
        <div className="notice error" role="alert">
          <span>{loadError}</span>
          <button className="link-button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="muted">Cargando…</p>
      ) : products.length === 0 ? (
        <p className="muted">
          {trimmedSearch ? `Ningún producto contiene "${trimmedSearch}".` : 'Aún no hay productos.'}
        </p>
      ) : (
        <ul className="product-items">
          {products.map((product) => (
            <li key={product.id}>
              <button
                className={product.id === selectedId ? 'product-item selected' : 'product-item'}
                aria-current={product.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(product.id)}
              >
                <span className="product-name">{product.name}</span>
                {product.cheapest ? (
                  <span className="cheapest-tag">
                    {formatPrice(product.cheapest.price)} · {product.cheapest.storeName}
                  </span>
                ) : (
                  <span className="muted small">Sin precios</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

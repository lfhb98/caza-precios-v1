'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorMessage, fetchStores, type Store } from '@/lib/api';
import { ProductDetail } from './product-detail';
import { ProductList } from './product-list';
import { StoresPanel } from './stores-panel';

type Tab = 'products' | 'stores';

// SPA: una sola página; las pestañas y el producto seleccionado son estado del cliente.
export function CazaPreciosApp() {
  const [tab, setTab] = useState<Tab>('products');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesError, setStoresError] = useState<string | null>(null);
  // Cambia cada vez que se crea, edita o borra un precio, para que la lista
  // recalcule el precio más barato de cada producto.
  const [pricesVersion, setPricesVersion] = useState(0);

  const loadStores = useCallback(async () => {
    try {
      setStores(await fetchStores());
      setStoresError(null);
    } catch (error) {
      setStoresError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">CazaPrecios 🛒</h1>
        <nav className="tabs" aria-label="Secciones">
          <button
            className={tab === 'products' ? 'tab active' : 'tab'}
            aria-current={tab === 'products' ? 'page' : undefined}
            onClick={() => setTab('products')}
          >
            Productos
          </button>
          <button
            className={tab === 'stores' ? 'tab active' : 'tab'}
            aria-current={tab === 'stores' ? 'page' : undefined}
            onClick={() => setTab('stores')}
          >
            Tiendas
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'products' ? (
          <div className={selectedId ? 'products-layout has-selection' : 'products-layout'}>
            <ProductList
              selectedId={selectedId}
              onSelect={setSelectedId}
              pricesVersion={pricesVersion}
            />
            {selectedId ? (
              <ProductDetail
                key={selectedId}
                productId={selectedId}
                stores={stores}
                storesError={storesError}
                onPricesChanged={() => setPricesVersion((version) => version + 1)}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <section className="panel detail-empty">
                <p className="muted">Elige un producto para ver y registrar sus precios.</p>
              </section>
            )}
          </div>
        ) : (
          <StoresPanel stores={stores} error={storesError} onChanged={loadStores} />
        )}
      </main>
    </div>
  );
}

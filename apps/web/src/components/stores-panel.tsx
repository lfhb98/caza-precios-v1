'use client';

import { useState, type FormEvent } from 'react';
import { createStore, errorMessage, type Store } from '@/lib/api';

type Props = {
  stores: Store[];
  error: string | null;
  onChanged: () => Promise<void>;
};

export function StoresPanel({ stores, error, onChanged }: Props) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setNotice({ type: 'error', text: 'Escribe el nombre de la tienda.' });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const { store, existed } = await createStore(name.trim());
      setName('');
      setNotice({
        type: existed ? 'error' : 'info',
        text: existed ? `Ya existe una tienda llamada "${store.name}".` : `"${store.name}" añadida.`,
      });
      await onChanged();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel stores-panel" aria-labelledby="stores-title">
      <h2 id="stores-title">Tiendas</h2>

      <form className="inline-form" onSubmit={submit}>
        <input
          aria-label="Nombre de la tienda nueva"
          placeholder="Nueva tienda (ej. Ahorramás)"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
        />
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? 'Añadiendo…' : '+ Añadir'}
        </button>
      </form>
      {notice && (
        <p className={notice.type === 'error' ? 'notice error' : 'notice'} role="status">
          {notice.text}
        </p>
      )}

      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
          <button className="link-button" onClick={onChanged}>
            Reintentar
          </button>
        </div>
      )}

      <ul className="store-items">
        {stores.map((store) => (
          <li key={store.id}>
            <span>📍 {store.name}</span>
            {store.isDefault && <span className="badge">precargada</span>}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Las tiendas son compartidas por todos los usuarios. Por ahora no se pueden renombrar ni
        borrar.
      </p>
    </section>
  );
}

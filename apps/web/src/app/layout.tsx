import { THEME } from '@caza-precios/shared';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'CazaPrecios',
  description: 'Compara lo que cuesta cada producto en cada supermercado.',
};

// Los colores de la marca vienen de @caza-precios/shared (los mismos que la app
// móvil) y se exponen como variables CSS: --bg, --primary, --cheapest...
const themeVariables = Object.fromEntries(
  Object.entries(THEME).map(([name, color]) => [`--${name}`, color])
) as CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={themeVariables}>
      <body>{children}</body>
    </html>
  );
}

# CazaPrecios

Comparador de precios de supermercado.

```
apps/
  mobile/        App Expo (iOS, Android)
packages/
  shared/        Tipos y constantes compartidos (@caza-precios/shared)
```

## Empezar

```bash
npm install          # desde la raíz: instala todos los workspaces
npm run mobile       # arranca Expo (equivale a `npx expo start` en apps/mobile)
npm run typecheck    # typecheck de todos los workspaces
```

Los comandos de Expo y EAS (`npx expo ...`, `npx eas-cli@latest ...`) se ejecutan dentro de `apps/mobile`.

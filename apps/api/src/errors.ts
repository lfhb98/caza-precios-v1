import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

// Códigos de error de PostgreSQL que traducimos a respuestas HTTP.
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

function postgresCode(error: unknown): string | undefined {
  // Drizzle envuelve el error del driver en `cause`.
  for (let current = error; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  switch (postgresCode(error)) {
    case UNIQUE_VIOLATION:
      return c.json({ error: 'Ya existe un registro con esos datos' }, 409);
    case FOREIGN_KEY_VIOLATION:
      return c.json({ error: 'El producto o la tienda no existen' }, 400);
    case CHECK_VIOLATION:
      return c.json({ error: 'Los datos no cumplen las reglas de la base de datos' }, 400);
  }

  console.error(error);
  return c.json({ error: 'Error interno del servidor' }, 500);
};

// Hook de @hono/zod-validator: respuesta 400 uniforme cuando la validación falla.
export function validationHook(
  result:
    | { success: true }
    | { success: false; error: { issues: readonly { path: PropertyKey[]; message: string }[] } },
  c: Context
) {
  if (!result.success) {
    return c.json(
      {
        error: 'Datos inválidos',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
      400
    );
  }
}

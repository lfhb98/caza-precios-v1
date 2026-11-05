import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireAuth, type AppEnv, type VerifyToken } from '../auth.js';
import type { Database } from '../db/client.js';
import { profiles } from '../db/schema.js';

export function meRoutes(db: Database, verifyToken: VerifyToken) {
  return new Hono<AppEnv>().use(requireAuth(verifyToken)).get('/', async (c) => {
    const [profile] = await db
      .select({ id: profiles.id, username: profiles.username, createdAt: profiles.createdAt })
      .from(profiles)
      .where(eq(profiles.id, c.get('user').id));
    // El trigger de registro crea el perfil; si falta, la cuenta no es de este proyecto.
    if (!profile) throw new HTTPException(404, { message: 'Perfil no encontrado' });
    return c.json(profile);
  });
}

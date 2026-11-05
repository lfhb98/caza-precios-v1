import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthUser {
  id: string;
}

export type VerifyToken = (token: string) => Promise<AuthUser>;

export type AppEnv = {
  Variables: { user: AuthUser };
};

export function createJwtVerifier(options: { keys: JWTVerifyGetKey; issuer: string }): VerifyToken {
  return async (token) => {
    const { payload } = await jwtVerify(token, options.keys, {
      issuer: options.issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) throw new Error('El token no tiene sub');
    return { id: payload.sub };
  };
}

// Tokens de Supabase Auth firmados con claves asimétricas (JWT Signing Keys).
// https://supabase.com/docs/guides/auth/jwts
export function createSupabaseVerifier(supabaseUrl: string): VerifyToken {
  const issuer = new URL('/auth/v1', supabaseUrl).toString();
  const keys = createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl));
  return createJwtVerifier({ keys, issuer });
}

export function requireAuth(verifyToken: VerifyToken) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      throw new HTTPException(401, { message: 'Falta el token de sesión' });
    }

    try {
      c.set('user', await verifyToken(token));
    } catch {
      throw new HTTPException(401, { message: 'Sesión inválida o caducada' });
    }

    await next();
  });
}

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createJwtVerifier, type VerifyToken } from '../src/auth.js';

// Simula las claves de firma de Supabase con un par de claves local.
const issuer = 'https://proyecto.supabase.co/auth/v1';
let privateKey: CryptoKey;
let verify: VerifyToken;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'clave-1', alg: 'ES256' };
  verify = createJwtVerifier({ keys: createLocalJWKSet({ keys: [jwk] }), issuer });
});

function token(claims: { sub?: string; aud?: string; iss?: string; exp?: string | Date } = {}) {
  const jwt = new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'clave-1' })
    .setIssuedAt()
    .setIssuer(claims.iss ?? issuer)
    .setAudience(claims.aud ?? 'authenticated')
    .setExpirationTime(claims.exp ?? '1h');
  if (claims.sub !== '') jwt.setSubject(claims.sub ?? 'b3f1c2d4-0000-4000-8000-000000000001');
  return jwt.sign(privateKey);
}

describe('verificación de tokens de Supabase', () => {
  it('acepta un token válido y devuelve el id del usuario', async () => {
    await expect(verify(await token())).resolves.toEqual({ id: 'b3f1c2d4-0000-4000-8000-000000000001' });
  });

  it('rechaza tokens de otro proyecto, otra audiencia, caducados o sin sub', async () => {
    await expect(verify(await token({ iss: 'https://otro.supabase.co/auth/v1' }))).rejects.toThrow();
    await expect(verify(await token({ aud: 'anon' }))).rejects.toThrow();
    await expect(verify(await token({ exp: new Date('2020-01-01T00:00:00Z') }))).rejects.toThrow();
    await expect(verify(await token({ sub: '' }))).rejects.toThrow();
  });

  it('rechaza un token manipulado', async () => {
    const [header, , signature] = (await token()).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'otro', aud: 'authenticated', iss: issuer })).toString('base64url');
    await expect(verify(`${header}.${forged}.${signature}`)).rejects.toThrow();
  });
});

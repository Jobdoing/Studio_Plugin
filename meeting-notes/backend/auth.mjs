// Adapted from Studio5 templates/backend-app/backend/node/server.mjs.
import { createPublicKey, verify } from 'node:crypto';

export function assertionVerifier(studioUrl, fetchImpl = fetch) {
  const origin = new URL(studioUrl).origin;
  let cache = null;
  let refreshed = 0;
  async function keys(force = false) {
    if (cache && Date.now() - refreshed < (force ? 60000 : 300000)) return cache;
    const response = await fetchImpl(`${origin}/.well-known/studio-plugin-jwks.json`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('JWKS_UNAVAILABLE');
    const body = await response.json();
    if (!Array.isArray(body.keys)) throw new Error('JWKS_UNAVAILABLE');
    cache = body.keys;
    refreshed = Date.now();
    return cache;
  }
  return async token => {
    try {
      if (typeof token !== 'string' || token.length > 16384 || token.split('.').length !== 3) throw new Error();
      const [headerPart, payloadPart, signature] = token.split('.');
      const header = JSON.parse(Buffer.from(headerPart, 'base64url'));
      const claims = JSON.parse(Buffer.from(payloadPart, 'base64url'));
      if (header.alg !== 'EdDSA') throw new Error();
      let jwk = (await keys()).find(key => key.kid === header.kid);
      if (!jwk) jwk = (await keys(true)).find(key => key.kid === header.kid);
      if (!jwk || !verify(null, Buffer.from(`${headerPart}.${payloadPart}`),
        createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new Error();
      const now = Date.now() / 1000;
      if (claims.aud !== 'meeting-notes' || !Number.isFinite(claims.exp) || claims.exp <= now
        || !Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.exp - claims.iat > 360
        || typeof claims.sub !== 'string' || !claims.sub
        || typeof claims.company?.id !== 'string' || !claims.company.id
        || typeof claims.project?.key !== 'string' || !claims.project.key) throw new Error();
      return JSON.stringify([claims.company.id, claims.project.key, claims.sub, claims.sandbox === true]);
    } catch { throw new Error('UNAUTHORIZED'); }
  };
}

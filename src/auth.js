// Sign-in state for the GitHub OAuth round trip. Stateless: the Worker stores nothing.
// state = base64url(payload).base64url(HMAC-SHA256); the nonce inside must also match a cookie, so a link
// someone else made cannot be replayed in your browser.

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function newNonce() {
  return b64u(crypto.getRandomValues(new Uint8Array(16)));
}

export async function signState(secret, repo, nonce, now = Date.now()) {
  const payload = b64u(enc.encode(JSON.stringify({ repo, nonce, exp: now + 10 * 60_000 })));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmac(secret), enc.encode(payload)));
  return `${payload}.${sig}`;
}

// -> { repo } or null
export async function verifyState(secret, state, cookieNonce, now = Date.now()) {
  try {
    const [payload, sig] = String(state).split('.');
    if (!payload || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmac(secret), unb64u(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    if (!cookieNonce || data.nonce !== cookieNonce || data.exp < now) return null;
    return { repo: data.repo };
  } catch {
    return null;
  }
}

export const nonceCookie = (nonce) => `rd_nonce=${nonce}; Path=/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
export const clearNonceCookie = 'rd_nonce=; Path=/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
export const readNonce = (cookieHeader) => /(?:^|;\s*)rd_nonce=([\w-]+)/.exec(cookieHeader || '')?.[1] || '';

export function authorizeUrl(clientId, redirectUri, state) {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'public_repo', state, allow_signup: 'false' }).toString();
  return u.toString();
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri, fetchImpl = fetch }) {
  const res = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'readme-diagram' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const json = await res.json().catch(() => ({}));
  return typeof json.access_token === 'string' ? json.access_token : null;
}

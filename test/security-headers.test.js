import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';
import { withSecurityHeaders } from '../src/security-headers.js';

const EXPECTED = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' https:; frame-src 'self' https:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self' https://analytics.flisk.si; base-uri 'self'; form-action 'self' https:",
};

test('home page, ready probe and 404 carry the baseline security headers', async () => {
  for (const path of ['/', '/ready', '/nope']) {
    const res = await worker.fetch(new Request('https://diagram.flisk.si' + path), {}, { waitUntil() {} });
    for (const [k, v] of Object.entries(EXPECTED)) assert.equal(res.headers.get(k), v, `${path} ${k}`);
  }
});

test('existing headers are kept and a CSP gains frame-ancestors', () => {
  const res = withSecurityHeaders(new Response('x', { headers: { 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'" } }));
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'self' https://analytics.flisk.si");
  const keep = withSecurityHeaders(new Response('x', { headers: { 'content-security-policy': 'frame-ancestors https://a.example' } }));
  assert.equal(keep.headers.get('content-security-policy'), 'frame-ancestors https://a.example');
});

test('the body stream passes through untouched', async () => {
  const src = new Response('abc', { headers: { 'content-type': 'image/svg+xml' } });
  const out = withSecurityHeaders(src);
  assert.equal(out.body, src.body);
  assert.equal(await out.text(), 'abc');
});

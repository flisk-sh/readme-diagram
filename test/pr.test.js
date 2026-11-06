import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signState, verifyState, newNonce, authorizeUrl, readNonce } from '../src/auth.js';
import worker from '../src/index.js';
import { PrError, createReadmePr, decodeB64Utf8, encodeUtf8B64, insertSnippet, snippetFor } from '../src/pr.js';

const ORIGIN = 'https://diagram.flisk.si';
const SNIP = snippetFor(ORIGIN, 'o/r');
const b64 = (s) => encodeUtf8B64(s);

// A tiny fake GitHub: records calls, answers from a route table.
function fakeGitHub(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = String(url).replace('https://api.github.com', '');
    const method = init.method || 'GET';
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.authorization });
    const key = Object.keys(routes).find((k) => k === `${method} ${path}` || (k.endsWith('*') && `${method} ${path}`.startsWith(k.slice(0, -1))));
    const r = key ? routes[key] : { status: 404, body: {} };
    const res = typeof r === 'function' ? r(calls.at(-1)) : r;
    return new Response(JSON.stringify(res.body ?? {}), { status: res.status ?? 200 });
  };
  return { calls, fetchImpl };
}

const readme = (text, path = 'README.md') => ({ status: 200, body: { path, sha: 'sha1', size: text.length, encoding: 'base64', content: b64(text) } });
const repoInfo = (over = {}) => ({ status: 200, body: { private: false, archived: false, default_branch: 'main', permissions: { push: false }, ...over } });

test('insertSnippet: after the first H1, at the top without one, idempotent, keeps CRLF and unicode', () => {
  assert.equal(insertSnippet('# T\n\nHello\n', SNIP, 'o/r'), `# T\n\n${SNIP}\n\nHello\n`);
  assert.equal(insertSnippet('no title here\n', SNIP, 'o/r'), `${SNIP}\n\nno title here\n`);
  assert.equal(insertSnippet(`# T\n\n${SNIP}\n`, SNIP, 'o/r'), null);
  assert.equal(insertSnippet('# T\r\n\r\nHi\r\n', SNIP, 'o/r'), `# T\r\n\r\n${SNIP}\r\n\r\nHi\r\n`);
  assert.ok(insertSnippet('# Привіт 🌍\n\nтекст\n', SNIP, 'o/r').includes('Привіт 🌍'));
  const late = `${'x\n'.repeat(20)}# Late title\n`;
  assert.ok(insertSnippet(late, SNIP, 'o/r').startsWith(SNIP), 'an H1 past line 15 is ignored');
});

test('base64: round-trips unicode and large text', () => {
  const t = 'héllo 🌍 '.repeat(20000);
  assert.equal(decodeB64Utf8(encodeUtf8B64(t)), t);
  // GitHub returns one base64 stream wrapped every 60 characters
  const wrapped = encodeUtf8B64('Hello, wrapped base64 from GitHub — ok 🌍').replace(/(.{20})/g, '$1\n');
  assert.equal(decodeB64Utf8(wrapped), 'Hello, wrapped base64 from GitHub — ok 🌍');
});

test('PR: a user without push access gets a fork, a branch, one commit and a cross-repo PR', async () => {
  const gh = fakeGitHub({
    'GET /user': { body: { login: 'alice' } },
    'GET /repos/o/r': repoInfo(),
    'POST /repos/o/r/forks': { status: 202, body: { full_name: 'alice/r' } },
    'GET /repos/alice/r': { body: {} },
    'POST /repos/alice/r/merge-upstream': { body: {} },
    'GET /repos/alice/r/readme?ref=main': readme('# T\n\nHello\n'),
    'GET /repos/alice/r/git/ref/heads/main': { body: { object: { sha: 'base123' } } },
    'POST /repos/alice/r/git/refs': { status: 201, body: {} },
    'PUT /repos/alice/r/contents/README.md': { body: {} },
    'POST /repos/o/r/pulls': { status: 201, body: { html_url: 'https://github.com/o/r/pull/7', number: 7 } },
  });
  const out = await createReadmePr({ token: 'tok', repo: 'o/r', origin: ORIGIN, fetchImpl: gh.fetchImpl, sleep: async () => {} });
  assert.deepEqual(out, { url: 'https://github.com/o/r/pull/7', number: 7, forked: true });
  const put = gh.calls.find((c) => c.method === 'PUT');
  assert.equal(put.body.sha, 'sha1');
  assert.match(put.body.branch, /^readme-diagram-/);
  assert.match(decodeB64Utf8(put.body.content), /^# T\n\n<p align="center"><img src="https:\/\/diagram\.flisk\.si\/o\/r\.svg"/);
  const pr = gh.calls.find((c) => c.path === '/repos/o/r/pulls');
  assert.equal(pr.body.head, `alice:${put.body.branch}`);
  assert.equal(pr.body.base, 'main');
  assert.match(pr.body.body, /Opened by @alice/);
  assert.ok(gh.calls.every((c) => c.auth === 'Bearer tok'));
});

test('PR: a maintainer with push access branches in the repo itself, no fork', async () => {
  const gh = fakeGitHub({
    'GET /user': { body: { login: 'bob' } },
    'GET /repos/o/r': repoInfo({ permissions: { push: true } }),
    'GET /repos/o/r/readme?ref=main': readme('# T\n'),
    'GET /repos/o/r/git/ref/heads/main': { body: { object: { sha: 'b' } } },
    'POST /repos/o/r/git/refs': { status: 201, body: {} },
    'PUT /repos/o/r/contents/README.md': { body: {} },
    'POST /repos/o/r/pulls': { status: 201, body: { html_url: 'u', number: 1 } },
  });
  const out = await createReadmePr({ token: 't', repo: 'o/r', origin: ORIGIN, fetchImpl: gh.fetchImpl });
  assert.equal(out.forked, false);
  assert.ok(!gh.calls.some((c) => c.path.endsWith('/forks')));
  assert.ok(!/:/.test(gh.calls.find((c) => c.path.endsWith('/pulls')).body.head));
});

test('PR: refusals are clear and nothing is written', async () => {
  const run = async (routes, repo = 'o/r') => {
    const gh = fakeGitHub({ 'GET /user': { body: { login: 'a' } }, ...routes });
    const err = await createReadmePr({ token: 't', repo, origin: ORIGIN, fetchImpl: gh.fetchImpl, sleep: async () => {} }).catch((e) => e);
    assert.ok(err instanceof PrError, String(err));
    assert.ok(!gh.calls.some((c) => ['PUT', 'POST'].includes(c.method)), 'wrote something');
    return err.code;
  };
  assert.equal(await run({}, 'not a repo'), 'bad-repo');
  assert.equal(await run({ 'GET /repos/o/r': { status: 404 } }), 'not-found');
  assert.equal(await run({ 'GET /repos/o/r': repoInfo({ private: true }) }), 'private');
  assert.equal(await run({ 'GET /repos/o/r': repoInfo({ archived: true }) }), 'archived');
  const pushable = repoInfo({ permissions: { push: true } });
  assert.equal(await run({ 'GET /repos/o/r': pushable, 'GET /repos/o/r/readme?ref=main': { status: 404 } }), 'no-readme');
  assert.equal(await run({ 'GET /repos/o/r': pushable, 'GET /repos/o/r/readme?ref=main': readme('x', 'README.rst') }), 'format');
  assert.equal(await run({ 'GET /repos/o/r': pushable, 'GET /repos/o/r/readme?ref=main': readme(`# T\n${SNIP}\n`) }), 'already');
});

test('PR: GitHub rejecting the sign-in token stops before anything else', async () => {
  const gh = fakeGitHub({ 'GET /user': { status: 401 } });
  const err = await createReadmePr({ token: 'bad', repo: 'o/r', origin: ORIGIN, fetchImpl: gh.fetchImpl }).catch((e) => e);
  assert.equal(err.code, 'auth');
  assert.equal(gh.calls.length, 1);
});

test('state: signed, expiring, bound to the cookie, tamper-proof', async () => {
  const n = newNonce();
  const s = await signState('secret', 'o/r', n, 1000);
  assert.deepEqual(await verifyState('secret', s, n, 2000), { repo: 'o/r' });
  assert.equal(await verifyState('other-secret', s, n, 2000), null);
  assert.equal(await verifyState('secret', s, 'another-nonce', 2000), null);
  assert.equal(await verifyState('secret', s, '', 2000), null);
  assert.equal(await verifyState('secret', s, n, 1000 + 11 * 60_000), null, 'expired');
  const [p, sig] = s.split('.');
  const forged = `${btoa(JSON.stringify({ repo: 'evil/x', nonce: n, exp: 9e15 })).replace(/=+$/, '')}.${sig}`;
  assert.equal(await verifyState('secret', forged, n, 2000), null);
  assert.equal(await verifyState('secret', 'garbage', n), null);
  assert.equal(await verifyState('secret', `${p}.`, n), null);
  assert.equal(readNonce('a=b; rd_nonce=abc-_9; c=d'), 'abc-_9');
  assert.equal(readNonce(''), '');
  assert.match(authorizeUrl('cid', `${ORIGIN}/auth/callback`, 's'), /scope=public_repo.*|client_id=cid/);
});

const ENV = { PUBLIC_ORIGIN: ORIGIN, GH_CLIENT_ID: 'cid', GH_CLIENT_SECRET: 'csec', STATE_SECRET: 'sss' };

test('routes: /auth/start sends you to GitHub with a signed state and a cookie', async () => {
  const res = await worker.fetch(new Request(`${ORIGIN}/auth/start?repo=${encodeURIComponent('https://github.com/o/r/')}`), ENV);
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'cid');
  assert.equal(loc.searchParams.get('scope'), 'public_repo');
  assert.equal(loc.searchParams.get('redirect_uri'), `${ORIGIN}/auth/callback`);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.deepEqual(await verifyState('sss', loc.searchParams.get('state'), readNonce(cookie)), { repo: 'o/r' });
  assert.ok(!res.headers.get('location').includes('csec'), 'secret never leaves');
});

test('routes: without credentials the PR flow is off and says so; the page hides the button', async () => {
  const res = await worker.fetch(new Request(`${ORIGIN}/auth/start?repo=o/r`), { PUBLIC_ORIGIN: ORIGIN });
  assert.equal(res.status, 503);
  assert.match(await res.text(), /not set up/);
  const page = await (await worker.fetch(new Request(`${ORIGIN}/o/r`), { PUBLIC_ORIGIN: ORIGIN })).text();
  assert.ok(!page.includes('Open a pull request for me'));
  const on = await (await worker.fetch(new Request(`${ORIGIN}/o/r`), ENV)).text();
  assert.match(on, /href="\/auth\/start\?repo=o\/r"/);
});

test('routes: /auth/callback rejects a missing, forged or cookie-less state', async () => {
  for (const [qs, cookie] of [['code=c', ''], ['code=c&state=junk', 'rd_nonce=x'], ['state=junk', '']]) {
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/callback?${qs}`, { headers: { cookie } }), ENV);
    assert.equal(res.status, 400, qs);
    assert.match(await res.text(), /expired or was not started here/);
  }
  const nonce = newNonce();
  const state = await signState('sss', 'o/r', nonce);
  const noCookie = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=c&state=${state}`), ENV);
  assert.equal(noCookie.status, 400, 'a valid state without the matching cookie is refused');
});

test('routes: /auth/callback end to end opens the PR and shows the link', async () => {
  const nonce = newNonce();
  const state = await signState('sss', 'o/r', nonce);
  const gh = fakeGitHub({
    'GET /user': { body: { login: 'bob' } },
    'GET /repos/o/r': repoInfo({ permissions: { push: true } }),
    'GET /repos/o/r/readme?ref=main': readme('# T\n'),
    'GET /repos/o/r/git/ref/heads/main': { body: { object: { sha: 'b' } } },
    'POST /repos/o/r/git/refs': { status: 201, body: {} },
    'PUT /repos/o/r/contents/README.md': { body: {} },
    'POST /repos/o/r/pulls': { status: 201, body: { html_url: 'https://github.com/o/r/pull/9', number: 9 } },
  });
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => (String(u) === 'https://github.com/login/oauth/access_token' ? new Response(JSON.stringify({ access_token: 'gho_x' })) : gh.fetchImpl(u, init));
  try {
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=abc&state=${state}`, { headers: { cookie: `rd_nonce=${nonce}` } }), ENV);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /Pull request opened/);
    assert.match(html, /https:\/\/github\.com\/o\/r\/pull\/9/);
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
    assert.ok(!html.includes('gho_x'), 'token never rendered');
    // the same state cannot be replayed without the cookie
    const again = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=abc&state=${state}`), ENV);
    assert.equal(again.status, 400);
  } finally {
    globalThis.fetch = real;
  }
});

test('routes: a GitHub refusal is shown as a plain message, not a crash', async () => {
  const nonce = newNonce();
  const state = await signState('sss', 'o/r', nonce);
  const gh = fakeGitHub({ 'GET /user': { body: { login: 'a' } }, 'GET /repos/o/r': repoInfo({ archived: true }) });
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => (String(u).startsWith('https://github.com/login') ? new Response(JSON.stringify({ access_token: 't' })) : gh.fetchImpl(u, init));
  try {
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=c&state=${state}`, { headers: { cookie: `rd_nonce=${nonce}` } }), ENV);
    assert.equal(res.status, 422);
    assert.match(await res.text(), /archived/);
  } finally {
    globalThis.fetch = real;
  }
});

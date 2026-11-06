import { loadRepo, readmeEditUrl, validRepo } from './github.js';
import { buildModel, quality } from './model.js';
import { parseRepoInput } from './repo-input.js';
import { renderSvg } from './render.js';
import { authorizeUrl, clearNonceCookie, exchangeCode, newNonce, nonceCookie, readNonce, signState, verifyState } from './auth.js';
import { ICON, donePage, page, resultPage } from './page.js';
import { PrError, createReadmePr } from './pr.js';

const SVG = { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400', 'access-control-allow-origin': '*' };

// Bump when the renderer changes: it is part of the edge-cache key, so old diagrams are not served for a day.
export const RENDER_VERSION = '12';

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const origin = env.PUBLIC_ORIGIN || url.origin;

    if (url.pathname === '/ready') return new Response('ok');
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(page(origin), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const oauth = Boolean(env.GH_CLIENT_ID && env.GH_CLIENT_SECRET && env.STATE_SECRET);
    const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra } });

    if (url.pathname === '/auth/start' && request.method === 'GET') {
      const repo = parseRepoInput(url.searchParams.get('repo') || '');
      if (!oauth) return html(donePage(origin, { repo, error: 'Pull requests are not set up on this server yet. Use the copy button instead.' }), 503);
      if (!repo) return html(donePage(origin, { error: 'Enter a GitHub repo first.' }), 400);
      const nonce = newNonce();
      const state = await signState(env.STATE_SECRET, repo, nonce);
      return new Response(null, { status: 302, headers: { location: authorizeUrl(env.GH_CLIENT_ID, `${origin}/auth/callback`, state), 'set-cookie': nonceCookie(nonce), 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      if (!oauth) return html(donePage(origin, { error: 'Pull requests are not set up on this server yet.' }), 503);
      const verified = await verifyState(env.STATE_SECRET, url.searchParams.get('state'), readNonce(request.headers.get('cookie')));
      const clear = { 'set-cookie': clearNonceCookie };
      if (!verified) return html(donePage(origin, { error: 'That sign-in link expired or was not started here. Start again from the diagram page.' }), 400, clear);
      const code = url.searchParams.get('code');
      if (!code) return html(donePage(origin, { repo: verified.repo, error: 'GitHub sign-in was cancelled.' }), 400, clear);
      const token = await exchangeCode({ clientId: env.GH_CLIENT_ID, clientSecret: env.GH_CLIENT_SECRET, code, redirectUri: `${origin}/auth/callback` });
      if (!token) return html(donePage(origin, { repo: verified.repo, error: 'GitHub did not complete the sign-in. Try again.' }), 400, clear);
      try {
        const pr = await createReadmePr({ token, repo: verified.repo, origin });
        return html(donePage(origin, { repo: verified.repo, url: pr.url, forked: pr.forked }), 200, clear);
      } catch (e) {
        const msg = e instanceof PrError ? e.message : 'Something went wrong talking to GitHub.';
        return html(donePage(origin, { repo: verified.repo, error: msg }), e instanceof PrError ? 422 : 502, clear);
      }
    }
    if (url.pathname === '/icon.svg') return new Response(ICON, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
    if (url.pathname === '/check' && request.method === 'GET') {
      const raw = url.searchParams.get('repo') || '';
      const repo = parseRepoInput(raw);
      if (!repo) {
        const error = 'Enter a GitHub repo like owner/repo or paste its URL.';
        return new Response(page(origin, { error, value: raw.slice(0, 200) }), { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      return Response.redirect(`${origin}/${repo}`, 302);
    }
    if (url.pathname === '/render' && request.method === 'POST') {
      const md = await request.text();
      if (md.length > 400_000) return new Response('README too large', { status: 413 });
      return new Response(renderSvg(buildModel(md)), { headers: { ...SVG, 'cache-control': 'no-store' } });
    }
    const pm = url.pathname.match(/^\/([^/]+)\/([^/.][^/]*)$/);
    if (pm && request.method === 'GET' && !/\.(svg|json)$/.test(pm[2])) {
      if (!validRepo(pm[1], pm[2])) return new Response('bad repo', { status: 400 });
      const edit = await readmeEditUrl(pm[1], pm[2], { token: env.GITHUB_TOKEN });
      return new Response(resultPage(origin, `${pm[1]}/${pm[2]}`, edit, { oauth }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+?)\.(svg|json)$/);
    if (m && request.method === 'GET') {
      const [, owner, repo, ext] = m;
      if (!validRepo(owner, repo)) return new Response('bad repo', { status: 400 });
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const key = new Request(`${url.origin}${url.pathname}?rv=${RENDER_VERSION}`);
      const hit = cache && (await cache.match(key));
      if (hit) return hit;
      const loaded = await loadRepo(owner, repo, { token: env.GITHUB_TOKEN });
      if (loaded.error) return new Response(loaded.error, { status: loaded.error === 'not-found' ? 404 : 502 });
      const model = buildModel(loaded.readme, loaded.files, `${owner}/${repo}`, loaded.pkg);
      const q = quality(model);
      const res = ext === 'json'
        ? new Response(JSON.stringify(q), { headers: { ...SVG, 'content-type': 'application/json' } })
        : new Response(renderSvg(model), { headers: { ...SVG, 'x-diagram-quality': q.ok ? 'good' : 'thin' } });
      if (cache && ctx) ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }
    return new Response('not found', { status: 404 });
  },
};

import { loadRepo, readmeEditUrl, validRepo } from './github.js';
import { buildModel, quality } from './model.js';
import { parseRepoInput } from './repo-input.js';
import { renderSvg } from './render.js';
import { ICON, page, resultPage } from './page.js';

const SVG = { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400', 'access-control-allow-origin': '*' };

// Bump when the renderer changes: it is part of the edge-cache key, so old diagrams are not served for a day.
export const RENDER_VERSION = '5';

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const origin = env.PUBLIC_ORIGIN || url.origin;

    if (url.pathname === '/ready') return new Response('ok');
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(page(origin), { headers: { 'content-type': 'text/html; charset=utf-8' } });
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
      return new Response(resultPage(origin, `${pm[1]}/${pm[2]}`, edit), { headers: { 'content-type': 'text/html; charset=utf-8' } });
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
      const model = buildModel(loaded.readme, loaded.files, repo);
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

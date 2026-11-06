import { loadRepo, validRepo } from './github.js';
import { buildModel } from './model.js';
import { renderSvg } from './render.js';
import { page } from './page.js';

const SVG = { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400', 'access-control-allow-origin': '*' };

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    const origin = env.PUBLIC_ORIGIN || url.origin;

    if (url.pathname === '/ready') return new Response('ok');
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(page(origin), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/render' && request.method === 'POST') {
      const md = await request.text();
      if (md.length > 400_000) return new Response('README too large', { status: 413 });
      return new Response(renderSvg(buildModel(md)), { headers: { ...SVG, 'cache-control': 'no-store' } });
    }
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+?)\.svg$/);
    if (m && request.method === 'GET') {
      const [, owner, repo] = m;
      if (!validRepo(owner, repo)) return new Response('bad repo', { status: 400 });
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const hit = cache && (await cache.match(request));
      if (hit) return hit;
      const loaded = await loadRepo(owner, repo, { token: env.GITHUB_TOKEN });
      if (loaded.error) return new Response(loaded.error, { status: loaded.error === 'not-found' ? 404 : 502 });
      const res = new Response(renderSvg(buildModel(loaded.readme, loaded.files, repo)), { headers: SVG });
      if (cache && ctx) ctx.waitUntil(cache.put(request, res.clone()));
      return res;
    }
    return new Response('not found', { status: 404 });
  },
};

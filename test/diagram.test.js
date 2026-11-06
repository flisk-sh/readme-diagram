import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../src/index.js';
import { detect } from '../src/detect.js';
import { buildModel } from '../src/model.js';
import { parseReadme } from '../src/parse.js';
import { renderSvg } from '../src/render.js';

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.md`, import.meta.url), 'utf8');

test('parse: title, tagline, sections, shell commands', () => {
  const p = parseReadme(fx('fullstack'));
  assert.equal(p.title, 'Shop');
  assert.match(p.tagline, /online shop/);
  assert.deepEqual(p.sections.map((s) => s.title), ['Quick start', 'Stack']);
  assert.deepEqual(p.commands, ['docker compose up', 'npm install']);
});

test('parse: ignores headings inside code fences and handles CRLF', () => {
  const p = parseReadme('# A\r\n\r\n```bash\r\n# comment\r\nls\r\n```\r\n## B\r\n');
  assert.deepEqual(p.sections.map((s) => s.title), ['B']);
  assert.deepEqual(p.commands, ['ls']);
});

test('parse: empty and non-string input do not throw', () => {
  for (const v of ['', null, undefined]) assert.equal(parseReadme(v).sections.length, 0);
});

test('detect: finds languages, frameworks, services and files', () => {
  const d = detect(parseReadme(fx('fullstack')));
  assert.ok(d.languages.includes('TypeScript') && d.languages.includes('Python'));
  assert.ok(d.frameworks.includes('React') && d.frameworks.includes('FastAPI'));
  assert.ok(d.services.includes('Postgres') && d.services.includes('Redis') && d.services.includes('Docker'));
  assert.ok(d.files.includes('docker-compose.yml') && d.files.includes('Dockerfile'));
});

test('detect: repo file names add signals', () => {
  const d = detect(parseReadme('# x'), ['Cargo.toml', 'wrangler.toml']);
  assert.ok(d.languages.includes('Rust'));
  assert.ok(d.files.includes('wrangler.toml'));
});

test('model: deterministic', () => {
  assert.deepEqual(buildModel(fx('fullstack')), buildModel(fx('fullstack')));
});

test('render: valid-looking, animated, bounded size', () => {
  const svg = renderSvg(buildModel(fx('fullstack')));
  assert.match(svg, /^<svg [^>]*viewBox="0 0 1080 400"/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.match(svg, /@keyframes m0/);
  assert.match(svg, /prefers-color-scheme: dark/);
  assert.ok(svg.length < 60_000, `svg is ${svg.length} bytes`);
  assert.equal((svg.match(/<svg /g) ?? []).length, 1);
});

test('render: minimal README still produces a complete diagram', () => {
  const svg = renderSvg(buildModel(fx('minimal')));
  assert.match(svg, /<\/svg>\s*$/);
  assert.match(svg, /no shell commands found/);
});

test('render: hostile README text is escaped', () => {
  const svg = renderSvg(buildModel(fx('hostile')));
  assert.ok(!/<script/i.test(svg), 'no script tag');
  assert.ok(!/onerror=/i.test(svg.replace(/&lt;[^&]*&gt;/g, '')) || !/<img/i.test(svg));
  assert.match(svg, /&amp;|&quot;/);
});

test('render: golden snapshot of fullstack', () => {
  const svg = renderSvg(buildModel(fx('fullstack')));
  const golden = new URL('./fixtures/fullstack.svg', import.meta.url);
  if (process.env.UPDATE_GOLDEN) return void import('node:fs').then((f) => f.writeFileSync(golden, svg));
  assert.equal(svg, readFileSync(golden, 'utf8'));
});

test('worker: POST /render returns an svg', async () => {
  const res = await worker.fetch(new Request('https://x/render', { method: 'POST', body: fx('fullstack') }), {});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await res.text(), /^<svg /);
});

test('worker: bad repo names are rejected before any fetch', async () => {
  const res = await worker.fetch(new Request('https://x/..%2Fevil/repo.svg'), {});
  assert.ok([400, 404].includes(res.status));
});

test('worker: landing page and /ready', async () => {
  const home = await worker.fetch(new Request('https://x/'), { PUBLIC_ORIGIN: 'https://diagram.flisk.si' });
  assert.match(await home.text(), /diagram\.flisk\.si/);
  assert.equal((await worker.fetch(new Request('https://x/ready'), {})).status, 200);
  assert.equal((await worker.fetch(new Request('https://x/nope'), {})).status, 404);
});

test('render: long tagline is clipped to fit the hero card', () => {
  const svg = renderSvg(buildModel(`# T\n\n${'word '.repeat(40)}\n`));
  const head = svg.match(/class="head" x="266" y="53">([^<]*)</)[1];
  assert.ok(head.length <= 46, head);
});

test('github: falls back to raw.githubusercontent when the API is rate-limited', async () => {
  const { loadRepo } = await import('../src/github.js');
  const calls = [];
  const fetchImpl = async (u) => {
    calls.push(u);
    if (u.startsWith('https://api.github.com')) return new Response('limit', { status: 403 });
    return new Response('# Hi\n', { status: 200 });
  };
  const r = await loadRepo('a', 'b', { fetchImpl });
  assert.equal(r.readme, '# Hi\n');
  assert.ok(calls.some((u) => u.includes('raw.githubusercontent.com/a/b/HEAD/README.md')));
});

test('github: 404 stays not-found', async () => {
  const { loadRepo } = await import('../src/github.js');
  const r = await loadRepo('a', 'b', { fetchImpl: async () => new Response('', { status: 404 }) });
  assert.equal(r.error, 'not-found');
});

test('repo input: accepts owner/repo and every pasted GitHub URL shape', async () => {
  const { parseRepoInput: p } = await import('../src/repo-input.js');
  for (const v of ['flisk-sh/flisk', ' flisk-sh/flisk ', 'github.com/flisk-sh/flisk', 'https://github.com/flisk-sh/flisk/', 'https://www.github.com/flisk-sh/flisk.git', 'https://github.com/flisk-sh/flisk/tree/main/docs?x=1#y', 'git@github.com:flisk-sh/flisk.git']) {
    assert.equal(p(v), 'flisk-sh/flisk', v);
  }
  for (const v of ['', 'flisk', 'https://github.com/', '../x', 'a b/c', null, undefined, 'https://example.com/a/b/c<']) assert.equal(p(v), '', String(v));
});

test('page: ships the parser to the browser and never builds a double URL', async () => {
  const { page } = await import('../src/page.js');
  const html = page('https://diagram.flisk.si');
  assert.match(html, /function parseRepoInput/);
  assert.match(html, /'https:\/\/diagram\.flisk\.si\/'\+repo\+'\.svg'/);
});
